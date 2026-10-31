// ─── EDIT THIS FILE ──────────────────────────────────────────────
// One entry per pricing tier.
//   key      → used in the Join link: /api/discord/login?tier=monthly
//   priceId  → Stripe: Product catalog → product → price → copy "price_..."
//   roleId   → Discord: Server Settings → Roles → right-click → Copy Role ID
//
// Different access per tier? Give each its own roleId.
// Same access, different billing (monthly/quarterly/yearly)? Use the SAME roleId for all three.
// (These IDs are not secrets, so they're safe to keep in code.)

export const TIERS = {
  monthly:   { priceId: "price_REPLACE_ME_1", roleId: "ROLE_ID_1" },
  quarterly: { priceId: "price_REPLACE_ME_2", roleId: "ROLE_ID_1" },
  yearly:    { priceId: "price_REPLACE_ME_3", roleId: "ROLE_ID_1" },
};

export const DEFAULT_TIER = "monthly";

export const tierForPrice = (priceId) =>
  Object.values(TIERS).find((t) => t.priceId === priceId);

export const allRoleIds = () => [...new Set(Object.values(TIERS).map((t) => t.roleId))];
