/**
 * anthropic-proxy.js — Netlify serverless function
 *
 * General-purpose proxy for Anthropic API calls from the rose.trading dashboard.
 * Used by the Chart Analysis tab and any other feature that calls Claude.
 * Runs server-side — no CORS issues, API key never exposed to the browser.
 *
 * Required env vars (set in Netlify → Site config → Environment variables):
 *   ANTHROPIC_API_KEY   — your key from console.anthropic.com
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

// Fields we allow the client to control
const ALLOWED_FIELDS = ['model', 'max_tokens', 'system', 'messages', 'tools', 'tool_choice', 'temperature'];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

  if (!ANTHROPIC_KEY) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured in Netlify environment variables' })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  // Whitelist only safe fields — prevent prompt injection from client
  const safePayload = {};
  for (const field of ALLOWED_FIELDS) {
    if (payload[field] !== undefined) safePayload[field] = payload[field];
  }

  // Ensure sensible defaults
  safePayload.model = safePayload.model || 'claude-sonnet-4-20250514';
  safePayload.max_tokens = Math.min(safePayload.max_tokens || 1500, 4000);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(safePayload)
    });

    const data = await res.json();

    return {
      statusCode: res.status,
      headers: CORS_HEADERS,
      body: JSON.stringify(data)
    };

  } catch (err) {
    console.error('anthropic-proxy error:', err.message);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message })
    };
  }
};
