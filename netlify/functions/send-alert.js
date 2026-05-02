// netlify/functions/send-alert.js
// Sends a push notification via OneSignal REST API v1
// Uses newer API key format with 'Key' prefix instead of 'Basic'

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { title, message } = await req.json();

  if (!title || !message) {
    return new Response('Missing title or message', { status: 400 });
  }

  const appId      = process.env.ONESIGNAL_APP_ID;
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !restApiKey) {
    console.error('Missing env vars: ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY');
    return new Response(JSON.stringify({ error: 'Missing env vars' }), { status: 500 });
  }

  const payload = {
    app_id:            appId,
    included_segments: ['All'],
    headings:          { en: title },
    contents:          { en: message },
  };

  console.log('Sending to OneSignal:', JSON.stringify(payload));

  // Try 'Key' prefix first (newer API keys), fall back handled by logging
  const res = await fetch('https://onesignal.com/api/v1/notifications', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Key ${restApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  console.log('OneSignal response:', JSON.stringify(data));

  if (!res.ok) {
    return new Response(JSON.stringify({ error: data }), { status: 500 });
  }

  // ── Discord webhook helper ─────────────────────────────────────────────────
  const buildDiscordBody = (title, message) => {
    const isCall       = message.includes('CALL');
    const isPut        = message.includes('PUT');
    const isAlert      = title === 'SPX Alert';
    const isPreMarket  = title === 'Pre-Market Review';
    const isPostMarket = title === 'Post-Market Review';
    const isNote       = title.includes('Note from Rose');

    let color, emoji, footer;
    if (isAlert && isCall) {
      color = 0x3DDC84; emoji = '🟢'; footer = 'SPX Options Alert';
    } else if (isAlert && isPut) {
      color = 0xFF5C5C; emoji = '🔴'; footer = 'SPX Options Alert';
    } else if (isAlert) {
      color = 0x5F5CFF; emoji = '⚡'; footer = 'SPX Options Alert';
    } else if (isPreMarket) {
      color = 0x998BFF; emoji = '🌅'; footer = 'Pre-Market Review';
    } else if (isPostMarket) {
      color = 0x5F5CFF; emoji = '🌙'; footer = 'Post-Market Review';
    } else if (isNote) {
      color = 0x3a3a5c; emoji = '📝'; footer = 'Note from Rose';
    } else {
      color = 0x5F5CFF; emoji = '📡'; footer = 'rose.trading';
    }

    return JSON.stringify({
      username:   'Rose Alerts 🌹',
      avatar_url: 'https://rose.trading/rose-logo.png',
      embeds: [{
        title:       `${emoji} ${title}`,
        description: message,
        color,
        footer:      { text: footer },
        timestamp:   new Date().toISOString(),
      }],
    });
  };

  // ── Send to Discord webhooks ───────────────────────────────────────────────
  const discordWebhooks = [
    { url: process.env.DISCORD_WEBHOOK_URL,      name: 'DISCORD_WEBHOOK_URL' },
    { url: process.env.DISCORD_ADEX_WEBHOOK_URL, name: 'DISCORD_ADEX_WEBHOOK_URL' },
  ];

  const discordBody = buildDiscordBody(title, message);

  for (const { url, name } of discordWebhooks) {
    if (!url) {
      console.warn(`${name} not set — skipping`);
      continue;
    }
    const body = name === 'DISCORD_ADEX_WEBHOOK_URL'
      ? JSON.stringify({ ...JSON.parse(discordBody), content: '<@&1316500131633299467>' })
      : discordBody;

    const discordRes = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (!discordRes.ok) {
      const err = await discordRes.text();
      console.error(`${name} webhook failed:`, err);
    } else {
      console.log(`${name} webhook sent`);
    }
  }

  return new Response(JSON.stringify({ success: true, id: data.id }), {
    status:  200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = { path: '/.netlify/functions/send-alert' };