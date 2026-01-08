const functions = require('firebase-functions');
const admin = require('firebase-admin');
const imap = require('imap-simple');
const { simpleParser } = require('mailparser');
const nodemailer = require('nodemailer');
const cors = require('cors')({ origin: true });
const axios = require('axios');

admin.initializeApp();

// proxyTiime removed

// --- EMAIL FETCHING (One.com) ---
exports.getEmails = functions
  .runWith({ timeoutSeconds: 60, memory: '1GB' })
  .https.onRequest((req, res) => {
    cors(req, res, async () => {
      if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
      const { email, password, mailbox = 'INBOX' } = req.body;

      console.log(`Attempting to fetch emails for ${email} in ${mailbox}`);

      if (!email || !password) return res.status(400).json({ error: 'Requis: email, password.' });

      // Map Special Folders
      let targetBox = mailbox;
      if (mailbox === 'Junk') targetBox = 'INBOX.Spam';
      if (mailbox === 'Trash') targetBox = 'INBOX.Trash';
      if (mailbox === 'Sent') targetBox = 'INBOX.Sent';

      const config = {
        imap: {
          user: email,
          password: password,
          host: 'imap.one.com',
          port: 993,
          tls: true,
          authTimeout: 10000, // Reduced to fail faster
          tlsOptions: { rejectUnauthorized: false },
        },
      };

      try {
        const connection = await imap.connect(config);
        console.log('IMAP Connected');

        try {
          await connection.openBox(targetBox);
        } catch (e) {
          console.warn(`Folder ${targetBox} failed, trying ${mailbox}`, e.message);
          try {
            await connection.openBox(mailbox);
          } catch (e2) {
            throw new Error(`Dossier introuvable: ${mailbox}`);
          }
        }

        // Fetch Recent Headers
        const date = new Date();
        date.setDate(date.getDate() - 30);
        const searchCriteria = [['SINCE', date]];
        // Order By Date Descending
        const fetchOptions = {
          bodies: ['HEADER', 'TEXT', ''],
          markSeen: false,
          struct: true,
        };

        console.log('Searching messages...');
        const messages = await connection.search(searchCriteria, fetchOptions);
        console.log(`Found ${messages.length} messages. Sorting...`);

        // Sort in memory (IMAP default order is ID, usually chronological)
        const sortedMessages = messages
          .sort((a, b) => {
            const dateA = a.attributes.date ? new Date(a.attributes.date) : new Date(0);
            const dateB = b.attributes.date ? new Date(b.attributes.date) : new Date(0);
            return dateB - dateA;
          })
          .slice(0, 20); // Reduce to 20 for stability

        const results = await Promise.all(
          sortedMessages.map(async (item) => {
            const fullBodyPart = item.parts.find((p) => p.which === '');
            if (fullBodyPart) {
              try {
                const parsed = await simpleParser(fullBodyPart.body);
                return {
                  id: item.attributes.uid,
                  from: parsed.from?.text || 'Inconnu',
                  subject: parsed.subject || '(Sans objet)',
                  date: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
                  preview: parsed.text ? parsed.text.substring(0, 100) + '...' : '...',
                  read: item.attributes.flags?.includes('\\Seen'),
                  html: parsed.html || parsed.textAsHtml || parsed.text || '',
                };
              } catch (e) {
                return null;
              }
            }
            return null;
          })
        );

        connection.end();
        return res.status(200).json({ success: true, emails: results.filter((r) => r) });
      } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
      }
    });
  });

// --- EMAIL SENDING ---
exports.sendEmail = functions.runWith({ timeoutSeconds: 60 }).https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    const { email, password, to, subject, html, text } = req.body;

    const transporter = nodemailer.createTransport({
      host: 'send.one.com',
      port: 587,
      secure: false,
      auth: { user: email, pass: password },
      tls: { rejectUnauthorized: false },
    });

    try {
      await transporter.sendMail({
        from: email,
        to,
        subject,
        html,
        text: text || 'Voir version HTML',
      });
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });
});

// --- NOTIFICATIONS & TRIGGERS ---
async function createInAppNotification(title, message, type = 'INFO', projectId = null) {
  try {
    await admin.firestore().collection('notifications').add({
      title,
      message,
      type,
      projectId,
      date: admin.firestore.FieldValue.serverTimestamp(),
      read: false,
      targetUser: 'ADMIN',
    });
  } catch (e) {
    console.error(e);
  }
}

exports.notifyNewDossier = functions.firestore
  .document('projects/{projectId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    await createInAppNotification(
      'Nouveau Dossier',
      `Dossier "${data.title}" créé.`,
      'INFO',
      context.params.projectId
    );
  });

exports.notifyNewClient = functions.firestore
  .document('clients/{clientId}')
  .onCreate(async (snap) => {
    const data = snap.data();
    await createInAppNotification('Nouveau Client', `Client "${data.name}" ajouté.`, 'INFO');
  });

exports.notifyDossierClosure = functions.firestore
  .document('projects/{projectId}')
  .onUpdate(async (change, context) => {
    const newData = change.after.data();
    const oldData = change.before.data();
    if (newData.status !== oldData.status && ['TERMINE', 'PERDU'].includes(newData.status)) {
      await createInAppNotification(
        'Dossier Clôturé',
        `Le dossier "${newData.title}" est ${newData.status}.`,
        'WARNING',
        context.params.projectId
      );
    }
  });

exports.notifyTeamMessage = functions.firestore
  .document('team_messages/{msgId}')
  .onCreate(async (snap) => {
    const data = snap.data();
    await createInAppNotification('Message Équipe', `${data.authorName}: ${data.content}`, 'INFO');
  });

exports.checkDevisReminders = functions.pubsub.schedule('every 1 hours').onRun(async (context) => {
  const now = Date.now();
  const snapshot = await admin
    .firestore()
    .collection('projects')
    .where('status', 'in', ['NOUVEAU', 'EN_COURS', 'NEW', 'IN_PROGRESS'])
    .get();

  const batch = admin.firestore().batch();
  let updates = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const hasDevis = data.documents?.some(
      (d) => d.type?.toUpperCase().includes('DEVIS') || d.name?.toUpperCase().includes('DEVIS')
    );
    if (hasDevis) continue;

    const created = data.createdAt?.toDate ? data.createdAt.toDate().getTime() : data.createdAt;
    if (!created) continue;

    const hours = (now - created) / 36e5;
    const flags = data.notificationFlags || {};
    let changed = false;

    if (hours >= 24 && !flags.h24) {
      await createInAppNotification(
        'Relance Devis (24h)',
        `Dossier "${data.title}" sans devis.`,
        'WARNING',
        doc.id
      );
      flags.h24 = true;
      changed = true;
    } else if (hours >= 48 && !flags.h48) {
      await createInAppNotification(
        'Relance Devis (48h)',
        `URGENT: Dossier "${data.title}" sans devis.`,
        'WARNING',
        doc.id
      );
      flags.h48 = true;
      changed = true;
    } else if (hours >= 72 && !flags.h72) {
      await createInAppNotification(
        'Relance Devis (72h)',
        `CRITIQUE: Dossier "${data.title}" sans devis.`,
        'ALERT',
        doc.id
      );
      flags.h72 = true;
      changed = true;
    }

    if (changed) {
      batch.update(doc.ref, { notificationFlags: flags });
      updates++;
    }
  }
  if (updates) await batch.commit();
});
