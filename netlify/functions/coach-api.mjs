// The chat endpoint. Called by the /coach page (typed messages, buttons) and by the
// service worker when a notification button is tapped.
import { etNow, loadDay, saveDay, askCoach, authorized, replyActions, BUTTONS, MAX_TRADES } from "../lib/coach.mjs";

export default async (req) => {
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  if (!(await authorized(req, body))) return new Response("Forbidden", { status: 403 });

  const { date } = etNow();
  const day = await loadDay(date);

  // Page load: return today's thread.
  if (req.method === "GET") return Response.json({ trades: day.trades, max: MAX_TRADES, log: day.log });

  if (body.undo) {
    day.trades = Math.max(0, day.trades - 1);
    await saveDay(date, day);
    return Response.json({ trades: day.trades, max: MAX_TRADES });
  }

  let modelText, displayText, searchHint = "";
  if (body.button) {
    const b = BUTTONS[body.button];
    if (!b) return new Response("Unknown button", { status: 400 });
    if (b.trade) day.trades += 1;
    modelText = `[She tapped "${b.title}": ${b.meaning}]`;
    displayText = b.title;
    searchHint = b.search || "";
  } else if (typeof body.text === "string" && body.text.trim()) {
    modelText = displayText = body.text.trim().slice(0, 1000);
  } else {
    return new Response("Nothing to send", { status: 400 });
  }

  const reply = await askCoach(day, modelText, displayText, searchHint, { chat: !body.button });
  await saveDay(date, day);
  return Response.json({ reply, trades: day.trades, max: MAX_TRADES, actions: replyActions(day, body.button) });
};

export const config = { path: "/api/coach" };
