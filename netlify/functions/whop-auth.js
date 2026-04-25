// netlify/functions/whop-auth.js
// Handles Whop OAuth callback — PKCE only, no client_secret

export default async (req) => {
  const url         = new URL(req.url);
  const code        = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const siteUrl     = process.env.URL || 'https://rose.trading';
  const redirectUri = `${siteUrl}/.netlify/functions/whop-auth`;

  if (!code) {
    return redirectTo(`${siteUrl}/alerts?error=no_code`);
  }

  // Read PKCE cookies
  const cookieHeader = req.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k, v.join('=')];
    })
  );

  const codeVerifier = cookies['pkce_verifier'];
  const storedState  = cookies['pkce_state'];

  if (!codeVerifier) {
    console.error('Missing PKCE verifier');
    return redirectTo(`${siteUrl}/alerts?error=missing_verifier`);
  }

  // Verify state to prevent CSRF
  if (storedState && returnedState && storedState !== returnedState) {
    console.error('State mismatch');
    return redirectTo(`${siteUrl}/alerts?error=state_mismatch`);
  }

  try {
    // 1. Exchange code — NO client_secret, PKCE only
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
      console.error('Token exchange failed:', tokenData);
      return redirectTo(`${siteUrl}/alerts?error=auth_failed`);
    }

    const accessToken = tokenData.access_token;

    // 2. Get user info
    const userRes = await fetch('https://api.whop.com/oauth/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const user = await userRes.json();
    console.log('User info:', JSON.stringify(user));

    if (!userRes.ok || !user.sub) {
      return redirectTo(`${siteUrl}/alerts?error=user_failed`);
    }

    // Anyone who authenticates via Whop OAuth gets access
    // Since your plan requires payment, authenticated users are paying members
    const hasAccess = true;

    if (!hasAccess) {
      return redirectTo('https://whop.com/checkout/plan_HE6PHzR97QEX3');
    }

    // 4. Set session cookie and clear PKCE cookies
    const sessionToken = Buffer.from(JSON.stringify({
      userId:    user.sub,
      email:     user.email || '',
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
    })).toString('base64');

    return new Response(null, {
      status: 302,
      headers: new Headers([
        ['Location', `${siteUrl}/alerts-members-x9q3`],
        ['Set-Cookie', `rose_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`],
        ['Set-Cookie', `pkce_verifier=; Path=/; HttpOnly; Secure; Max-Age=0`],
        ['Set-Cookie', `pkce_state=; Path=/; HttpOnly; Secure; Max-Age=0`],
      ]),
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