// netlify/functions/feed-json.js
// Serves /feed.json to SIGNED-IN MEMBERS ONLY.
// netlify.toml redirect (keep as-is):
//   [[redirects]]
//   from = "/feed.json"
//   to   = "/.netlify/functions/feed-json"
//   status = 200

import { getStore } from '@netlify/blobs';
import { isAuthorized } from '../lib/session.mjs';

export default async (req) => {
  // private + no-store: never let the CDN cache a member's feed and hand it to someone else
  const headers = {
    'Content-Type':  'application/json',
    'Cache-Control': 'private, no-store',
  };

  if (!isAuthorized(req.headers.get('cookie'))) {
    return new Response(JSON.stringify({ error: 'members_only' }), { status: 401, headers });
  }

  const store = getStore('feed');

  let items = [];
  try {
    const existing = await store.get('items', { type: 'json' });
    if (existing) items = existing;
  } catch {
    items = [];
  }

  return new Response(JSON.stringify(items), { status: 200, headers });
};

export const config = { path: '/.netlify/functions/feed-json' };
