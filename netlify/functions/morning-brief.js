// netlify/functions/morning-brief.js
// Fetches earnings from Yahoo Finance, Trump's schedule from Roll Call Factbase,
// and live market + company news from Finnhub — passes all to Claude in one call.
//
// Required Netlify env vars:
//   ANTHROPIC_API_KEY   — your Anthropic key
//   FINNHUB_API_KEY     — your Finnhub key (free tier at finnhub.io)

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

// Fetch general market news from Finnhub (macro, broad market)
async function fetchFinnhubMarketNews(apiKey) {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/news?category=general&minId=0&token=${apiKey}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return [];
    const articles = await res.json();
    return articles.slice(0, 25).map(a => ({
      headline: a.headline || '',
      summary: (a.summary || '').slice(0, 180),
      source: a.source || '',
      datetime: a.datetime
        ? new Date(a.datetime * 1000).toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
          })
        : '',
    }));
  } catch {
    return [];
  }
}

// Fetch merger/company-specific news from Finnhub (category=merger)
// This catches earnings reactions, analyst actions, corporate events
async function fetchFinnhubCompanyNews(apiKey) {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/news?category=merger&minId=0&token=${apiKey}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return [];
    const articles = await res.json();
    return articles.slice(0, 15).map(a => ({
      headline: a.headline || '',
      summary: (a.summary || '').slice(0, 180),
      source: a.source || '',
      datetime: a.datetime
        ? new Date(a.datetime * 1000).toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
          })
        : '',
    }));
  } catch {
    return [];
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

function formatArticles(articles) {
  if (!articles.length) return 'None available.';
  return articles
    .map((a, i) =>
      `[${i + 1}] ${a.datetime ? a.datetime + ' — ' : ''}${a.headline}` +
      (a.summary ? `\n    ${a.summary}` : '')
    )
    .join('\n');
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
  const finnhubKey = process.env.FINNHUB_API_KEY || '';

  // ── Fetch all sources in parallel ────────────────────────────────────────
  const [
    trumpHtml,
    earningsHtml,
    eventsHtml,
    marketNewsHtml,
    finnhubMarket,
    finnhubCompany,
  ] = await Promise.all([
    safeFetch(TRUMP_URL),
    safeFetch(`https://finance.yahoo.com/calendar/earnings?day=${isoDate}`),
    safeFetch(`https://finance.yahoo.com/calendar/?day=${isoDate}`),
    safeFetch('https://finance.yahoo.com/topic/stock-market-news/'),
    finnhubKey ? fetchFinnhubMarketNews(finnhubKey) : Promise.resolve([]),
    finnhubKey ? fetchFinnhubCompanyNews(finnhubKey) : Promise.resolve([]),
  ]);

  const trumpText    = stripHtml(trumpHtml).slice(0, 2500);
  const earningsText = stripHtml(earningsHtml).slice(0, 2500);
  const eventsText   = stripHtml(eventsHtml).slice(0, 1500);
  const marketText   = stripHtml(marketNewsHtml).slice(0, 1500);

  const hasFinnhub = finnhubMarket.length > 0 || finnhubCompany.length > 0;

  const sources = [
    '"Yahoo Finance Earnings Calendar"',
    '"Yahoo Finance Events Calendar"',
    '"Roll Call Factbase"',
    hasFinnhub ? '"Finnhub Live News"' : null,
    '"Claude knowledge base"',
  ].filter(Boolean).join(', ');

  // ── Claude prompt ─────────────────────────────────────────────────────────
  const userMessage = `Today is ${dateStr}.

DATA SOURCES — use all of them to build the JSON briefing below.

=== TRUMP SCHEDULE (Roll Call Factbase) ===
${trumpText || 'Unavailable.'}

=== EARNINGS CALENDAR (Yahoo Finance — ${isoDate}) ===
${earningsText || 'Unavailable.'}
BMO = Before Market Open, AMC = After Market Close, TAS = Time As Scheduled.
Only include market cap >$500M names most likely to move SPX/ES.

=== COMPANY EVENTS CALENDAR (Yahoo Finance) ===
${eventsText || 'Unavailable.'}

=== YAHOO MARKET NEWS ===
${marketText || 'Unavailable.'}

=== FINNHUB LIVE MARKET NEWS (real-time — prioritize over training data) ===
${formatArticles(finnhubMarket)}

=== FINNHUB LIVE COMPANY/MERGER NEWS (real-time — use for company_news and analyst_actions) ===
${formatArticles(finnhubCompany)}

INSTRUCTIONS:
- gap_ups / gap_downs: Extract from Finnhub headlines any stocks moving pre-market with a stated catalyst. Only include real moves you can identify from the headlines above — no fabrication.
- analyst_actions: Look in both Finnhub feeds for upgrade/downgrade/price-target language (e.g. "raises PT", "downgrades to Neutral", "initiates at Buy"). Extract ticker, firm, and action type.
- company_news: Pull the 4-6 most market-moving headlines from Finnhub. Identify ticker from headline context. Use "MACRO" if no specific ticker.
- company_events_today: Use Yahoo events calendar data above.
- economic_events: Use your knowledge of today's scheduled US economic data releases — include time, name, importance, and what to watch.
- market_tone: Synthesize Finnhub headlines + economic events into a 2-3 sentence bias summary.
- geopolitical: Extract any geopolitical/macro risk items from Finnhub headlines.
- trump_schedule: Parse Roll Call text above for today's schedule entries.

Return ONLY valid JSON — no markdown, no backticks, no explanation. Fill every array — do not leave them empty unless there is genuinely nothing to report:

{
  "generated_at": "${today.toISOString()}",
  "market_tone": {
    "summary": "2-3 sentences on overall market bias and key themes today",
    "bias": "bullish|bearish|neutral|mixed",
    "bias_score": 0-100,
    "key_risk": "single biggest risk to watch today"
  },
  "gap_ups": [{"ticker": "XX", "move": "+X.X%", "name": "Company Name", "catalyst": "reason"}],
  "gap_downs": [{"ticker": "XX", "move": "-X.X%", "name": "Company Name", "catalyst": "reason"}],
  "earnings_today": [{"ticker": "XX", "name": "Company", "timing": "pre-market|after-close", "note": "SPX impact note"}],
  "earnings_week": "Most important earnings reporters this week beyond today",
  "company_events_today": [{"ticker": "XX", "name": "Company", "event_type": "Investor Day|Conference|Split|IPO|Other", "note": "why it matters"}],
  "economic_events": [{"time": "8:30 AM ET", "name": "Event Name", "importance": "high|medium|low", "note": "what to watch"}],
  "analyst_actions": [{"type": "upgrade|downgrade|initiation|pt_raise|pt_cut", "ticker": "XX", "firm": "Firm Name", "action": "short description", "note": "market impact"}],
  "geopolitical": [{"title": "Headline", "body": "2-3 sentence summary", "market_impact": "impact on SPX/oil/rates", "level": "high|medium|low"}],
  "company_news": [{"ticker": "XX", "title": "Headline", "body": "2-3 sentence summary for traders"}],
  "trump_schedule": [{"time": "9:00 AM", "description": "Event description", "location": "Location", "access": "Open|Closed|Pool"}],
  "trump_watch": "1-2 sentences on what traders should watch from Trump today",
  "sources": [${sources}]
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
        max_tokens: 4000, // ← was 1000, now 4000 — enough to fill all arrays
        system: `You are a professional market analyst for rose.trading, a trading education platform for SPX/ES 0DTE options traders in Houston, TX.

Generate a complete morning briefing from the raw data provided. Rules:
- NEVER return empty arrays if Finnhub headlines contain relevant data. Always extract company_news, analyst_actions, and gap moves from the live feeds.
- For gaps: only include moves explicitly mentioned in Finnhub headlines. State the move % and catalyst from the headline. Never fabricate.
- For analyst_actions: scan both Finnhub feeds for rating/PT language. Common phrases: "raises price target", "downgrades", "initiates coverage", "cuts to", "upgrades to Buy".
- For economic_events: always populate this — use your knowledge of today's US economic calendar even if not in the scraped data.
- For company_news: use Finnhub merger/company feed first, then general feed. Aim for 4-6 items.
- Return valid JSON only. No markdown, no preamble.`,
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
