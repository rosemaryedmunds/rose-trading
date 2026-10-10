// Scheduled: runs every 30 min on weekdays. Main check-ins at their set times; a breathing
// check-in on every other half hour from 9:30 to 4:00 ET.
import { etNow, loadDay, saveDay, askCoach, pushToAll, actions } from "../lib/coach.mjs";

// Times are ET and must land on :00 or :30. Each carries two buttons.
const CHECKINS = [
  { at: "08:30", id: "state", buttons: ["plan_done", "not_ready"],
    prompt: "8:30 state check-in, before market prep. Check her state first: calm or activated, and anything she's carrying from yesterday. Then nudge her into prep and marking up her opening plan by 9:30." },
  { at: "09:30", id: "open", buttons: ["waiting", "want_in"],
    prompt: "The bell. She marks the 10-min open range at 9:40, and ORB entry is on the retest only. The open is her highest-risk window for chasing. Quick body check." },
  { at: "10:30", id: "midmorning", buttons: ["on_plan", "tilted"],
    prompt: "Mid-morning check. Reference her trade count. If she's at 3, she's done for the day. Otherwise check her state and whether her last entry had a complete checklist." },
  { at: "12:30", id: "break", buttons: ["hands_off", "want_trade"],
    prompt: "De-risk window starts. No new trades until 3:00. Anything she sees gets logged as 'would have traded.' Boredom and 'seeing something' are the trap here." },
  { at: "15:00", id: "afternoon", buttons: ["reset", "carrying"],
    prompt: "3:00. The afternoon window opens: clear playbook setups only, and 1-min EOD Divergence is in play. Check for carryover from the morning, good or bad. Reference trade count." },
  { at: "16:00", id: "scorecard", buttons: ["clean_day", "rule_break"],
    prompt: "4:00. Market closed; journaling time. Ask how her process and state of mind went today. Process and state, not P&L." },
];

const BREATH = {
  buttons: ["breathed", "tilted"],
  search: "breathing breath muscle tension relaxation calm observer present moment",
  prompt: "Half-hour breathing check-in. Lead with one breathing cue she can do right now without leaving her desk (vary it: physiological sigh, box breathing 4-4-4-4, slow 4-in 6-out exhale, unclench jaw and drop shoulders while breathing). Then a quick body scan or one line tied to how her day is going and her trade count. If it's 12:30-3:00, remind her she's on break. Under 200 characters.",
};
const BREATH_START = 9 * 60 + 30; // 9:30 ET
const BREATH_END = 16 * 60;       // 4:00 ET

// NYSE full-day closures. Add next year's from nyse.com before January.
const HOLIDAYS = new Set(["2026-11-26", "2026-12-25"]);

export default async () => {
  const now = etNow();
  if (HOLIDAYS.has(now.date)) return new Response("holiday");

  const half = Math.floor(now.minute / 30) * 30;
  const slot = `${String(now.hour).padStart(2, "0")}:${String(half).padStart(2, "0")}`;
  const mins = now.hour * 60 + half;

  let checkin = CHECKINS.find((c) => c.at === slot);
  if (checkin) {
    checkin = { ...checkin, prompt: `${checkin.prompt} Open with a one-line breathing cue.` };
  } else if (mins >= BREATH_START && mins <= BREATH_END) {
    checkin = { ...BREATH, id: `breath-${slot}` };
  } else {
    return new Response("nothing scheduled");
  }

  const day = await loadDay(now.date);
  if (day.sent.includes(checkin.id)) return new Response("already sent");

  const body = await askCoach(day, `[Scheduled check-in: ${checkin.prompt} Write the notification text now.]`, null, checkin.search || "");
  await pushToAll({ title: "Coach", body, actions: actions(checkin.buttons) });
  day.sent.push(checkin.id);
  await saveDay(now.date, day);
  return new Response("sent");
};

// UTC cron. 12-21 UTC covers 9 AM-4 PM ET in both EDT and EST.
export const config = { schedule: "0,30 12-21 * * 1-5" };
