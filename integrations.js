import { db } from './db.js';

// ---------------------------------------------------------------------------
// SMS / WhatsApp delivery (Twilio adapter — currently mocked to local log)
// ---------------------------------------------------------------------------
// In production this would call Twilio's Messages API. For the demo, every
// outbound message lands in the `sms_log` table and shows up in the dashboard
// "Artist phone" inbox so you can drive the flow end to end.
export function sendSms({ artistId, kind, body }) {
  db.prepare(
    'INSERT INTO sms_log (artist_id, kind, body) VALUES (?, ?, ?)'
  ).run(artistId, kind, body);
}

// ---------------------------------------------------------------------------
// Overture REST API adapter — mocked
// ---------------------------------------------------------------------------
// In production this writes a confirmed booking back to Overture. For the demo
// we just stamp the slot's overture_slot_id with the booking and log it.
export function pushBookingToOverture({ slot, artist }) {
  // The real call would be a POST to /v1/bookings with the overture_slot_id,
  // artist external ID, fee, and signed agent token. We record what would be
  // sent so it shows up in the notification feed.
  return {
    ok: true,
    overture_slot_id: slot.overture_slot_id,
    booked_artist: artist.name,
    confirmed_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Calendar adapter (Google / Apple) — mocked
// ---------------------------------------------------------------------------
// The artist completes OAuth at /onboard/:token. The adapter only ever pulls
// busy/free data, never event titles. For the demo we just flip the artist
// to "onboarded" and seed a few empty busy slots (none, since they're free
// for everything by default).
export function connectCalendar({ artistId, provider }) {
  db.prepare(
    `UPDATE artists SET onboarded = 1, calendar_provider = ?, onboarded_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(provider, artistId);
}
