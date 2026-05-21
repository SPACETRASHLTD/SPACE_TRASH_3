import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, getSetting, setSetting } from './db.js';
import { seedDemoData } from './seed.js';
import { rankArtistsForSlot } from './ranking.js';
import {
  startFillingSlot,
  acceptOffer,
  declineOffer,
  sweepExpiredOffers,
} from './engine.js';
import { connectCalendar, sendSms } from './integrations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

// Seed on first boot if the DB is empty
seedDemoData({ reset: false });

// ---------------------------------------------------------------------------
// Dashboard data
// ---------------------------------------------------------------------------
app.get('/api/state', (_req, res) => {
  const slots = db.prepare(`
    SELECT s.*, v.name AS venue_name, v.location AS venue_location, v.genres AS venue_genres,
           a.name AS confirmed_artist_name
    FROM slots s
    JOIN venues v ON v.id = s.venue_id
    LEFT JOIN artists a ON a.id = s.confirmed_artist_id
    ORDER BY s.slot_date ASC
  `).all();

  for (const slot of slots) {
    const offers = db.prepare(`
      SELECT o.*, a.name AS artist_name
      FROM offers o JOIN artists a ON a.id = o.artist_id
      WHERE o.slot_id = ?
      ORDER BY o.rank ASC
    `).all(slot.id);
    slot.offers = offers;
    slot.current_offer = offers.find((o) => o.status === 'pending') || null;
  }

  const artists = db.prepare(`
    SELECT id, name, phone, genres, location, fee_min, fee_max,
           onboarded, calendar_provider, onboarding_token, onboarded_at, last_reminder_at
    FROM artists ORDER BY name ASC
  `).all();

  const notifications = db.prepare(`
    SELECT * FROM notifications ORDER BY id DESC LIMIT 50
  `).all();

  const sms = db.prepare(`
    SELECT s.*, a.name AS artist_name, a.phone AS artist_phone
    FROM sms_log s JOIN artists a ON a.id = s.artist_id
    ORDER BY s.id DESC LIMIT 30
  `).all();

  const stats = {
    open_slots: slots.filter((s) => s.status === 'unfilled' || s.status === 'exhausted').length,
    pending: slots.filter((s) => s.status === 'offer_pending').length,
    confirmed: slots.filter((s) => s.status === 'confirmed').length,
    onboarded: artists.filter((a) => a.onboarded).length,
    not_onboarded: artists.filter((a) => !a.onboarded).length,
    offer_window_seconds: parseInt(getSetting('offer_window_seconds', '60'), 10),
    server_now: new Date().toISOString(),
  };

  res.json({ slots, artists, notifications, sms, stats });
});

