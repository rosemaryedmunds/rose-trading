import { GoogleGenerativeAI } from "@google/generative-ai";

export default async (req, context) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: "API Key missing" }), { status: 500 });

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Switch to Gemini 3.1 for stability during the current grounding outage
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.1-flash",
      tools: [{ googleSearch: {} }] 
    });

    const today = new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago' });

    // We add a 'thinking' instruction to force the model to process search results
    const prompt = `Today is ${today}. Using Google Search, provide a pre-market brief for an SPX trader. 
    Search for: S&P futures tone, Trump's schedule today, and top Gap Ups/Downs.
    Return ONLY a valid JSON object. If you find no specific data, use "None" for the value.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Aggressive cleaning for the April 2026 "triple backtick" bug
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    if (!text || text.length < 5) throw new Error("Search tool returned an empty response.");

    return new Response(text, { status: 200, headers: { "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Brief Error:", error.message);
    
    // Fail gracefully with valid JSON so the dashboard cards don't stay blank
    const fallback = {
      market_tone: "The live search tool is currently experiencing high latency (API Issue).",
      trump_schedule: [{"time": "N/A", "event": "Searching... try refreshing."}],
      gaps: { ups: ["None"], downs: ["None"] },
      econ_calendar: [{"time": "N/A", "event": "No data", "impact": "Low"}],
      analyst_actions: ["N/A"],
      breaking_news: ["Note: Markets are quiet or search grounding is resetting."]
    };

    return new Response(JSON.stringify(fallback), { status: 200, headers: { "Content-Type": "application/json" } });
  }
};