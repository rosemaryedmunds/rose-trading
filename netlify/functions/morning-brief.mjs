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

async function generateWithRetry(ai, prompt, maxRetries = 2) {
  let lastError;
  const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

  for (const model of MODELS) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await ai.models.generateContent({
          model,
          contents: prompt,
          config: { tools: [{ googleSearch: {} }] },
        });
        const text = extractText(result);
        console.log(`Success with ${model} on attempt ${attempt}`);
        return text;
      } catch (err) {
        lastError = err;
        const status = err?.status || 0;
        const msg = err?.message || '';

        if (status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
          console.error(`Quota exceeded on ${model}.`);
          break; // try next model
        }

        const is503 = status === 503 || msg.includes('503') || msg.includes('UNAVAILABLE');
        if (is503 && attempt < maxRetries) {
          const delay = attempt * 1500;
          console.log(`${model} attempt ${attempt} got 503, retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        console.error(`${model} attempt ${attempt} failed:`, msg);
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

  const prompt = `
    You are a financial research assistant. Search the web thoroughly for today's data: ${today}.

    REQUIRED searches to perform:
    1. Search "pre-market earnings movers ${today}" on benzinga.com or marketwatch.com — find stocks gapping up or down on earnings beats/misses
    2. Search "Trump schedule today ${today}" on rollcall.com, whitehouse.gov, or reuters.com — find any public appearances, signings, or press events
    3. Search "US economic calendar ${today}" on investing.com or marketwatch.com — find scheduled US data releases
    4. Search "analyst upgrades downgrades ${today}" on benzinga.com — find rating changes with price targets
    5. Search "market moving news pre-market ${today}" on reuters.com or bloomberg.com — find catalyst news

    Return ONLY raw JSON with this exact schema — absolutely no markdown, no backticks, no preamble text:
    {
      "market_tone": "2-3 sentence summary of overall pre-market sentiment and key drivers",
      "morning_bias": "1-2 sentence actionable bias — what to watch and why (specific levels, setups, or catalyst risk)",
      "trump_schedule": [{"time": "10:00 AM ET", "event": "description of event"}],
      "gaps": {
        "ups": [{"ticker": "$SYMBOL", "move": "+XX%", "reason": "beat EPS by $X, raised guidance"}],
        "downs": [{"ticker": "$SYMBOL", "move": "-XX%", "reason": "missed revenue est by $XB"}]
      },
      "econ_calendar": [{"time": "8:30 AM ET", "event": "event name", "impact": "HIGH", "actual": "214K or null if not yet released", "forecast": "210K or null"}],
      "analyst_actions": ["$TICKER — FirmName upgrades/downgrades/raises PT to $XX (from $XX)"],
      "breaking_news": ["$TICKER or Topic — one sentence describing the catalyst and market impact"]
    }

    STRICT rules:
    - impact must be exactly "HIGH", "MED", or "LOW" — no other values
    - Only include US economic events — exclude ECB, BOE, BOJ, RBA, Bank of Canada, and all non-US central bank events
    - All ticker symbols must have $ prefix (e.g. $AAPL not AAPL)
    - trump_schedule: if you cannot find a public schedule, return at least 1 item noting "No public schedule found for today"
    - gaps: search hard — there are almost always pre-market earnings movers on weekdays. Include at least 3-5 if found.
    - Return empty arrays [] only if you genuinely searched and found nothing
    - Output ONLY the JSON object. No text before or after it.
  `;

  try {
    const responseText = await generateWithRetry(ai, prompt);
    const jsonString = responseText.replace(/```json|```/g, "").trim();
    const data = JSON.parse(jsonString);

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Briefing Error:", error.message);

    let userMessage = "Error loading brief. Please try again.";
    if (error.message?.includes('RESOURCE_EXHAUSTED') || error.message?.includes('429')) {
      userMessage = "API quota exceeded. Please check your Gemini billing at aistudio.google.com.";
    } else if (error.message?.includes('503') || error.message?.includes('UNAVAILABLE')) {
      userMessage = "Gemini is under high demand. Please try again in 1-2 minutes.";
    }

    return new Response(JSON.stringify({
      error: userMessage,
      details: error.message
    }), { status: 500 });
  }
};
