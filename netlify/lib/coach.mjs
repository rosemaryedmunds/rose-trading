// Shared brain: system prompt, buttons, daily state, Claude call, push sending.
import Anthropic from "@anthropic-ai/sdk";
import webpush from "web-push";
import { getStore } from "@netlify/blobs";

// Uses a coach-only key when set, so its spending shows separately in the Anthropic console.
const anthropic = new Anthropic({ apiKey: process.env.COACH_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001"; // fast enough for the function timeout
export const MAX_TRADES = 3;

// Added after her Trader's State of Mind project instructions. The project defines who the coach is;
// this adapts it to phone notifications and adds rules from her recent debriefs.
const FORMAT_PROMPT = `---

YOU ARE NOW RUNNING ON HER PHONE
Everything above still applies. You reach Rose through push notifications with tap buttons, and a private chat page, during market hours. Most messages are scheduled check-ins or a single button tap.

Added to her rules from recent debriefs:
- Max 3 trades per day. After the 3rd she is done. No exceptions, no "just small size."
- Current focus is A-setups: ORB retest and Flag Into Ribbon with a confirmed ribbon tap.
- Setups seen during the 12:30-3:00 break get logged as "would have traded," not taken.
- Her body is her early-warning system: clenched teeth, tense shoulders, or feeling hot means pause and regulate.
- Her anchor: "The chart is my signal. My feelings are data, not instructions."

How to write here:
- Your words appear in a phone notification. Stay under 250 characters unless she types a longer message or asks for more. Plain text, no markdown.
- Regulate before you reason. When she taps anything tilt-related, lead with breath and body, then one concrete next action.
- At most one question per message.
- You can't see her chart. Never invent levels or make calls. If she describes a setup in the chat, use your pre-trade approach on what she tells you, and ask for anything missing.
- Don't bring up her past losses or her husband unless she does.
- If she seems in real distress beyond trading, drop coach mode and be a human about it.`;

// Her project lives in the private "coach-knowledge" blob store (scripts/upload-coach-knowledge.sh):
//   instructions.md  the project instructions
//   core/*           short files (her plan, playbook, skill guides): included in every message
//   library/*        the textbooks: searched per message, best few passages included
// Loaded once per warm function instance.
let knowledgeCache;
async function loadKnowledge() {
  if (knowledgeCache) return knowledgeCache;
  const kb = getStore("coach-knowledge");
  const { blobs } = await kb.list();
  const keys = blobs.map((b) => b.key).sort();
  const read = async (k) => ((await kb.get(k)) || "").trim();

  const instructions = keys.includes("instructions.md") ? await read("instructions.md") : "";
  const core = [];
  const chunks = [];
  for (const key of keys) {
    if (key.startsWith("core/")) core.push(`<document name="${key.slice(5)}">\n${await read(key)}\n</document>`);
    if (key.startsWith("library/")) chunks.push(...chunkText(key.slice(8).replace(/\.(txt|md)$/, ""), await read(key)));
  }
  knowledgeCache = { instructions, core: core.join("\n\n"), library: buildIndex(chunks) };
  return knowledgeCache;
}

// --- Library search (BM25 over ~400-word passages) ---
const STOP = new Set("the and that this with you your for are was were have has had not but they them their what when where which who will would can could should into from about there then than been being our out all any just its it's his her she him how also more most some such only own same very too did does doing just yourself myself".split(" "));
const tokens = (t) => (t.toLowerCase().match(/[a-z']+/g) || []).map((w) => w.replace(/'s$/, "").replace(/(ing|ed|es|s)$/, "")).filter((w) => w.length > 2 && !STOP.has(w));

function chunkText(source, text) {
  const paras = text.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
  const out = [];
  let buf = [], words = 0;
  for (const p of paras) {
    buf.push(p); words += p.split(" ").length;
    if (words >= 400) { out.push({ source, text: buf.join("\n\n") }); buf = []; words = 0; }
  }
  if (buf.length) out.push({ source, text: buf.join("\n\n") });
  return out;
}

function buildIndex(chunks) {
  const df = new Map();
  const docs = chunks.map((c) => {
    const tf = new Map();
    const toks = tokens(c.text);
    for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    return { ...c, tf, len: toks.length };
  });
  const avg = docs.reduce((s, d) => s + d.len, 0) / (docs.length || 1);
  return { docs, df, avg, n: docs.length };
}

function searchLibrary(index, query, k = 3) {
  if (!index.n) return [];
  const q = [...new Set(tokens(query))];
  const scored = index.docs.map((d) => {
    let score = 0;
    for (const t of q) {
      const f = d.tf.get(t);
      if (!f) continue;
      const idf = Math.log(1 + (index.n - index.df.get(t) + 0.5) / (index.df.get(t) + 0.5));
      score += idf * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * d.len / index.avg));
    }
    return { d, score };
  });
  return scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, k).map((x) => x.d);
}

