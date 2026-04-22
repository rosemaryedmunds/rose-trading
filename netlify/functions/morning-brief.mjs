import { GoogleGenAI } from "@google/genai";

export default async (req, context) => {
  const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);
  
  // Use the Flash model for speed, with Google Search grounding enabled
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    tools: [{ googleSearch: {} }] // Enables real-time web access
  });

  const prompt = `
    Search the web for financial and political news for today, April 22, 2026. 
    Prioritize data from:
    - benzinga.com (for analyst ratings and stock gaps)
    - rollcall.com (for the Trump schedule/calendar)
    - tikr.com (for earnings and economic data)

    Return the data in a raw JSON format ONLY with this exact schema:
    {
      "market_tone": "1-2 sentence summary",
      "trump_schedule": [{"time": "string", "event": "string"}],
      "gaps": {"ups": ["TICKER (+%)"], "downs": ["TICKER (-%)"]},
      "econ_calendar": [{"time": "string", "event": "string", "impact": "High/Med/Low"}],
      "analyst_actions": ["TICKER: Action (Target)"],
      "breaking_news": ["string"]
    }
    If data is missing, use "None" or empty lists. No conversational text.
  `;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Clean up any Markdown formatting if the AI includes it
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