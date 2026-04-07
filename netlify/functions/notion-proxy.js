const DB_ID = '30e626c1-f8f8-8027-a6dc-fd63cf9db4a7';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  if (!NOTION_TOKEN) return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'NOTION_TOKEN not set in Netlify environment variables' }) };

  try {
    const trades = [];
    let cursor = undefined;

    do {
      const body = { page_size: 100, sorts: [{ property: 'Date', direction: 'descending' }] };
      if (cursor) body.start_cursor = cursor;

      const res = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Notion API error ${res.status}`);
      }

      const data = await res.json();

      for (const page of data.results) {
        const p = page.properties;
        trades.push({
          date:            p['Date']?.date?.start || null,
          setup:           p['Saty Setup']?.rich_text?.[0]?.plain_text || '',
          direction:       p['Direction']?.select?.name || '',
          option_type:     p['Option Type']?.select?.name || '',
          entry_price:     p['Entry Price']?.number || null,
          exit_price:      p['Exit Price']?.number || null,
          pnl:             p['P&L ($)']?.number ?? null,
          grade:           p['Grade']?.select?.name || '',
          emotional_grade: p['Emotional Grade']?.select?.name || '',
          notes:           p['Notes']?.rich_text?.[0]?.plain_text || '',
          claude_notes:    p['Claude Notes']?.rich_text?.[0]?.plain_text || '',
          symbol:          p['Underlying']?.rich_text?.[0]?.plain_text || 'SPX',
          strike:          p['Strike']?.number || null,
          qty:             p['Qty / Contracts']?.number || null,
          entry_time:      p['Entry Time']?.rich_text?.[0]?.plain_text || '',
          exit_time:       p['Exit Time']?.rich_text?.[0]?.plain_text || '',
          session:         p['Session']?.select?.name || '',
          winner:          p['Winner?']?.checkbox || false
        });
      }

      cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ trades, synced_at: new Date().toISOString() })
    };

  } catch (err) {
    console.error('notion-proxy error:', err.message);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
