import { GoogleGenAI } from "@google/genai";

// Only use 2.5-flash — fallbacks require paid quota on free tier anyway
const MODELS = ["gemini-2.5-flash"];

function extractText(result) {
  if (typeof result.text === 'string' && result.text.length > 0) return result.text;
  if (typeof result.text === 'function') return result.text();
  const part = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (part) return part;
  if (typeof result?.response?.text === 'function') return result.response.text();
  if (typeof result?.response?.text === 'string') return result.response.text;
  throw new Error(`Empty or unrecognized response. Keys: ${JSON.stringify(Object.keys(result))}`);
}

async function generateWithRetry(ai, prompt, maxRetries = 2) {
  let lastError;

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

        // 429 = quota exhausted — no point retrying
        if (status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
          console.error(`Quota exceeded on ${model}. Check your Gemini billing at aistudio.google.com`);
          throw new Error('QUOTA_EXCEEDED');
        }

        // 503 = temporary overload — retry with short delay
        const is503 = status === 503 || msg.includes('503') || msg.includes('UNAVAILABLE');
        if (is503 && attempt < maxRetries) {
          const delay = attempt * 1500;
          console.log(`${model} attempt ${attempt} got 503, retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        console.error(`${model} attempt ${attempt} failed:`, msg);
        break; // move to next model (if any)
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
    console.error("Briefing Error:", error.message);

    let userMessage = "Error loading brief. Please try again.";
    if (error.message === 'QUOTA_EXCEEDED') {
      userMessage = "API quota exceeded. Please upgrade your Gemini plan at aistudio.google.com, then add billing to your API key.";
    } else if (error.message?.includes('503') || error.message?.includes('UNAVAILABLE')) {
      userMessage = "Gemini is under high demand. Please try again in 1-2 minutes.";
    }

    return new Response(JSON.stringify({
      error: userMessage,
      details: error.message
    }), { status: 500 });
  }
};
