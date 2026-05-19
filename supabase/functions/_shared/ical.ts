// Builds a minimal RFC 5545 .ics feed of busy blocks only.
//
// Privacy guarantees:
//   - SUMMARY hardcoded to "Unavailable"
//   - No DESCRIPTION, LOCATION, ATTENDEE, ORGANIZER
//   - Deterministic UIDs so Overture-side import doesn't churn

export interface BusyBlockRow {
  artist_id: string;
  start_ts: string;
  end_ts: string;
  source: string;
}

const CRLF = "\r\n";

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function toIcsDate(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function deterministicUid(
  artistId: string,
  start: string,
  end: string,
): Promise<string> {
  const h = await sha256Hex(`${artistId}|${start}|${end}`);
  return `${h.substring(0, 32)}@bookingbot`;
}

/**
 * Folds a single content line per RFC 5545: lines must be <= 75 octets.
 * Continuation lines start with a single space.
 */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let i = 0;
  while (i < line.length) {
    parts.push(line.substring(i, i + 75));
    i += 75;
  }
  return parts.join(CRLF + " ");
}

export async function buildBusyFeed(
  artistId: string,
  blocks: BusyBlockRow[],
  opts: { excludeSources?: string[] } = {},
): Promise<string> {
  const excluded = new Set(opts.excludeSources ?? ["overture"]);
  const dtstamp = toIcsDate(new Date());

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BookingBot//BusyFeed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "NAME:Unavailable",
    "X-WR-CALNAME:Unavailable",
  ];

  for (const b of blocks) {
    if (excluded.has(b.source)) continue;
    const uid = await deterministicUid(b.artist_id, b.start_ts, b.end_ts);
    lines.push(
      "BEGIN:VEVENT",
      fold(`UID:${uid}`),
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${toIcsDate(b.start_ts)}`,
      `DTEND:${toIcsDate(b.end_ts)}`,
      "SUMMARY:Unavailable",
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join(CRLF) + CRLF;
}
