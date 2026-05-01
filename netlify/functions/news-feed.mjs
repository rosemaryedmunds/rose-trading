import { XMLParser } from 'fast-xml-parser';

// ── CONFIG ────────────────────────────────────────────────────────────────────
const DISCORD_WEBHOOK = process.env.NEWS_DISCORD_WEBHOOK;

const FEEDS = [
  {
    name: 'Reuters Markets',
    url: 'https://feeds.reuters.com/reuters/businessNews',
    emoji: '📰',
    color: 0xFF6600,
  },
  {
    name: 'Benzinga',
    url: 'https://www.benzinga.com/feed',
    emoji: '⚡',
    color: 0x00BFFF,
  },
  {
    name: 'MarketWatch',
    url: 'https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines',
    emoji: '📊',
    color: 0x00C851,
  },
  {
    name: 'Investing.com News',
    url: 'https://www.investing.com/rss/news.rss',
    emoji: '🌐',
    color: 0xFFD700,
  },
];

// How far back to look (in minutes) — run every 15 min, look back 16 to avoid gaps
const LOOKBACK_MINUTES = 16;

// ── HELPERS ───────────────────────────────────────────────────────────────────
function truncate(str, max = 200) {
  if (!str) return '';
  const clean = str.replace(/<[^>]+>/g, '').trim();
  return clean.length > max ? clean.slice(0, max) + '…' : clean;
}

async function fetchFeed(feed) {
  const res = await fetch(feed.url, {
    headers: { 'User-Agent': 'rose.trading/1.0 news-aggregator' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${feed.url}`);
  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml);
  return parsed?.rss?.channel?.item || parsed?.feed?.entry || [];
}

function getItemDate(item) {
  const raw = item.pubDate || item.published || item.updated || item['dc:date'];
  return raw ? new Date(raw) : null;
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default async function handler(req) {
  if (!DISCORD_WEBHOOK) {
    console.error('NEWS_DISCORD_WEBHOOK env var not set');
    return new Response('Missing webhook', { status: 500 });
  }

  const cutoff = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000);
  const allEmbeds = [];

  for (const feed of FEEDS) {
    try {
      const items = await fetchFeed(feed);
      const recent = items.filter(item => {
        const d = getItemDate(item);
        return d && d > cutoff;
      });

      for (const item of recent.slice(0, 5)) { // max 5 per feed per run
        const title = item.title?.['#text'] || item.title || 'No title';
        const link = item.link?.['@_href'] || item.link || item.guid?.['#text'] || item.guid || '';
        const desc = truncate(item.description || item.summary || item.content || '');
        const pubDate = getItemDate(item);

        allEmbeds.push({
          title: typeof title === 'string' ? title.slice(0, 256) : 'News',
          url: typeof link === 'string' ? link : undefined,
          description: desc || undefined,
          color: feed.color,
          footer: { text: `${feed.emoji} ${feed.name}` },
          timestamp: pubDate?.toISOString(),
        });
      }
    } catch (err) {
      console.warn(`Feed error [${feed.name}]:`, err.message);
    }
  }

  if (allEmbeds.length === 0) {
    console.log('No new items since last run');
    return new Response('No new items', { status: 200 });
  }

  // Discord allows max 10 embeds per message — batch them
  for (let i = 0; i < allEmbeds.length; i += 10) {
    const batch = allEmbeds.slice(i, i + 10);
    const payload = {
      username: 'Rose News Feed',
      avatar_url: 'https://rose.trading/favicon.ico',
      embeds: batch,
    };

    const res = await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Discord webhook error:', err);
    }

    // Small delay between batches to avoid rate limits
    if (i + 10 < allEmbeds.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`Posted ${allEmbeds.length} items to Discord`);
  return new Response(`Posted ${allEmbeds.length} items`, { status: 200 });
}