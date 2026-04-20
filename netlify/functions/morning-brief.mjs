import { GoogleGenerativeAI } from "@google/generative-ai";

export default async (req, context) => {
  console.log("PULSE: Gemini 2.5 Morning Brief triggered");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API Key missing in Netlify" }), { status: 500 });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Gemini 2.5 Flash is the 2026 workhorse for grounded research
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      tools: [{ googleSearch: {} }] 
    });

    const today = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago'
    });

    const prompt = `Today is ${today}. Provide a pre-market brief JSON for an SPX trader. 
    Use Google Search to find:
    1. Overnight S&P 500 futures action and current bias.
    2. Donald Trump's public schedule for today.
    3. Notable pre-market Gap Ups/Downs for stocks >$2b market cap.
    4. Economic reports (CPI, PPI, Jobs) scheduled for today.
    5. Breaking news for NVDA, TSLA, and AAPL.

    Return ONLY a valid JSON object (no markdown):
    {
      "market_tone": "Summary of overnight action",
      "trump_schedule": [{"time": "HH:MM", "event": "Description"}],
      "gaps": {"ups": ["TICKER (+X%)"], "downs": ["TICKER (-X%)"]},
      "econ_calendar": [{"time": "ET", "event": "Report", "impact": "High/Med/Low"}],
      "analyst_actions": ["Ticker: Action"],
      "breaking_news": ["Headline"]
    }`;

    // Execute generation with search grounding enabled
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Aggressively clean the JSON string to ensure parsing succeeds
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    if (!text || !text.startsWith('{')) {
      throw new Error("Empty or malformed response from Gemini search grounding.");
    }

    return new Response(text, {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("GEN-AI ERROR:", error.message);
    
    // Safety Fallback: Return a valid JSON object so the frontend doesn't crash
    const fallback = {
      market_tone: "System is warming up or markets are quiet (Sunday).",
      trump_schedule: [{"time": "N/A", "event": "Check again at 7:00 AM CT"}],
      gaps: { ups: ["N/A"], downs: ["N/A"] },
      econ_calendar: [{"time": "N/A", "event": "No data", "impact": "Low"}],
      analyst_actions: ["N/A"],
      breaking_news: ["Note: Search tool took too long to respond. Refreshing may help."]
    };

    return new Response(JSON.stringify(fallback), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
};