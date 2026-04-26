import { GoogleGenAI } from "@google/genai";

function extractText(result) {
  if (typeof result.text === 'string' && result.text.length > 0) return result.text;
  if (typeof result.text === 'function') return result.text();
  const part = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (part) return part;
  if (typeof result?.response?.text === 'function') return result.response.text();
  if (typeof result?.response?.text === 'string') return result.response.text;
  throw new Error(`Unrecognized response shape: ${JSON.stringify(Object.keys(result))}`);
}

function truncate(str, max = 1024) {
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

function buildDiscordPayload(brief, dateStr) {
  const formatGap = (g) => typeof g === 'object'
    ? `**${g.ticker}** ${g.move} — ${g.reason || ''}`
    : g;

  const gapUps   = brief.gaps?.ups?.map(formatGap).join('\n') || 'None';
  const gapDowns = brief.gaps?.downs?.map(formatGap).join('\n') || 'None';

  const analystText = brief.analyst_actions?.length
    ? brief.analyst_actions.join('\n')
    : 'No ratings today.';

  const newsText = brief.breaking_news?.length
    ? brief.breaking_news.join('\n')
    : 'No major catalyst news.';

  const econText = brief.econ_calendar?.length
    ? brief.econ_calendar.map(e => {
        const actual = e.actual ? ` · Actual: **${e.actual}** vs Est: ${e.forecast || '—'}` : '';
        return `\`${e.time}\` **[${e.impact}]** ${e.event}${actual}`;
      }).join('\n')
    : 'No major US data today.';

  const trumpText = brief.trump_schedule?.length
    ? brief.trump_schedule.map(s => `\`${s.time}\` ${s.event}`).join('\n')
    : 'No scheduled public events.';

  const fields = [
    {
      name: '📊 Morning Bias',
      value: truncate(brief.morning_bias || 'No bias available.'),
      inline: false
    },
    {
      name: '📈 Gap Ups',
      value: truncate(gapUps),
      inline: true
    },
    {
      name: '📉 Gap Downs',
      value: truncate(gapDowns),
      inline: true
    },
    {
      name: '📅 US Economic Calendar',
      value: truncate(econText),
      inline: false
    },
    {
      name: '🔼 Analyst Ratings',
      value: truncate(analystText),
      inline: true
    },
    {
      name: '🔥 Catalyst News',
      value: truncate(newsText),
      inline: true
    },
    {
      name: '🏛️ Trump Schedule',
      value: truncate(trumpText),
      inline: false
    },
  ];

  return {
    content: `## 🌅 Morning Brief — ${dateStr}`,
    embeds: [{
      title: '📈 Market Tone',
      description: truncate(brief.market_tone || 'Summary unavailable.', 4096),
      color: 0x998BFF,
      fields,
      footer: { text: 'Generated via Gemini 2.5 · Live Search · rose.trading' },
      url: 'https://rose.trading/morning-brief',
    }],
    components: [{
      type: 1,
      components: [{
        type: 2,
        style: 5,
        label: '📋 View Full Brief on Website',
        url: 'https://rose.trading/morning-brief',
      }],
    }],
  };
}

// ✅ Default export — required for Netlify scheduled functions
export default async (req, context) => {
  // Skip weekends
  const today = new Date();
  if (today.getDay() === 0 || today.getDay() === 6) {
    console.log('Weekend — skipping Discord brief.');
    return new Response('Weekend — skipping brief.', { status: 200 });
  }

  const webhookUrl = process.env.DISCORD_MORNING_BRIEF_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('DISCORD_MORNING_BRIEF_WEBHOOK_URL env var is not set.');
    return new Response('Missing DISCORD_MORNING_BRIEF_WEBHOOK_URL', { status: 500 });
  }

  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  const prompt = `
    Search the web for financial and political news for today, ${dateStr}.
    Prioritize data from:
    - benzinga.com (for analyst ratings and stock gaps)
    - rollcall.com or whitehouse.gov (for the Trump schedule/calendar)
    - tikr.com or marketwatch.com (for earnings and economic data)
    - reuters.com or bloomberg.com (for breaking catalyst news)

    Return ONLY raw JSON with this exact schema — no markdown, no preamble:
    {
      "market_tone": "2-3 sentence summary of overall pre-market sentiment and key drivers",
      "morning_bias": "1-2 sentence actionable bias — what to watch and why",
      "trump_schedule": [{"time": "10:00 AM ET", "event": "string"}],
      "gaps": {
        "ups": [{"ticker": "$SYMBOL", "move": "+XX%", "reason": "brief reason"}],
        "downs": [{"ticker": "$SYMBOL", "move": "-XX%", "reason": "brief reason"}]
      },
      "econ_calendar": [{"time": "8:30 AM ET", "event": "string", "impact": "HIGH or MED or LOW", "actual": "string or null", "forecast": "string or null"}],
      "analyst_actions": ["$TICKER — Firm upgrades/downgrades to Rating, PT $XX"],
      "breaking_news": ["$TICKER or Topic — 1-sentence catalyst description"]
    }
    Rules:
    - impact must be exactly "HIGH", "MED", or "LOW" (uppercase)
    - Only include US economic events
    - ticker symbols must include the $ prefix
    - If a field has no data, use an empty array []
    - Do not include any text outside the JSON object
  `;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });

    const text = extractText(result);
    const jsonString = text.replace(/```json|```/g, '').trim();
    const brief = JSON.parse(jsonString);

    const payload = buildDiscordPayload(brief, dateStr);

    const discordRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!discordRes.ok) {
      const err = await discordRes.text();
      throw new Error(`Discord webhook failed: ${discordRes.status} — ${err}`);
    }

    console.log('Discord brief sent successfully.');
    return new Response('Discord brief sent.', { status: 200 });

  } catch (err) {
    console.error('Discord brief failed:', err.message);
    return new Response(err.message, { status: 500 });
  }
};
