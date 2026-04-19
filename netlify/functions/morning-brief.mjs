import { GoogleGenerativeAI } from "@google/generative-ai";

export const handler = async (event, context) => {
  console.log("PULSE: Gemini 2.5 Morning Brief triggered");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "API Key missing in Netlify settings" })
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // NEW SYNTAX: gemini-2.5-flash with the updated googleSearch tool
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      tools: [{ googleSearch: {} }] 
    });

    const today = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago'
    });

    const prompt = `Today is ${today}. Provide a pre-market brief JSON for an SPX trader. 
    Search for:
    1. Overnight price action for S&P 500 futures.
    2. Donald Trump's public schedule for today.
    3. Notable pre-market Gap Ups/Downs.
    4. Economic reports (CPI, PPI, Jobs, etc) scheduled for today.
    5. Breaking news for NVDA, TSLA, and AAPL.

    Return ONLY this JSON structure:
    {
      "market_tone": "2 sentence summary",
      "trump_schedule": [{"time": "", "event": ""}],
      "gaps": {"ups": [], "downs": []},
      "econ_calendar": [{"time": "", "event": "", "impact": "High/Med/Low"}],
      "analyst_actions": ["Ticker: Action"],
      "breaking_news": ["Headline"]
    }`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Aggressively clean JSON if the model includes markdown formatting
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: text
    };

  } catch (error) {
    console.error("GEN-AI ERROR:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};