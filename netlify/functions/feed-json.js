// netlify/functions/feed-json.js
// Serves /feed.json publicly so the alerts page can read it
// Add this redirect to netlify.toml:
//   [[redirects]]
//   from = "/feed.json"
//   to   = "/.netlify/functions/feed-json"
//   status = 200

import { getStore } from '@netlify/blobs';

export default async (req) => {
  const store = getStore('feed');

  let items = [];
  try {
    const existing = await store.get('items', { type: 'json' });
    if (existing) items = existing;
  } catch {
    items = [];
  }

  return new Response(JSON.stringify(items), {
    status: 200,
    headers: {
      'Content-Type':  'application/json',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    },
  });
};

export const config = { path: '/.netlify/functions/feed-json' };