async function systemBlocks() {
  const { instructions, core } = await loadKnowledge();
  const intro = instructions || "You are Rose's trading psychology coach. She trades SPX/ES 0DTE options with Saty's Pivot Ribbon, Phase Oscillator, and ATR levels, and works on her state of mind with Rande Howell's Trader's State of Mind approach.";
  const text = core
    ? `${intro}\n\n---\n\nHER PLANS AND COURSE GUIDES\nHer own trading process and playbook, her state-of-mind trade plan, example plans from other Trader's State of Mind students, and the Ignite skill guides. Use them to ground your coaching in her plan and the course's language.\n\n${core}\n\n${FORMAT_PROMPT}`
    : `${intro}\n\n${FORMAT_PROMPT}`;
  // One-hour cache so half-hourly check-ins reuse it instead of paying full price each time.
  return [{ type: "text", text, cache_control: { type: "ephemeral", ttl: "1h" } }];
}

// Every tappable response. Titles stay short so Android doesn't truncate them.
export const BUTTONS = {
  breathed:     { title: "Breathed, I'm calm",  meaning: "She did the breathing reset and feels calm.", search: "breathing calm relaxation observer present moment regulated state" },
  plan_done:    { title: "Plan's written",      meaning: "Her pre-market plan is done.", search: "prepare mind before trading day rehearse empowered memory committee ruler" },
  not_ready:    { title: "Not ready yet",       meaning: "Her pre-market routine isn't done and the open is close.", search: "prepare mind before trading day stress not ready safe place breathe" },
  waiting:      { title: "Waiting for close",   meaning: "She's waiting for a clean ORB candle close before doing anything.", search: "patience discipline waiting uncertainty impartial observer" },
  want_in:      { title: "Itching to get in",   meaning: "She feels the urge to enter before the ORB confirms. FOMO risk.", tilt: true, search: "impatience urge act fear missing out reactive emotion amygdala regulate breath patience" },
  on_plan:      { title: "On plan",             meaning: "She says she's trading her plan.", search: "discipline plan execution impartial patience courage" },
  logged:       { title: "Logged a trade",      meaning: "She just took a trade.", trade: true, search: "execution trade plan stop target discipline observer outcome" },
  tilted:       { title: "Feeling tilted",      meaning: "She's tilted: urge to chase, revenge trade, or force something.", tilt: true, search: "reactive emotion fight flight amygdala hijack regulate breath anger frustration revenge orphan" },
  still_tilted: { title: "Still tilted",        meaning: "She's still tilted after your last message. Go slower and more concrete.", tilt: true, search: "emotional intensity escalation regulate breath muscle tension safe place calm" },
  reset:        { title: "I'm reset",           meaning: "She says she's calm and reset.", search: "calm regulated observer empowered self warrior patience" },
  hands_off:    { title: "Hands off",           meaning: "She's respecting the break window.", search: "rest break replenish stillness patience boredom" },
  want_trade:   { title: "Saw a setup",         meaning: "She sees a setup during the 12:30-3:00 break and wants to take it.", tilt: true, search: "boredom need action stillness discomfort impulse patience break rest" },
  carrying:     { title: "Carrying the morning", meaning: "She's carrying emotion from the morning session into the afternoon.", tilt: true, search: "carryover emotion previous trade loss win reset observer present" },
  clean_day:    { title: "Clean process",       meaning: "She reports a clean process day.", search: "reflection journal success self sabotage winning streak inner trader identity" },
  rule_break:   { title: "Broke a rule",        meaning: "She broke one of her rules today.", search: "self sabotage belief inner critic shame wounded child adapted self reflection learn" },
};

