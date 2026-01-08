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

    const boxes = ['INBOX.Spam', 'INBOX.Sent'];

    for (const box of boxes) {
      console.log(`\n--- Checking ${box} ---`);
      await connection.openBox(box);

      const date = new Date();
      date.setDate(date.getDate() - 30);
      const searchCriteria = [['SINCE', date]];
      const fetchOptions = {
        bodies: ['HEADER'],
        markSeen: false,
        struct: true,
      };

      console.log(`Searching SINCE ${date.toISOString()}...`);
      const messages = await connection.search(searchCriteria, fetchOptions);
      console.log(`Found ${messages.length} messages (last 30 days).`);

      if (messages.length > 0) {
        // Sort and show top 3
        messages.sort((a, b) => {
          const hA = a.parts.find((p) => p.which === 'HEADER').body;
          const hB = b.parts.find((p) => p.which === 'HEADER').body;
          const dA = hA.date ? new Date(hA.date[0]) : new Date(0);
          const dB = hB.date ? new Date(hB.date[0]) : new Date(0);
          return dB - dA;
        });

        messages.slice(0, 3).forEach((m) => {
          const h = m.parts.find((p) => p.which === 'HEADER').body;
          console.log(` - ${h.date[0]}: ${h.subject[0]}`);
        });
      } else {
        // Try search ALL to see if it's a DATE issue
        console.log('Searching ALL (limit 5)...');
        const allMsgs = await connection.search([['ALL']], { bodies: ['HEADER'], markSeen: false });
        console.log(`ALL found ${allMsgs.length}. Showing last 2:`);
        allMsgs.slice(-2).forEach((m) => {
          const h = m.parts.find((p) => p.which === 'HEADER').body;
          console.log(` - ${h.date[0]}: ${h.subject[0]}`);
        });
      }
    }

    connection.end();
  } catch (e) {
    console.error(e);
  }
}

run();
