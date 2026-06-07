# The Root Map

An interactive web app built from **The Root Map** — the archetype cheat sheet
and XP system that expands *The Self Scale*. It turns the printed tracker into a
playable self-development game you can run from any browser.

## What it does

- **Pick your archetype** — all 10 from the Root Map (Warrior, Seeker, Sovereign,
  Craftsman, Scholar, Visionary, Builder, Connector, Protector, Merchant), each
  with its stat bleed, level-up requirement, and unlock paths.
- **Set your Self Scale baseline** — your three starting pillar scores
  (Spiritual / Physical / Mental).
- **Weekly tracker** — mark each practice the day you complete it across a Mon–Sun
  grid. Tier One foundations (Sleep, Movement, Breathwork) are your passive base;
  your archetype's sources are your active XP.
- **Live pillar scores** — every checked practice banks XP into the right pillar,
  capped at 100, with progress toward your level-up targets.
- **Week One Missions** — onboarding quests with one-time XP bonuses.
- **Unlock Upgrades** — light up automatically when your stats cross the
  archetype's thresholds.
- **Multi-week history** — navigate weeks; XP compounds across all of them.
- Everything saves to **localStorage** — no account, no backend.

## Run it

It's a static site — no build step. Open `index.html`, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Deploys as-is to any static host (Netlify, GitHub Pages, etc.).

## Structure

```
index.html        markup + font loading
css/styles.css    parchment / serif styling matching the source document
js/data.js        the Root Map data model (archetypes, XP sources, unlocks)
js/app.js         state, scoring engine, rendering, persistence
```

The scoring model: each practice awards points to specific pillars
(`sp` / `ph` / `mn`). Your Self Scale score = baseline + cumulative XP earned
(capped at 100). Daily sources are checkable per day; weekly and one-off sources
are marked once per week.
