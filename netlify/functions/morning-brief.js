import { GoogleGenerativeAI } from "@google/generative-ai";

export default async (req, context) => {
  const apiKey = Netlify.env.get('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: 'API Key missing' }), { status: 500 });

  const genAI = new GoogleGenerativeAI(apiKey);
  
  // We will try Flash 2.5 first, then fall back to Flash 3.1-Lite if it fails
  const modelsToTry = ["gemini-2.5-flash", "gemini-3.1-flash-lite-preview"];
  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        tools: [{ googleSearchRetrieval: {} }] 
      });

      const prompt = `Today is ${new Date().toDateString()}. Provide a professional pre-market brief JSON... [Include your full prompt instructions here]`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();

      // Clean the response
      text = text.replace(/```json/g, "").replace(/```/g, "").trim();

      // If we got actual content, return it immediately
      if (text && text.length > 20 && text.startsWith('{')) {
        return new Response(text, {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      
      throw new Error(`Model ${modelName} returned empty or invalid content.`);
    } catch (err) {
      console.error(`Attempt with ${modelName} failed:`, err.message);
      lastError = err.message;
    }
  }

  // If both models fail
  return new Response(JSON.stringify({ error: "Market search currently unavailable", details: lastError }), { 
    status: 500,
    headers: { 'Content-Type': 'application/json' }
  });
};