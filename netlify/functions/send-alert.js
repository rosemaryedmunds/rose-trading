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

  // ── Discord webhook ────────────────────────────────────────────────────────
  const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (discordWebhookUrl) {
    // Detect message type from title
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

    const discordRes = await fetch(discordWebhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username:   'Rose Alerts 🌹',
        embeds: [{
          title:       `${emoji} ${title}`,
          description: `\`\`\`${message}\`\`\``,
          color,
          footer:      { text: footer },
          timestamp:   new Date().toISOString(),
        }],
      }),
    });

    if (!discordRes.ok) {
      const discordErr = await discordRes.text();
      console.error('Discord webhook failed:', discordErr);
      // Still return success — push already went out
    } else {
      console.log('Discord webhook sent');
    }
  } else {
    console.warn('DISCORD_WEBHOOK_URL not set — skipping Discord');
  }

  return new Response(JSON.stringify({ success: true, id: data.id }), {
    status:  200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = { path: '/.netlify/functions/send-alert' };