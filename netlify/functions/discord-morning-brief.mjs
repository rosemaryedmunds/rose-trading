import { GoogleGenerativeAI } from "@google/generative-ai";

// ── Build the Discord embed from the Gemini briefing object ─────────────────
function buildDiscordPayload(brief, dateStr) {
  const fields = [
    {
      name: `🏛️ Trump Schedule`,
      value: brief.trump_schedule?.map(s => `\`${s.time}\` ${s.event}`).join('\n') || 'No public events scheduled.',
      inline: false
    },
    {
      name: `📈 Gap Ups`,
      value: brief.gaps?.ups?.join('\n') || 'None',
      inline: true
    },
    {
      name: `📉 Gap Downs`,
      value: brief.gaps?.downs?.join('\n') || 'None',
      inline: true
    },
    {
      name: `📅 Economic Calendar`,
      value: brief.econ_calendar?.map(e => `**${e.time}** — ${e.event} [${e.impact}]`).join('\n') || 'No major data.',
      inline: false
    },
    {
      name: `🔍 Ratings & News`,
      value: [...(brief.analyst_actions || []), ...(brief.breaking_news || [])].join('\n') || 'No major news.',
      inline: false
    }
  ];

  return {
    content: `## 🌅 Morning Brief — ${dateStr}`,
    embeds: [{
      title: "Market Tone",
      description: brief.market_tone || "Summary unavailable.",
      color: 0x6b5ecd, // Rose Purple
      fields,
      footer: { text: "Generated via Gemini 2.5 · Live Search · rose.trading" },
      url: 'https://rose.trading/morning-brief',
    }],
    components: [{
      type: 1,
      components: [{
        type: 2,
        style: 5,
        label: '📋 View Full Brief on Website',
        url: 'https://rose.trading/morning-brief',
      }],
    }],
  };
}

export const handler = async () => {
  // Skip weekends
  const today = new Date();
  if (today.getDay() === 0 || today.getDay() === 6) return { statusCode: 200, body: 'Weekend skip' };

  const apiKey = process.env.GEMINI_API_KEY;
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      tools: [{ googleSearch: {} }] 
    });

    const prompt = `Today is ${dateStr}. Provide a pre-market brief JSON for an SPX trader. 
    Include: market_tone, trump_schedule (time/event), gaps (ups/downs), econ_calendar (time/event/impact), analyst_actions, and breaking_news. 
    Return ONLY valid JSON.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    
    const brief = JSON.parse(text);
    const payload = buildDiscordPayload(brief, dateStr);

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return { statusCode: 200, body: "Discord brief sent" };
  } catch (err) {
    console.error('Discord brief failed:', err.message);
    return { statusCode: 500, body: err.message };
  }
};