// ---------------------------------------------------------------------------
// Slot actions
// ---------------------------------------------------------------------------
app.get('/api/slots/:id/preview', (req, res) => {
  try {
    const { slot, ranked } = rankArtistsForSlot(parseInt(req.params.id, 10));
    res.json({ slot, ranked: ranked.slice(0, 10) });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/slots/:id/fill', (req, res) => {
  try {
    const result = startFillingSlot(parseInt(req.params.id, 10));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Artist onboarding
// ---------------------------------------------------------------------------
app.post('/api/artists/send-onboarding-batch', (req, res) => {
  const targets = db.prepare(
    'SELECT * FROM artists WHERE onboarded = 0'
  ).all();
  const base = req.protocol + '://' + req.get('host');
  const sent = [];
  for (const artist of targets) {
    const link = `${base}/onboard/${artist.onboarding_token}`;
    const body = (
      `Hi ${artist.name.split(' ')[0]} — your agent uses Overture to manage your gigs. ` +
      `Connect your calendar in one tap so we always know when you're free: ${link}\n\n` +
      `We only see when you're busy, not what you're doing.`
    );
    sendSms({ artistId: artist.id, kind: 'onboarding', body });
    db.prepare('UPDATE artists SET last_reminder_at = CURRENT_TIMESTAMP WHERE id = ?').run(artist.id);
    sent.push({ id: artist.id, name: artist.name, link });
  }
  res.json({ count: sent.length, sent });
});

app.get('/onboard/:token', (req, res) => {
  const artist = db.prepare('SELECT * FROM artists WHERE onboarding_token = ?').get(req.params.token);
  if (!artist) {
    return res.status(404).send(renderShell('Link not found', '<p>This onboarding link is no longer valid.</p>'));
  }
  res.send(renderOnboardingPage(artist));
});

app.post('/api/onboard/:token/connect', (req, res) => {
  const artist = db.prepare('SELECT * FROM artists WHERE onboarding_token = ?').get(req.params.token);
  if (!artist) return res.status(404).json({ error: 'Invalid link' });
  const provider = (req.body.provider || '').toLowerCase();
  if (!['google', 'apple'].includes(provider)) {
    return res.status(400).json({ error: 'Provider must be google or apple' });
  }
  connectCalendar({ artistId: artist.id, provider });
  res.json({ ok: true, provider });
});

// ---------------------------------------------------------------------------
// Artist YES / NO offer response
// ---------------------------------------------------------------------------
app.get('/r/:token/:action', (req, res) => {
  const { token, action } = req.params;
  const offer = db.prepare(`
    SELECT o.*, s.slot_date, s.start_time, s.end_time, s.fee, v.name AS venue_name, a.name AS artist_name
    FROM offers o
    JOIN slots s ON s.id = o.slot_id
    JOIN venues v ON v.id = s.venue_id
    JOIN artists a ON a.id = o.artist_id
    WHERE o.response_token = ?
  `).get(token);
  if (!offer) {
    return res.status(404).send(renderShell('Offer not found', '<p>This offer link is no longer valid.</p>'));
  }
  res.send(renderOfferPage(offer, action, token));
});

app.post('/api/offer/:token/respond', (req, res) => {
  const { action } = req.body;
  if (action === 'accept') return res.json(acceptOffer(req.params.token));
  if (action === 'decline') return res.json(declineOffer(req.params.token));
  res.status(400).json({ error: 'action must be accept or decline' });
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
app.post('/api/notifications/mark-read', (_req, res) => {
  db.prepare("UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE read_at IS NULL").run();
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Settings (demo: short offer window so the flow is watchable)
// ---------------------------------------------------------------------------
app.post('/api/settings/offer-window', (req, res) => {
  const seconds = parseInt(req.body.seconds, 10);
  if (isNaN(seconds) || seconds < 5 || seconds > 86400) {
    return res.status(400).json({ error: 'seconds must be between 5 and 86400' });
  }
  setSetting('offer_window_seconds', seconds);
  res.json({ ok: true, offer_window_seconds: seconds });
});

// ---------------------------------------------------------------------------
// Demo controls
// ---------------------------------------------------------------------------
app.post('/api/demo/reset', (_req, res) => {
  const result = seedDemoData({ reset: true });
  res.json(result);
});

// ---------------------------------------------------------------------------
// Background sweep — expire pending offers and bump to next artist
// ---------------------------------------------------------------------------
setInterval(() => {
  try {
    const n = sweepExpiredOffers();
    if (n > 0) console.log(`[sweep] expired ${n} offer(s)`);
  } catch (err) {
    console.error('[sweep] error', err);
  }
}, 5000);

// ---------------------------------------------------------------------------
// Default route → dashboard
// ---------------------------------------------------------------------------
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Overture slot-filler listening on http://localhost:${PORT}`);
});

// ---------------------------------------------------------------------------
// Inline server-rendered pages for artist onboarding & offer response
// (Kept tiny so we don't need a templating engine.)
// ---------------------------------------------------------------------------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderShell(title, body) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="/styles.css">
</head><body class="artist-page"><main class="card">${body}</main></body></html>`;
}

function renderOnboardingPage(artist) {
  if (artist.onboarded) {
    return renderShell('Already connected', `
      <h1>You're set up</h1>
      <p>Hi ${escapeHtml(artist.name.split(' ')[0])} — your ${escapeHtml(artist.calendar_provider || 'calendar')} is already connected.</p>
      <p class="muted">Your agent only sees when you're busy, never what you're doing.</p>
    `);
  }
  return renderShell('Connect your calendar', `
    <h1>Hi ${escapeHtml(artist.name.split(' ')[0])}</h1>
    <p>Connect your calendar in one tap. Your agent will only ever see when you're <strong>busy</strong> — never event titles or details.</p>
    <p class="muted">No app, no account, no login after this.</p>
    <div class="cal-buttons">
      <button class="btn btn-google" data-provider="google">Connect Google Calendar</button>
      <button class="btn btn-apple" data-provider="apple">Connect Apple Calendar</button>
    </div>
    <div id="result"></div>
    <script>
      document.querySelectorAll('button[data-provider]').forEach((b) => {
        b.addEventListener('click', async () => {
          const provider = b.dataset.provider;
          const res = await fetch('/api/onboard/${artist.onboarding_token}/connect', {
            method: 'POST', headers: {'content-type': 'application/json'},
            body: JSON.stringify({ provider }),
          });
          const data = await res.json();
          if (data.ok) {
            document.querySelector('.cal-buttons').style.display = 'none';
            document.getElementById('result').innerHTML =
              '<div class="success">Connected to ' + provider + '. You can close this window.</div>';
          } else {
            document.getElementById('result').innerHTML =
              '<div class="error">' + (data.error || 'Something went wrong.') + '</div>';
          }
        });
      });
    </script>
  `);
}

function renderOfferPage(offer, action, token) {
  if (offer.status !== 'pending') {
    return renderShell('Offer closed', `
      <h1>This offer is closed</h1>
      <p>Status: <strong>${escapeHtml(offer.status)}</strong></p>
    `);
  }
  const verb = action === 'yes' ? 'accept' : 'decline';
  const dateStr = new Date(offer.slot_date + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  return renderShell(verb === 'accept' ? 'Confirm acceptance' : 'Confirm decline', `
    <h1>${verb === 'accept' ? 'Accept this offer?' : 'Decline this offer?'}</h1>
    <div class="offer-summary">
      <p><strong>${escapeHtml(offer.venue_name)}</strong></p>
      <p>${escapeHtml(dateStr)} · ${escapeHtml(offer.start_time)}–${escapeHtml(offer.end_time)}</p>
      <p>Fee: £${offer.fee}</p>
    </div>
    <button id="go" class="btn ${verb === 'accept' ? 'btn-yes' : 'btn-no'}">${verb === 'accept' ? 'Yes, accept' : 'Yes, decline'}</button>
    <div id="result"></div>
    <script>
      document.getElementById('go').addEventListener('click', async () => {
        const res = await fetch('/api/offer/${token}/respond', {
          method: 'POST', headers: {'content-type': 'application/json'},
          body: JSON.stringify({ action: '${verb}' }),
        });
        const data = await res.json();
        document.getElementById('go').style.display = 'none';
        if (data.ok) {
          document.getElementById('result').innerHTML = '<div class="success">Thanks — your response was logged.</div>';
        } else {
          document.getElementById('result').innerHTML = '<div class="error">' + (data.error || 'Something went wrong.') + '</div>';
        }
      });
    </script>
  `);
}
