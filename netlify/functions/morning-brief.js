// netlify/functions/morning-brief.js
// Required Netlify env vars: ANTHROPIC_API_KEY, FINNHUB_API_KEY

const TRUMP_URL = 'https://rollcall.com/factbase/trump/topic/calendar/';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(null), ms)),
  ]);
}

async function finnhubGet(path, apiKey) {
  try {
    const res = await fetch(`https://finnhub.io/api/v1${path}&token=${apiKey}`, {
      signal: AbortSignal.timeout(4000),
    });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

async function safeFetch(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
      signal: AbortSignal.timeout(4000),
    });
    return res.ok ? await res.text() : '';
  } catch { return ''; }
}

function stripHtml(html) {
  return (html || '')
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
  const KEY = process.env.FINNHUB_API_KEY || '';

  // ── 4 fetches, 4s each, all parallel ─────────────────────────────────────
  const [trumpHtml, newsRaw, earningsRaw, yahooHtml] = await Promise.all([
    withTimeout(safeFetch(TRUMP_URL), 4000),
    withTimeout(KEY ? finnhubGet('/news?category=general&minId=0', KEY) : Promise.resolve([]), 4000),
    withTimeout(KEY ? finnhubGet(`/calendar/earnings?from=${isoDate}&to=${isoDate}`, KEY) : Promise.resolve(null), 4000),
    withTimeout(safeFetch('https://finance.yahoo.com/topic/stock-market-news/'), 4000),
  ]);

  // Trim inputs aggressively to keep prompt short → faster Claude response
  const trumpText = stripHtml(trumpHtml || '').slice(0, 1500);
  const yahooText = stripHtml(yahooHtml || '').slice(0, 800);

  const articles = Array.isArray(newsRaw)
    ? newsRaw.slice(0, 12).map(a => ({
        headline: (a.headline || '').slice(0, 120),
        summary: (a.summary || '').slice(0, 120),
        datetime: a.datetime
          ? new Date(a.datetime * 1000).toLocaleTimeString('en-US', {
              hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
            })
          : '',
      }))
    : [];

  const newsText = articles.length
    ? articles.map((a, i) => `[${i + 1}] ${a.datetime ? a.datetime + ' — ' : ''}${a.headline}${a.summary ? ' | ' + a.summary : ''}`).join('\n')
    : 'None.';

  const earningsText = earningsRaw?.earningsCalendar?.length
    ? earningsRaw.earningsCalendar.map(e => `${e.symbol} ${e.company || ''} ${e.hour || '?'}`).join(', ')
    : 'None.';

  const userMessage = `Today: ${dateStr} (${isoDate})

TRUMP SCHEDULE: ${trumpText || 'Unavailable'}

FINNHUB NEWS: ${newsText}

EARNINGS TODAY: ${earningsText} (BMO=pre-market, AMC=after-close)

YAHOO NEWS: ${yahooText || 'Unavailable'}

Return JSON briefing. Use your own knowledge to fill any gaps — especially economic_events, analyst_actions, gap_ups, gap_downs. Never leave arrays empty if you have relevant knowledge.

{"generated_at":"${today.toISOString()}","market_tone":{"summary":"...","bias":"bullish|bearish|neutral|mixed","bias_score":50,"key_risk":"..."},"gap_ups":[{"ticker":"","move":"","name":"","catalyst":""}],"gap_downs":[{"ticker":"","move":"","name":"","catalyst":""}],"earnings_today":[{"ticker":"","name":"","timing":"pre-market|after-close","note":""}],"earnings_week":"...","company_events_today":[{"ticker":"","name":"","event_type":"","note":""}],"economic_events":[{"time":"","name":"","importance":"high|medium|low","note":""}],"analyst_actions":[{"type":"upgrade|downgrade|initiation|pt_raise|pt_cut","ticker":"","firm":"","action":"","note":""}],"geopolitical":[{"title":"","body":"","market_impact":"","level":"high|medium|low"}],"company_news":[{"ticker":"","title":"","body":""}],"trump_schedule":[{"time":"","description":"","location":"","access":""}],"trump_watch":"...","sources":["Finnhub","Roll Call","Yahoo","Claude"]}`;

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      // 25s timeout on Claude call — leaves 5s buffer inside the 30s function limit
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // Haiku is 3-5x faster than Sonnet
        max_tokens: 2000,
        system: 'You are a market analyst for SPX/ES 0DTE traders. Return only valid JSON matching the schema provided. No markdown, no backticks. Fill all arrays — never leave them empty if you have knowledge of today\'s events.',
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      return { statusCode: claudeRes.status, headers: HEADERS, body: JSON.stringify({ error: `Claude API ${claudeRes.status}`, detail: errText }) };
    }

    const data = await claudeRes.json();
    const rawText = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');

    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      const brief = JSON.parse(clean.slice(clean.indexOf('{'), clean.lastIndexOf('}') + 1));
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify(brief) };
    } catch {
      return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'JSON parse failed', raw: rawText.slice(0, 400) }) };
    }
  } catch (err) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
