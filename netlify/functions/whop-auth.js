
Rosemary Edmunds <edmunds.rosemary@gmail.com>
4:00 PM (0 minutes ago)
to me

// netlify/functions/whop-auth.js
// Reads PKCE verifier from state parameter (no cookies needed)

export default async (req) => {
const url = new URL(req.url);
const code = url.searchParams.get(‘code’);
const stateParam = url.searchParams.get(‘state’);
const siteUrl = process.env.URL || ‘https://rose.trading’;
const redirectUri = `${siteUrl}/.netlify/functions/whop-auth`;

if (!code) {
return redirectTo(`${siteUrl}/alerts?error=no_code`);
}

// Extract verifier from state
let codeVerifier;
try {
const stateData = JSON.parse(Buffer.from(stateParam, ‘base64url’).toString(‘utf8’));
codeVerifier = stateData.verifier;
} catch (err) {
console.error(‘Failed to parse state:’, err);
return redirectTo(`${siteUrl}/alerts?error=invalid_state`);
}

if (!codeVerifier) {
return redirectTo(`${siteUrl}/alerts?error=missing_verifier`);
}

try {
// 1. Exchange code with PKCE verifier
const tokenRes = await fetch(‘https://api.whop.com/oauth/token’, {
method: ‘POST’,
headers: { ‘Content-Type’: ‘application/json’ },
body: JSON.stringify({
grant_type: ‘authorization_code’,
code,
redirect_uri: redirectUri,
client_id: process.env.WHOP_CLIENT_ID,
code_verifier: codeVerifier,
}),
});

```
const tokenData = await tokenRes.json();
console.log('Token response status:', tokenRes.status);

if (!tokenRes.ok || !tokenData.access_token) {
console.error('Token exchange failed:', JSON.stringify(tokenData));
return redirectTo(`${siteUrl}/alerts?error=auth_failed`);
}

// 2. Get user info
const userRes = await fetch('https://api.whop.com/oauth/userinfo', {
headers: { Authorization: `Bearer ${tokenData.access_token}` },
});
const user = await userRes.json();
console.log('User:', user.sub, user.email);

if (!user.sub) {
return redirectTo(`${siteUrl}/alerts?error=user_failed`);
}

// 3. Set session cookie
const sessionToken = Buffer.from(JSON.stringify({
userId: user.sub,
email: user.email || '',
expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
})).toString('base64');

console.log('Auth successful, setting session for:', user.email);

return new Response(null, {
status: 302,
headers: {
Location: `${siteUrl}/alerts-members-x9q3`,
'Set-Cookie': `rose_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`,
},
});
```

} catch (err) {
console.error(‘Whop auth error:’, err);
return redirectTo(`${siteUrl}/alerts?error=server_error`);
}
};

function redirectTo(url) {
return new Response(null, { status: 302, headers: { Location: url } });
}

export const config = { path: ‘/.netlify/functions/whop-auth’ };