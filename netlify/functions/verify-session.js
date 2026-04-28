// netlify/functions/verify-session.js

exports.handler = async (event) => {
  const cookieHeader = event.headers?.cookie || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k.trim(), v.join('=')];
    })
  );

  const json = (data) => ({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  // Admin bypass
  const adminKey    = process.env.ADMIN_BYPASS_KEY;
  const adminCookie = cookies['rose_admin'];
  if (adminKey && adminCookie === adminKey) {
    return json({ valid: true, userId: 'admin' });
  }

  const sessionToken = cookies['rose_session'];
  if (!sessionToken) return json({ valid: false, reason: 'no_session' });

  let session;
  try {
    // Normalize URL-safe base64 and fix missing padding
    const normalized = sessionToken.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '=='.slice(0, (4 - normalized.length % 4) % 4);
    session = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch (err) {
    console.error('Session parse error:', err.message, '| token prefix:', sessionToken.slice(0, 20));
    // Treat parse failures as expired → frontend redirects to login, not paywall
    return json({ valid: false, reason: 'expired' });
  }

  // Guard against seconds vs milliseconds bug in expiresAt
  const expiresAt = session.expiresAt > 1e12 ? session.expiresAt : session.expiresAt * 1000;
  if (Date.now() > expiresAt) {
    return json({ valid: false, reason: 'expired' });
  }

  if (!session.userId) {
    return json({ valid: false, reason: 'expired' });
  }

  return json({ valid: true, userId: session.userId });
};
