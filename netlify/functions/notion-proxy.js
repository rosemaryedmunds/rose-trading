/**
 * notion-proxy.js — Netlify serverless function
 *
 * Fetches trades from Rose's Webull Journal Notion database via
 * the Anthropic API + Notion MCP. Runs server-side so there are
 * no CORS issues when called from the rose.trading dashboard.
 *
 * Required env vars (set in Netlify → Site config → Environment variables):
 *   ANTHROPIC_API_KEY   — your key from console.anthropic.com
 *   NOTION_TOKEN        — your integration token from notion.so/profile/integrations
 */

const DB_ID = '30e626c1-f8f8-80f4-83cf-000bde7776e8';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const NOTION_TOKEN  = process.env.NOTION_TOKEN;

  if (!ANTHROPIC_KEY) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not set — add it in Netlify → Site config → Environment variables' })
    };
  }

  if (!NOTION_TOKEN) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'NOTION_TOKEN not set — add it in Netlify → Site config → Environment variables' })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const action = body.action || 'fetch-journal';

  if (action !== 'fetch-journal') {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: `Unknown action: ${action}` }) };
  }

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'mcp-client-2025-11-20'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        system: `You are a Notion data fetcher. Use the notion MCP tool to query ALL pages from the Webull Journal trading database (ID: ${DB_ID}).

Return ONLY a raw JSON array — no markdown, no explanation, no code fences, no preamble. Start with [ and end with ].

Each object must have exactly these fields (use null if missing):
date, setup, direction, option_type, entry_price, exit_price, pnl, grade, emotional_grade, notes, claude_notes, symbol, strike, qty, entry_time, exit_time, session, winner

Map from Notion properties:
- date       → Date field (date start, format YYYY-MM-DD)
- setup      → "Saty Setup" (rich_text)
- direction  → Direction (select: LONG/SHORT)
- option_type→ "Option Type" (select: CALL/PUT)
- entry_price→ "Entry Price" (number)
- exit_price → "Exit Price" (number)
- pnl        → "P&L ($)" (number)
- grade      → Grade (select)
- emotional_grade → "Emotional Grade" (select)
- notes      → Notes (rich_text)
- claude_notes → "Claude Notes" (rich_text)
- symbol     → Underlying (rich_text, default "SPX")
- strike     → Strike (number)
- qty        → "Qty / Contracts" (number)
- entry_time → "Entry Time" (rich_text)
- exit_time  → "Exit Time" (rich_text)
- session    → Session (select: AM/PM)
- winner     → "Winner?" (checkbox boolean)

Sort by date descending. Return ONLY the JSON array.`,
        messages: [{
          role: 'user',
          content: `Fetch all pages from Notion database ID ${DB_ID} and return them as a JSON array.`
        }],
mcp_servers: [{
  type: 'url',
  url: 'https://mcp.notion.com/mcp',
  name: 'notion',
  authorization_token: NOTION_TOKEN
}],
tools: [{
  type: 'mcp_toolset',
  mcp_server_name: 'notion'
}]
    });

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.json().catch(() => ({}));
      throw new Error(errBody.error?.message || `Anthropic API error ${anthropicRes.status}`);
    }

    const anthropicData = await anthropicRes.json();

    // Extract text blocks from response
    const text = (anthropicData.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    if (!text.trim()) {
      throw new Error('Empty response from Claude — check that NOTION_TOKEN has access to the Webull Journal database');
    }

    // Parse the JSON array out of the response
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      console.error('Raw Claude response:', text.slice(0, 500));
      throw new Error('Claude did not return a JSON array');
    }

    const trades = JSON.parse(match[0]);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        trades: Array.isArray(trades) ? trades.filter(t => t.date) : [],
        synced_at: new Date().toISOString()
      })
    };

  } catch (err) {
    console.error('notion-proxy error:', err.message);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message })
    };
  }
};
