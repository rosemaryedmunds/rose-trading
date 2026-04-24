import { GoogleGenAI } from "@google/genai";

const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

async function generateWithRetry(ai, prompt, maxRetries = 3) {
  for (const model of MODELS) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await ai.models.generateContent({
          model,
          contents: prompt,
          config: { tools: [{ googleSearch: {} }] },
        });
        console.log(`Success with ${model} on attempt ${attempt}`);
        return result.text;
      } catch (err) {
        const is503 = err?.status === 503 || err?.message?.includes('503') || err?.message?.includes('UNAVAILABLE');
        const isLast = attempt === maxRetries;
        const isLastModel = model === MODELS[MODELS.length - 1];

        if (is503 && !isLast) {
          const delay = attempt * 2000; // 2s, 4s, 6s
          console.log(`${model} attempt ${attempt} got 503, retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        if (is503 && !isLastModel) {
          console.log(`${model} exhausted retries, trying next model...`);
          break; // try next model
        }
        throw err; // non-503 error or all models failed
      }
    }
  }
  throw new Error("All models unavailable. Try again in a few minutes.");
}

export default async (req, context) => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  const prompt = `
    Search the web for financial and political news for today, ${today}.
    Prioritize data from:
    - benzinga.com (for analyst ratings and stock gaps)
    - rollcall.com or whitehouse.gov (for the Trump schedule/calendar)
    - tikr.com or marketwatch.com (for earnings and economic data)
    - reuters.com or bloomberg.com (for breaking catalyst news)

    Return ONLY raw JSON with this exact schema — no markdown, no preamble:
    {
      "market_tone": "2-3 sentence summary of overall pre-market sentiment and key drivers",
      "morning_bias": "1-2 sentence actionable bias — what to watch and why (e.g. key levels, catalyst risk, sector rotation)",
      "trump_schedule": [{"time": "string e.g. 10:00 AM ET", "event": "string description"}],
      "gaps": {
        "ups": [{"ticker": "$SYMBOL", "move": "+XX%", "reason": "brief reason e.g. beat EPS est, raised guidance"}],
        "downs": [{"ticker": "$SYMBOL", "move": "-XX%", "reason": "brief reason e.g. missed revenue, guidance cut"}]
      },
      "econ_calendar": [{"time": "string e.g. 8:30 AM ET", "event": "string", "impact": "HIGH or MED or LOW", "actual": "string or null", "forecast": "string or null"}],
      "analyst_actions": ["$TICKER — Firm upgrades/downgrades to Rating, PT $XX"],
      "breaking_news": ["$TICKER or Topic — 1-sentence catalyst description"]
    }
    Rules:
    - impact must be exactly "HIGH", "MED", or "LOW" (uppercase)
    - Only include US economic events, no ECB/BOE/BOJ/foreign central bank data
    - ticker symbols must include the $ prefix
    - If a field has no data, use an empty array []
    - Do not include any text outside the JSON object
  `;

  try {
    const responseText = await generateWithRetry(ai, prompt);
    const jsonString = responseText.replace(/```json|```/g, "").trim();
    const data = JSON.parse(jsonString);

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Briefing Error:", error);
    const is503 = error?.message?.includes('503') || error?.message?.includes('UNAVAILABLE') || error?.message?.includes('All models');
    return new Response(JSON.stringify({
      error: is503
        ? "Gemini is under high demand right now. Please try refreshing in 1-2 minutes."
        : "Error loading brief",
      details: error.message
    }), { status: 503 });
  }
};
