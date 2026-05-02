// netlify/functions/whop-auth.js

exports.handler = async (event) => {
var params = new URLSearchParams(event.rawQuery || ‘’);
var code = params.get(‘code’);
var siteUrl = process.env.URL || ‘https://rose.trading’;
var redirectUri = siteUrl + ‘/.netlify/functions/whop-auth’;

function redirect(url) {
return { statusCode: 302, headers: { Location: url }, body: ‘’ };
}

if (!code) return redirect(siteUrl + ‘/alerts?error=no_code’);

var cookieHeader = (event.headers && event.headers.cookie) ? event.headers.cookie : ‘’;
var cookies = {};
cookieHeader.split(’;’).forEach(function(c) {
var parts = c.trim().split(’=’);
var k = parts[0].trim();
var v = parts.slice(1).join(’=’);
cookies[k] = v;
});

var codeVerifier = cookies[‘pkce_verifier’];
if (!codeVerifier) {
console.error(‘Missing PKCE verifier’);
return redirect(siteUrl + ‘/alerts?error=missing_verifier’);
}

try {
// 1. Exchange code for token
var tokenRes = await fetch(‘https://api.whop.com/oauth/token’, {
method: ‘POST’,
headers: { ‘Content-Type’: ‘application/json’ },
body: JSON.stringify({
grant_type: ‘authorization_code’,
code: code,
redirect_uri: redirectUri,
client_id: process.env.WHOP_CLIENT_ID,
code_verifier: codeVerifier,
}),
});

```
var tokenData = await tokenRes.json();
console.log('Token response:', JSON.stringify(tokenData));

if (!tokenRes.ok || !tokenData.access_token) {
  return redirect(siteUrl + '/alerts?error=auth_failed');
}

// 2. Get user info
var userRes = await fetch('https://api.whop.com/oauth/userinfo', {
  headers: { Authorization: 'Bearer ' + tokenData.access_token },
});
var user = await userRes.json();
console.log('User info:', JSON.stringify(user));

if (!userRes.ok || !user.sub) {
  return redirect(siteUrl + '/alerts?error=user_failed');
}

// 3. Check access - try multiple endpoints and log all results
var companyId = process.env.WHOP_COMPANY_ID;

var resA = await fetch(
  'https://api.whop.com/v5/me/has_access/' + companyId,
  { headers: { Authorization: 'Bearer ' + tokenData.access_token } }
);
var textA = await resA.text();
console.log('A user-token /me/has_access:', resA.status, textA);

var resB = await fetch(
  'https://api.whop.com/v5/users/' + user.sub + '/access/' + companyId,
  { headers: { Authorization: 'Bearer ' + process.env.WHOP_API_KEY } }
);
var textB = await resB.text();
console.log('B app-key /v5/users/access:', resB.status, textB);

var resC = await fetch(
  'https://api.whop.com/api/v5/users/' + user.sub + '/access/' + companyId,
  { headers: { Authorization: 'Bearer ' + process.env.WHOP_API_KEY } }
);
var textC = await resC.text();
console.log('C app-key /api/v5/users/access:', resC.status, textC);

// Grant access temporarily so we can read the logs
console.log('Granting access for log inspection:', user.sub);

// 4. Issue session cookie (7-day expiry)
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
```

} catch (err) {
console.error(‘Whop auth error:’, err);
return redirect(siteUrl + ‘/alerts?error=server_error’);
}
};
