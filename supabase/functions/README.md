# Supabase Edge Functions

Four functions in this directory:

- **`poll-availability/`** — cron every 15 min. Reads each artist's encrypted Google refresh token, queries the FreeBusy API, replaces `source='google'` rows in `busy_blocks`. Per-artist failures are isolated and recorded in `google_tokens.last_error`.
- **`ical-feed/`** — public HTTP endpoint at `/functions/v1/ical-feed/<token>.ics`. Returns busy-only `.ics` content. The token in the URL is the only auth (`verify_jwt` is disabled on deploy).
- **`dispatch-offers/`** — cron every 1 min. Picks up `draft` offers, sends SMS via Twilio, flips them to `pending`. **Refuses to send unless `OFFERS_ALLOW_DISPATCH=1`** — safety toggle so dev doesn't surprise-text artists.
- **`expire-offers/`** — cron every 5 min. Flips `pending` offers past `expires_at` to `expired`.

Shared code lives in `_shared/`:
- `crypto.ts` — AES-256-GCM decrypt (Web Crypto, mirror of `/lib/crypto.ts`)
- `google.ts` — refresh-token → access-token → FreeBusy chunked over 30-day windows
- `ical.ts` — minimal RFC 5545 .ics builder with deterministic UIDs

## Deploy

```bash
# from repo root
supabase login
supabase link --project-ref <your-project-ref>

supabase functions deploy poll-availability
supabase functions deploy ical-feed --no-verify-jwt
supabase functions deploy dispatch-offers
supabase functions deploy expire-offers
```

## Secrets

```bash
supabase secrets set \
  GOOGLE_CLIENT_ID=... \
  GOOGLE_CLIENT_SECRET=... \
  TOKEN_ENCRYPTION_KEY=... \
  TWILIO_ACCOUNT_SID=... \
  TWILIO_AUTH_TOKEN=... \
  TWILIO_FROM_NUMBER=... \
  NEXT_PUBLIC_APP_URL=https://gigs.<your-agency>.com \
  OFFERS_ALLOW_DISPATCH=1
```

`OFFERS_ALLOW_DISPATCH=0` (or unset) makes `dispatch-offers` a no-op.
Flip to `1` only after Twilio + 10DLC are configured.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by Supabase.

## Schedule the cron

In Supabase Studio → **Database → Cron Jobs → New job**:

| Field | Value |
|---|---|
| Name | `poll-availability` |
| Schedule | `*/15 * * * *` |
| Type | HTTP Request |
| Method | POST |
| URL | `https://<project-ref>.supabase.co/functions/v1/poll-availability` |
| Headers | `{ "Authorization": "Bearer <service-role-key>", "Content-Type": "application/json" }` |
| Body | `{}` |

## Verify

After deploying and adding at least one connected artist:

```bash
# Trigger poll-availability manually
curl -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  https://<project-ref>.supabase.co/functions/v1/poll-availability

# Then fetch a feed (token from ical_feed_tokens table)
curl https://<project-ref>.supabase.co/functions/v1/ical-feed/<token>.ics
```

Expected response from the feed:

```
BEGIN:VCALENDAR
VERSION:2.0
...
BEGIN:VEVENT
UID:<hash>@bookingbot
DTSTAMP:20260519T210000Z
DTSTART:...
DTEND:...
SUMMARY:Unavailable
TRANSP:OPAQUE
END:VEVENT
END:VCALENDAR
```

Confirm there are **no event titles, locations, or descriptions** beyond
`SUMMARY:Unavailable`. That's the privacy guarantee.
