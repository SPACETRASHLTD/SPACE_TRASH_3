# Overture Slot Filler

A working prototype of the slot-filling bot described in the spec.
It solves the two compounding problems a booking agent on Overture
faces: stale availability data, and the sequential offer bottleneck.

## What's in here

- **Calendar onboarding** — agent generates a batch of personalised
  onboarding SMS, each containing a unique link. Artist clicks, picks
  Google or Apple, and is "connected" with busy/free sync only.
- **Slot offering** — agent clicks a slot. The engine pulls the slot
  from Overture, intersects the roster with live calendar availability,
  and shows the agent the list of artists who are free for that
  window. The agent picks who to offer.
- **Refusal & timeout handling** — a background sweeper detects 24-hour
  no-responses and marks them refused. Refusals (whether the artist
  taps REFUSE or the timer expires) drop the slot back to unfilled
  and notify the agent so they can pick the next artist.
- **Confirmation** — an ACCEPT tap confirms the booking, writes it
  back to Overture, and notifies the agent.

## Architecture

```
┌──────────────────┐     ┌────────────────────────┐     ┌────────────────────┐
│ Agent dashboard  │◄───►│ Express API + engine   │◄───►│ SQLite (data.db)   │
│ (public/*)       │     │ (server.js, engine.js) │     └────────────────────┘
└──────────────────┘     │                        │
                         │  Adapters:             │◄──► Twilio (mocked → SMS inbox in UI)
                         │   • integrations.js    │◄──► Overture REST (mocked)
                         │                        │◄──► Google/Apple Calendar (mocked OAuth)
                         └────────────────────────┘
```

Integrations are isolated behind adapter functions in `integrations.js`.
Swapping the mocks for real Twilio / Google / Apple / Overture clients
is a single-file change per integration; the engine and UI don't need
to know.

## Run it

```
npm install
npm start
# → http://localhost:3000
```

First boot seeds 12 artists, 5 venues, 5 open slots, and calendar
conflicts so the available-artists list shrinks for some slots.

`npm run seed -- --reset` wipes and re-seeds. The dashboard also has
a *Reset demo data* button.

## Demo flow (90 seconds)

1. **See the roster** — three artists in the "Roster" panel show
   `not onboarded`. The stats row highlights this in amber.
2. **Send onboarding batch** — click the button. Three SMS messages
   appear in the "Artist phones" inbox at the bottom right. Each
   message contains a `/onboard/...` link.
3. **Onboard an artist** — click one of those links. A standard
   onboarding page appears with two big buttons: *Connect Google*
   and *Connect Apple*. Click either. The page confirms; back on the
   dashboard that artist now shows a green dot.
4. **Offer a slot** — click any slot card with status `unfilled`. The
   modal shows artists who are onboarded *and* free for that window.
   Click *Send offer* next to whichever artist you want to book.
5. **Refuse it** — click the REFUSE link in the SMS that appears in
   the inbox. The slot drops back to `unfilled`, a notification fires,
   and the modal opens again with that artist removed from the list.
   Pick another and send.
6. **Accept it** — click ACCEPT in the next SMS. The slot turns green,
   `confirmed`, and a notification announces the booking was pushed
   to Overture.
7. **Let one expire** — drop the *Offer window* selector at the top
   to "30 seconds (demo)". Send an offer and don't respond. After 30
   seconds the background sweeper auto-refuses it and the slot drops
   back to `unfilled` for the agent to pick again.

## Code map

- `server.js` — Express routes (dashboard data, slot actions,
  onboarding pages, offer accept/refuse endpoints, settings, demo reset).
- `engine.js` — core verbs: `availableArtistsForSlot`,
  `sendOfferToArtist`, `acceptOffer`, `refuseOffer`,
  `sweepExpiredOffers`.
- `integrations.js` — Twilio / Overture / Calendar adapters (mocked).
- `db.js` — SQLite schema (uses Node's built-in `node:sqlite`), settings.
- `seed.js` — demo data.
- `public/index.html` + `dashboard.js` + `styles.css` — agent UI.
- `public/styles.css` is also used by the server-rendered artist
  pages (onboarding + offer accept/refuse).

## What's deliberately out of scope (matches the spec)

- No automatic booking without agent visibility — every step shows up
  in notifications and the per-slot offer history.
- No replacement of Overture — confirmed bookings are pushed back via
  the adapter and the slot keeps its `OVT-…` ID.
- No contracts / payments / riders — Overture handles that already.
- No multi-artist broadcasts — one offer at a time, agent picks who,
  24-hour window (configurable for the demo).
- No automatic ranking of artists — agent decides who to offer based
  on the available list. The bot only filters by calendar availability.
- The agent never sees event titles — calendar adapter only reads
  busy/free.
