// netlify/functions/discord-morning-brief.js
//
// Scheduled function — runs Mon–Fri at 8:00 AM CT (13:00 UTC)
// Generates the morning brief and posts a formatted embed to Discord.
//
// Required Netlify env vars:
//   ANTHROPIC_API_KEY   — your Anthropic API key
//   DISCORD_WEBHOOK_URL — your Discord channel webhook URL
//
// Schedule is set in netlify.toml (see below)

const TRUMP_URL = 'https://rollcall.com/factbase/trump/topic/calendar/';

async function safeFetch(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(6000),
    });
    return res.ok ? await res.text() : '';
  } catch {
    return '';
  }
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ── Build the Discord embed from a briefing object ──────────────────────────
function buildDiscordPayload(brief, dateStr) {
  const t = brief.market_tone || {};

  // Bias color for embed sidebar
  const colorMap = { bullish: 0x4ADE80, bearish: 0xF87171, mixed: 0xFBBF24, neutral: 0x8B8FA8 };
  const color = colorMap[t.bias] || colorMap.neutral;

  // Bias emoji
  const biasEmoji = { bullish: '🟢', bearish: '🔴', mixed: '🟡', neutral: '⚪' };
  const emoji = biasEmoji[t.bias] || '⚪';

  const fields = [];

  // Market tone
  fields.push({
    name: `${emoji} Market Tone — ${(t.bias || 'neutral').toUpperCase()} ${t.bias_score || 50}%`,
    value: [
      t.summary || 'No summary available.',
      t.key_risk ? `⚠️ **Key risk:** ${t.key_risk}` : '',
    ].filter(Boolean).join('\n'),
    inline: false,
  });

  // Gap ups
  if ((brief.gap_ups || []).length > 0) {
    const lines = brief.gap_ups.slice(0, 4).map(g =>
      `\`${g.ticker}\` **${g.move}** — ${g.catalyst}`
    );
    fields.push({ name: '📈 Gap Ups', value: lines.join('\n'), inline: true });
  }

  // Gap downs
  if ((brief.gap_downs || []).length > 0) {
    const lines = brief.gap_downs.slice(0, 4).map(g =>
      `\`${g.ticker}\` **${g.move}** — ${g.catalyst}`
    );
    fields.push({ name: '📉 Gap Downs', value: lines.join('\n'), inline: true });
  }

  // Force new row if both gaps present
  if ((brief.gap_ups || []).length > 0 && (brief.gap_downs || []).length > 0) {
    fields.push({ name: '\u200b', value: '\u200b', inline: false });
  }

  // Earnings today
  if ((brief.earnings_today || []).length > 0) {
    const lines = brief.earnings_today.slice(0, 5).map(e => {
      const tag = e.timing === 'pre-market' ? '🌅 BMO' : '🌙 AMC';
      return `${tag} \`${e.ticker}\` ${e.name} — ${e.note}`;
    });
    fields.push({ name: '📊 Earnings Today', value: lines.join('\n'), inline: false });
  }

  // Economic events
  if ((brief.economic_events || []).length > 0) {
    const high = brief.economic_events.filter(e => e.importance === 'high');
    const others = brief.economic_events.filter(e => e.importance !== 'high');
    const all = [...high, ...others].slice(0, 5);
    const lines = all.map(e => {
      const imp = e.importance === 'high' ? '🔥' : e.importance === 'medium' ? '◆' : '·';
      return `${imp} **${e.time}** ${e.name}${e.note ? ` — ${e.note}` : ''}`;
    });
    fields.push({ name: '📅 Economic Calendar', value: lines.join('\n'), inline: false });
  }

  // Analyst actions
  if ((brief.analyst_actions || []).length > 0) {
    const lines = brief.analyst_actions.slice(0, 4).map(a => {
      const arrow = (a.type === 'upgrade' || a.type === 'pt_raise') ? '⬆️' :
                    (a.type === 'downgrade' || a.type === 'pt_cut') ? '⬇️' : '↔️';
      return `${arrow} \`${a.ticker}\` ${a.firm} — ${a.action}`;
    });
    fields.push({ name: '🔍 Analyst Actions', value: lines.join('\n'), inline: false });
  }

  // Geopolitical
  if ((brief.geopolitical || []).length > 0) {
    const top = brief.geopolitical.slice(0, 2);
    const lines = top.map(g => {
      const lvl = g.level === 'high' ? '🚨' : g.level === 'medium' ? '⚠️' : '📌';
      return `${lvl} **${g.title}**\n${g.body}${g.market_impact ? `\n_Market: ${g.market_impact}_` : ''}`;
    });
    fields.push({ name: '🌍 Geopolitical Watch', value: lines.join('\n\n'), inline: false });
  }

  // Trump schedule
  if ((brief.trump_schedule || []).length > 0) {
    const lines = brief.trump_schedule.slice(0, 5).map(s =>
      `\`${s.time}\` ${s.description}${s.location ? ` — ${s.location}` : ''}`
    );
    if (brief.trump_watch) {
      lines.push(`\n📡 ${brief.trump_watch}`);
    }
    fields.push({ name: '🏛️ Trump Schedule', value: lines.join('\n'), inline: false });
  }

  // Company events
  if ((brief.company_events_today || []).length > 0) {
    const lines = brief.company_events_today.slice(0, 4).map(e =>
      `\`${e.ticker}\` **${e.event_type}** — ${e.note}`
    );
    fields.push({ name: '🏢 Company Events', value: lines.join('\n'), inline: false });
  }

  // Footer
  const sources = (brief.sources || []).join(' · ');
  const genTime = brief.generated_at
    ? new Date(brief.generated_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
    : 'just now';

  return {
    content: `## 🌅 Morning Brief — ${dateStr}`,
    embeds: [{
      color,
      fields,
      footer: {
        text: `Generated ${genTime} · AI-generated · Not financial advice · ${sources}`,
      },
      url: 'https://rose.trading/morning-brief',
    }],
    components: [{
      type: 1, // Action Row
      components: [{
        type: 2, // Button
        style: 5, // Link
        label: '📋 Full Briefing on rose.trading',
        url: 'https://rose.trading/morning-brief',
      }],
    }],
  };
}

// ── Main handler ─────────────────────────────────────────────────────────────
exports.handler = async () => {
  // Skip weekends — cron runs Mon-Fri but double-check
  const today = new Date();
  const dow = today.getDay();
  if (dow === 0 || dow === 6) {
    console.log('Weekend — skipping Discord brief');
    return { statusCode: 200, body: 'Weekend skip' };
  }

  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const isoDate = today.toISOString().slice(0, 10);

  // ── 1. Fetch raw data ──────────────────────────────────────────────────────
  const [trumpHtml, earningsHtml, eventsHtml, marketNewsHtml] = await Promise.all([
    safeFetch(TRUMP_URL),
    safeFetch(`https://finance.yahoo.com/calendar/earnings?day=${isoDate}`),
    safeFetch(`https://finance.yahoo.com/calendar/?day=${isoDate}`),
    safeFetch('https://finance.yahoo.com/topic/stock-market-news/'),
  ]);

  const trumpText    = stripHtml(trumpHtml).slice(0, 3000);
  const earningsText = stripHtml(earningsHtml).slice(0, 3000);
  const eventsText   = stripHtml(eventsHtml).slice(0, 2000);
  const marketText   = stripHtml(marketNewsHtml).slice(0, 2000);

  // ── 2. Generate briefing via Claude ───────────────────────────────────────
  const userMessage = `Today is ${dateStr}.

--- TRUMP SCHEDULE (Roll Call Factbase) ---
${trumpText || 'Unavailable.'}

--- EARNINGS CALENDAR (Yahoo Finance — ${isoDate}) ---
${earningsText || 'Unavailable.'}
BMO = Before Market Open, AMC = After Market Close. Only include market cap >$500M.

--- COMPANY EVENTS (Yahoo Finance) ---
${eventsText || 'Unavailable.'}

--- MARKET NEWS (Yahoo Finance) ---
${marketText || 'Unavailable.'}

Generate the morning briefing JSON using the data above plus your knowledge of current conditions as of ${dateStr}.

Return ONLY valid JSON:
{
  "generated_at": "${today.toISOString()}",
  "market_tone": { "summary": "", "bias": "bullish|bearish|neutral|mixed", "bias_score": 0-100, "key_risk": "" },
  "gap_ups": [{"ticker":"","move":"","name":"","catalyst":""}],
  "gap_downs": [{"ticker":"","move":"","name":"","catalyst":""}],
  "earnings_today": [{"ticker":"","name":"","timing":"pre-market|after-close","note":""}],
  "earnings_week": "",
  "company_events_today": [{"ticker":"","name":"","event_type":"","note":""}],
  "economic_events": [{"time":"","name":"","importance":"high|medium|low","note":""}],
  "analyst_actions": [{"type":"upgrade|downgrade|initiation|pt_raise|pt_cut","ticker":"","firm":"","action":"","note":""}],
  "geopolitical": [{"title":"","body":"","market_impact":"","level":"high|medium|low"}],
  "company_news": [{"ticker":"","title":"","body":""}],
  "trump_schedule": [{"time":"","description":"","location":"","access":""}],
  "trump_watch": "",
  "sources": []
}`;

  let brief;
  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: 'You are a professional market analyst for rose.trading. Generate accurate morning briefings for SPX/ES 0DTE traders. Only include gap data if you have genuine knowledge of a pre-market move with a real catalyst — never fabricate percentages. Always return valid JSON only.',
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!aiRes.ok) {
      throw new Error(`Anthropic API ${aiRes.status}: ${await aiRes.text()}`);
    }

    const aiData = await aiRes.json();
    const raw = (aiData.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    brief = JSON.parse(clean.slice(clean.indexOf('{'), clean.lastIndexOf('}') + 1));
  } catch (err) {
    console.error('Brief generation failed:', err.message);
    // Post a simple error notice to Discord so you know it failed
    await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `⚠️ **Morning Brief failed** — ${dateStr}\n\`\`\`${err.message}\`\`\`\nVisit https://rose.trading/morning-brief to generate manually.`,
      }),
    });
    return { statusCode: 500, body: err.message };
  }

  // ── 3. Post to Discord ─────────────────────────────────────────────────────
  try {
    const payload = buildDiscordPayload(brief, dateStr);
    const discordRes = await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!discordRes.ok) {
      const err = await discordRes.text();
      throw new Error(`Discord webhook ${discordRes.status}: ${err}`);
    }

    console.log(`Morning brief posted to Discord — ${dateStr}`);
    return { statusCode: 200, body: `Posted: ${dateStr}` };
  } catch (err) {
    console.error('Discord post failed:', err.message);
    return { statusCode: 500, body: err.message };
  }
};
