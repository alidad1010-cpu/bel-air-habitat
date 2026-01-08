const imap = require('imap-simple');

const config = {
  imap: {
    user: 'contact@belairhabitat.com',
    password: 'Epinay786@',
    host: 'imap.one.com',
    port: 993,
    tls: true,
    authTimeout: 30000,
    tlsOptions: { rejectUnauthorized: false },
  },
};

async function run() {
  try {
    console.log('Connecting...');
    const connection = await imap.connect(config);
    console.log('Connected.');

    const boxesToCheck = [
      'INBOX',
      'INBOX.Trash',
      'INBOX.Spam',
      'INBOX.Sent',
      'INBOX.Sent Messages',
    ];

    for (const boxName of boxesToCheck) {
      try {
        // Must use quotes if spaces? imap-simple handles it usually.
        await connection.openBox(boxName);

        // Search ALL to get count
        // We use SINCE to limit huge fetch if any
        const date = new Date();
        date.setFullYear(date.getFullYear() - 1); // Last 1 year

        const results = await connection.search([['SINCE', date]], {
          bodies: ['HEADER'],
          markSeen: false,
        });
        console.log(`Folder "${boxName}": ${results.length} messages (last 1 year).`);
      } catch (e) {
        console.log(`Folder "${boxName}": ERROR - ${e.message}`);
      }
    }

    connection.end();
  } catch (e) {
    console.error(e);
  }
}

run();
