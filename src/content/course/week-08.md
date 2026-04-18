---
title: "Week 8: The Entry"
phase: "Phase 3: Execution"
week: 8
---
> **📹 Video Lesson — Coming Soon**
> *Replace this block with your YouTube embed when ready:*
> `<!-- <iframe width="100%" height="400" src="https://www.youtube.com/embed/YOUR_VIDEO_ID" frameborder="0" allowfullscreen></iframe> -->`

---

# Week 8: The Entry – The "Toll Booth" (Spreads)

Cash-secured puts require significant capital — potentially tens of thousands of dollars per position. Most traders starting out don't have that kind of buying power tied up in a single trade. This week we learn the solution: the **Vertical Credit Spread**.

Think of it as "The Toll Booth." You set up a barrier on the road, and the market pays you a fee every time it passes by without crashing through your gate.

---

## The Problem with Naked Puts

Selling a cash-secured put on Apple at a $140 strike means you need $14,000 in cash reserved as collateral. That is a lot of capital for a single trade.

The risk is also theoretically large: if Apple goes to zero, you are forced to buy 100 shares at $140 = $14,000 loss.

The credit spread solves both problems simultaneously.

---

## The Mechanics of a Put Credit Spread

Instead of one options transaction, you execute two simultaneously:

1. **Sell** the more expensive Put at your target strike (e.g., $140). You collect premium here.
2. **Buy** a cheaper Put at a lower strike (e.g., $135) as your protection. You pay a smaller amount.
3. The difference is your **Net Credit** — the profit you keep as long as the stock stays above your short strike.

**Example:**
* Sell $140 Put: collect $1.50 per share
* Buy $135 Put: pay $1.00 per share
* Net Credit: **$0.50 per share = $50 per contract**
* Maximum Loss: **$4.50 per share = $450 per contract** (spread width minus credit)
* Capital Required: Only $450 (vs. $14,000 for cash-secured put)

> **The Key Advantage:** Your risk is strictly capped at the spread width minus credit received. Even if the stock goes to zero, you cannot lose more than $450 per contract. Risk is defined before you enter.

---

## Order Entry: Never Use Market Orders

Market orders are for panicking retail traders. You are a Sniper. You set the price, and you wait.

**Market Order — Never Use:**
"Fill me at whatever price is available." You will receive the worst possible fill. Market makers will take full advantage. Especially dangerous in illiquid options where spreads are wide.

**Limit Order — Always Use:**
"Fill me at $0.50 credit or better." You set the terms. If the market won't meet your price, the trade doesn't happen — which is often the correct outcome.

### Entry Protocol Step-by-Step

1. Identify your spread: which two strikes, which expiration
2. Look at the current Mid Price (midpoint between bid and ask)
3. Set your limit order slightly *above* the mid price (give yourself a small edge)
4. Submit the order and wait patiently
5. If not filled in 10–15 minutes, walk the price down by $0.05 at a time
6. If the market won't give you fair value — skip the trade entirely

> **The Patience Principle:** Not getting filled is not a failure — it is discipline. The Sniper who doesn't fire is not missing an opportunity; they're avoiding a bad fill. There will always be another trade tomorrow.

---

## Choosing Your Spread Width

The width between your two strikes determines your maximum loss and capital requirement.

| Spread Width | Max Loss / Contract | Capital Required | Notes |
|---|---|---|---|
| $1 wide | ~$50–$90 | ~$50–$90 | Very small, lower premium |
| $2 wide | ~$100–$180 | ~$100–$180 | Good for small accounts |
| $5 wide | ~$250–$450 | ~$250–$450 | Standard size, good premium |
| $10 wide | ~$500–$900 | ~$500–$900 | Larger accounts |

Wider spreads collect more premium but require more capital and have higher max loss. Start with $5-wide spreads until you are comfortable with the mechanics.

---

## Summary

The Vertical Credit Spread is the Sniper's tool for defined-risk premium selling. It:

* **Caps your maximum loss** before you enter the trade
* **Reduces capital requirements** dramatically vs. naked puts
* **Maintains the probability edge** of selling premium at 30 Delta
* **Allows smaller accounts** to participate in premium selling

Master the mechanics of this structure — the entry, the order type, the spread width — before moving to trade management in Week 9.
