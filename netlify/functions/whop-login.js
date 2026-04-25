// netlify/functions/whop-login.js
// Redirects user to Whop OAuth with PKCE (no client_secret needed)

import { createHash, randomBytes } from 'crypto';

export default async (req) => {
  const siteUrl     = process.env.URL || 'https://rose.trading';
  const clientId    = process.env.WHOP_CLIENT_ID;
  const redirectUri = `${siteUrl}/.netlify/functions/whop-auth`;

  // Generate PKCE
  const codeVerifier  = randomBytes(32).toString('base64url');
  const state         = randomBytes(16).toString('base64url');
  const nonce         = randomBytes(16).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

  const params = new URLSearchParams({
    response_type:          'code',
    client_id:              clientId,
    redirect_uri:           redirectUri,
    scope:                  'openid profile email',
    state,
    nonce,
    code_challenge:         codeChallenge,
    code_challenge_method:  'S256',
  });

  const whopAuthUrl = `https://api.whop.com/oauth/authorize?${params}`;

  // Store verifier + state in short-lived cookies
  return new Response(null, {
    status: 302,
    headers: new Headers([
      ['Location', whopAuthUrl],
      ['Set-Cookie', `pkce_verifier=${codeVerifier}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=300`],
      ['Set-Cookie', `pkce_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=300`],
    ]),
  });
};

export const config = { path: '/.netlify/functions/whop-login' };