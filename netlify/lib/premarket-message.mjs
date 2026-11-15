// The message that gets posted. Edit the text here.
// Discord formatting works: **bold**, *italic*, [link text](https://url)

const LINE = "━━━━━━━━━━━━━━━━━━━━━━━━━━";

export const premarketMessage = {
  username: "Rose Trading",          // name shown on the post
  // avatar_url: "https://rose.trading/logo.png",  // optional: picture shown on the post
  embeds: [
    {
      title: "🎯 ROSE'S PRE-MARKET DISCLAIMER",
      color: 0x998bff, // Rose Trading purple (#998BFF) bar on the left
      description: `${LINE}

⚠️ **HIGH RISK / HIGH REWARD:**
Alerts posted here are based on my personal execution and **are not financial advice.** Options, especially 0DTE, can lose their full value quickly. Take every trade at your own risk. If you're in a losing streak, step back, size down, and review before jumping into the next one.

📋 **THE RULES:**
• Position sizing is your responsibility. Never put your whole account into one play.
• Know your stop before you enter.
• Take profits in pieces. Don't let a green trade go red. If you only bought one contract, sell at my first trim so you can compound.
• DON'T average down unless you have high conviction.

💡 **THE GOAL:**
Don't just copy. Learn. Use these alerts to understand *why* a setup works so you can spot it on your own. Stay focused, stay patient, stay disciplined.

📚 **STUDY:** Visit [rose.trading](https://rose.trading/guides/) to learn the strategy.
${LINE}`,
      footer: { text: "Not financial advice • rose.trading" },
    },
  ],
};

export async function sendToDiscord(webhookUrl) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(premarketMessage),
  });
  if (!res.ok) {
    throw new Error(`Discord returned ${res.status}: ${await res.text()}`);
  }
}
