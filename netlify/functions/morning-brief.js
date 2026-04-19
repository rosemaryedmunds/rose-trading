import { GoogleGenerativeAI } from "@google/generative-ai";

export default async (req, context) => {
  // 1. Handle CORS and Methods
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  const apiKey = Netlify.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not set in Netlify' }), { status: 500 });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Using Gemini 1.5 Flash for speed and Search Grounding
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      tools: [{ googleSearchRetrieval: {} }] 
    });

    const today = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });

    const prompt = `Today is ${today}. Provide a pre-market morning brief for an SPX options trader. 
    Search for:
    1. S&P 500 futures overnight tone.
    2. Donald Trump's public schedule for today.
    3. Top 3 pre-market Gap Ups and Gap Downs.
    4. Major US economic releases today (with consensus).
    5. Notable analyst upgrades/downgrades.
    6. Major breaking news for NVDA, TSLA, AAPL, or MSFT.

    Return ONLY a JSON object:
    {
      "market_tone": "2 sentences",
      "trump_schedule": [{"time": "", "event": ""}],
      "gaps": {"ups": [], "downs": []},
      "econ_calendar": [{"time": "", "event": "", "impact": "High/Med/Low"}],
      "analyst_actions": ["Ticker: Action by Bank"],
      "breaking_news": ["Headline - impact"]
    }`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Clean JSON in case model includes markdown fences
    const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();

    return new Response(cleanJson, {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};