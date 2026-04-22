// netlify/functions/whop-auth.js
// Handles Whop OAuth callback — verifies the user has an active subscription
// Environment variables needed:
//   WHOP_API_KEY       — your Whop API key
//   WHOP_CLIENT_ID     — from Whop dashboard → OAuth Apps
//   WHOP_CLIENT_SECRET — from Whop dashboard → OAuth Apps
//   URL                — your site URL (Netlify sets this automatically)

export default async (req) => {
  const url    = new URL(req.url);
  const code   = url.searchParams.get('code');
  const siteUrl = process.env.URL || 'https://rose.trading';
  const redirectUri = `${siteUrl}/.netlify/functions/whop-auth`;

  if (!code) {
    return new Response('Missing code', { status: 400 });
  }

  try {
    // 1. Exchange code for access token
    const tokenRes = await fetch('https://api.whop.com/v5/oauth/token', {
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
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Token exchange failed:', tokenData);
      return redirectTo(`${siteUrl}/alerts?error=auth_failed`);
    }

    const accessToken = tokenData.access_token;

    // 2. Get user info
    const userRes = await fetch('https://api.whop.com/v5/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const user = await userRes.json();

    if (!userRes.ok || !user.id) {
      return redirectTo(`${siteUrl}/alerts?error=user_failed`);
    }

    // 3. Check membership using Whop API key (server-side)
    const memberRes = await fetch(
      `https://api.whop.com/v5/memberships?user_id=${user.id}&plan_id=plan_HE6PHzR97QEX3&status=active`,
      {
        headers: {
          Authorization: `Bearer ${process.env.WHOP_API_KEY}`,
        },
      }
    );
    const memberData = await memberRes.json();
    const hasAccess  = memberData?.data?.length > 0;

    if (!hasAccess) {
      // Not a paying subscriber — send to checkout
      return redirectTo('https://whop.com/checkout/plan_HE6PHzR97QEX3?error=no_subscription');
    }

    // 4. Set a signed session cookie and redirect to members page
    const sessionToken = Buffer.from(JSON.stringify({
      userId:    user.id,
      email:     user.email,
      expiresAt: Date.now() + 1000 * 60 * 60 * 24, // 24 hours
    })).toString('base64');

    return new Response(null, {
      status: 302,
      headers: {
        Location:   `${siteUrl}/alerts-members-x9q3`,
        'Set-Cookie': `rose_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`,
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
