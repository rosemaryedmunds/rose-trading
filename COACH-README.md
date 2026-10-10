# rose.trading coach (push version)

Push notifications from rose.trading with tap-to-respond buttons. Claude coaches you back, in the notification itself, without opening anything.

## What you get

- **Six check-ins** each trading day (ET), each with two buttons:
  - 8:30 state check-in: "Plan's written" / "Not ready yet"
  - 9:30 open: "Waiting for close" / "Itching to get in"
  - 10:30 mid-morning: "On plan" / "Feeling tilted"
  - 12:30 break: "Hands off" / "Saw a setup"
  - 3:00 afternoon: "I'm reset" / "Carrying the morning"
  - 4:00 scorecard: "Clean process" / "Broke a rule"
- **Breathing check-ins every 30 minutes** from 9:30 to 4:00 ET on the half hours that don't already have a check-in. Each leads with a breathing cue (physiological sigh, box breathing, long exhale, jaw and shoulder release) and carries "Breathed, I'm calm" / "Feeling tilted". The six main check-ins also open with a breathing cue. That's 14 notifications a day.
- **Tap a button** and the coach's reply arrives as a new notification with its own buttons. Tilt-type taps get "Still tilted" / "I'm reset", so you can keep going until you're steady. Otherwise you get "Logged a trade" / "Feeling tilted".
- **Tap the notification itself** to open `rose.trading/coach/`: a big "I'm feeling tilted" button, quick buttons, a trade counter (3 dots), and free-text chat.

## Files (drop into the rose-trading repo at the same paths)

```
netlify/lib/coach.mjs                 system prompt, buttons, state, Claude + push
netlify/functions/coach-checkins.mjs  scheduled check-ins (every 30 min, weekdays)
netlify/functions/coach-api.mjs       /api/coach: chat, buttons, undo
netlify/functions/coach-subscribe.mjs /api/coach/subscribe: registers your phone
public/coach-sw.js                    service worker: shows pushes, handles button taps
public/coach.webmanifest              makes /coach installable
src/pages/coach.astro                 the private chat page (noindex, not in nav)
scripts/upload-coach-knowledge.sh     uploads your project files to private storage
coach-knowledge/                      your project instructions and files (never committed)
```

## Setup

1. **Install dependencies** in the rose-trading repo:
   `npm install @anthropic-ai/sdk @netlify/blobs web-push`
2. **Generate push keys** (one time): `npx web-push generate-vapid-keys`
3. **Anthropic API key**: create one at console.anthropic.com. API billing is separate from a Claude subscription.
4. **Netlify environment variables** (Site configuration > Environment variables):
   - `ANTHROPIC_API_KEY`
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` from step 2
   - `VAPID_SUBJECT`: `mailto:` plus your email
   - `COACH_PASSPHRASE`: something long. This is the only thing keeping /coach private.
   - `CLAUDE_MODEL` (optional): defaults to Haiku 4.5 for speed
5. **Icons**: add `public/images/coach-192.png` and `coach-512.png` (your logo works). Push works without them, but Chrome won't offer "Install app" without icons.
6. **netlify.toml**: if the repo has one, make sure it includes
   ```
   [functions]
     node_bundler = "esbuild"
   ```
7. **Deploy** (push to main).
8. **On your Android phone**: open `rose.trading/coach/` in Chrome, enter the passphrase, tap "Turn on notifications", allow. Then Chrome menu > "Install app" (or "Add to Home screen") so it opens full-screen.
9. **Test**: in the Netlify dashboard, open the `coach-checkins` function and run it during a check-in slot, or tap "I'm feeling tilted" on the page.

## Things to know

- **Do Not Disturb**: if you use it during market hours, allow Chrome or the installed Coach app through it.
- **Battery optimization**: if notifications arrive late, set Chrome to "Unrestricted" in Android battery settings.
- **Speed**: a button tap shows "Reading that..." and the reply follows a few seconds later. Synchronous Netlify functions time out at about 10 seconds by default, so stick with Haiku.
- **Holidays**: add each year's NYSE closures to `HOLIDAYS` in `coach-checkins.mjs`. Half days aren't handled.
- **Daily reset**: the thread and trade count start fresh each trading day.
- **Old notifications**: check-ins expire after 10 minutes undelivered, so a phone that was off won't get a stale 9:30 nudge at 11:00.

## Your Trader's State of Mind project

The coach reads your project from a private Netlify Blobs store on the site. None of it goes into GitHub, which matters for the personal details in the instructions and the copyrighted Ignite material.

`coach-knowledge/` is already filled in, converted to text:

- `instructions.md`: the project instructions.
- `core/` (about 13,000 tokens): your Trading Process and Playbook, your State of Mind Trade Plan, the three example plans (DTSOM VR, PB, TG), Micro Management of a Trader's Psychology, the Emotional Regulation instructions, and the four Read This First guides. Included in every message.
- `library/` (about 270,000 tokens): Mindful Trading, the Emotional Regulation and Safe Place texts, Awakening the Observer, Mastering the Internal Struggle, The Dark Side of the Committee, Building the Intentional Mind, Becoming the Change, and the Stress Inoculation guide. Too big to send every time, so for each check-in or tap the coach searches it and adds the three most relevant passages.

Setup:

1. **Keep it out of git.** Add `coach-knowledge/` to the repo's `.gitignore` before copying the folder in.
2. **Copy `coach-knowledge/` to the repo root.**
3. **Upload** from the repo root (one-time `npm install -g netlify-cli`, `netlify login`, `netlify link`):
   `./scripts/upload-coach-knowledge.sh`
4. **Redeploy**, or wait about 15 minutes for warm functions to pick up the change.

To change things later, edit or add files and re-run the script. It also removes files you've deleted locally. A new short reference goes in `core/`; anything long goes in `library/`.

The every-message prompt is cached for an hour, so the half-hourly check-ins keep it warm and you pay full price for it about once an hour.

## Changing things

- **Breathing frequency or window**: `BREATH_START` / `BREATH_END` in `coach-checkins.mjs`. For hourly instead, change the cron to `0 12-21 * * 1-5`.
- **Check-in times, wording, or buttons**: `CHECKINS` in `coach-checkins.mjs`.
- **New buttons**: add to `BUTTONS` in `coach.mjs`. Set `tilt: true` if tapping it should trigger the "Still tilted / I'm reset" follow-up.
- **Coach personality**: `coach-knowledge/instructions.md`, then re-run the upload script.
- **What the library search looks for on each tap**: the `search` words on each button in `BUTTONS` (`coach.mjs`). **Phone-length rules and rules from your debriefs**: `FORMAT_PROMPT` in `coach.mjs`. Update it when your ruleset changes.
