// netlify/functions/morning-brief.js
// Data sources:
//   - Finnhub: live news (general + merger), earnings calendar, IPO calendar
//   - Roll Call Factbase: Trump's daily schedule
//   - Yahoo Finance: fallback market news
//
// Required Netlify env vars:
//   ANTHROPIC_API_KEY
//   FINNHUB_API_KEY   (free tier — finnhub.io)

const TRUMP_URL = 'https://rollcall.com/factbase/trump/topic/calendar/';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// Wraps any promise with a timeout — returns null instead of throwing
function withTimeout(promise, ms = 5000) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(null), ms)),
  ]);
}

// JSON fetch from Finnhub — never throws, returns null on failure
async function finnhubGet(path, apiKey) {
  try {
    const url = `https://finnhub.io/api/v1${path}&token=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// HTML scrape — never throws, returns '' on failure
async function safeFetch(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
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

function formatArticles(articles = []) {
  if (!articles.length) return 'None retrieved.';
  return articles
    .map((a, i) =>
      `[${i + 1}] ${a.datetime ? a.datetime + ' — ' : ''}${a.headline}` +
      (a.summary ? `\n    ${a.summary}` : '')
    )
    .join('\n');
}

function formatEarnings(data) {
  if (!data?.earningsCalendar?.length) return 'None retrieved from Finnhub.';
  return data.earningsCalendar
    .map(e =>
      `${e.symbol} — ${e.company || ''} | Hour: ${e.hour || '?'} | ` +
      `EPS est: ${e.epsEstimate ?? '?'} | Rev est: ${e.revenueEstimate ?? '?'}`
    )
    .join('\n');
}

function formatIPOs(data) {
  if (!data?.ipoCalendar?.length) return 'None today.';
  return data.ipoCalendar
    .map(e =>
      `${e.symbol || '?'} — ${e.name || ''} | Date: ${e.date} | ` +
      `Price: ${e.price || '?'} | Exchange: ${e.exchange || '?'}`
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
  const KEY = process.env.FINNHUB_API_KEY || '';
  const dateParam = `from=${isoDate}&to=${isoDate}`;

  // ── 6 fetches in parallel, each capped at 5s ─────────────────────────────
  // Total budget: ~6s for fetches + ~4s for Claude call = well under 10s limit
  const [
    trumpHtml,
    yahooNewsHtml,
    newsGeneral,
    newsMerger,
    earningsData,
    ipoData,
  ] = await Promise.all([
    withTimeout(safeFetch(TRUMP_URL)),
    withTimeout(safeFetch('https://finance.yahoo.com/topic/stock-market-news/')),
    withTimeout(KEY ? finnhubGet('/news?category=general&minId=0', KEY) : Promise.resolve([])),
    withTimeout(KEY ? finnhubGet('/news?category=merger&minId=0', KEY) : Promise.resolve([])),
    withTimeout(KEY ? finnhubGet(`/calendar/earnings?${dateParam}`, KEY) : Promise.resolve(null)),
    withTimeout(KEY ? finnhubGet(`/calendar/ipo?${dateParam}`, KEY) : Promise.resolve(null)),
  ]);

  // Process news articles
  const processArticles = (raw, limit) =>
    Array.isArray(raw)
      ? raw.slice(0, limit).map(a => ({
          headline: a.headline || '',
          summary: (a.summary || '').slice(0, 180),
          datetime: a.datetime
            ? new Date(a.datetime * 1000).toLocaleTimeString('en-US', {
                hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
              })
            : '',
        }))
      : [];

  const generalArticles = processArticles(newsGeneral, 20);
  const mergerArticles  = processArticles(newsMerger, 15);
  const trumpText       = stripHtml(trumpHtml || '').slice(0, 2500);
  const yahooText       = stripHtml(yahooNewsHtml || '').slice(0, 1500);

  const hasFinnhub = generalArticles.length > 0 || mergerArticles.length > 0;

  const sources = [
    '"Yahoo Finance"',
    '"Roll Call Factbase"',
    hasFinnhub ? '"Finnhub Live News"' : null,
    earningsData?.earningsCalendar?.length ? '"Finnhub Earnings Calendar"' : null,
    ipoData?.ipoCalendar?.length ? '"Finnhub IPO Calendar"' : null,
    '"Claude knowledge base"',
  ].filter(Boolean).join(', ');

  // ── Claude prompt ─────────────────────────────────────────────────────────
  const userMessage = `Today is ${dateStr} (${isoDate}).

Build a complete SPX/ES 0DTE morning briefing from these sources.

=== TRUMP SCHEDULE (Roll Call Factbase) ===
${trumpText || 'Unavailable.'}

=== YAHOO MARKET NEWS (fallback) ===
${yahooText || 'Unavailable.'}

=== FINNHUB LIVE GENERAL NEWS (real-time) ===
${formatArticles(generalArticles)}

=== FINNHUB LIVE MERGER/COMPANY NEWS (real-time) ===
${formatArticles(mergerArticles)}

=== FINNHUB EARNINGS CALENDAR (${isoDate}) ===
${formatEarnings(earningsData)}
BMO = before market open, AMC = after market close, DMT = during market trading.

=== FINNHUB IPO CALENDAR (${isoDate}) ===
${formatIPOs(ipoData)}

=== FILL INSTRUCTIONS ===
gap_ups/gap_downs: Scan Finnhub general news for stocks described as surging, spiking, gapping, plunging, falling pre-market. Also use your own knowledge of today's pre-market movers. Estimate % from context if not stated. Aim for 2-4 each.
analyst_actions: Scan all Finnhub feeds for "raises PT", "cuts PT", "upgrades to", "downgrades to", "initiates". Also use your own knowledge of today's analyst calls. Aim for 3-5.
earnings_today: Use Finnhub earnings calendar above. Fill company names/SPX notes from your knowledge.
company_events_today: Use IPO calendar + your knowledge of today's investor days, conferences, splits.
economic_events: Always populate — list today's scheduled US economic data releases with times.
company_news: 4-6 items from Finnhub merger feed first, then general feed.
market_tone: Synthesize all of the above into a 2-3 sentence bias read.
geopolitical: Any geopolitical/macro risk items from the news feeds.
trump_schedule: Parse Roll Call text above carefully for today's entries.

Return ONLY valid JSON — no markdown, no backticks:

{
  "generated_at": "${today.toISOString()}",
  "market_tone": {"summary":"...","bias":"bullish|bearish|neutral|mixed","bias_score":0-100,"key_risk":"..."},
  "gap_ups": [{"ticker":"XX","move":"+X.X%","name":"Company","catalyst":"reason"}],
  "gap_downs": [{"ticker":"XX","move":"-X.X%","name":"Company","catalyst":"reason"}],
  "earnings_today": [{"ticker":"XX","name":"Company","timing":"pre-market|after-close","note":"SPX impact"}],
  "earnings_week": "Key reporters this week beyond today",
  "company_events_today": [{"ticker":"XX","name":"Company","event_type":"IPO|Investor Day|Conference|Split|Other","note":"why it matters"}],
  "economic_events": [{"time":"8:30 AM ET","name":"Event","importance":"high|medium|low","note":"what to watch"}],
  "analyst_actions": [{"type":"upgrade|downgrade|initiation|pt_raise|pt_cut","ticker":"XX","firm":"Firm","action":"description","note":"impact"}],
  "geopolitical": [{"title":"Headline","body":"2-3 sentences","market_impact":"SPX/oil/rates impact","level":"high|medium|low"}],
  "company_news": [{"ticker":"XX","title":"Headline","body":"2-3 sentences for traders"}],
  "trump_schedule": [{"time":"9:00 AM","description":"Event","location":"Location","access":"Open|Closed|Pool"}],
  "trump_watch": "1-2 sentences on market-moving Trump events today",
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
        max_tokens: 4000,
        system: `You are a professional market analyst for rose.trading, an SPX/ES 0DTE options trading education platform in Houston, TX.

Rules:
1. Never return an empty array if Finnhub data or your own knowledge has relevant content.
2. economic_events: always populate — you know today's US economic calendar.
3. gap_ups/gap_downs: use news feeds + your own knowledge of today's pre-market action.
4. analyst_actions: scan all feeds for rating/PT language + use your own knowledge.
5. Return valid JSON only. No markdown. No preamble.`,
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
