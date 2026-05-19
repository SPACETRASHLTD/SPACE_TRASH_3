import ical, { ICalCalendarMethod } from "ical-generator";
import { createHash } from "node:crypto";

export interface BusyBlockRow {
  artist_id: string;
  start_ts: string;
  end_ts: string;
  source: string;
}

/**
 * Builds an RFC 5545 .ics feed for an artist containing busy blocks only.
 *
 * Privacy guarantees:
 *   - SUMMARY is hardcoded to "Unavailable"
 *   - no DESCRIPTION, LOCATION, ATTENDEE, ORGANIZER
 *   - UIDs are deterministic hashes so polling doesn't churn event IDs
 *     in Overture (avoids duplicate/orphan events on each refresh)
 *
 * The `agencySource` filter omits blocks whose source is the agency's
 * own Overture bookings — those already exist in Overture, no point
 * round-tripping them and double-counting.
 */
export function buildBusyFeed(
  artistId: string,
  blocks: BusyBlockRow[],
  opts: { excludeSources?: string[]; calendarName?: string } = {},
): string {
  const excluded = new Set(opts.excludeSources ?? ["overture"]);
  const cal = ical({
    name: opts.calendarName ?? "Unavailable",
    prodId: { company: "BookingBot", product: "BusyFeed", language: "EN" },
    method: ICalCalendarMethod.PUBLISH,
  });

  for (const block of blocks) {
    if (excluded.has(block.source)) continue;
    const uid = deterministicUid(artistId, block.start_ts, block.end_ts);
    cal.createEvent({
      id: uid,
      start: new Date(block.start_ts),
      end: new Date(block.end_ts),
      summary: "Unavailable",
      transparency: "OPAQUE",
    });
  }

  return cal.toString();
}

function deterministicUid(artistId: string, start: string, end: string): string {
  const h = createHash("sha256")
    .update(`${artistId}|${start}|${end}`)
    .digest("hex");
  return `${h.substring(0, 32)}@bookingbot`;
}
