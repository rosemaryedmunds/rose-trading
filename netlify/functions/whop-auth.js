// netlify/functions/whop-auth.js
// Handles Whop OAuth callback — verifies the user has an active subscription

export default async (req) => {
  const url      = new URL(req.url);
  const code     = url.searchParams.get('code');
  const siteUrl  = process.env.URL || 'https://rose.trading';
  const redirectUri = `${siteUrl}/.netlify/functions/whop-auth`;

  if (!code) {
    return redirectTo(`${siteUrl}/alerts?error=no_code`);
  }

  try {
    // 1. Exchange code for access token
    const tokenRes = await fetch('https://api.whop.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id:     process.env.WHOP_CLIENT_ID,
        client_secret: process.env.WHOP_CLIENT_SECRET,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    console.log('Token response:', JSON.stringify(tokenData));

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Token exchange failed:', tokenData);
      return redirectTo(`${siteUrl}/alerts?error=auth_failed`);
    }

    const accessToken = tokenData.access_token;

    // 2. Get user info using new endpoint
    const userRes = await fetch('https://api.whop.com/oauth/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const user = await userRes.json();
    console.log('User info:', JSON.stringify(user));

    if (!userRes.ok || !user.sub) {
      return redirectTo(`${siteUrl}/alerts?error=user_failed`);
    }

    const userId = user.sub; // new API uses 'sub' not 'id'

    // 3. Check membership using has_access endpoint
    const accessRes = await fetch(
      `https://api.whop.com/api/v2/me/has_access/plan_HE6PHzR97QEX3`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    const accessData = await accessRes.json();
    console.log('Access check:', JSON.stringify(accessData));

    const hasAccess = accessData?.has_access === true;

    if (!hasAccess) {
      return redirectTo('https://whop.com/checkout/plan_HE6PHzR97QEX3');
    }

    // 4. Set session cookie and redirect to members page
    const sessionToken = Buffer.from(JSON.stringify({
      userId,
      email:     user.email || '',
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
    })).toString('base64');

    return new Response(null, {
      status: 302,
      headers: {
        Location:     `${siteUrl}/alerts-members-x9q3`,
        'Set-Cookie': `rose_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`,
      },
    });

  } catch (err) {
    console.error('Whop auth error:', err);
    return redirectTo(`${siteUrl}/alerts?error=server_error`);
  }
};

function redirectTo(url) {
  return new Response(null, { status: 302, headers: { Location: url } });
}

export const config = { path: '/.netlify/functions/whop-auth' };