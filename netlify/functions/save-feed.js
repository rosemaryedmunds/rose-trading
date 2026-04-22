// netlify/functions/save-feed.js
// Saves alerts and reviews to Netlify Blobs (persistent key-value storage)
// No database needed — Netlify handles it for free

import { getStore } from '@netlify/blobs';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const item = await req.json();

  if (!item.type || !item.message || !item.timestamp) {
    return new Response('Missing required fields', { status: 400 });
  }

  const store = getStore('feed');

  // Load existing items
  let items = [];
  try {
    const existing = await store.get('items', { type: 'json' });
    if (existing) items = existing;
  } catch {
    items = [];
  }

  // Prepend new item (newest first), keep last 100
  items.unshift(item);
  if (items.length > 100) items = items.slice(0, 100);

  // Save back
  await store.set('items', JSON.stringify(items));

  return new Response(JSON.stringify({ success: true }), {
    status:  200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = { path: '/.netlify/functions/save-feed' };
