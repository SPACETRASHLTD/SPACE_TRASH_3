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

After applying migrations, run the seed script. It inserts one row into
the `agencies` table and prints the UUID for you to copy into `AGENCY_ID`.

```bash
node --env-file=.env.local scripts/seed-agency.mjs "Your Agency Name" "America/New_York"
```

Timezone is optional (defaults to `America/New_York`). Use any IANA name.

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

Code is complete for Phases 1–3. **Nothing has been run live yet** — needs Supabase + Google + Twilio + Overture provisioning before it works against real data.

- [ ] **Phase 0** — Prerequisites (external services, **action items for you**)
  - [ ] Supabase project created + migrations applied + edge functions deployed (see `supabase/functions/README.md`)
  - [ ] Google Cloud project: Calendar API enabled, OAuth client created, redirect URI configured
  - [ ] Twilio account + phone number + A2P 10DLC campaign registered (1–4 week wait)
  - [ ] Overture API key obtained + endpoint shapes pulled from the docs PDF in your friend's Overture Settings page
- [x] **Phase 1** — Calendar sync (Google FreeBusy → private .ics → Overture). Artist OAuth flow, encrypted refresh tokens, 15-min poll cron, per-artist iCal feed served from edge function. Privacy scope: `calendar.freebusy` only.
- [x] **Phase 2** — Agent availability dashboard. Month grid with utilization bars + pending-offer badges. Day-detail panel with available / busy / pending sections. Make-offer CTA links straight into composer with date + artists pre-filled. *(Note: Overture sync-back into `busy_blocks` is stubbed — needs the API docs to finish.)*
- [x] **Phase 3** — SMS offer flow with 24h expiry. Composer with available-first artist picker, batch creation, public mobile accept/decline pages, Twilio dispatch edge function (safety-gated by `OFFERS_ALLOW_DISPATCH=1`), expiry cron. Race-safe acceptance via partial unique index on pending offers.
- [ ] **Phase 4** — Polish: auto-cascade (artist B gets offered if A declines/expires), audit log, agent morning digest, Supabase Auth (replacing the HTTP Basic Auth placeholder), Overture API client implementation.

See `/root/.claude/plans/ok-i-just-spoke-encapsulated-garden.md` for the full plan.

## First-run checklist

1. `npm install`
2. Create Supabase project, copy URL + service-role key into `.env.local`
3. Create Google Cloud OAuth client (Calendar API enabled), set redirect URI to `${NEXT_PUBLIC_APP_URL}/api/auth/google/callback`, copy creds
4. Generate `TOKEN_ENCRYPTION_KEY`: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
5. Set `AGENT_PASSWORD` (anything strong)
6. Apply migrations: `supabase db push` (or paste `supabase/migrations/*.sql` into the SQL editor)
7. Seed agency: `node --env-file=.env.local scripts/seed-agency.mjs "Lecky & Co."` — copy printed UUID into `AGENCY_ID`
8. Deploy edge functions: `supabase functions deploy poll-availability && supabase functions deploy ical-feed --no-verify-jwt && supabase functions deploy dispatch-offers && supabase functions deploy expire-offers`
9. Set edge function secrets: `supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... TOKEN_ENCRYPTION_KEY=...`
10. Schedule the crons in Supabase Studio (see `supabase/functions/README.md` for the SQL)
11. `npm run dev`, open http://localhost:3000/artists, invite yourself as the first artist, walk through the OAuth flow end-to-end
12. Twilio: leave `OFFERS_ALLOW_DISPATCH=0` until 10DLC clears. Drafts will pile up safely in the meantime.
