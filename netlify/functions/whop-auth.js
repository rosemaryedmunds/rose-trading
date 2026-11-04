// netlify/functions/whop-auth.js
var { createSession, sessionCookie } = require('../lib/session.mjs');

exports.handler = async (event) => {
  var params = new URLSearchParams(event.rawQuery || '');
  var code = params.get('code');
  var siteUrl = process.env.URL || 'https://rose.trading';
  var redirectUri = siteUrl + '/.netlify/functions/whop-auth';

  function redirect(url) {
    return { statusCode: 302, headers: { Location: url }, body: '' };
  }

  if (!code) return redirect(siteUrl + '/alerts-members-x9q3?error=no_code');

  var cookieHeader = (event.headers && event.headers.cookie) ? event.headers.cookie : '';
  var cookies = {};
  cookieHeader.split(';').forEach(function(c) {
    var parts = c.trim().split('=');
    var k = parts[0].trim();
    var v = parts.slice(1).join('=');
    cookies[k] = v;
  });

  var codeVerifier = cookies['pkce_verifier'];
  if (!codeVerifier) {
    console.error('Missing PKCE verifier');
    return redirect(siteUrl + '/alerts-members-x9q3?error=missing_verifier');
  }

  try {
    var tokenRes = await fetch('https://api.whop.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: process.env.WHOP_CLIENT_ID,
        code_verifier: codeVerifier,
      }),
    });

    var tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return redirect(siteUrl + '/alerts-members-x9q3?error=auth_failed');
    }

    var userRes = await fetch('https://api.whop.com/oauth/userinfo', {
      headers: { Authorization: 'Bearer ' + tokenData.access_token },
    });
    var user = await userRes.json();
    console.log('User sub:', user.sub);

    if (!userRes.ok || !user.sub) {
      return redirect(siteUrl + '/alerts-members-x9q3?error=user_failed');
    }

    // Owner bypass
    if (user.sub === process.env.WHOP_OWNER_ID) {
      console.log('Owner access granted');
      var ownerToken = createSession({ userId: user.sub, email: user.email || '' });
      return {
        statusCode: 302,
        multiValueHeaders: {
          'Set-Cookie': [
            sessionCookie(ownerToken),
            'pkce_verifier=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0',
            'pkce_state=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0',
          ],
          Location: [siteUrl + '/alerts-members-x9q3'],
        },
        body: '',
      };
    }

    // Check membership across all pages
    // NOTE: 'completed' covers free/comp "Joined" memberships shown in Whop dashboard
    var hasMembership = false;
    var validStatuses = ['active', 'trialing', 'past_due', 'completed'];
    var page = 1;
    var totalPages = 1;

    while (page <= totalPages && !hasMembership) {
      var memberRes = await fetch(
        'https://api.whop.com/v5/company/memberships?page=' + page,  // removed status=active filter so all statuses are returned
        { headers: { Authorization: 'Bearer ' + process.env.WHOP_API_KEY } }
      );
      var memberText = await memberRes.text();
      if (!memberRes.ok) console.error('Whop memberships API error', memberRes.status, memberText.slice(0, 200));
      if (memberRes.ok && memberText) {
        var memberData = JSON.parse(memberText);
        if (memberData && memberData.data) {
          hasMembership = memberData.data.some(function(m) {
            // Whop returns the member's id as user_id, or as user (string or object)
            var memberId = m.user_id || (m.user && (typeof m.user === 'string' ? m.user : m.user.id));
            return memberId === user.sub && validStatuses.indexOf(m.status) !== -1;
          });
          totalPages = memberData.pagination ? memberData.pagination.total_pages : 1;
        }
      }
      page++;
    }

    console.log('Has membership:', hasMembership, 'for user:', user.sub);

    if (!hasMembership) {
      return redirect(siteUrl + '/alerts-members-x9q3?error=no_membership');
    }

    var sessionToken = createSession({ userId: user.sub, email: user.email || '' });

    return {
      statusCode: 302,
      multiValueHeaders: {
        'Set-Cookie': [
          sessionCookie(sessionToken),
          'pkce_verifier=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0',
          'pkce_state=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0',
        ],
        Location: [siteUrl + '/alerts-members-x9q3'],
      },
      body: '',
    };

  } catch (err) {
    console.error('Whop auth error:', err);
    return redirect(siteUrl + '/alerts-members-x9q3?error=server_error');
  }
};