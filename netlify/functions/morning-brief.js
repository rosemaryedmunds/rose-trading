// netlify/functions/morning-brief.js
// Fetches earnings from Yahoo Finance calendar, company events from Yahoo Finance events,
// and Trump's schedule from Roll Call Factbase — then passes all to Claude in one fast call.
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
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS, body: '' };
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  // Build date strings for Yahoo Finance URLs (YYYY-MM-DD)
  const isoDate = today.toISOString().slice(0, 10);

  // ── Fetch all sources in parallel ────────────────────────────────────────
  const [
    trumpHtml,
    earningsHtml,
    eventsHtml,
    marketNewsHtml,
  ] = await Promise.all([
    // Trump's daily schedule
    safeFetch(TRUMP_URL),
    // Yahoo Finance earnings calendar — today's date
    safeFetch(`https://finance.yahoo.com/calendar/earnings?day=${isoDate}`),
    // Yahoo Finance company events calendar — today's date (investor days, conferences, etc.)
    safeFetch(`https://finance.yahoo.com/calendar/?day=${isoDate}`),
    // Yahoo Finance stock market news for broader market context
    safeFetch('https://finance.yahoo.com/topic/stock-market-news/'),
  ]);

  // Strip HTML and truncate to keep tokens manageable
  const trumpText    = stripHtml(trumpHtml).slice(0, 3000);
  const earningsText = stripHtml(earningsHtml).slice(0, 3000);
  const eventsText   = stripHtml(eventsHtml).slice(0, 2000);
  const marketText   = stripHtml(marketNewsHtml).slice(0, 2000);

  // ── Single Claude call ────────────────────────────────────────────────────
  const userMessage = `Today is ${dateStr}.

I'm giving you four raw data sources. Extract and synthesize the most relevant information for an SPX/ES 0DTE options trader's morning briefing.

--- TRUMP SCHEDULE (Roll Call Factbase — today's entries) ---
${trumpText || 'Unavailable — use your knowledge for today.'}

--- EARNINGS CALENDAR (Yahoo Finance — today: ${isoDate}) ---
${earningsText || 'Unavailable — use your knowledge for today.'}
Note: BMO = Before Market Open (pre-market), AMC = After Market Close, TAS = Time As Scheduled.
Focus on large-cap names with market cap >$1B that are most likely to move SPX/ES.

--- COMPANY EVENTS CALENDAR (Yahoo Finance — investor days, conferences, splits, IPOs) ---
${eventsText || 'Unavailable — use your knowledge for today.'}

--- MARKET NEWS (Yahoo Finance) ---
${marketText || 'Unavailable — use your knowledge for today.'}

Using all the above plus your own knowledge of current conditions as of ${dateStr}, generate the complete morning briefing JSON.

Return ONLY valid JSON — no markdown, no backticks, no explanation:
{
  "generated_at": "${today.toISOString()}",
  "market_tone": {
    "summary": "2-3 sentences on overall market bias and key themes today",
    "bias": "bullish|bearish|neutral|mixed",
    "bias_score": 0-100,
    "key_risk": "single biggest risk to watch today in one sentence"
  },
  "gap_ups": [
    {"ticker": "XX", "move": "+X.X%", "name": "Company Name", "catalyst": "reason for gap"}
  ],
  "gap_downs": [
    {"ticker": "XX", "move": "-X.X%", "name": "Company Name", "catalyst": "reason for gap"}
  ],
  "earnings_today": [
    {"ticker": "XX", "name": "Company", "timing": "pre-market|after-close", "note": "what to watch for SPX impact"}
  ],
  "earnings_week": "One sentence listing the most important reporters this week beyond today",
  "company_events_today": [
    {"ticker": "XX", "name": "Company", "event_type": "Investor Day|Conference|Split|IPO|Other", "note": "why it matters"}
  ],
  "economic_events": [
    {"time": "8:30 AM ET", "name": "Event Name", "importance": "high|medium|low", "note": "what to watch"}
  ],
  "analyst_actions": [
    {"type": "upgrade|downgrade|initiation|pt_raise|pt_cut", "ticker": "XX", "firm": "Firm Name", "action": "short description", "note": "market impact"}
  ],
  "geopolitical": [
    {"title": "Headline", "body": "2-3 sentence summary", "market_impact": "direct impact on SPX/oil/rates", "level": "high|medium|low"}
  ],
  "company_news": [
    {"ticker": "XX", "title": "Headline", "body": "2-3 sentence summary of why it matters for traders"}
  ],
  "trump_schedule": [
    {"time": "9:00 AM", "description": "Event description", "location": "Location", "access": "Open|Closed|Pool"}
  ],
  "trump_watch": "1-2 sentences on what traders should specifically watch from Trump today — any scheduled press events, policy meetings, or social media patterns that could move markets",
  "sources": ["Yahoo Finance Earnings Calendar", "Yahoo Finance Events Calendar", "Roll Call Factbase", "Claude knowledge base"]
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
        system: `You are a professional market analyst for rose.trading — a trading education platform for SPX/ES 0DTE options traders in Houston, TX. 

Your job is to generate a concise, accurate morning market briefing from the raw data provided. Follow these rules:
- For earnings_today: only include companies with market cap >$500M or that are known SPX component stocks. Prefer BMO (pre-market) names as they directly affect the open.
- For company_events_today: focus on events that could move individual stocks or sectors — investor days with guidance, major conferences, stock splits effective today.
- For gaps: only include if you have specific knowledge of a genuine pre-market move with a real catalyst. Do not fabricate gap percentages.
- For trump_schedule: parse the Roll Call text carefully — extract time, event description, location, and press access level.
- Always return valid JSON only. No markdown fences, no preamble, no postamble.`,
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
