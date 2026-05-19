import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export interface BusyBlock {
  artist_id: string;
  start_ts: string;
  end_ts: string;
  source: string;
}

export interface ArtistLite {
  id: string;
  full_name: string;
  phone_e164: string | null;
  status: string;
}

/**
 * A month's worth of day-keyed metadata used to render the calendar grid.
 * Day keys are ISO dates in the agency's timezone (YYYY-MM-DD).
 */
export interface MonthViewDay {
  key: string;
  date: Date;
  inMonth: boolean;
  busyArtistIds: Set<string>;
}

/**
 * Builds the 6-row grid (always 42 cells) for the given month, with each
 * day pre-tagged with the set of artist IDs who have any busy block
 * overlapping that day in the agency's timezone.
 */
export function buildMonthView(
  monthAnchor: Date,
  blocks: BusyBlock[],
  tz: string,
): MonthViewDay[] {
  const monthStart = startOfMonth(monthAnchor);
  // Grid always starts on Sunday for now. Week-start configurability later.
  const gridStart = startOfDay(addDays(monthStart, -monthStart.getDay()));
  const cells: MonthViewDay[] = [];
  for (let i = 0; i < 42; i++) {
    const date = addDays(gridStart, i);
    cells.push({
      key: formatInTimeZone(date, tz, "yyyy-MM-dd"),
      date,
      inMonth: format(date, "yyyy-MM") === format(monthAnchor, "yyyy-MM"),
      busyArtistIds: new Set(),
    });
  }

  // For each block, mark every day it touches in the agency's TZ.
  for (const b of blocks) {
    const start = parseISO(b.start_ts);
    const end = parseISO(b.end_ts);
    const startKey = formatInTimeZone(start, tz, "yyyy-MM-dd");
    const endKey = formatInTimeZone(end, tz, "yyyy-MM-dd");
    for (const cell of cells) {
      if (cell.key >= startKey && cell.key <= endKey) {
        cell.busyArtistIds.add(b.artist_id);
      }
    }
  }

  return cells;
}

/**
 * For a given day key, partition artists into available / busy and (for
 * busy ones) attach the relevant time ranges in the agency's timezone.
 */
export interface DayBreakdown {
  available: ArtistLite[];
  busy: Array<{ artist: ArtistLite; ranges: Array<{ start: string; end: string; sourceLabel: string }> }>;
}

export function buildDayBreakdown(
  dayKey: string,
  artists: ArtistLite[],
  blocks: BusyBlock[],
  tz: string,
): DayBreakdown {
  // Convert dayKey + tz to UTC bounds for filtering.
  const dayStartLocal = parseISO(`${dayKey}T00:00:00`);
  const dayStartUtc = fromZonedTime(dayStartLocal, tz);
  const dayEndUtc = addDays(dayStartUtc, 1);

  const rangesByArtist = new Map<string, Array<{ start: string; end: string; sourceLabel: string }>>();
  for (const b of blocks) {
    const start = parseISO(b.start_ts);
    const end = parseISO(b.end_ts);
    if (end <= dayStartUtc || start >= dayEndUtc) continue;
    const sourceLabel = sourceToLabel(b.source);
    const list = rangesByArtist.get(b.artist_id) ?? [];
    list.push({
      start: formatInTimeZone(start < dayStartUtc ? dayStartUtc : start, tz, "h:mm a"),
      end: formatInTimeZone(end > dayEndUtc ? dayEndUtc : end, tz, "h:mm a"),
      sourceLabel,
    });
    rangesByArtist.set(b.artist_id, list);
  }

  const busy: DayBreakdown["busy"] = [];
  const available: ArtistLite[] = [];
  for (const a of artists) {
    const ranges = rangesByArtist.get(a.id);
    if (ranges && ranges.length > 0) {
      busy.push({ artist: a, ranges });
    } else {
      available.push(a);
    }
  }
  available.sort((x, y) => x.full_name.localeCompare(y.full_name));
  busy.sort((x, y) => x.artist.full_name.localeCompare(y.artist.full_name));
  return { available, busy };
}

function sourceToLabel(source: string): string {
  switch (source) {
    case "google":
      return "personal";
    case "overture":
      return "agency booking";
    case "manual":
      return "manual";
    default:
      return source;
  }
}

/**
 * Returns `YYYY-MM` for the month anchor.
 */
export function monthKey(date: Date): string {
  return format(date, "yyyy-MM");
}

export function parseMonthKey(s: string | null | undefined): Date {
  if (s && /^\d{4}-\d{2}$/.test(s)) {
    return parseISO(`${s}-01T00:00:00`);
  }
  return startOfMonth(new Date());
}

export function prevMonthKey(d: Date): string {
  return monthKey(subMonths(d, 1));
}

export function nextMonthKey(d: Date): string {
  return monthKey(addMonths(d, 1));
}

export function monthRange(monthAnchor: Date): { fromIso: string; toIso: string } {
  const monthStart = startOfMonth(monthAnchor);
  const gridStart = startOfDay(addDays(monthStart, -monthStart.getDay()));
  const gridEnd = addDays(gridStart, 42);
  return { fromIso: gridStart.toISOString(), toIso: gridEnd.toISOString() };
}

export function dayHeader(dayKey: string, tz: string): string {
  return formatInTimeZone(parseISO(`${dayKey}T12:00:00Z`), tz, "EEEE, MMMM d, yyyy");
}
