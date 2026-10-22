import crypto from 'node:crypto';

export function paymentKeys() {
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const secret = process.env.RAZORPAY_KEY_SECRET || '';
  return keyId && secret ? { keyId, secret } : null;
}

export async function createRazorpayOrder({ amountPaise, receipt }) {
  const keys = paymentKeys();
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${keys.keyId}:${keys.secret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt }),
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
