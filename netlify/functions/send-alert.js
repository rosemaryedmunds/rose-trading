export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { title, message, notes, imageUrl } = JSON.parse(event.body);

  // ── OneSignal push ──────────────────────────────────────────────────────
  try {
    const pushRes = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id:            process.env.ONESIGNAL_APP_ID,
        included_segments: ['All'],
        headings:          { en: title },
        contents:          { en: message },
        url:               'https://rose.trading/alerts-members-x9q3',
      }),
    });
    if (!pushRes.ok) console.error('OneSignal error:', await pushRes.text());
  } catch (err) {
    console.error('OneSignal exception:', err);
  }

  // ── Discord helpers ─────────────────────────────────────────────────────
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

  const ctTime = new Date().toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

  // Build description — notes appended below message if present
  let description = message;
  if (notes && notes.trim()) {
    description += `\n\n📌 ${notes.trim()}`;
  }

  const avatarUrl = 'https://rose.trading/rose-logo.png';

  const embed = {
    title:       `${emoji} ${title}`,
    description: `\`\`\`${description}\`\`\``,
    color,
    thumbnail: { url: avatarUrl },
    footer: {
      text:     `${footer} | ${ctTime} CT`,
      icon_url: avatarUrl,
    },
    timestamp: new Date().toISOString(),
  };

  if (imageUrl && imageUrl.trim()) {
    embed.image = { url: imageUrl.trim() };
  }

  // ── Primary Discord webhook ─────────────────────────────────────────────
  const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (discordWebhookUrl) {
    try {
      const res = await fetch(discordWebhookUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username:   'Rose Alerts 🌹',
          avatar_url: avatarUrl,
          embeds:     [embed],
        }),
      });
      if (!res.ok) console.error('Discord primary error:', await res.text());
    } catch (err) {
      console.error('Discord primary exception:', err);
    }
  }

  // ── ADEX Discord webhook ────────────────────────────────────────────────
  const adexWebhookUrl = process.env.DISCORD_ADEX_WEBHOOK_URL;
  if (adexWebhookUrl) {
    try {
      const res = await fetch(adexWebhookUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content:    '<@&1316500131633299467>',
          username:   'Rose Alerts 🌹',
          avatar_url: avatarUrl,
          embeds:     [embed],
        }),
      });
      if (!res.ok) console.error('Discord ADEX error:', await res.text());
    } catch (err) {
      console.error('Discord ADEX exception:', err);
    }
  }

  // ── Save to feed (members page) ────────────────────────────────────────
  try {
    const feedItem = {
      type:      title === 'SPX Alert' ? 'alert' : (title.toLowerCase().includes('review') ? 'review' : 'note'),
      title,
      message,
      notes:     notes  || null,
      imageUrl:  imageUrl || null,
      timestamp: new Date().toISOString(),
    };

    const siteUrl = process.env.URL || 'https://rose.trading';
    await fetch(`${siteUrl}/.netlify/functions/save-feed`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(feedItem),
    });
  } catch (err) {
    console.error('Feed save error:', err);
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
}