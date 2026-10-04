// netlify/functions/guest-login.js
//
// Private invite-link sign-in for people who don't use Whop or Discord.
// Env var GUEST_INVITES holds comma-separated "email:token" pairs, e.g.
//   rc8200@gmail.com:qWNh1eX5wXDe-PykdMN3ee7-qjRXMl9c
// Invite link: https://rose.trading/.netlify/functions/guest-login?t=<token>
// Sets the same rose_session cookie as whop-auth / discord-auth, so
// verify-session and the members page need no changes.

const { timingSafeEqual } = require('crypto');

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

exports.handler = async (event) => {
  const siteUrl = process.env.URL || 'https://rose.trading';
  const params  = new URLSearchParams(event.rawQuery || '');
  const token   = params.get('t') || '';

  const redirect = (url) => ({ statusCode: 302, headers: { Location: url }, body: '' });

  if (!token) return redirect(siteUrl + '/alerts-members-x9q3?invite=invalid');

  const invites = (process.env.GUEST_INVITES || '')
    .split(',')
    .map((entry) => {
      const idx = entry.lastIndexOf(':');
      return idx === -1
        ? null
        : { email: entry.slice(0, idx).trim().toLowerCase(), token: entry.slice(idx + 1).trim() };
    })
    .filter((i) => i && i.email && i.token);

  const match = invites.find((i) => safeEqual(i.token, token));

  if (!match) {
    console.log('Guest invite rejected');
    return redirect(siteUrl + '/alerts-members-x9q3?invite=invalid');
  }

  console.log('Guest access granted for:', match.email);

  // Same shape as the Whop/Discord sessions; "guest:" prefix keeps the
  // id from colliding with Whop or Discord user ids.
  const sessionToken = Buffer.from(JSON.stringify({
    userId:    'guest:' + match.email,
    email:     match.email,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
  })).toString('base64url');

  return {
    statusCode: 302,
    multiValueHeaders: {
      'Set-Cookie': [
        'rose_session=' + sessionToken + '; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=604800',
      ],
      Location: [siteUrl + '/alerts-members-x9q3'],
    },
    body: '',
  };
};
