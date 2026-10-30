// Step 2: Discord sends the user back here. We identify them, add them to the
// server (no role yet), then send them to Stripe Checkout tagged with their Discord ID.
import Stripe from "stripe";
import { env, joinGuild } from "../lib/discord.mjs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async (req, context) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const site = env("SITE_URL");

  if (!code || !state || state !== context.cookies.get("discord_oauth_state")) {
    return new Response("Login expired or invalid. Please try again.", { status: 400 });
  }
  context.cookies.delete("discord_oauth_state");

  // Exchange code for an access token
  const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("DISCORD_CLIENT_ID"),
      client_secret: env("DISCORD_CLIENT_SECRET"),
      grant_type: "authorization_code",
      code,
      redirect_uri: `${site}/api/discord/callback`,
    }),
  });
  if (!tokenRes.ok) {
    console.error("token exchange failed", await tokenRes.text());
    return new Response("Discord login failed. Please try again.", { status: 400 });
  }
  const { access_token } = await tokenRes.json();

  // Who is this?
  const user = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${access_token}` },
  }).then((r) => r.json());

  // Put them in the server now so the role can be applied the moment they pay
  await joinGuild(user.id, access_token);

  // Reuse their Stripe customer if they've subscribed before
  const existing = await stripe.customers.search({
    query: `metadata['discord_id']:'${user.id}'`,
    limit: 1,
  });
  const customer = existing.data[0];

  // Already subscribed? Skip checkout and go to the billing portal instead
  if (customer) {
    const subs = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 10 });
    if (subs.data.some((s) => ["active", "trialing", "past_due"].includes(s.status))) {
      const portal = await stripe.billingPortal.sessions.create({
        customer: customer.id,
        return_url: site,
      });
      return Response.redirect(portal.url, 302);
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: env("STRIPE_PRICE_ID"), quantity: 1 }],
    ...(customer ? { customer: customer.id } : {}),
    client_reference_id: user.id,
    metadata: { discord_id: user.id, discord_username: user.username },
    subscription_data: {
      metadata: { discord_id: user.id, discord_username: user.username },
    },
    allow_promotion_codes: true,
    success_url: `${site}/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/`,
  });

  return Response.redirect(session.url, 303);
};

export const config = { path: "/api/discord/callback" };
