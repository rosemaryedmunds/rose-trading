// netlify/functions/whop-login.js
// Redirects user to Whop OAuth with PKCE

import { createHash, randomBytes } from 'crypto';

export default async (req) => {
  const siteUrl     = process.env.URL || 'https://rose.trading';
  const clientId    = process.env.WHOP_CLIENT_ID;
  const redirectUri = encodeURIComponent(`${siteUrl}/.netlify/functions/whop-auth`);

  // Generate PKCE code verifier and challenge
  const codeVerifier  = randomBytes(64).toString('base64url');
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  const whopAuthUrl = `https://whop.com/oauth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&code_challenge=${codeChallenge}&code_challenge_method=S256&scope=openid%20profile%20email`;

  // Store verifier in a short-lived cookie so whop-auth can use it
  return new Response(null, {
    status: 302,
    headers: {
      Location:     whopAuthUrl,
      'Set-Cookie': `pkce_verifier=${codeVerifier}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=300`,
    },
  });
};

export const config = { path: '/.netlify/functions/whop-login' };