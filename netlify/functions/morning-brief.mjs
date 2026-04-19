import { GoogleGenerativeAI } from "@google/generative-ai";

export const handler = async (event, context) => {
  // This log MUST show up if the function is hit
  console.log("PULSE: Morning Brief Function Triggered");

  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "API Key missing in Netlify" })
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      tools: [{ googleSearchRetrieval: {} }] 
    });

    const prompt = "Provide a morning brief JSON for SPX trading today..."; 

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().replace(/```json/g, "").replace(/```/g, "").trim();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: text
    };
  } catch (error) {
    console.error("GEMINI ERROR:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};