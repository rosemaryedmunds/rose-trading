// netlify/functions/morning-brief.js
// Data sources:
//   - Finnhub: live news (general + merger), analyst recommendations, earnings calendar, IPO calendar
//   - Roll Call Factbase: Trump's daily schedule
//   - Yahoo Finance: fallback market news (best-effort scrape)
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

// ── Generic JSON fetch from Finnhub ──────────────────────────────────────────
async function finnhubGet(path, apiKey) {
  try {
    const url = `https://finnhub.io/api/v1${path}&token=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── HTML scrape (best-effort) ─────────────────────────────────────────────────
async function safeFetch(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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

// ── Format news articles for the Claude prompt ───────────────────────────────
function formatArticles(articles = []) {
  if (!articles.length) return 'None retrieved.';
  return articles
    .map((a, i) =>
      `[${i + 1}] ${a.datetime ? a.datetime + ' — ' : ''}${a.headline}` +
      (a.summary ? `\n    ${a.summary}` : '')
    )
    .join('\n');
}

// ── Format Finnhub earnings calendar ─────────────────────────────────────────
function formatEarnings(data) {
  if (!data || !Array.isArray(data.earningsCalendar) || !data.earningsCalendar.length) {
    return 'None retrieved from Finnhub.';
  }
  return data.earningsCalendar
    .map(e =>
      `${e.symbol} — ${e.company || ''} | Hour: ${e.hour || '?'} | ` +
      `EPS est: ${e.epsEstimate ?? '?'} | Rev est: ${e.revenueEstimate ?? '?'}`
    )
    .join('\n');
}

// ── Format Finnhub IPO calendar (proxy for company events) ───────────────────
function formatIPOs(data) {
  if (!data || !Array.isArray(data.ipoCalendar) || !data.ipoCalendar.length) {
    return 'None retrieved from Finnhub.';
  }
  return data.ipoCalendar
    .map(e =>
      `${e.symbol || '?'} — ${e.name || ''} | Date: ${e.date} | ` +
      `Price: ${e.price || '?'} | Shares: ${e.numberOfShares || '?'} | Exchange: ${e.exchange || '?'}`
    )
    .join('\n');
}

// ── Format Finnhub analyst recommendations ───────────────────────────────────
// /stock/recommendation returns aggregate sentiment counts — not individual actions.
// We use /news?category=general and scan for analyst language instead (see prompt).
// But we also pull a few high-profile tickers' latest recommendation trends.
function formatRecommendations(results) {
  // results is array of { symbol, data: [{period, strongBuy, buy, hold, sell, strongSell}] }
  const lines = [];
  for (const { symbol, data } of results) {
    if (!data || !data.length) continue;
    const latest = data[0]; // most recent period
    lines.push(
      `${symbol}: period ${latest.period} | StrongBuy ${latest.strongBuy} Buy ${latest.strongBuy} Hold ${latest.hold} Sell ${latest.sell} StrongSell ${latest.strongSell}`
    );
  }
  return lines.length ? lines.join('\n') : 'None retrieved.';
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

  // Date range for Finnhub calendar endpoints (today only)
  const dateParam = `from=${isoDate}&to=${isoDate}`;

  // SPX-heavy tickers to pull recommendation trends for
  const recTickers = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'GOOGL', 'TSLA', 'JPM', 'SPY'];

  // ── All fetches in parallel ───────────────────────────────────────────────
  const [
    trumpHtml,
    yahooNewsHtml,
    newsGeneral,
    newsMerger,
    earningsData,
    ipoData,
    ...recResults
  ] = await Promise.all([
    // Trump schedule
    safeFetch(TRUMP_URL),
    // Yahoo fallback news
    safeFetch('https://finance.yahoo.com/topic/stock-market-news/'),
    // Finnhub general market news
    KEY ? finnhubGet('/news?category=general&minId=0', KEY) : Promise.resolve([]),
    // Finnhub merger/company news
    KEY ? finnhubGet('/news?category=merger&minId=0', KEY) : Promise.resolve([]),
    // Finnhub earnings calendar — today
    KEY ? finnhubGet(`/calendar/earnings?${dateParam}`, KEY) : Promise.resolve(null),
    // Finnhub IPO calendar — today
    KEY ? finnhubGet(`/calendar/ipo?${dateParam}`, KEY) : Promise.resolve(null),
    // Recommendation trends for key SPX tickers
    ...recTickers.map(sym =>
      KEY
        ? finnhubGet(`/stock/recommendation?symbol=${sym}`, KEY).then(d => ({ symbol: sym, data: d }))
        : Promise.resolve({ symbol: sym, data: null })
    ),
  ]);

  // ── Process news articles ─────────────────────────────────────────────────
  const processArticles = (raw, limit) =>
    Array.isArray(raw)
      ? raw.slice(0, limit).map(a => ({
          headline: a.headline || '',
          summary: (a.summary || '').slice(0, 180),
          source: a.source || '',
          datetime: a.datetime
            ? new Date(a.datetime * 1000).toLocaleTimeString('en-US', {
                hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
              })
            : '',
        }))
      : [];

  const generalArticles = processArticles(newsGeneral, 20);
  const mergerArticles  = processArticles(newsMerger, 15);
  const trumpText       = stripHtml(trumpHtml).slice(0, 2500);
  const yahooText       = stripHtml(yahooNewsHtml).slice(0, 1500);

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

Build a complete SPX/ES 0DTE morning briefing from the sources below.

=== TRUMP SCHEDULE (Roll Call Factbase) ===
${trumpText || 'Unavailable.'}

=== YAHOO MARKET NEWS (fallback) ===
${yahooText || 'Unavailable.'}

=== FINNHUB LIVE GENERAL NEWS (real-time — highest priority) ===
${formatArticles(generalArticles)}

=== FINNHUB LIVE MERGER/COMPANY NEWS (real-time — use for company_news) ===
${formatArticles(mergerArticles)}

=== FINNHUB EARNINGS CALENDAR (today: ${isoDate}) ===
${formatEarnings(earningsData)}
Hour codes: BMO = before market open, AMC = after market close, DMT = during market trading.
Only include in earnings_today if market cap >$500M or known SPX component.

=== FINNHUB IPO CALENDAR (today: ${isoDate}) ===
${formatIPOs(ipoData)}
Use this for company_events_today (event_type: "IPO").

=== SPX KEY TICKER RECOMMENDATION TRENDS (Finnhub aggregate — last period) ===
${formatRecommendations(recResults)}
These are aggregate analyst counts, not individual actions. Use them to infer if a ticker has
a strong buy/sell skew worth noting in analyst_actions (e.g. "NVDA: 28 Buy vs 2 Sell — strong consensus").

=== SECTION-BY-SECTION INSTRUCTIONS ===
gap_ups / gap_downs:
  - Scan the Finnhub general news for ANY stock explicitly described as gapping, surging, spiking,
    jumping, plunging, falling, or moving pre-market.
  - Also use your own real-time knowledge of today's pre-market movers.
  - If no specific move % is in the news, estimate based on context (e.g. "beat earnings" = ~3-5%).
  - Aim for 2-4 entries each. Return [] only if truly nothing is moving today.

analyst_actions:
  - Scan ALL Finnhub news feeds for phrases like: "raises price target", "cuts PT", "downgrades to",
    "upgrades to Buy/Overweight", "initiates with Buy/Sell", "reiterates Outperform".
  - Also use the recommendation trends above — if a ticker has a lopsided count, note it.
  - Use your knowledge of today's analyst actions if Finnhub feeds are light.
  - Aim for 3-5 entries. Return [] only if genuinely nothing today.

earnings_today:
  - Use the Finnhub earnings calendar above as primary source.
  - Fill in company names and SPX-impact notes from your knowledge.
  - Return [] only if the calendar genuinely shows no earnings today.

company_events_today:
  - Use IPO calendar above for IPOs.
  - Use your knowledge for investor days, conferences, spin-offs, and splits today.
  - Aim for 2-4 entries if any exist.

economic_events:
  - ALWAYS populate this from your knowledge of today's US economic data schedule.
  - Today is ${dateStr} — what economic releases are scheduled?

company_news:
  - Use Finnhub merger/company feed first, then general feed.
  - 4-6 items. Identify ticker from context where possible, else "MACRO".

market_tone:
  - Synthesize everything above into a 2-3 sentence bias read.

Return ONLY valid JSON — no markdown, no backticks, no preamble:

{
  "generated_at": "${today.toISOString()}",
  "market_tone": {
    "summary": "2-3 sentences on overall market bias and key themes",
    "bias": "bullish|bearish|neutral|mixed",
    "bias_score": 0-100,
    "key_risk": "single biggest risk today"
  },
  "gap_ups": [{"ticker":"XX","move":"+X.X%","name":"Company","catalyst":"reason"}],
  "gap_downs": [{"ticker":"XX","move":"-X.X%","name":"Company","catalyst":"reason"}],
  "earnings_today": [{"ticker":"XX","name":"Company","timing":"pre-market|after-close","note":"SPX impact"}],
  "earnings_week": "Key reporters this week beyond today",
  "company_events_today": [{"ticker":"XX","name":"Company","event_type":"IPO|Investor Day|Conference|Split|Other","note":"why it matters"}],
  "economic_events": [{"time":"8:30 AM ET","name":"Event","importance":"high|medium|low","note":"what to watch"}],
  "analyst_actions": [{"type":"upgrade|downgrade|initiation|pt_raise|pt_cut","ticker":"XX","firm":"Firm","action":"description","note":"market impact"}],
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
        system: `You are a professional market analyst for rose.trading, a trading education site for SPX/ES 0DTE options traders in Houston, TX.

Critical rules:
1. NEVER return an empty array if there is any data in the sources above, or if you have real-time knowledge of relevant events. Empty arrays are a last resort only.
2. For gap_ups/gap_downs: look hard in the news feeds for pre-market movers. Use your own knowledge of today's pre-market action if feeds are light. Estimate move % from context if not stated.
3. For analyst_actions: scan every news feed for rating/PT language. Also use your own knowledge of today's analyst actions.
4. For economic_events: always populate — use your knowledge of today's US economic calendar.
5. For earnings_today: use the Finnhub calendar data provided. It is real and accurate.
6. Return valid JSON only. No markdown fences, no preamble, no postamble.`,
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
