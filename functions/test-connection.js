const imap = require('imap-simple');

const config = {
  imap: {
    user: 'contact@belairhabitat.com',
    password: 'Epinay786@',
    host: 'imap.one.com',
    port: 993,
    tls: true,
    authTimeout: 10000,
    tlsOptions: { rejectUnauthorized: false },
  },
};

async function testConnection() {
  console.log('Testing IMAP connection...');
  try {
    const connection = await imap.connect(config);
    console.log('CONNECTION SUCCESSFUL!');
    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('CONNECTION FAILED:', error);
    process.exit(1);
  }
}

testConnection();
