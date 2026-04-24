import { GoogleGenAI } from "@google/genai";

function extractText(result) {
  if (typeof result.text === 'string' && result.text.length > 0) return result.text;
  if (typeof result.text === 'function') return result.text();
  const part = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (part) return part;
  if (typeof result?.response?.text === 'function') return result.response.text();
  if (typeof result?.response?.text === 'string') return result.response.text;
  throw new Error(`Unrecognized response shape: ${JSON.stringify(Object.keys(result))}`);
}

function repairJSON(raw) {
  let str = raw.replace(/```json|```/g, '').trim();
  const start = str.indexOf('{');
  const end = str.lastIndexOf('}');
  if (start !== -1 && end !== -1) str = str.slice(start, end + 1);
  try { return JSON.parse(str); } catch (_) {}
  str = str.replace(/,\s*([\]}])/g, '$1');
  try { return JSON.parse(str); } catch (_) {}
  const opens = (str.match(/\[/g) || []).length - (str.match(/\]/g) || []).length;
  const braces = (str.match(/\{/g) || []).length - (str.match(/\}/g) || []).length;
  str += ']'.repeat(Math.max(0, opens)) + '}'.repeat(Math.max(0, braces));
  try { return JSON.parse(str); } catch (e) {
    throw new Error(`JSON parse failed: ${e.message}`);
  }
}

async function generateWithRetry(ai, prompt, maxRetries = 2) {
  let lastError;
  const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];
  for (const model of MODELS) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
            maxOutputTokens: 2000,
          },
        });
        const text = extractText(result);
        console.log(`Success with ${model} on attempt ${attempt}`);
        return text;
      } catch (err) {
        lastError = err;
        const status = err?.status || 0;
        const msg = err?.message || '';
        if (status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
          console.error(`Quota exceeded on ${model}, trying next.`);
          break;
        }
        const is503 = status === 503 || msg.includes('503') || msg.includes('UNAVAILABLE');
        if (is503 && attempt < maxRetries) {
          await new Promise(r => setTimeout(r, attempt * 1500));
          continue;
        }
        break;
      }
    }
  }
  throw lastError || new Error('All models failed');
}

export default async (req, context) => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  const prompt = `You are a financial research assistant. Today is ${today}. Search the web and return a pre-market brief for US equity traders.

You MUST search for ALL of the following:
1. Pre-market earnings movers (benzinga.com, marketwatch.com) — stocks gapping on earnings
2. Trump public schedule today (whitehouse.gov, rollcall.com) — appearances, signings, press events. If no schedule is found, use {"time":"N/A","event":"No public schedule found for today"}
3. US economic data releases today (investing.com, marketwatch.com) — US only
4. Analyst rating changes today (benzinga.com) — upgrades, downgrades, PT changes. There are almost always several on any trading day — search hard.
5. Breaking market news (reuters.com, bloomberg.com)

Return ONLY valid JSON, no markdown, no extra text:
{
  "market_tone": "2-3 sentence pre-market sentiment summary",
  "morning_bias": "1-2 sentence actionable bias with specific levels or catalysts",
  "trump_schedule": [{"time": "10:00 AM ET", "event": "event description"}],
  "gaps": {
    "ups": [{"ticker": "$SYM", "move": "+X%", "reason": "why"}],
    "downs": [{"ticker": "$SYM", "move": "-X%", "reason": "why"}]
  },
  "econ_calendar": [{"time": "8:30 AM ET", "event": "US event name", "impact": "HIGH", "actual": "value or null", "forecast": "value or null"}],
  "analyst_actions": ["$TICKER — FirmName upgrades/downgrades/raises PT to $XX (from $YY)"],
  "breaking_news": ["$TICKER or Topic — one sentence catalyst"]
}

Strict rules: US econ only. $ on all tickers. impact = HIGH, MED, or LOW. Max 6 items per array. Empty array [] only if truly nothing found.`;

  try {
    const responseText = await generateWithRetry(ai, prompt);
    const data = repairJSON(responseText);
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Briefing Error:", error.message);
    let msg = "Error loading brief. Please try again.";
    if (error.message?.includes('RESOURCE_EXHAUSTED') || error.message?.includes('429'))
      msg = "API quota exceeded. Check billing at aistudio.google.com.";
    else if (error.message?.includes('503') || error.message?.includes('UNAVAILABLE'))
      msg = "Gemini is under high demand. Try again in 1-2 minutes.";
    return new Response(JSON.stringify({ error: msg, details: error.message }), { status: 500 });
  }
};
