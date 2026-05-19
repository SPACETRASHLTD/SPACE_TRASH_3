# Booking Bot

Artist availability & gig dispatch for talent booking agencies that use [Overture](https://bookingwithoverture.com/).

## What it does

1. **One-time per artist:** Artist clicks an invite link, signs into Google, and grants read-only Calendar access.
2. **Privacy-preserving sync:** Our server polls Google's FreeBusy API (returns time ranges only — no event titles, locations, or attendees) every 15 minutes and exposes a per-artist private `.ics` URL.
3. **Into Overture once:** The agent pastes that `.ics` URL into the artist's "Internet Calendars" field in Overture. From then on, the artist's busy blocks flow into Overture automatically as opaque "Unavailable" blocks. The artist never updates anything again.
4. **Master availability dashboard:** Agent picks a day, sees who's free.
5. **SMS gig offers:** Agent composes offers, system sends SMS with accept/decline links and a 24-hour countdown. First accept wins; expired offers auto-relinquish.

## Stack

- Next.js 15 (App Router) — agent UI, artist onboarding, public accept/decline pages
- Supabase — Postgres, Auth, Edge Functions, Cron
- Twilio — outbound SMS + delivery webhooks
- Google Calendar API — FreeBusy reads + event writes on accepted gigs
- Overture REST API — reading agency bookings, creating bookings on accept

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Provision external services

#### Supabase
- Create a Supabase project at https://supabase.com.
- Apply the migrations in `supabase/migrations/` (via `supabase db push` once the CLI is configured, or by pasting the SQL into the dashboard SQL editor).
- Deploy the Edge Functions in `supabase/functions/` (via `supabase functions deploy <name>`).
- Schedule the cron jobs (see comments at the top of each Edge Function file for the cron expression).

#### Google Cloud
- Create a project at https://console.cloud.google.com.
- Enable the **Google Calendar API**.
- Configure the OAuth consent screen (External, Testing mode is fine for <100 artists).
- Create an OAuth 2.0 Client ID (Web application).
  - Authorized redirect URI: `${NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
- Copy the Client ID and Client Secret into `.env.local`.

#### Twilio
- Create a Twilio account at https://twilio.com.
- Buy a long code phone number (US).
- **Register A2P 10DLC** brand + campaign. Use case: *Account Notification*. This takes 1–4 weeks; SMS to real US numbers won't deliver reliably until it clears.
- Copy Account SID, Auth Token, and the From number into `.env.local`.

#### Overture
- In Overture, go to Settings → API and create an API key.
- Copy the key and the API base URL into `.env.local`.

### 3. Fill in env vars

```bash
cp .env.example .env.local
```

Fill in every value. The `TOKEN_ENCRYPTION_KEY` can be generated with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 4. Seed the agency row

After applying migrations, insert one row into the `agencies` table and copy its UUID into `AGENCY_ID`. There's a seed script in `supabase/migrations/seed.sql` (added in a later slab).

### 5. Run

```bash
npm run dev
```

Visit http://localhost:3000.

## Repo layout

```
app/
  (agent)/           - agent-facing pages (artists, calendar, offers)
  onboard/           - artist OAuth landing
  offer/[token]/     - public accept/decline pages
  api/               - server routes (OAuth callback, availability, offer respond)
lib/
  google.ts          - Google FreeBusy + Calendar client
  overture.ts        - Overture REST client
  twilio.ts          - SMS send + webhook signature verification
  ical.ts            - RFC 5545 .ics generator
  crypto.ts          - AES-GCM encrypt/decrypt for refresh tokens
  supabase.ts        - server-side Supabase client factory
supabase/
  migrations/        - schema as SQL files
  functions/         - Edge Functions (cron + ical-feed)
```

## Privacy model

Artists' Google Calendar **event details never leave Google**. We use the FreeBusy API, which returns time ranges only — no titles, locations, descriptions, or attendees. The `busy_blocks` table in our Postgres stores `(artist_id, start_ts, end_ts)` and nothing else from the artist's calendar. Overture sees `SUMMARY:Unavailable` blocks via the `.ics` feed we serve. If an artist leaves the agency, revoke their token in `ical_feed_tokens` — the feed 404s, Overture's import goes blank.

## Status

- [ ] Phase 0 — Prerequisites (Twilio 10DLC, Google OAuth, Overture API key)
- [ ] Phase 1 — Calendar sync (Google FreeBusy → private .ics → Overture)
- [ ] Phase 2 — Agent availability dashboard
- [ ] Phase 3 — SMS offer flow with 24h expiry
- [ ] Phase 4 — Auto-cascade + polish

See `/root/.claude/plans/ok-i-just-spoke-encapsulated-garden.md` for the full plan.
