import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

export const CUSTOMER_COOKIE = 'jo_customer';
export const STAFF_COOKIE = 'jo_desk';

export function jwtSecret() {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (!secret || secret === 'change-this-to-a-long-random-string') {
    throw new Error('Set a long random JWT_SECRET in server/.env before going live.');
  }
  return secret;
}

function cookieKey() {
  return crypto.createHash('sha256').update(String(process.env.COOKIE_SECRET || jwtSecret())).digest();
}

export function encryptValue(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', cookieKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64url');
}

export function decryptValue(packed) {
  const buf = Buffer.from(String(packed || ''), 'base64url');
  if (buf.length < 29) return '';
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', cookieKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

function cookieOpts(maxAgeMs) {
  const secure = process.env.NODE_ENV === 'production'
    || String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true';
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeMs,
  };
}

export function setCustomerCookie(res, token) {
  res.cookie(CUSTOMER_COOKIE, encryptValue(token), cookieOpts(30 * 24 * 60 * 60 * 1000));
}

export function setStaffCookie(res, token) {
  res.cookie(STAFF_COOKIE, encryptValue(token), cookieOpts(7 * 24 * 60 * 60 * 1000));
}

export function clearCustomerCookie(res) {
  res.clearCookie(CUSTOMER_COOKIE, { path: '/' });
}

export function clearStaffCookie(res) {
  res.clearCookie(STAFF_COOKIE, { path: '/' });
}

function bearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

function cookieToken(req, name) {
  const packed = req.cookies?.[name];
  if (!packed) return '';
  try {
    return decryptValue(packed);
  } catch {
    return '';
  }
}

export function readCustomerToken(req) {
  const token = cookieToken(req, CUSTOMER_COOKIE) || bearerToken(req);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, jwtSecret());
    return payload.kind === 'customer' ? payload : null;
  } catch {
    return null;
  }
}

export function readStaffToken(req) {
  const token = cookieToken(req, STAFF_COOKIE) || bearerToken(req);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, jwtSecret());
    return payload.role ? payload : null;
  } catch {
    return null;
  }
}

export function signCustomerToken(row) {
  const customer = { id: row.id, name: row.name, email: row.email, phone: row.phone };
  const token = jwt.sign({ kind: 'customer', ...customer }, jwtSecret(), { expiresIn: '30d' });
  return { token, customer };
}

export function signStaffToken(admin) {
  const staff = { id: admin.id, email: admin.email, name: admin.name, role: admin.role || 'admin' };
  const token = jwt.sign(staff, jwtSecret(), { expiresIn: '7d' });
  return { token, staff };
}

export function revealOtp() {
  return String(process.env.SHOW_OTP || '').toLowerCase() === 'true';
}
