// netlify/functions/morning-brief.js
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

function withTimeout(promise, ms = 4000) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(null), ms)),
  ]);
}

async function finnhubGet(path, apiKey) {
  try {
    const url = `https://finnhub.io/api/v1${path}&token=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function safeFetch(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
      signal: AbortSignal.timeout(4000),
    });
    return res.ok ? await res.text() : '';
  } catch {
    return '';
  }
}

function stripHtml(html) {
  return (html || '')
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
  if (!data?.earningsCalendar?.length) return 'None retrieved.';
  return data.earningsCalendar
    .map(e => `${e.symbol} — ${e.company || ''} | Hour: ${e.hour || '?'} | EPS est: ${e.epsEstimate ?? '?'}`)
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

  // ── 4 fetches only — well under Netlify's 10s limit ──────────────────────
  const [trumpHtml, newsGeneral, earningsData, yahooHtml] = await Promise.all([
    withTimeout(safeFetch(TRUMP_URL)),
    withTimeout(KEY ? finnhubGet('/news?category=general&minId=0', KEY) : Promise.resolve([])),
    withTimeout(KEY ? finnhubGet(`/calendar/earnings?from=${isoDate}&to=${isoDate}`, KEY) : Promise.resolve(null)),
    withTimeout(safeFetch('https://finance.yahoo.com/topic/stock-market-news/')),
  ]);

  const articles = Array.isArray(newsGeneral)
    ? newsGeneral.slice(0, 20).map(a => ({
        headline: a.headline || '',
        summary: (a.summary || '').slice(0, 180),
        datetime: a.datetime
          ? new Date(a.datetime * 1000).toLocaleTimeString('en-US', {
              hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
            })
          : '',
      }))
    : [];

  const trumpText = stripHtml(trumpHtml || '').slice(0, 2500);
  const yahooText = stripHtml(yahooHtml || '').slice(0, 1500);

  const sources = [
    '"Roll Call Factbase"',
    articles.length ? '"Finnhub Live News"' : null,
    earningsData?.earningsCalendar?.length ? '"Finnhub Earnings Calendar"' : null,
    '"Claude knowledge base"',
  ].filter(Boolean).join(', ');

  const userMessage = `Today is ${dateStr} (${isoDate}).

=== TRUMP SCHEDULE (Roll Call Factbase) ===
${trumpText || 'Unavailable.'}

=== FINNHUB LIVE NEWS (real-time) ===
${formatArticles(articles)}

=== FINNHUB EARNINGS CALENDAR (${isoDate}) ===
${formatEarnings(earningsData)}
BMO = before market open, AMC = after market close.

=== YAHOO MARKET NEWS (fallback) ===
${yahooText || 'Unavailable.'}

Using all sources above plus your own real-time knowledge, return this JSON briefing.

Rules:
- gap_ups/gap_downs: find pre-market movers in the news feeds OR use your knowledge. Estimate % from context. Aim for 2-4 each.
- analyst_actions: scan news for "raises PT / cuts PT / upgrades / downgrades / initiates" AND use your own knowledge of today's calls. Aim for 3-5.
- earnings_today: use Finnhub calendar. BMO = pre-market, AMC = after-close.
- economic_events: ALWAYS populate — you know today's US economic release schedule.
- company_events_today: use your knowledge of investor days, conferences, splits today.
- company_news: 4-6 items from the Finnhub feed above.
- trump_schedule: parse Roll Call text for today's entries.

Return ONLY valid JSON, no markdown, no backticks:

{
  "generated_at": "${today.toISOString()}",
  "market_tone": {"summary":"2-3 sentences","bias":"bullish|bearish|neutral|mixed","bias_score":0-100,"key_risk":"..."},
  "gap_ups": [{"ticker":"XX","move":"+X.X%","name":"Company","catalyst":"reason"}],
  "gap_downs": [{"ticker":"XX","move":"-X.X%","name":"Company","catalyst":"reason"}],
  "earnings_today": [{"ticker":"XX","name":"Company","timing":"pre-market|after-close","note":"SPX impact"}],
  "earnings_week": "Key reporters this week beyond today",
  "company_events_today": [{"ticker":"XX","name":"Company","event_type":"Investor Day|Conference|Split|IPO|Other","note":"why it matters"}],
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
        system: `You are a professional market analyst for rose.trading, an SPX/ES 0DTE options trading education platform in Houston, TX. Return valid JSON only — no markdown, no preamble. Never return empty arrays if you have relevant knowledge. Always populate economic_events, gap moves, and analyst_actions using your own knowledge if the feeds are light.`,
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
