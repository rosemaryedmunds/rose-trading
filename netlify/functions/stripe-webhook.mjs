// Step 3: Stripe tells us when subscriptions start, change, or end.
// We add/remove the Discord role to match.
import Stripe from "stripe";
import { addMemberRole, removeMemberRole } from "../lib/discord.mjs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// past_due keeps access during Stripe's automatic payment retries (grace period)
const ACCESS_STATUSES = ["active", "trialing", "past_due"];

async function customerStillHasAccess(customerId) {
  const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 });
  return subs.data.some((s) => ACCESS_STATUSES.includes(s.status));
}

export default async (req) => {
  const body = await req.text(); // raw body required for signature check
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      req.headers.get("stripe-signature"),
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Bad signature", err.message);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        if (s.mode !== "subscription" || !s.client_reference_id) break;
        // Tag the customer so we can find them by Discord ID later
        await stripe.customers.update(s.customer, {
          metadata: { discord_id: s.client_reference_id },
        });
        await addMemberRole(s.client_reference_id);
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const discordId = sub.metadata?.discord_id;
        if (!discordId) break; // not a Discord-linked subscription (e.g. legacy)

        if (ACCESS_STATUSES.includes(sub.status)) {
          await addMemberRole(discordId);
        } else if (!(await customerStillHasAccess(sub.customer))) {
          await removeMemberRole(discordId);
        }
        break;
      }
    }
  } catch (err) {
    console.error(`Error handling ${event.type}`, err);
    return new Response("Handler error", { status: 500 }); // Stripe will retry
  }

  return new Response("ok", { status: 200 });
};

export const config = { path: "/api/stripe/webhook" };
