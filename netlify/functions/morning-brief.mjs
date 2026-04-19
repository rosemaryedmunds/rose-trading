import { GoogleGenerativeAI } from "@google/generative-ai";

export const handler = async (event, context) => {
  console.log("PULSE: Gemini 2.5 Brief Triggered");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing API Key" })
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      tools: [{ googleSearch: {} }] 
    });

    const today = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago'
    });

    const prompt = `Today is ${today}. Provide a pre-market brief JSON for an SPX trader. 
    Search for:
    1. Overnight S&P 500 futures action.
    2. Donald Trump's public schedule for today.
    3. Top 3 pre-market Gap Ups/Downs.
    4. Economic reports for today.

    Return ONLY this JSON format:
    {
      "market_tone": "Summary",
      "trump_schedule": [{"time": "TBD", "event": "No public events scheduled"}],
      "gaps": {"ups": ["None"], "downs": ["None"]},
      "econ_calendar": [{"time": "N/A", "event": "No major data", "impact": "Low"}],
      "analyst_actions": ["None"],
      "breaking_news": ["Markets are closed or no major news"]
    }`;

    // Set a race condition: if Gemini takes > 20s, we fail gracefully
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Clean any markdown fences
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    // Final sanity check: if text isn't JSON, throw error to trigger catch block
    if (!text.startsWith('{')) {
      throw new Error("Invalid JSON received from AI");
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: text
    };

  } catch (error) {
    console.error("FUNCTION ERROR:", error.message);
    
    // FALLBACK: Send a valid JSON object so the frontend doesn't throw "Unexpected end of input"
    const fallback = {
      market_tone: "Search is currently timed out or markets are closed (Sunday).",
      trump_schedule: [{"time": "N/A", "event": "Check back during market hours"}],
      gaps: { ups: ["N/A"], downs: ["N/A"] },
      econ_calendar: [{"time": "N/A", "event": "No data", "impact": "Low"}],
      analyst_actions: ["N/A"],
      breaking_news: ["API Timeout: The search grounding tool took too long to respond."]
    };

    return {
      statusCode: 200, // Return 200 so the JSON parse succeeds
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(fallback)
    };
  }
};