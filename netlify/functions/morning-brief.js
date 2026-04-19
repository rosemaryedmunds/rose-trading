import { GoogleGenerativeAI } from "@google/generative-ai";

export default async (req, context) => {
  // 1. Handle CORS and Methods
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // 2. Validate API Key
  const apiKey = Netlify.env.get('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY is not set in Netlify Environment Variables.' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Using the current 2026 stable model
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      tools: [{ googleSearchRetrieval: {} }] 
    });

    const today = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago'
    });

    const prompt = `Today is ${today}. You are a professional trading floor analyst.
    Use Google Search to provide a pre-market morning brief for an SPX options trader. 
    
    Search for:
    1. S&P 500 futures overnight tone and current price action.
    2. Donald Trump's public schedule for today (April 19, 2026).
    3. Top 3 pre-market Gap Ups and Gap Downs for high-volume stocks.
    4. Major US economic releases today (with consensus/forecast).
    5. Notable analyst upgrades/downgrades from major banks.
    6. Major breaking news for NVDA, TSLA, AAPL, or MSFT.

    Return ONLY a valid JSON object in this format (no markdown code blocks):
    {
      "market_tone": "Summary of overnight action and key levels",
      "trump_schedule": [{"time": "HH:MM", "event": "Description"}],
      "gaps": {"ups": ["TICKER (+X%)"], "downs": ["TICKER (-X%)"]},
      "econ_calendar": [{"time": "ET", "event": "Report Name", "impact": "High/Med/Low"}],
      "analyst_actions": ["Ticker: Upgrade/Downgrade by Bank"],
      "breaking_news": ["Headline - impact"]
    }`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    // Clean up any potential markdown formatting from the AI
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    // Final Validation: If Gemini returns an empty string or non-JSON
    if (!text || !text.startsWith('{')) {
      throw new Error("Gemini search failed to return structured data. Try refreshing.");
    }

    return new Response(text, {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' 
      }
    });

  } catch (error) {
    console.error("Brief Error:", error.message);
    return new Response(JSON.stringify({ 
      error: "Failed to generate brief", 
      details: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};