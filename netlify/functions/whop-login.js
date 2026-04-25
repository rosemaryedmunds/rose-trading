// netlify/functions/whop-login.js
// Uses state parameter to pass PKCE verifier (avoids cookie issues on iPhone Safari)

import { createHash, randomBytes } from ‘crypto’;

export default async (req) => {
const siteUrl = process.env.URL || ‘https://rose.trading’;
const clientId = process.env.WHOP_CLIENT_ID;
const redirectUri = `${siteUrl}/.netlify/functions/whop-auth`;

// Generate PKCE
const codeVerifier = randomBytes(32).toString(‘base64url’);
const codeChallenge = createHash(‘sha256’).update(codeVerifier).digest(‘base64url’);

// Encode verifier in state so we don’t need cookies
const statePayload = Buffer.from(JSON.stringify({
verifier: codeVerifier,
nonce: randomBytes(8).toString(‘base64url’),
})).toString(‘base64url’);

const params = new URLSearchParams({
response_type: ‘code’,
client_id: clientId,
redirect_uri: redirectUri,
scope: ‘openid profile email’,
state: statePayload,
code_challenge: codeChallenge,
code_challenge_method: ‘S256’,
});

return new Response(null, {
status: 302,
headers: { Location: `https://api.whop.com/oauth/authorize?${params}` },
});
};

export const config = { path: ‘/.netlify/functions/whop-login’ };