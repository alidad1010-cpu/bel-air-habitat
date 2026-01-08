const https = require('https');

const API_BASE = 'https://us-central1-bel-air-habitat.cloudfunctions.net';
const CREDENTIALS = {
  email: 'contact@belairhabitat.com',
  password: 'Epinay786@',
};

function makeRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data }); // Fallback for non-JSON
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING FUNCTION CHECK ---\n');

  // 1. Test getEmails
  console.log('Testing getEmails (INBOX)...');
  try {
    const res = await makeRequest('/getEmails', 'POST', {
      ...CREDENTIALS,
      mailbox: 'INBOX',
    });
    if (res.status === 200 && res.data.success) {
      console.log(
        `✅ getEmails [INBOX]: Functioning. Fetched ${res.data.emails ? res.data.emails.length : 0} emails.`
      );
    } else {
      console.error(`❌ getEmails [INBOX]: Failed. Status: ${res.status}`, res.data);
    }
  } catch (e) {
    console.error('❌ getEmails [INBOX]: Network Error', e.message);
  }

  // 2. Test sendEmail (Dry run - effectively checking auth)
  // We won't actually send to a random address to avoid spam, but we can try sending to self.
  // However, if we just want to check if function is ALIVE, we can send missing params causing a 400 or 500 but verifying validity.
  // Or send to self.
  console.log('\nTesting sendEmail (Auth Check)...');
  try {
    // Sending to self to verify SMTP auth works without spamming others
    const res = await makeRequest('/sendEmail', 'POST', {
      ...CREDENTIALS,
      to: 'contact@belairhabitat.com',
      subject: 'Test Automated Check',
      text: 'This is a test to verify the sendEmail function is healthy.',
    });

    if (res.status === 200 && res.data.success) {
      console.log('✅ sendEmail: Functioning. Email accepted by SMTP server.');
    } else {
      console.error(`❌ sendEmail: Failed. Status: ${res.status}`, res.data);
    }
  } catch (e) {
    console.error('❌ sendEmail: Network Error', e.message);
  }

  // 3. Test proxyTiime (Simple Ping)
  console.log('\nTesting proxyTiime (Ping)...');
  try {
    // This is a GET proxy.
    const url = new URL('/proxyTiime', API_BASE);
    // Just see if it returns 200/404 or crashes
    // We'll pass a dummy url query if needed or just hit base

    // Using simplified https get for GET request
    const req = https.get(url.toString(), (res) => {
      console.log(
        `ℹ️ proxyTiime Status: ${res.statusCode} (Expected 200 or 400/500 if upstream fails, but function is reachable)`
      );
      // We consider it working if we get a response, even if upstream Tiime blocks it.
      if (res.statusCode === 200) console.log('✅ proxyTiime: Reachable.');
    });
    req.on('error', (e) => console.error('❌ proxyTiime: Unreachable', e.message));
  } catch (e) {}

  console.log('\n--- CHECK COMPLETE ---');
}

runTests();
