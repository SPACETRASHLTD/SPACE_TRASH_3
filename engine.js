import { db, getSetting } from './db.js';
import { nanoid } from 'nanoid';
import { sendSms, pushBookingToOverture } from './integrations.js';

function offerWindowMs() {
  return parseInt(getSetting('offer_window_seconds', '60'), 10) * 1000;
}

function notify(kind, message, slotId = null) {
  db.prepare(
    'INSERT INTO notifications (kind, message, slot_id) VALUES (?, ?, ?)'
  ).run(kind, message, slotId);
}

function getSlot(slotId) {
  return db.prepare(`
    SELECT s.*, v.name AS venue_name, v.location AS venue_location
    FROM slots s JOIN venues v ON v.id = s.venue_id
    WHERE s.id = ?
  `).get(slotId);
}

function getArtist(artistId) {
  return db.prepare('SELECT * FROM artists WHERE id = ?').get(artistId);
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

// Filter the roster down to artists who are onboarded and free during the
// slot window. No scoring — the agent picks from the list. Already-offered
// artists for the same slot are excluded so the agent can't re-offer.
export function availableArtistsForSlot(slotId) {
  const slot = getSlot(slotId);
  if (!slot) throw new Error('Slot not found');

  const offered = db.prepare(
    'SELECT artist_id FROM offers WHERE slot_id = ?'
  ).all(slotId).map((r) => r.artist_id);
  const offeredSet = new Set(offered);

  const slotStart = `${slot.slot_date}T${slot.start_time}:00`;
  const slotEnd = `${slot.slot_date}T${slot.end_time}:00`;

  const candidates = db.prepare(
    'SELECT * FROM artists WHERE onboarded = 1 ORDER BY name ASC'
  ).all();

  const available = [];
  for (const artist of candidates) {
    if (offeredSet.has(artist.id)) continue;
    const conflict = db.prepare(`
      SELECT 1 FROM calendar_busy
      WHERE artist_id = ?
        AND NOT (end_time <= ? OR start_time >= ?)
      LIMIT 1
    `).get(artist.id, slotStart, slotEnd);
    if (!conflict) available.push(artist);
  }
  return { slot, available };
}

function sendOfferSms({ artist, slot, token }) {
  const base = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const accept = `${base}/r/${token}/accept`;
  const refuse = `${base}/r/${token}/refuse`;
  const body = (
    `Hi ${artist.name.split(' ')[0]}, you've been offered ${slot.venue_name} on ` +
    `${formatDate(slot.slot_date)} (${slot.start_time}-${slot.end_time}). ` +
    `Fee: £${slot.fee}.\n\n` +
    `Tap one within 24h:\n` +
    `ACCEPT → ${accept}\n` +
    `REFUSE → ${refuse}`
  );
  sendSms({ artistId: artist.id, kind: 'offer', body });
}

// Send an offer for a slot to a specific artist (chosen by the agent).
export function sendOfferToArtist(slotId, artistId) {
  const slot = getSlot(slotId);
  if (!slot) throw new Error('Slot not found');
  if (slot.status === 'confirmed') return { error: 'Slot is already confirmed.' };
  if (slot.status === 'offer_pending') return { error: 'An offer is already pending for this slot.' };

  const artist = getArtist(artistId);
  if (!artist) throw new Error('Artist not found');
  if (!artist.onboarded) return { error: `${artist.name} has not completed calendar onboarding.` };

  const already = db.prepare(
    'SELECT 1 FROM offers WHERE slot_id = ? AND artist_id = ?'
  ).get(slotId, artistId);
  if (already) return { error: `${artist.name} has already been offered this slot.` };

  // offers.rank stores the order in which offers were sent for this slot
  // (1st, 2nd, 3rd…) — purely an audit-trail counter, not a fit score.
  const priorCount = db.prepare('SELECT COUNT(*) as n FROM offers WHERE slot_id = ?').get(slotId).n;
  const token = nanoid(20);
  const expires = new Date(Date.now() + offerWindowMs()).toISOString();

  db.prepare(`
    INSERT INTO offers (slot_id, artist_id, rank, expires_at, response_token)
    VALUES (?, ?, ?, ?, ?)
  `).run(slotId, artistId, priorCount + 1, expires, token);

  db.prepare('UPDATE slots SET status = ? WHERE id = ?').run('offer_pending', slotId);
  sendOfferSms({ artist, slot, token });
  notify(
    'offer_sent',
    `Offer sent to ${artist.name} for ${slot.venue_name} on ${formatDate(slot.slot_date)}. Expires in ${Math.round(offerWindowMs() / 1000)}s.`,
    slotId
  );
  return { ok: true, artist, expires_at: expires };
}

export function acceptOffer(token) {
  const offer = db.prepare('SELECT * FROM offers WHERE response_token = ?').get(token);
  if (!offer) return { error: 'Unknown offer link.' };
  if (offer.status !== 'pending') return { error: `This offer has already been ${offer.status}.` };
  if (new Date(offer.expires_at).getTime() < Date.now()) return { error: 'This offer has expired.' };

  db.prepare("UPDATE offers SET status = 'accepted', response_at = CURRENT_TIMESTAMP WHERE id = ?").run(offer.id);

  const slot = getSlot(offer.slot_id);
  const artist = getArtist(offer.artist_id);
  db.prepare("UPDATE slots SET status = 'confirmed', confirmed_artist_id = ? WHERE id = ?")
    .run(artist.id, slot.id);

  const overture = pushBookingToOverture({ slot, artist });
  notify(
    'slot_confirmed',
    `${artist.name} accepted ${slot.venue_name} on ${formatDate(slot.slot_date)}. Overture booking ${overture.overture_slot_id} confirmed.`,
    slot.id
  );
  return { ok: true, slot, artist };
}

// Artist refuses the offer. Slot returns to unfilled so the agent can pick
// the next artist manually.
export function refuseOffer(token, reason = 'refused') {
  const offer = db.prepare('SELECT * FROM offers WHERE response_token = ?').get(token);
  if (!offer) return { error: 'Unknown offer link.' };
  if (offer.status !== 'pending') return { error: `This offer has already been ${offer.status}.` };

  db.prepare('UPDATE offers SET status = ?, response_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(reason, offer.id);

  const slot = getSlot(offer.slot_id);
  const artist = getArtist(offer.artist_id);

  // Drop the slot back to unfilled so the agent can pick the next artist.
  db.prepare("UPDATE slots SET status = 'unfilled' WHERE id = ?").run(slot.id);

  notify(
    reason === 'expired' ? 'offer_expired' : 'offer_refused',
    `${artist.name} ${reason === 'expired' ? 'did not respond in time' : 'refused'} ${slot.venue_name} on ${formatDate(slot.slot_date)}. Pick another artist to offer.`,
    slot.id
  );
  return { ok: true };
}

// Periodic sweep — expire offers past their window and notify the agent.
// No auto-cascade now: the agent decides who to offer next.
export function sweepExpiredOffers() {
  const expired = db.prepare(`
    SELECT response_token FROM offers
    WHERE status = 'pending' AND expires_at < ?
  `).all(new Date().toISOString());
  for (const row of expired) refuseOffer(row.response_token, 'expired');
  return expired.length;
}
