import { GoogleGenAI } from "@google/genai";

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
    - ticker symbols must include the $ prefix
    - If a field has no data, use an empty array []
    - Do not include any text outside the JSON object
  `;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const responseText = result.text;
    const jsonString = responseText.replace(/```json|```/g, "").trim();
    const data = JSON.parse(jsonString);

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Briefing Error:", error);
    return new Response(JSON.stringify({
      error: "Search Latency Issue",
      details: error.message
    }), { status: 500 });
  }
};
