// netlify/functions/whop-login.js
// Redirects user to Whop OAuth login page
// Environment variables needed:
//   WHOP_CLIENT_ID — from Whop dashboard → OAuth Apps
//   URL            — your site URL (Netlify sets this automatically)

export default async (req) => {
  const siteUrl     = process.env.URL || 'https://rose.trading';
  const clientId    = process.env.WHOP_CLIENT_ID;
  const redirectUri = encodeURIComponent(`${siteUrl}/.netlify/functions/whop-auth`);

  const whopAuthUrl = `https://whop.com/oauth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code`;

  return new Response(null, {
    status:  302,
    headers: { Location: whopAuthUrl },
  });
};

export const config = { path: '/.netlify/functions/whop-login' };
