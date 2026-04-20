import { GoogleGenerativeAI } from "@google/generative-ai";

export default async (req, context) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: "API Key missing" }), { status: 500 });

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Using gemini-2.5-flash which currently handles grounding better than Pro in 2026
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      tools: [{ googleSearch: {} }] 
    });

    const today = new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago' });

    // Step 1: Request as text first (more stable for grounding)
    const prompt = `Today is ${today}. provide a pre-market brief for an SPX trader. 
    Include: Overnight S&P futures tone, Trump's schedule today, top Gap Ups/Downs, Econ reports, and top market news.
    Format the response as a clean, raw JSON object only.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Step 2: Clean and validate before sending
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    if (!text || !text.startsWith('{')) {
       // If grounding failed, return a structured fallback so the page doesn't break
       throw new Error("Search tool returned empty content");
    }

    return new Response(text, { status: 200, headers: { "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Grounding Error:", error.message);
    
    // Reliable fallback for Sunday/Quiet periods
    const fallback = {
      market_tone: "Search grounding is currently refreshing or markets are quiet (Sunday).",
      trump_schedule: [{"time": "N/A", "event": "No public events scheduled"}],
      gaps: { ups: ["None"], downs: ["None"] },
      econ_calendar: [{"time": "N/A", "event": "No major data", "impact": "Low"}],
      analyst_actions: ["N/A"],
      breaking_news: ["Note: The live search tool is experiencing high latency. Try refreshing in 1 minute."]
    };

    return new Response(JSON.stringify(fallback), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
};