# Vancouver House Party

A one-page marketing site **plus an adaptive AI booking chatbot** that captures
leads for live music at private house parties in Vancouver. The bot is the core
product; the page exists to build trust and get the visitor into the bot.

- **Framework:** Next.js 14 (App Router) + React 18
- **Styling:** Tailwind CSS — warm off-white `#FAF7F2`, deep charcoal `#1A1A1A`, single gold accent `#B8893A`; Fraunces (headlines) + Inter (body/UI)
- **Bot:** Anthropic Claude via a server-side API route (key never reaches the browser)
- **Leads:** Supabase (Postgres)
- **Notifications:** Twilio SMS + Resend email, both fired on lead insert
- **Deploy target:** Render (Node web service). Mobile-first.

## Project layout

```
src/
  app/
    layout.tsx            # fonts, metadata, BotProvider + ChatBot + Toast mount
    page.tsx              # single scrolling homepage (assembles the sections)
    artists/page.tsx      # /artists — full roster, data-driven
    api/chat/route.ts     # the bot: Claude tool-use loop, Supabase write, notify
    globals.css           # design tokens + component classes
  components/
    BotProvider.tsx       # context so any "Find your musician" button opens the bot
    FindMusicianButton.tsx
    Nav.tsx, Toast.tsx, ArtistCard.tsx
    bot/ChatBot.tsx        # the chat sheet/modal, typing dots, quick replies
    bot/TypingDots.tsx, bot/BotIcon.tsx
    sections/*             # Hero, RecentParties, HowItWorks, FeaturedMusicians,
                           # WhoWeAre, FAQ, FinalCTA, Footer
  data/
    artists.ts            # roster (add an artist = add an object here)
    content.ts            # all site copy, FAQ, recent parties, bot name
  lib/
    prompt.ts             # the booking-assistant system prompt
    lead.ts               # Lead type + submit_lead tool schema + SMS summary
    supabase.ts           # server-only Supabase admin client
    notify.ts             # Twilio SMS + Resend email (parallel, never throw)
supabase/migrations/0001_leads.sql   # the `leads` table
public/                   # placeholder images (clearly marked)
```

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your keys
npm run dev                  # http://localhost:3000
```

`npm run build` runs a full production build + type-check.

## Deploying to Render

This repo includes `render.yaml`, a Render Blueprint for a Node web service:

1. In Render, **New → Blueprint** and point it at this repo. It picks up
   `render.yaml` (build `npm ci && npm run build`, start `npm run start`).
2. Fill in every `sync: false` env var in the service's **Environment** tab
   (all the secrets from `.env.example`). `CLAUDE_MODEL` and `NODE_VERSION`
   already have values.
3. Deploy. `next start` binds to Render's `$PORT` automatically; the
   `/api/chat` route runs in the same Node process (no serverless config).

Node version is pinned via `.node-version` (22) and `engines` in `package.json`.

## Environment variables

See `.env.example`. Server-side only (never `NEXT_PUBLIC_*`): `ANTHROPIC_API_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, all Twilio + Resend keys, `FOUNDER_PHONES`,
`FOUNDER_EMAILS`. Set the same keys in Render (dashboard → service → Environment),
or let `render.yaml` declare them and fill the `sync: false` values there.

- `CLAUDE_MODEL` defaults to `claude-sonnet-4-6` (fast + warm for high-volume chat).
- `FOUNDER_PHONES` / `FOUNDER_EMAILS` are comma-separated so both founders are notified.

## Supabase

Create the `leads` table by running `supabase/migrations/0001_leads.sql`
(Supabase CLI `supabase db push`, or paste into the SQL editor). RLS is enabled
with no public policies — leads are written server-side with the service role
key only, so the browser can never read or write the table.

> Note: this build environment had one unrelated Supabase project, so the table
> was **not** auto-created remotely. Run the migration against your own project.

## The chatbot

The bot runs an **adaptive** discovery conversation (not a rigid form) through
`POST /api/chat`, which calls Claude server-side with the system prompt in
`src/lib/prompt.ts`. Key behaviours:

- **Tool-use completion.** Claude calls the `submit_lead` tool when it has at
  least name/email/phone. The route then inserts the lead into Supabase and
  fires both notifications, then asks Claude for one warm closing line. Only
  contact details are required by the tool so the safety-valve path can close
  with minimal info.
- **Safety valve.** If the visitor is impatient or asks to "just leave my
  number," the prompt instructs Claude to drop discovery, collect
  name/email/phone, and close. Never traps a ready-to-convert visitor.
- **Soft routing** toward the two founder-artists (Stephen Lecky / Sasha
  Veregen) lives in the prompt and is never exposed to the user.
- **Quick replies.** Claude may append `[[quick: A | B | C]]`; the route strips
  it and the UI renders tappable pills. The visitor can always free-type.
- **Lead safety.** The lead is saved before notifications, and notifications
  never throw — a Twilio/Resend hiccup can't lose a captured lead.

## Placeholders the founder must fill before going fully live

- Hero headline + subhead — `src/data/content.ts` (`hero`)
- Bot name — `src/data/content.ts` (`bot.name`; falls back to "your booking assistant")
- Real testimonials + dates — `src/data/content.ts` (`recentParties`)
- FAQ answers, especially pricing — `src/data/content.ts` (`faqs`)
- Hero + final-CTA photos, founder + artist portraits — `public/` (placeholders in place)
- Artist 30-second audio clips — `public/artists/*.mp3` (referenced in `artists.ts`)
- Neighborhood list in FAQ #5 — `src/data/content.ts`
- Site email + Instagram + founder signoff — `src/data/content.ts` (`site`, `whoWeAre`)

## What was verified vs. what needs live credentials

Verified in this environment: production build + type-check, homepage and
`/artists` render, and the chat API's graceful `503` when no key is configured.

Needs real credentials (run as a live end-to-end test after setting env vars —
build step 8): the Claude conversation itself, the Supabase insert, and the
Twilio/Resend notifications.

## Security note

`npm audit` reports residual Next.js advisories (mostly DoS / self-hosted image
optimizer classes) only fully patched in Next 16, a breaking major upgrade.
Because Render self-hosts the Next image optimizer, the optimizer advisories
are more relevant here than on a managed platform — worth scheduling the Next 16
upgrade. As a quick mitigation, all `<Image>` use is first-party (`/public`
assets, no untrusted remote `remotePatterns`), which avoids the highest-risk
vectors. Revisit the upgrade when convenient.

## Note on legacy files

`index2.html` and `styles2.css` are unrelated leftovers from a previous,
different site that were already in the repo. They are not part of the Next.js
app and were left untouched.
