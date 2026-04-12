// netlify/functions/morning-brief.js
// Fast approach: fetch raw data from public sources first,
// then send it all to Claude in ONE call (no web search tool = ~3-5 seconds)
//
// Required Netlify env var: ANTHROPIC_API_KEY

const TRUMP_URL = 'https://rollcall.com/factbase/trump/topic/calendar/';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

async function safeFetch(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; rose.trading/1.0)' },
      signal: AbortSignal.timeout(5000),
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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS, body: '' };
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const isoDate = today.toISOString().slice(0, 10);

  // ── Step 1: Fetch raw data in parallel (max 5s each) ────────────────────
  const [trumpHtml, yahooHtml, earningsHtml] = await Promise.all([
    safeFetch(TRUMP_URL),
    safeFetch('https://finance.yahoo.com/topic/stock-market-news/'),
    safeFetch(`https://finance.yahoo.com/calendar/earnings/?day=${isoDate}`),
  ]);

  const trumpText  = stripHtml(trumpHtml).slice(0, 3000);
  const marketText = stripHtml(yahooHtml).slice(0, 2000);
  const earningsText = stripHtml(earningsHtml).slice(0, 2000);

  // ── Step 2: Single fast Claude call with pre-fetched data ────────────────
  const userMessage = `Today is ${dateStr}.

Here is raw data from three sources for you to analyze:

--- TRUMP SCHEDULE (Roll Call Factbase) ---
${trumpText || 'Unavailable — use your knowledge.'}

--- MARKET NEWS (Yahoo Finance) ---
${marketText || 'Unavailable — use your knowledge.'}

--- EARNINGS CALENDAR ---
${earningsText || 'Unavailable — use your knowledge.'}

Using the data above plus your knowledge of current market conditions as of ${dateStr}, generate a complete morning market briefing JSON object.

Return ONLY valid JSON — no markdown, no backticks, no explanation before or after:
{
  "generated_at": "${today.toISOString()}",
  "market_tone": {
    "summary": "2-3 sentences on overall market bias and key themes today",
    "bias": "bullish|bearish|neutral|mixed",
    "bias_score": 0-100,
    "key_risk": "single biggest risk to watch today"
  },
  "gap_ups": [
    {"ticker": "XX", "move": "+X.X%", "name": "Company Name", "catalyst": "reason"}
  ],
  "gap_downs": [
    {"ticker": "XX", "move": "-X.X%", "name": "Company Name", "catalyst": "reason"}
  ],
  "earnings_today": [
    {"ticker": "XX", "name": "Company", "timing": "pre-market|after-close", "note": "what to watch"}
  ],
  "earnings_week": "One sentence listing major reporters this week",
  "economic_events": [
    {"time": "8:30 AM ET", "name": "Event", "importance": "high|medium|low", "note": "context"}
  ],
  "analyst_actions": [
    {"type": "upgrade|downgrade|initiation|pt_raise|pt_cut", "ticker": "XX", "firm": "Firm", "action": "description", "note": "why it matters"}
  ],
  "geopolitical": [
    {"title": "Headline", "body": "2-3 sentence summary", "market_impact": "impact on markets", "level": "high|medium|low"}
  ],
  "company_news": [
    {"ticker": "XX", "title": "Headline", "body": "2-3 sentence summary"}
  ],
  "trump_schedule": [
    {"time": "9:00 AM", "description": "Event description", "location": "Location", "access": "Open|Closed|Pool"}
  ],
  "trump_watch": "1-2 sentences on what traders should watch from Trump today",
  "sources": ["Roll Call Factbase", "Yahoo Finance", "Claude knowledge base"]
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: `You are a professional market analyst for rose.trading — a trading education platform for SPX/ES 0DTE options traders in Houston, TX. Generate accurate, concise morning briefings. Use the provided source data when available; fall back to your training knowledge when not. Always return valid JSON only — nothing else.`,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        statusCode: response.status,
        headers: HEADERS,
        body: JSON.stringify({ error: `Anthropic API ${response.status}`, detail: errText }),
      };
    }

    const data = await response.json();
    const rawText = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      const start = clean.indexOf('{');
      const end = clean.lastIndexOf('}');
      const brief = JSON.parse(clean.slice(start, end + 1));
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify(brief) };
    } catch {
      return {
        statusCode: 500,
        headers: HEADERS,
        body: JSON.stringify({ error: 'JSON parse failed', raw: rawText.slice(0, 400) }),
      };
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
