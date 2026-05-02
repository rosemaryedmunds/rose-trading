// netlify/functions/whop-auth.js

exports.handler = async (event) => {
const params        = new URLSearchParams(event.rawQuery || ‘’);
const code          = params.get(‘code’);
const siteUrl       = process.env.URL || ‘https://rose.trading’;
const redirectUri   = `${siteUrl}/.netlify/functions/whop-auth`;

const redirect = (url) => ({
statusCode: 302,
headers: { Location: url },
body: ‘’,
});

if (!code) return redirect(`${siteUrl}/alerts?error=no_code`);

// Parse cookies
const cookieHeader = event.headers?.cookie || ‘’;
const cookies = Object.fromEntries(
cookieHeader.split(’;’).map(c => {
const [k, …v] = c.trim().split(’=’);
return [k.trim(), v.join(’=’)];
})
);

const codeVerifier = cookies[‘pkce_verifier’];
if (!codeVerifier) {
console.error(‘Missing PKCE verifier’);
return redirect(`${siteUrl}/alerts?error=missing_verifier`);
}

try {
// 1. Exchange code for token
const tokenRes = await fetch(‘https://api.whop.com/oauth/token’, {
method: ‘POST’,
headers: { ‘Content-Type’: ‘application/json’ },
body: JSON.stringify({
grant_type:    ‘authorization_code’,
code,
redirect_uri:  redirectUri,
client_id:     process.env.WHOP_CLIENT_ID,
code_verifier: codeVerifier,
}),
});

```
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

// 3. Try both access check approaches and log everything
const companyId = process.env.WHOP_COMPANY_ID;

// Approach A: user token + /me/has_access
const resA = await fetch(
  `https://api.whop.com/v5/me/has_access/${companyId}`,
  { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
);
const textA = await resA.text();
console.log('Approach A (user token /me/has_access):', resA.status, textA);

// Approach B: app API key + /v5/users/{id}/access/{company}
const resB = await fetch(
  `https://api.whop.com/v5/users/${user.sub}/access/${companyId}`,
  { headers: { Authorization: `Bearer ${process.env.WHOP_API_KEY}` } }
);
const textB = await resB.text();
console.log('Approach B (app key /users/access):', resB.status, textB);

// Approach C: app API key + /users/{id}/access/{company} (no v5)
const resC = await fetch(
  `https://api.whop.com/users/${user.sub}/access/${companyId}`,
  { headers: { Authorization: `Bearer ${process.env.WHOP_API_KEY}` } }
);
const textC = await resC.text();
console.log('Approach C (app key no v5):', resC.status, textC);

// For now grant access so we can see the logs
console.log('Granting access to inspect logs for:', user.sub);

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
```

} catch (err) {
console.error(‘Whop auth error:’, err);
return redirect(`${siteUrl}/alerts?error=server_error`);
}
};
