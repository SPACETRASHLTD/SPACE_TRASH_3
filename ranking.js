import { db } from './db.js';

// Score weights (tweakable by agent in future)
const W = {
  genre: 40,
  fee: 20,
  history: 25,
  location: 15,
};

const intersect = (a, b) => a.some((x) => b.includes(x));

function genreScore(slotGenre, artistGenres) {
  const list = artistGenres.split(',').map((s) => s.trim().toLowerCase());
  if (list.includes(slotGenre.toLowerCase())) return W.genre;
  // partial: any overlap with venue genre family scored lower
  return list.length > 0 ? W.genre * 0.4 : 0;
}

function feeScore(slotFee, feeMin, feeMax) {
  if (slotFee >= feeMin && slotFee <= feeMax) return W.fee;
  // graceful degradation outside the range
  const dist = slotFee < feeMin ? feeMin - slotFee : slotFee - feeMax;
  const tolerance = Math.max(feeMin, 200);
  const ratio = Math.max(0, 1 - dist / tolerance);
  return W.fee * ratio;
}

function historyScore(artistId, venueId) {
  const rows = db.prepare(
    'SELECT played_at, rating FROM venue_history WHERE artist_id = ? AND venue_id = ?'
  ).all(artistId, venueId);
  if (rows.length === 0) return 0;
  // most recent strong booking gets the bonus
  const best = rows
    .map((r) => {
      const daysAgo = (Date.now() - new Date(r.played_at).getTime()) / 86400_000;
      const recency = Math.max(0, 1 - daysAgo / 365); // dies off over a year
      return r.rating / 5 * recency;
    })
    .reduce((a, b) => Math.max(a, b), 0);
  return W.history * best;
}

function locationScore(artistLocation, venueLocation) {
  if (artistLocation.toLowerCase() === venueLocation.toLowerCase()) return W.location;
  // simple regional grouping
  const southEast = ['london', 'brighton'];
  const a = artistLocation.toLowerCase();
  const v = venueLocation.toLowerCase();
  if (southEast.includes(a) && southEast.includes(v)) return W.location * 0.6;
  return W.location * 0.2;
}

export function rankArtistsForSlot(slotId) {
  const slot = db.prepare(`
    SELECT s.*, v.name AS venue_name, v.location AS venue_location, v.genres AS venue_genres
    FROM slots s JOIN venues v ON v.id = s.venue_id
    WHERE s.id = ?
  `).get(slotId);
  if (!slot) throw new Error('Slot not found');

  // Pull all onboarded artists
  const candidates = db.prepare(`
    SELECT * FROM artists WHERE onboarded = 1
  `).all();

  // Artists already offered for this slot (declined, expired, or pending) should not be re-offered
  const alreadyOffered = db.prepare(`
    SELECT artist_id FROM offers WHERE slot_id = ?
  `).all(slotId).map((r) => r.artist_id);
  const offeredSet = new Set(alreadyOffered);

  const slotStart = `${slot.slot_date}T${slot.start_time}:00`;
  const slotEnd = `${slot.slot_date}T${slot.end_time}:00`;

  const ranked = [];
  for (const artist of candidates) {
    if (offeredSet.has(artist.id)) continue;

    // Calendar conflict check: any busy block overlapping the slot window
    const conflict = db.prepare(`
      SELECT 1 FROM calendar_busy
      WHERE artist_id = ?
        AND NOT (end_time <= ? OR start_time >= ?)
      LIMIT 1
    `).get(artist.id, slotStart, slotEnd);
    if (conflict) continue;

    const breakdown = {
      genre: genreScore(slot.genre_required, artist.genres),
      fee: feeScore(slot.fee, artist.fee_min, artist.fee_max),
      history: historyScore(artist.id, slot.venue_id),
      location: locationScore(artist.location, slot.venue_location),
    };
    const score = breakdown.genre + breakdown.fee + breakdown.history + breakdown.location;
    ranked.push({ artist, score: Math.round(score * 10) / 10, breakdown });
  }

  ranked.sort((a, b) => b.score - a.score);
  return { slot, ranked };
}
