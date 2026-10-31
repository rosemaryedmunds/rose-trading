// Stripe tells us when subscriptions start, change tier, or end.
// We recompute which tier roles the member should have and sync Discord to match.
import Stripe from "stripe";
import { addRole, removeRole } from "../lib/discord.mjs";
import { tierForPrice, allRoleIds } from "../lib/tiers.mjs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// past_due keeps access during Stripe's automatic payment retries (grace period)
const ACCESS_STATUSES = ["active", "trialing", "past_due"];

/** Roles this customer should have right now, based on ALL their subscriptions. */
async function rolesForCustomer(customerId) {
  const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 });
  const roles = new Set();
  for (const sub of subs.data) {
    if (!ACCESS_STATUSES.includes(sub.status)) continue;
    for (const item of sub.items.data) {
      const tier = tierForPrice(item.price.id);
      if (tier) roles.add(tier.roleId);
    }
  }
  return roles;
}

async function syncMember(discordId, customerId) {
  const keep = await rolesForCustomer(customerId);
  for (const roleId of allRoleIds()) {
    if (keep.has(roleId)) await addRole(discordId, roleId);
    else await removeRole(discordId, roleId);
  }
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
        await syncMember(s.client_reference_id, s.customer);
        break;
      }

      case "customer.subscription.updated": // renewals, failed payments, tier switches
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const discordId = sub.metadata?.discord_id;
        if (!discordId) break; // not a Discord-linked subscription (e.g. legacy)
        await syncMember(discordId, sub.customer);
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
