// netlify/lib/session.mjs
// Signed session tokens. A token is "payload.signature" — the signature is an
// HMAC made with SESSION_SECRET, so nobody can create or edit a token without
// knowing the secret. Any function that issues or checks rose_session uses this.

import crypto from 'node:crypto';

const SEVEN_DAYS_MS = 1000 * 60 * 60 * 24 * 7;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET env var missing or too short (need 32+ chars)');
  return s;
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', secret()).update(data).digest('base64url');

/** Create a signed token. */
function createSession({ userId, email = '', ttlMs = SEVEN_DAYS_MS, ...extra }) {
  const payload = b64url(JSON.stringify({ userId, email, expiresAt: Date.now() + ttlMs, ...extra }));
  return payload + '.' + sign(payload);
}

/** Returns the session object if the token is genuine and unexpired, else null. */
function readSession(token) {
  if (!token || typeof token !== 'string') return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null; // old unsigned tokens land here → must sign in again

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;

  let session;
  try {
    session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!session.userId || !session.expiresAt || Date.now() > session.expiresAt) return null;
  return session;
}

/** Ready-made Set-Cookie value for the session. */
function sessionCookie(token, maxAgeSec = 604800) {
  return 'rose_session=' + token + '; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=' + maxAgeSec;
}

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((c) => {
    const [k, ...v] = c.trim().split('=');
    if (k) out[k.trim()] = v.join('=');
  });
  return out;
}

/** True if the request carries a valid member session or the admin bypass cookie. */
function isAuthorized(cookieHeader) {
  const cookies = parseCookies(cookieHeader);
  const adminKey = process.env.ADMIN_BYPASS_KEY;
  const adminCookie = cookies['rose_admin'];
  if (adminKey && adminCookie && adminCookie.length === adminKey.length &&
      crypto.timingSafeEqual(Buffer.from(adminCookie), Buffer.from(adminKey))) {
    return true;
  }
  return readSession(cookies['rose_session']) !== null;
}

export { createSession, readSession, sessionCookie, parseCookies, isAuthorized };
