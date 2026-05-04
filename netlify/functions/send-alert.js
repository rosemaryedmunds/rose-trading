export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { title, message, imageUrl } = JSON.parse(event.body);

  // ── OneSignal push ──────────────────────────────────────────────────────
  const pushRes = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
    },
    body: JSON.stringify({
      app_id:             process.env.ONESIGNAL_APP_ID,
      included_segments:  ['All'],
      headings:           { en: title },
      contents:           { en: message },
    }),
  });

  if (!pushRes.ok) {
    const err = await pushRes.text();
    console.error('OneSignal error:', err);
    return { statusCode: 500, body: 'OneSignal send failed' };
  }

  // ── Discord webhook ─────────────────────────────────────────────────────
  const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (discordWebhookUrl) {
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

    // Build embed — add image if URL was provided
    const embed = {
      title:       `${emoji} ${title}`,
      description: `\`\`\`${message}\`\`\``,
      color,
      footer:      { text: `${footer} | ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })} CT` },
      timestamp:   new Date().toISOString(),
    };

    // Attach image if provided
    if (imageUrl && imageUrl.trim()) {
      embed.image = { url: imageUrl.trim() };
    }

    const discordRes = await fetch(discordWebhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Rose Alerts 🌹',
        embeds:   [embed],
      }),
    });

    if (!discordRes.ok) {
      const err = await discordRes.text();
      console.error('Discord error:', err);
      // Don't fail the whole request if Discord fails
    }
  } else {
    console.warn('DISCORD_WEBHOOK_URL not set — skipping Discord');
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
}