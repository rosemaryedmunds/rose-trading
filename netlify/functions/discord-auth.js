// netlify/functions/discord-auth.js

exports.handler = async (event) => {
  var params = new URLSearchParams(event.rawQuery || '');
  var code = params.get('code');
  var state = params.get('state');
  var siteUrl = process.env.URL || 'https://rose.trading';
  var redirectUri = siteUrl + '/.netlify/functions/discord-auth';

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

  var expectedState = cookies['discord_state'];
  if (!expectedState || expectedState !== state) {
    console.error('Discord state mismatch');
    return redirect(siteUrl + '/alerts?error=missing_verifier');
  }

  try {
    // Exchange code for access token
    var tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        code:          code,
        redirect_uri:  redirectUri,
        client_id:     process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
      }),
    });

    var tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Discord token exchange failed:', tokenData);
      return redirect(siteUrl + '/alerts?error=auth_failed');
    }

    // Get the logged-in user's Discord identity
    var userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: 'Bearer ' + tokenData.access_token },
    });
    var user = await userRes.json();

    if (!userRes.ok || !user.id) {
      return redirect(siteUrl + '/alerts?error=user_failed');
    }

    // Check whether this user holds the paid role in Adex's Discord server.
    // Uses the BOT token (not the user's token) since checking another
    // member's roles requires the bot to be a member of that guild.
    var guildId  = process.env.ADEX_GUILD_ID;
    // Comma-separated list of role IDs that should be granted access,
    // e.g. "896543718222491669,123456789012345678"
    var allowedRoleIds = (process.env.ADEX_ALLOWED_ROLE_IDS || '')
      .split(',')
      .map(function(r) { return r.trim(); })
      .filter(Boolean);
    var botToken = process.env.DISCORD_BOT_TOKEN;

    var memberRes = await fetch(
      'https://discord.com/api/guilds/' + guildId + '/members/' + user.id,
      { headers: { Authorization: 'Bot ' + botToken } }
    );

    var hasMembership = false;
    if (memberRes.status === 200) {
      var member = await memberRes.json();
      hasMembership = Array.isArray(member.roles) &&
        member.roles.some(function(r) { return allowedRoleIds.indexOf(r) !== -1; });
    } else if (memberRes.status !== 404) {
      // 404 just means "not in the server" - treat as no membership.
      // Anything else (401/403) means the bot itself is misconfigured.
      var errText = await memberRes.text();
      console.error('Discord member lookup failed:', memberRes.status, errText);
    }

    console.log('Discord has membership:', hasMembership, 'for user:', user.id);

    if (!hasMembership) {
      return redirect(siteUrl + '/alerts?error=no_membership');
    }

    // Prefix the id so it can never collide with a Whop user id in the
    // same session-token space.
    var sessionToken = Buffer.from(JSON.stringify({
      userId: 'discord:' + user.id,
      email: '',
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
    })).toString('base64');

    return {
      statusCode: 302,
      multiValueHeaders: {
        'Set-Cookie': [
          'rose_session=' + sessionToken + '; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=604800',
          'discord_state=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0',
        ],
        Location: [siteUrl + '/alerts-members-x9q3'],
      },
      body: '',
    };

  } catch (err) {
    console.error('Discord auth error:', err);
    return redirect(siteUrl + '/alerts?error=server_error');
  }
};