export const actions = (ids) => ids.map((id) => ({ action: id, title: BUTTONS[id].title }));

// Which two buttons ride along on a coach reply.
export function replyActions(day, lastButton) {
  if (lastButton && BUTTONS[lastButton]?.tilt) return actions(["still_tilted", "reset"]);
  if (day.trades >= MAX_TRADES) return actions(["tilted", "reset"]);
  return actions(["logged", "tilted"]);
}

// Current date/time in New York, DST-safe.
export function etNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, minute: Number(p.minute) };
}

// --- Storage (Netlify Blobs) ---
const store = () => getStore("coach");

// One record per trading day. history = what Claude sees; log = what the chat page shows.
export async function loadDay(date) {
  return (await store().get(`day-${date}`, { type: "json" })) ?? { trades: 0, history: [], log: [], sent: [] };
}

export async function saveDay(date, day) {
  day.history = day.history.slice(-30); // even count keeps user/assistant pairs intact
  day.log = day.log.slice(-60);
  await store().setJSON(`day-${date}`, day);
}

export async function getSubscriptions() {
  return (await store().get("subscriptions", { type: "json" })) ?? [];
}

export async function saveSubscriptions(subs) {
  await store().setJSON("subscriptions", subs);
}

// Page calls send the passphrase; the service worker proves itself with its push endpoint.
export async function authorized(req, body = {}) {
  if (process.env.COACH_PASSPHRASE && req.headers.get("x-coach-key") === process.env.COACH_PASSPHRASE) return true;
  if (body.endpoint) return (await getSubscriptions()).some((s) => s.endpoint === body.endpoint);
  return false;
}

// --- Claude ---
export async function askCoach(day, modelText, displayText, searchHint = "") {
  const { hour, minute } = etNow();
  const stamped = `[${hour}:${String(minute).padStart(2, "0")} ET | trades today: ${day.trades}/${MAX_TRADES}]\n${modelText}`;

  // Search her course library: course vocabulary for the button or check-in, the message, and her last typed message.
  const { library } = await loadKnowledge();
  const lastTyped = [...day.log].reverse().find((m) => m.who === "you")?.text || "";
  const passages = searchLibrary(library, `${searchHint} ${modelText} ${lastTyped}`);
  const withPassages = passages.length
    ? `${stamped}\n\n<course_passages>\nPassages from her Trader's State of Mind course that may fit this moment. Use their ideas and language if they help; don't quote at length.\n\n${passages.map((p) => `[${p.source}]\n${p.text}`).join("\n\n---\n\n")}\n</course_passages>`
    : stamped;

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 250,
    system: await systemBlocks(),
    messages: [...day.history, { role: "user", content: withPassages }],
  });
  const reply = res.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  // History keeps the message without passages so it stays small.
  day.history.push({ role: "user", content: stamped }, { role: "assistant", content: reply });
  if (displayText) day.log.push({ who: "you", text: displayText, t: Date.now() });
  day.log.push({ who: "coach", text: reply, t: Date.now() });
  return reply;
}

// --- Push ---
export async function pushToAll(payload) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const subs = await getSubscriptions();
  const alive = [];
  for (const sub of subs) {
    try {
      // TTL: a check-in that can't arrive within 10 minutes is stale. Urgency high gets through Android Doze.
      await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 600, urgency: "high" });
      alive.push(sub);
    } catch (err) {
      if (err.statusCode !== 404 && err.statusCode !== 410) alive.push(sub); // 404/410 = subscription expired
    }
  }
  if (alive.length !== subs.length) await saveSubscriptions(alive);
}
