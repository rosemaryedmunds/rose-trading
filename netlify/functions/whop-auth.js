// netlify/functions/whop-auth.js

exports.handler = async (event) => {
  var params = new URLSearchParams(event.rawQuery || '');
  var code = params.get('code');
  var siteUrl = process.env.URL || 'https://rose.trading';
  var redirectUri = siteUrl + '/.netlify/functions/whop-auth';

  function redirect(url) {
    return { statusCode: 302, headers: { Location: url }, body: '' };
  }

  if (!code) return redirect(siteUrl + '/alerts?error=no_code');

  var cookieHeader = (event.headers && event.headers.cookie) ? event.headers.cookie : '';
  var cookies = {};
  cookieHeader.split(';').forEach(function(c) {
    var parts = c.trim().split('=');
    var k = parts[0].trim();
    var v = parts.slice(1).join('=');
    cookies[k] = v;
  });

  var codeVerifier = cookies['pkce_verifier'];
  if (!codeVerifier) {
    console.error('Missing PKCE verifier');
    return redirect(siteUrl + '/alerts?error=missing_verifier');
  }

  try {
    var tokenRes = await fetch('https://api.whop.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: process.env.WHOP_CLIENT_ID,
        code_verifier: codeVerifier,
      }),
    });

    var tokenData = await tokenRes.json();
    console.log('Token response status:', tokenRes.status);

    if (!tokenRes.ok || !tokenData.access_token) {
      return redirect(siteUrl + '/alerts?error=auth_failed');
    }

    var userRes = await fetch('https://api.whop.com/oauth/userinfo', {
      headers: { Authorization: 'Bearer ' + tokenData.access_token },
    });
    var user = await userRes.json();
    console.log('User sub:', user.sub);

    if (!userRes.ok || !user.sub) {
      return redirect(siteUrl + '/alerts?error=user_failed');
    }

    // Check membership via /v5/app/members filtered by user_id
    var memberRes = await fetch(
      'https://api.whop.com/v5/app/members?user_id=' + user.sub,
      { headers: { Authorization: 'Bearer ' + process.env.WHOP_API_KEY } }
    );
    var memberText = await memberRes.text();
    console.log('Member check:', memberRes.status, memberText);

    var hasMembership = false;
    if (memberRes.ok && memberText) {
      var memberData = JSON.parse(memberText);
      hasMembership = memberData && memberData.data && memberData.data.length > 0;
    }

    if (!hasMembership) {
      console.log('No membership found for user:', user.sub);
      return redirect(siteUrl + '/alerts?error=no_membership');
    }

    console.log('Membership confirmed for:', user.sub);

    var sessionToken = Buffer.from(JSON.stringify({
      userId: user.sub,
      email: user.email || '',
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
    })).toString('base64');

    return {
      statusCode: 302,
      multiValueHeaders: {
        'Set-Cookie': [
          'rose_session=' + sessionToken + '; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=604800',
          'pkce_verifier=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0',
          'pkce_state=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0',
        ],
        Location: [siteUrl + '/alerts-members-x9q3'],
      },
      body: '',
    };

  } catch (err) {
    console.error('Whop auth error:', err);
    return redirect(siteUrl + '/alerts?error=server_error');
  }
};