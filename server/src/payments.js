import crypto from 'node:crypto';

export function paymentKeys() {
  const keyId = String(process.env.RAZORPAY_KEY_ID || '').trim();
  const secret = String(process.env.RAZORPAY_KEY_SECRET || '').trim();
  return keyId && secret ? { keyId, secret } : null;
}

export function demoEnabled() {
  if (paymentKeys()) return false;
  const flag = String(process.env.DEMO_PAYMENTS || '').toLowerCase();
  return flag === 'true' || flag === '1';
}

export function paymentMode() {
  const keys = paymentKeys();
  if (keys?.keyId.startsWith('rzp_live_')) return 'live';
  if (keys?.keyId.startsWith('rzp_test_')) return 'test';
  if (keys) return 'on';
  if (demoEnabled()) return 'demo';
  return 'off';
}

export async function createRazorpayOrder({ amountPaise, receipt, notes }) {
  const keys = paymentKeys();
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${keys.keyId}:${keys.secret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: notes || {},
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.id) {
    console.error('Razorpay order failed', response.status, data?.error?.description || '');
    const error = new Error('Online payment could not start. Please try again in a minute.');
    error.status = 502;
    throw error;
  }
  return data;
}

export function validSignature(razorpayOrderId, paymentId, signature) {
  const keys = paymentKeys();
  if (!keys || !razorpayOrderId || !paymentId || !signature) return false;
  const expected = crypto.createHmac('sha256', keys.secret).update(`${razorpayOrderId}|${paymentId}`).digest('hex');
  const given = String(signature);
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export function validWebhook(rawBody, signature) {
  const secret = String(process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
  if (!secret || !signature || !rawBody) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const given = String(signature);
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}
