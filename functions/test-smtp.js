const nodemailer = require('nodemailer');

const config = {
  host: 'send.one.com',
  port: 465,
  secure: true,
  auth: {
    user: 'contact@belairhabitat.com',
    pass: 'Epinay786@',
  },
};

const transporter = nodemailer.createTransport(config);

async function testSMTP() {
  console.log('Testing SMTP connection...');
  try {
    await transporter.verify();
    console.log('SMTP CONNECTION SUCCESSFUL!');
    process.exit(0);
  } catch (error) {
    console.error('SMTP CONNECTION FAILED:', error);
    process.exit(1);
  }
}

testSMTP();
