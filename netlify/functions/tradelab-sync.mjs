// netlify/functions/tradelab-sync.mjs
// Runs at 3:15pm CST (21:15 UTC) Monday–Friday
// Pulls today's Webull fills into TradeLab automatically

export const config = {
  schedule: "15 21 * * 1-5",
};

export default async function handler() {
  const TRADELAB_URL = process.env.TRADELAB_URL;

  if (!TRADELAB_URL) {
    console.error("TRADELAB_URL not set in Netlify environment variables");
    return;
  }

  // Get today's date in CT (UTC-5 standard, UTC-6 daylight — use UTC-5 to be safe)
  const now = new Date();
  now.setHours(now.getHours() - 5);
  const dateStr = now.toISOString().slice(0, 10);

  console.log(`[tradelab-sync] Syncing trades for ${dateStr}...`);

  try {
    const res = await fetch(`${TRADELAB_URL}/api/sync/webull?date=${dateStr}`, {
      signal: AbortSignal.timeout(120000), // 2 min timeout
    });

    const data = await res.json();

    if (data.error) {
      console.error(`[tradelab-sync] Error: ${data.error}`);
    } else if (data.inserted === 0 && data.orderCount === 0) {
      console.log(`[tradelab-sync] No trades found for ${dateStr}`);
    } else {
      console.log(`[tradelab-sync] ✓ ${dateStr}: ${data.orderCount} fills → ${data.inserted} inserted`);
    }
  } catch (err) {
    console.error(`[tradelab-sync] Failed: ${err.message}`);
  }
}
