// netlify/functions/whop-auth.js

exports.handler = async (event) => {
  const params        = new URLSearchParams(event.rawQuery || '');
  const code          = params.get('code');
  const siteUrl       = process.env.URL || 'https://rose.trading';
  const redirectUri   = `${siteUrl}/.netlify/functions/whop-auth`;

  const redirect = (url) => ({
    statusCode: 302,
    headers: { Location: url },
    body: '',
  });

  if (!code) return redirect(`${siteUrl}/alerts?error=no_code`);

  // Parse cookies
  const cookieHeader = event.headers?.cookie || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k.trim(), v.join('=')];
    })
  );

  const codeVerifier = cookies['pkce_verifier'];
  if (!codeVerifier) {
    console.error('Missing PKCE verifier');
    return redirect(`${siteUrl}/alerts?error=missing_verifier`);
  }

  try {
    // 1. Exchange code for token
    const tokenRes = await fetch('https://api.whop.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type:    'authorization_code',
        code,
        redirect_uri:  redirectUri,
        client_id:     process.env.WHOP_CLIENT_ID,
        code_verifier: codeVerifier,
      }),
    });

    const tokenData = await tokenRes.json();
    console.log('Token response:', JSON.stringify(tokenData));

    if (!tokenRes.ok || !tokenData.access_token) {
      return redirect(`${siteUrl}/alerts?error=auth_failed`);
    }

    // 2. Get user info
    const userRes = await fetch('https://api.whop.com/oauth/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const user = await userRes.json();
    console.log('User info:', JSON.stringify(user));

    if (!userRes.ok || !user.sub) {
      return redirect(`${siteUrl}/alerts?error=user_failed`);
    }

    // 3. Check for any active membership under your Whop account
    const membershipRes = await fetch(
      `https://api.whop.com/v5/memberships?user_id=${user.sub}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.WHOP_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const membershipData = await membershipRes.json();
    console.log('Membership check:', JSON.stringify(membershipData));

    // Accept active, trialing (trial period), and past_due (grace period)
    const validStatuses = ['active', 'trialing', 'past_due'];
    const hasMembership = membershipData?.data?.some(
      m => validStatuses.includes(m.status)
    );

    if (!hasMembership) {
      console.log('No active membership for user:', user.sub);
      return redirect(`${siteUrl}/alerts?error=no_membership`);
    }

    // 4. Issue session cookie (7-day expiry)
    const sessionToken = Buffer.from(JSON.stringify({
      userId:    user.sub,
      email:     user.email || '',
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
    })).toString('base64');

    console.log('Membership confirmed, granting access for:', user.sub);

    return {
      statusCode: 302,
      multiValueHeaders: {
        'Set-Cookie': [
          `rose_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=604800`,
          `pkce_verifier=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0`,
          `pkce_state=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0`,
        ],
        Location: [`${siteUrl}/alerts-members-x9q3`],
      },
      body: '',
    };

  } catch (err) {
    console.error('Whop auth error:', err);
    return redirect(`${siteUrl}/alerts?error=server_error`);
  }
};