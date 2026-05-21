# Overture Slot Filler

A working prototype of the slot-filling bot described in the spec.
It solves the two compounding problems a booking agent on Overture
faces: stale availability data, and the sequential offer bottleneck.

## What's in here

- **Calendar onboarding** — agent generates a batch of personalised
  onboarding SMS, each containing a unique link. Artist clicks, picks
  Google or Apple, and is "connected" with busy/free sync only.
- **Slot filling** — agent clicks *Fill this slot*. The engine pulls
  the slot from Overture, intersects the roster with live calendar
  availability, ranks the candidates by genre, fee, venue history,
  and location, and sends a single offer to the top match.
- **Auto follow-up** — declines and 24-hour no-responses are detected
  by a background sweeper and automatically push the offer to the
  next ranked artist. Slot status, offer history, and a live
  countdown are visible to the agent at all times.
- **Confirmation** — a YES tap confirms the booking, writes it back to
  Overture, and stops the chain. The agent is notified.

## Architecture

```
┌──────────────────┐     ┌────────────────────────┐     ┌────────────────────┐
│ Agent dashboard  │◄───►│ Express API + engine   │◄───►│ SQLite (data.db)   │
│ (public/*)       │     │ (server.js, engine.js) │     └────────────────────┘
└──────────────────┘     │                        │
                         │  Adapters:             │
                         │   • integrations.js    │◄──► Twilio (mocked → SMS inbox in UI)
                         │   • ranking.js         │◄──► Overture REST (mocked)
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

First boot seeds 12 artists, 5 venues, 5 open slots, calendar conflicts
that force the bot to skip the obvious top picks for some slots,
and a few past bookings that feed the ranking.

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
4. **Fill a slot** — click any slot card with status `unfilled`. The
   modal shows the ranked list of available artists with score
   breakdown (genre / fee / history / location). Click *Fill this
   slot*. A YES/NO SMS lands in the inbox.
5. **Decline it** — click the NO link in the SMS. The artist sees a
   simple confirmation page. The agent dashboard updates: that artist
   is marked `declined`, and an offer is automatically sent to the
   next ranked candidate.
6. **Accept it** — click YES on the next offer. The slot turns green,
   `confirmed`, and a notification announces the booking was pushed
   to Overture.
7. **Let one expire** — drop the *Offer window* selector at the top
   to "30 seconds (demo)". Trigger a fill on another slot and don't
   click anything. After 30 seconds the offer auto-expires, the
   declined artist is logged, and the next candidate is contacted
   automatically. The background sweeper handles this without any
   user action.

## Code map

- `server.js` — Express routes (dashboard data, slot actions,
  onboarding pages, offer YES/NO endpoints, settings, demo reset).
- `engine.js` — slot-filling core: `startFillingSlot`,
  `offerNextArtist`, `acceptOffer`, `declineOffer`,
  `sweepExpiredOffers`.
- `ranking.js` — scoring (genre, fee fit, venue history, location).
- `integrations.js` — Twilio / Overture / Calendar adapters (mocked).
- `db.js` — SQLite schema, settings.
- `seed.js` — demo data.
- `public/index.html` + `dashboard.js` + `styles.css` — agent UI.
- `public/styles.css` is also used by the server-rendered artist
  pages (onboarding + offer YES/NO).

## What's deliberately out of scope (matches the spec)

- No automatic booking without agent visibility — every step shows up
  in notifications and the per-slot offer history.
- No replacement of Overture — confirmed bookings are pushed back via
  the adapter and the slot keeps its `OVT-…` ID.
- No contracts / payments / riders — Overture handles that already.
- No multi-artist broadcasts — one offer at a time, top ranked,
  24-hour window (configurable for the demo).
- The agent never sees event titles — calendar adapter only reads
  busy/free.
