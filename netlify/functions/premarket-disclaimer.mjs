// Netlify scheduled function: posts the pre-market disclaimer to Discord
// every Monday–Friday at 8:15 AM Central.
//
// Netlify schedules run in UTC, and 8:15 AM Central is 14:15 UTC in winter (CST)
// but 13:15 UTC in summer (CDT). So it runs at both times and only posts when it's
// actually 8 AM in Chicago — no changes needed when daylight saving flips.

import { sendToDiscord } from "../lib/premarket-message.mjs";

export default async () => {
  const chicagoHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      hour: "numeric",
      hour12: false,
    }).format(new Date())
  );

  if (chicagoHour !== 8) {
    console.log(`Chicago hour is ${chicagoHour}, not 8. Skipping.`);
    return;
  }

const webhookUrl = process.env.DISCORD_PREMARKET_WEBHOOK_URL;
if (!webhookUrl) throw new Error("DISCORD_PREMARKET_WEBHOOK_URL is not set in Netlify");

  await sendToDiscord(webhookUrl);
  console.log("Posted pre-market disclaimer.");
};

export const config = {
  schedule: "15 13,14 * * 1-5",
};
