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

  try {
    const session = JSON.parse(Buffer.from(sessionToken, 'base64').toString('utf8'));
    if (Date.now() > session.expiresAt) return json({ valid: false, reason: 'expired' });
    return json({ valid: true, userId: session.userId });
  } catch (err) {
    console.error('Session verify error:', err);
    return json({ valid: false, reason: 'invalid_session' });
  }
};