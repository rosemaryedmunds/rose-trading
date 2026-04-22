// netlify/functions/verify-session.js
// Called by the members page on load to check if session cookie is valid
// Returns { valid: true/false }

export default async (req) => {
  const cookieHeader = req.headers.get('cookie') || '';
  const cookies      = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k, v.join('=')];
    })
  );

  const sessionToken = cookies['rose_session'];

  if (!sessionToken) {
    return json({ valid: false, reason: 'no_session' });
  }

  try {
    const session = JSON.parse(Buffer.from(sessionToken, 'base64').toString('utf8'));

    // Check expiry
    if (Date.now() > session.expiresAt) {
      return json({ valid: false, reason: 'expired' });
    }

    // Re-verify membership with Whop (catches cancelled subscriptions)
    const memberRes = await fetch(
      `https://api.whop.com/v5/memberships?user_id=${session.userId}&plan_id=plan_HE6PHzR97QEX3&status=active`,
      {
        headers: { Authorization: `Bearer ${process.env.WHOP_API_KEY}` },
      }
    );
    const memberData = await memberRes.json();
    const hasAccess  = memberData?.data?.length > 0;

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
    status:  200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const config = { path: '/.netlify/functions/verify-session' };
