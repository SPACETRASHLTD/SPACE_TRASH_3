import { db } from './db.js';
import { nanoid } from 'nanoid';

export function seedDemoData({ reset = false } = {}) {
  if (reset) {
    db.exec(`
      DELETE FROM offers;
      DELETE FROM notifications;
      DELETE FROM sms_log;
      DELETE FROM calendar_busy;
      DELETE FROM venue_history;
      DELETE FROM slots;
      DELETE FROM venues;
      DELETE FROM artists;
      DELETE FROM sqlite_sequence
        WHERE name IN ('offers','notifications','sms_log','calendar_busy','venue_history','slots','venues','artists');
    `);
  }

  const existingArtists = db.prepare('SELECT COUNT(*) as n FROM artists').get().n;
  if (existingArtists > 0 && !reset) return { skipped: true };

  const artists = [
    { name: 'Mara Quinn',       phone: '+447700900001', genres: 'indie,folk',         location: 'London',     fee_min: 300, fee_max: 700,  onboarded: 1, provider: 'google' },
    { name: 'The Velvet Tides', phone: '+447700900002', genres: 'indie,rock',         location: 'Manchester', fee_min: 500, fee_max: 1200, onboarded: 1, provider: 'google' },
    { name: 'Kojo Sound',       phone: '+447700900003', genres: 'afrobeats,soul',     location: 'London',     fee_min: 400, fee_max: 900,  onboarded: 1, provider: 'apple' },
    { name: 'Ava Lin',          phone: '+447700900004', genres: 'jazz,soul',          location: 'Brighton',   fee_min: 250, fee_max: 600,  onboarded: 1, provider: 'google' },
    { name: 'Disco Halo',       phone: '+447700900005', genres: 'disco,electronic',   location: 'Bristol',    fee_min: 600, fee_max: 1400, onboarded: 1, provider: 'google' },
    { name: 'Niamh Rourke',     phone: '+447700900006', genres: 'folk,indie',         location: 'Dublin',     fee_min: 350, fee_max: 800,  onboarded: 1, provider: 'apple' },
    { name: 'Lowfield',         phone: '+447700900007', genres: 'rock,indie',         location: 'Leeds',      fee_min: 450, fee_max: 1000, onboarded: 0, provider: null },
    { name: 'Hex Ritual',       phone: '+447700900008', genres: 'electronic,techno',  location: 'Berlin',     fee_min: 800, fee_max: 1800, onboarded: 0, provider: null },
    { name: 'Sade Marie',       phone: '+447700900009', genres: 'soul,jazz',          location: 'London',     fee_min: 400, fee_max: 950,  onboarded: 1, provider: 'google' },
    { name: 'Brick Lane Choir', phone: '+447700900010', genres: 'choral,folk',        location: 'London',     fee_min: 600, fee_max: 1200, onboarded: 0, provider: null },
    { name: 'Owen Tate',        phone: '+447700900011', genres: 'indie,rock',         location: 'Glasgow',    fee_min: 350, fee_max: 750,  onboarded: 1, provider: 'google' },
    { name: 'Coastal Drift',    phone: '+447700900012', genres: 'indie,folk',         location: 'Brighton',   fee_min: 300, fee_max: 650,  onboarded: 1, provider: 'apple' },
  ];

  const insertArtist = db.prepare(`
    INSERT INTO artists (name, phone, genres, location, fee_min, fee_max, onboarding_token, onboarded, calendar_provider, onboarded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const artistIds = artists.map((a) =>
    insertArtist.run(
      a.name, a.phone, a.genres, a.location, a.fee_min, a.fee_max,
      nanoid(16), a.onboarded, a.provider,
      a.onboarded ? new Date(Date.now() - Math.random() * 30 * 86400_000).toISOString() : null
    ).lastInsertRowid
  );

  const venues = [
    { name: 'The Old Blue Last', location: 'London',     genres: 'indie,rock,folk' },
    { name: 'Band on the Wall',  location: 'Manchester', genres: 'jazz,soul,afrobeats' },
    { name: 'The Lexington',     location: 'London',     genres: 'indie,rock' },
    { name: 'Concorde 2',        location: 'Brighton',   genres: 'electronic,indie,disco' },
    { name: 'Rough Trade',       location: 'Bristol',    genres: 'indie,folk,electronic' },
  ];
  const insertVenue = db.prepare('INSERT INTO venues (name, location, genres) VALUES (?, ?, ?)');
  const venueIds = venues.map((v) => insertVenue.run(v.name, v.location, v.genres).lastInsertRowid);

  // Slots — a mix of future dates within the next 3 weeks
  const now = new Date();
  const isoDate = (d) => d.toISOString().slice(0, 10);
  const futureDate = (days) => isoDate(new Date(now.getTime() + days * 86400_000));

  const slots = [
    { venue: 0, days: 7,  start: '20:00', end: '23:00', fee: 600,  genre: 'indie' },
    { venue: 1, days: 9,  start: '21:00', end: '23:30', fee: 850,  genre: 'soul' },
    { venue: 2, days: 14, start: '19:30', end: '22:30', fee: 500,  genre: 'indie' },
    { venue: 3, days: 16, start: '22:00', end: '02:00', fee: 1100, genre: 'electronic' },
    { venue: 4, days: 21, start: '20:00', end: '23:00', fee: 700,  genre: 'folk' },
  ];
  const insertSlot = db.prepare(`
    INSERT INTO slots (venue_id, slot_date, start_time, end_time, fee, genre_required, overture_slot_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  slots.forEach((s) =>
    insertSlot.run(
      venueIds[s.venue], futureDate(s.days), s.start, s.end, s.fee, s.genre,
      'OVT-' + nanoid(8)
    )
  );

  // Calendar busy data — give a few artists conflicts with various slot dates
  // so the filtering actually has work to do.
  const insertBusy = db.prepare('INSERT INTO calendar_busy (artist_id, start_time, end_time) VALUES (?, ?, ?)');
  const busy = [
    // Mara Quinn busy on day 7 (London indie slot — most obvious match)
    { artist: 0, day: 7,  start: '19:00', end: '23:30' },
    // Velvet Tides also busy that night
    { artist: 1, day: 7,  start: '20:00', end: '23:00' },
    // Disco Halo (best electronic fit) is busy day 16
    { artist: 4, day: 16, start: '20:00', end: '03:00' },
    // Ava Lin (soul/jazz) busy day 9
    { artist: 3, day: 9,  start: '19:00', end: '23:30' },
    // Coastal Drift busy day 21
    { artist: 11, day: 21, start: '18:00', end: '23:30' },
    // Random other busy slots for realism
    { artist: 8, day: 3,  start: '20:00', end: '23:00' },
    { artist: 10, day: 5, start: '19:30', end: '22:30' },
  ];
  busy.forEach((b) => {
    const date = futureDate(b.day);
    insertBusy.run(artistIds[b.artist], `${date}T${b.start}:00`, `${date}T${b.end}:00`);
  });

  // Venue history — a few past bookings to feed the ranking
  const insertHistory = db.prepare(`
    INSERT INTO venue_history (artist_id, venue_id, played_at, rating) VALUES (?, ?, ?, ?)
  `);
  const history = [
    { artist: 0,  venue: 0, daysAgo: 90,  rating: 5 }, // Mara at Old Blue Last — great show
    { artist: 0,  venue: 2, daysAgo: 180, rating: 4 },
    { artist: 1,  venue: 0, daysAgo: 200, rating: 4 },
    { artist: 1,  venue: 2, daysAgo: 60,  rating: 5 }, // Velvet Tides at Lexington — recent strong
    { artist: 2,  venue: 1, daysAgo: 120, rating: 5 },
    { artist: 3,  venue: 1, daysAgo: 45,  rating: 4 },
    { artist: 4,  venue: 3, daysAgo: 75,  rating: 5 },
    { artist: 5,  venue: 4, daysAgo: 110, rating: 4 },
    { artist: 8,  venue: 1, daysAgo: 95,  rating: 4 },
    { artist: 11, venue: 4, daysAgo: 130, rating: 4 },
  ];
  history.forEach((h) => {
    const date = new Date(now.getTime() - h.daysAgo * 86400_000).toISOString();
    insertHistory.run(artistIds[h.artist], venueIds[h.venue], date, h.rating);
  });

  return { skipped: false, artists: artistIds.length, venues: venueIds.length, slots: slots.length };
}

// Allow running as CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const reset = process.argv.includes('--reset');
  const result = seedDemoData({ reset });
  console.log('Seed result:', result);
}
