---
title: "Week 5: The Greeks – Delta & Theta"
phase: "Phase 2: The Business Model"
week: 5
---
> **📹 Video Lesson — Coming Soon**
> *Replace this block with your YouTube embed when ready:*
> `<!-- <iframe width="100%" height="400" src="https://www.youtube.com/embed/YOUR_VIDEO_ID" frameborder="0" allowfullscreen></iframe> -->`

---

# Week 5: The Greeks – Your Trading Dashboard

If you are flying a plane, you need instruments telling you altitude, speed, and fuel remaining. Options have their own instrument panel called "The Greeks" — mathematical measurements that describe exactly how your option behaves under different conditions.

There are five Greeks in total (Delta, Theta, Gamma, Vega, Rho), but as a Sniper, **you only need to master two: Delta and Theta.** These two numbers will tell you everything that matters before you place a trade.

---

## Delta (Δ) — The Probability Gauge

Delta officially measures how much an option's price moves per $1 move in the underlying stock. But we use it as a **Probability Calculator**.

* Delta ranges from 0 to 1.0.
* **The Rule of Thumb:** Delta ≈ the probability that the option expires In The Money (ITM).
* A 0.30 Delta option has roughly a 30% chance of expiring ITM — and therefore a **~70% chance of profit** for the seller.

### The Delta Spectrum

| Delta Level | ITM Probability | Seller's Win Rate | Notes |
|---|---|---|---|
| 0.05 (5 Delta) | ~5% | ~95% | Very safe, small premium |
| 0.10 (10 Delta) | ~10% | ~90% | Conservative, consistent |
| 0.20 (20 Delta) | ~20% | ~80% | Balanced |
| 0.30 (30 Delta) | ~30% | ~70% | Our primary target zone |
| 0.50 (50 Delta) | ~50% | ~50% | At-the-money, too risky for us |

> **Our Target Zone:** 0.20–0.30 Delta. Enough premium to make the trade worthwhile, with a strong probability edge in your favor from the start.

---

## Theta (Θ) — The Rent Collector

Theta measures how much the option loses in value *per day* purely due to time passing — with all else held equal.

* **Theta = Cash per day** (from the seller's perspective).
* If you sell an option with a Theta of **0.05**, you earn approximately **$5 per day** per contract, even if the stock doesn't move an inch.
* Hold 10 contracts: **$50/day**. Hold for 20 days: **$1,000** from pure time decay.

**The Acceleration Curve**

Theta decay is not linear. It accelerates sharply as expiration approaches. The last 14 days before expiration contain the most rapid decay. This is why we:

1. Sell options in the **30–45 DTE window** to capture meaningful daily theta from the start.
2. Close positions at **50% profit** (~15–21 DTE) — capturing the steepest part of the decay curve.
3. **Repeat** — compounding the effect across multiple cycles.

---

## The Sniper Sweet Spot

The trade you are looking for must satisfy both Greeks simultaneously:

1. **Confirm bullish chart** — Weekly ribbon green, daily 2-1-2 structure or inside bar. TFC aligned.
2. **Open the option chain** — Go to the expiration 30–45 days out.
3. **Find the 30 Delta strike** — Look down the Delta column and find the Put strike near 0.30.
4. **Check Theta at that strike** — Is the daily decay worth the capital committed? Target at least $5–10/day per contract.
5. **Confirm bid/ask spread is tight** — Wide spreads eat your profit. Liquid options only.

> If you find a trade where the chart is bullish, the Delta gives you 70%+ probability, and Theta is paying you daily rent — that is a Sniper trade.

---

## A Practical Example

You're looking at SPY options with 35 days to expiration.

* Current price: $500
* You look at the $480 Put strike (4% below current price)
* Delta shows: **0.20** — roughly 80% probability of profit
* Theta shows: **-0.08** — you earn $8/day per contract by selling this
* Bid/ask spread: $0.02 — tight and liquid

This checks every box. You sell the $480 Put, collect the premium, and let Theta work. If SPY stays above $480 for the next 35 days — which is likely given an 80% statistical edge — you win.

---

## Summary

| Greek | What It Measures | How We Use It |
|---|---|---|
| Delta (Δ) | Price sensitivity per $1 move | Proxy for probability of profit |
| Theta (Θ) | Daily time decay in dollars | Measures our passive daily income |

**The Sniper mantra:** Find the 30 Delta strike. Check the Theta. Make sure the chart agrees. Enter the trade. Let time do the work.
