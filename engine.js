import { db, getSetting } from './db.js';
import { nanoid } from 'nanoid';
import { rankArtistsForSlot } from './ranking.js';
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

function sendOfferSms({ artist, slot, token }) {
  const base = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const yes = `${base}/r/${token}/yes`;
  const no = `${base}/r/${token}/no`;
  const body = (
    `Hi ${artist.name.split(' ')[0]}, you've been offered ${slot.venue_name} on ` +
    `${formatDate(slot.slot_date)} (${slot.start_time}-${slot.end_time}). ` +
    `Fee: £${slot.fee}. Please accept or decline within 24h:\n` +
    `YES: ${yes}\nNO:  ${no}`
  );
  sendSms({ artistId: artist.id, kind: 'offer', body });
}

// Issue an offer to the next-ranked available artist for a slot. Returns the
// artist that received it, or null if the ranked list is exhausted.
export function offerNextArtist(slotId) {
  const slot = getSlot(slotId);
  if (!slot) throw new Error('Slot not found');
  if (slot.status === 'confirmed') return { done: true, reason: 'already_confirmed' };

  const { ranked } = rankArtistsForSlot(slotId);
  if (ranked.length === 0) {
    db.prepare('UPDATE slots SET status = ? WHERE id = ?').run('exhausted', slotId);
    notify(
      'slot_exhausted',
      `Slot at ${slot.venue_name} on ${formatDate(slot.slot_date)} is unfilled — ranked list exhausted. Manual intervention needed.`,
      slotId
    );
    return { done: true, reason: 'exhausted' };
  }

  const top = ranked[0];
  const priorCount = db.prepare('SELECT COUNT(*) as n FROM offers WHERE slot_id = ?').get(slotId).n;
  const rank = priorCount + 1;
  const token = nanoid(20);
  const expires = new Date(Date.now() + offerWindowMs()).toISOString();

  db.prepare(`
    INSERT INTO offers (slot_id, artist_id, rank, expires_at, response_token)
    VALUES (?, ?, ?, ?, ?)
  `).run(slotId, top.artist.id, rank, expires, token);

  db.prepare('UPDATE slots SET status = ? WHERE id = ?').run('offer_pending', slotId);
  sendOfferSms({ artist: top.artist, slot, token });
  notify(
    'offer_sent',
    `Offer #${rank} sent to ${top.artist.name} for ${slot.venue_name} on ${formatDate(slot.slot_date)}.`,
    slotId
  );

  return { done: false, artist: top.artist, rank, expires_at: expires, score: top.score };
}

// Begin the fill process for an unfilled slot — entry point from the agent UI
// or from the Overture poller when it spots a new open slot.
export function startFillingSlot(slotId) {
  const slot = getSlot(slotId);
  if (!slot) throw new Error('Slot not found');
  if (slot.status !== 'unfilled' && slot.status !== 'exhausted') {
    return { error: `Slot is currently ${slot.status}; cannot start a new fill.` };
  }
  // Reset exhausted slots: keep the offer history but allow re-fill if anyone
  // newly onboarded becomes available.
  if (slot.status === 'exhausted') {
    db.prepare('UPDATE slots SET status = ? WHERE id = ?').run('unfilled', slotId);
  }
  return offerNextArtist(slotId);
}

export function acceptOffer(token) {
  const offer = db.prepare('SELECT * FROM offers WHERE response_token = ?').get(token);
  if (!offer) return { error: 'Unknown offer link.' };
  if (offer.status !== 'pending') {
    return { error: `This offer has already been ${offer.status}.` };
  }
  if (new Date(offer.expires_at).getTime() < Date.now()) {
    return { error: 'This offer has expired.' };
  }

  db.prepare(`
    UPDATE offers SET status = 'accepted', response_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(offer.id);

  const slot = getSlot(offer.slot_id);
  const artist = getArtist(offer.artist_id);
  db.prepare(`
    UPDATE slots SET status = 'confirmed', confirmed_artist_id = ? WHERE id = ?
  `).run(artist.id, slot.id);

  const overture = pushBookingToOverture({ slot, artist });
  notify(
    'slot_confirmed',
    `${artist.name} accepted ${slot.venue_name} on ${formatDate(slot.slot_date)}. Overture booking ${overture.overture_slot_id} confirmed.`,
    slot.id
  );

  return { ok: true, slot, artist };
}

export function declineOffer(token, reason = 'declined') {
  const offer = db.prepare('SELECT * FROM offers WHERE response_token = ?').get(token);
  if (!offer) return { error: 'Unknown offer link.' };
  if (offer.status !== 'pending') {
    return { error: `This offer has already been ${offer.status}.` };
  }

  db.prepare(`
    UPDATE offers SET status = ?, response_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(reason, offer.id);

  const slot = getSlot(offer.slot_id);
  const artist = getArtist(offer.artist_id);
  notify(
    reason === 'expired' ? 'offer_expired' : 'offer_declined',
    `${artist.name} ${reason === 'expired' ? 'did not respond in time' : 'declined'} ${slot.venue_name} on ${formatDate(slot.slot_date)}. Moving to next ranked artist.`,
    slot.id
  );

  // Move on automatically
  const next = offerNextArtist(slot.id);
  return { ok: true, next };
}

// Periodic sweep — auto-decline any offers past their expiry. Returns the
// number that were moved on.
export function sweepExpiredOffers() {
  const expired = db.prepare(`
    SELECT response_token FROM offers
    WHERE status = 'pending' AND expires_at < ?
  `).all(new Date().toISOString());

  for (const row of expired) {
    declineOffer(row.response_token, 'expired');
  }
  return expired.length;
}
