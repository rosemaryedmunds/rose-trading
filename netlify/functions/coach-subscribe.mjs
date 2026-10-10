// GET: hands the page the public VAPID key. POST: saves this device's push subscription.
import { authorized, getSubscriptions, saveSubscriptions } from "../lib/coach.mjs";

export default async (req) => {
  if (req.method === "GET") return Response.json({ publicKey: process.env.VAPID_PUBLIC_KEY });

  if (!(await authorized(req))) return new Response("Forbidden", { status: 403 });
  const { subscription } = await req.json();
  if (!subscription?.endpoint) return new Response("Missing subscription", { status: 400 });

  const subs = (await getSubscriptions()).filter((s) => s.endpoint !== subscription.endpoint);
  subs.push(subscription);
  await saveSubscriptions(subs);
  return Response.json({ ok: true });
};

export const config = { path: "/api/coach/subscribe" };
