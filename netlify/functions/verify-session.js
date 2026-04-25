// netlify/functions/verify-session.js

export default async (req) => {
  const cookieHeader = req.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k, v.join('=')];
    })
  );

  // Admin bypass
  const adminKey    = process.env.ADMIN_BYPASS_KEY;
  const adminCookie = cookies['rose_admin'];
  if (adminKey && adminCookie === adminKey) {
    return json({ valid: true, userId: 'admin' });
  }

  const sessionToken = cookies['rose_session'];
  if (!sessionToken) {
    return json({ valid: false, reason: 'no_session' });
  }

  try {
    const session = JSON.parse(Buffer.from(sessionToken, 'base64').toString('utf8'));

    if (Date.now() > session.expiresAt) {
      return json({ valid: false, reason: 'expired' });
    }

    // Verify membership using has_access endpoint with API key
    const accessRes = await fetch(
      `https://api.whop.com/api/v2/memberships?user_id=${session.userId}&plan_id=plan_HE6PHzR97QEX3&status=active`,
      {
        headers: { Authorization: `Bearer ${process.env.WHOP_API_KEY}` },
      }
    );
    const accessData = await accessRes.json();
    const hasAccess  = accessData?.data?.length > 0;

    if (!hasAccess) {
      return json({ valid: false, reason: 'no_subscription' });
    }

    return json({ valid: true, userId: session.userId });

  } catch (err) {
    console.error('Session verify error:', err);
    return json({ valid: false, reason: 'invalid_session' });
  }
};

function json(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const config = { path: '/.netlify/functions/verify-session' };