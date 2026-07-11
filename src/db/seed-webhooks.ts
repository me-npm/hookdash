import { createHmac } from 'node:crypto';

const STRIPE_SECRET = 'whsec_test_secret_stripe';
const GITHUB_SECRET = 'ghsec_test_secret_github';

async function sendStripeWebhook() {
  const body = JSON.stringify({
    id: 'evt_123',
    object: 'event',
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: 'pi_123',
        amount: 2000,
        currency: 'usd',
        status: 'succeeded',
      }
    }
  });

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signedPayload = `${timestamp}.${body}`;
  const hmac = createHmac('sha256', STRIPE_SECRET).update(signedPayload).digest('hex');
  const signatureHeader = `t=${timestamp},v1=${hmac}`;

  try {
    const res = await fetch('http://localhost:9090/webhook/stripe-payments', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'Stripe-Signature': signatureHeader,
      },
      body,
    });
    console.log('Stripe webhook response:', res.status, await res.text());
  } catch (err: any) {
    console.error('Stripe webhook failed:', err.message);
  }
}

async function sendGithubWebhook() {
  const body = JSON.stringify({
    ref: 'refs/heads/main',
    before: '0000000000000000000000000000000000000000',
    after: '1ab6c0d8df30299fba5ec5a497b5bb50d8df3029',
    repository: {
      name: 'hookdash',
      full_name: 'me-npm/hookdash',
    },
    pusher: {
      name: 'ahmerarain',
      email: 'ahmer@example.com',
    }
  });

  const hmac = createHmac('sha256', GITHUB_SECRET).update(body).digest('hex');
  const signatureHeader = `sha256=${hmac}`;

  try {
    const res = await fetch('http://localhost:9090/webhook/github-ci', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': signatureHeader,
        'x-github-event': 'push',
      },
      body,
    });
    console.log('GitHub webhook response:', res.status, await res.text());
  } catch (err: any) {
    console.error('GitHub webhook failed:', err.message);
  }
}

async function main() {
  console.log('Sending mock webhooks to local hookdash ingestion endpoint...');
  await sendStripeWebhook();
  await sendGithubWebhook();
  console.log('Done seeding webhooks.');
}

main();
