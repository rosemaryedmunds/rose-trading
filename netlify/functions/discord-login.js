// netlify/functions/discord-login.js
const { randomBytes } = require('crypto');

exports.handler = async (req) => {
  const siteUrl     = process.env.URL || 'https://rose.trading';
  const clientId    = process.env.DISCORD_CLIENT_ID;
  const redirectUri = `${siteUrl}/.netlify/functions/discord-auth`;

  const state = randomBytes(16).toString('base64url');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     clientId,
    redirect_uri:  redirectUri,
    scope:         'identify',
    state,
  });

  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?${params}`;

  return {
    statusCode: 302,
    headers: {
      Location:    discordAuthUrl,
      'Set-Cookie': `discord_state=${state}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=300`,
    },
    body: '',
  };
};