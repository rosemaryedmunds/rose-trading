// netlify/functions/verify-session.js
const crypto = require('crypto');
const { readSession, parseCookies } = require('../lib/session.mjs');

exports.handler = async (event) => {
  const cookies = parseCookies(event.headers?.cookie);

  const json = (data) => ({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(data),
  });

  // Admin bypass (constant-time compare)
  const adminKey = process.env.ADMIN_BYPASS_KEY;
  const adminCookie = cookies['rose_admin'];
  if (adminKey && adminCookie && adminCookie.length === adminKey.length &&
      crypto.timingSafeEqual(Buffer.from(adminCookie), Buffer.from(adminKey))) {
    return json({ valid: true, userId: 'admin' });
  }

  if (!cookies['rose_session']) return json({ valid: false, reason: 'no_session' });

  // Signature + expiry check. Forged, edited, old-format, or expired tokens all fail.
  const session = readSession(cookies['rose_session']);
  if (!session) return json({ valid: false, reason: 'expired' });

  return json({ valid: true, userId: session.userId });
};
