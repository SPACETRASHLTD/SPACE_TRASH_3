import Link from "next/link";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { serviceClient } from "@/lib/supabase";
import { requireServerEnv } from "@/lib/env";
import {
  buildDayBreakdown,
  buildMonthView,
  bucketPendingOffersByDay,
  dayHeader,
  monthKey,
  monthRange,
  nextMonthKey,
  parseMonthKey,
  prevMonthKey,
  type ArtistLite,
  type BusyBlock,
  type PendingOffer,
} from "@/lib/availability";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ month?: string; day?: string }>;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function CalendarPage({ searchParams }: PageProps) {
  const { month: monthParam, day: dayParam } = await searchParams;

  const agencyId = requireServerEnv("AGENCY_ID");
  const sb = serviceClient();

  const { data: agency } = await sb
    .from("agencies")
    .select("name, timezone")
    .eq("id", agencyId)
    .maybeSingle();
  const tz = agency?.timezone ?? "America/New_York";

  const monthAnchor = parseMonthKey(monthParam);
  const { fromIso, toIso } = monthRange(monthAnchor);

  const [artistsRes, blocksRes, offersRes] = await Promise.all([
    sb
      .from("artists")
      .select("id, full_name, phone_e164, status")
      .eq("agency_id", agencyId)
      .in("status", ["invited", "connected"])
      .order("full_name", { ascending: true }),
    sb
      .from("busy_blocks")
      .select("artist_id, start_ts, end_ts, source")
      .gte("end_ts", fromIso)
      .lt("start_ts", toIso),
    sb
      .from("offers")
      .select("id, artist_id, gig_start_ts, gig_end_ts, venue, expires_at")
      .eq("agency_id", agencyId)
      .eq("status", "pending")
      .gte("gig_end_ts", fromIso)
      .lt("gig_start_ts", toIso),
  ]);

  const artists = (artistsRes.data ?? []) as ArtistLite[];
  const blocks = (blocksRes.data ?? []) as BusyBlock[];
  const pendingOffers = (offersRes.data ?? []) as PendingOffer[];
  const artistById = new Map(artists.map((a) => [a.id, a]));

  if (artists.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-12 text-center">
        <h1 className="text-2xl font-semibold">No artists yet</h1>
        <p className="mt-2 text-neutral-400">
          Invite at least one artist before the calendar has anything to show.
        </p>
        <Link href="/artists/new" className="mt-4 inline-block text-blue-400 hover:underline">
          Invite an artist →
        </Link>
      </div>
    );
  }

  const cells = buildMonthView(monthAnchor, blocks, tz);
  const pendingByDay = bucketPendingOffersByDay(cells, pendingOffers, tz);
  const totalArtists = artists.length;
  const today = format(new Date(), "yyyy-MM-dd");

  const selectedDayKey = dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : null;
  const dayBreakdown = selectedDayKey
    ? buildDayBreakdown(selectedDayKey, artists, blocks, tz)
    : null;
  const dayPendingOffers = selectedDayKey ? pendingByDay.get(selectedDayKey) ?? [] : [];

  const monthLabel = format(monthAnchor, "MMMM yyyy");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{monthLabel}</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {totalArtists} {totalArtists === 1 ? "artist" : "artists"} · click a day to see the breakdown · times shown in {tz}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/calendar?month=${prevMonthKey(monthAnchor)}`}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900"
          >
            ← Prev
          </Link>
          <Link
            href="/calendar"
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900"
          >
            Today
          </Link>
          <Link
            href={`/calendar?month=${nextMonthKey(monthAnchor)}`}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900"
          >
            Next →
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
        <div className="grid grid-cols-7 border-b border-neutral-800 bg-neutral-900 text-center text-xs uppercase tracking-wider text-neutral-400">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell) => {
            const available = totalArtists - cell.busyArtistIds.size;
            const utilization = totalArtists === 0 ? 0 : available / totalArtists;
            const isToday = cell.key === today;
            const isSelected = cell.key === selectedDayKey;
            const pendingCount = pendingByDay.get(cell.key)?.length ?? 0;
            const ratioColor =
              utilization >= 0.6
                ? "bg-green-500/70"
                : utilization >= 0.3
                  ? "bg-yellow-500/70"
                  : utilization > 0
                    ? "bg-orange-500/70"
                    : "bg-red-500/70";
            return (
              <Link
                key={cell.key}
                href={`/calendar?month=${monthKey(cell.date)}&day=${cell.key}`}
                className={`group relative flex min-h-[88px] flex-col border-b border-r border-neutral-800 px-2 py-1.5 text-left transition-colors hover:bg-neutral-900 ${
                  cell.inMonth ? "text-neutral-100" : "text-neutral-600"
                } ${isSelected ? "bg-blue-950/40 ring-1 ring-inset ring-blue-500" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm ${
                      isToday
                        ? "flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 font-semibold text-white"
                        : ""
                    }`}
                  >
                    {format(cell.date, "d")}
                  </span>
                  {cell.inMonth && pendingCount > 0 ? (
                    <span
                      title={`${pendingCount} pending offer${pendingCount === 1 ? "" : "s"}`}
                      className="inline-flex items-center gap-1 rounded bg-blue-900/60 px-1.5 py-0.5 text-[10px] font-medium text-blue-200"
                    >
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400" />
                      {pendingCount}
                    </span>
                  ) : null}
                </div>
                {cell.inMonth ? (
                  <div className="mt-auto">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-400">
                        <span className={available === 0 ? "text-red-400" : "text-neutral-200"}>{available}</span>
                        <span className="text-neutral-500">/{totalArtists}</span>
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-neutral-500 opacity-0 group-hover:opacity-100">
                        view
                      </span>
                    </div>
                    <div className="mt-1 h-1 w-full rounded bg-neutral-800">
                      <div
                        className={`h-1 rounded ${ratioColor}`}
                        style={{ width: `${utilization * 100}%` }}
                      />
                    </div>
                  </div>
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>

      {dayBreakdown && selectedDayKey ? (
        <DayPanel
          dayKey={selectedDayKey}
          breakdown={dayBreakdown}
          pendingOffers={dayPendingOffers}
          artistById={artistById}
          monthAnchor={monthAnchor}
          tz={tz}
        />
      ) : (
        <div className="mt-6 rounded-lg border border-dashed border-neutral-800 p-4 text-center text-sm text-neutral-500">
          Click any day above to see who's free.
        </div>
      )}
    </div>
  );
}

function DayPanel({
  dayKey,
  breakdown,
  pendingOffers,
  artistById,
  monthAnchor,
  tz,
}: {
  dayKey: string;
  breakdown: ReturnType<typeof buildDayBreakdown>;
  pendingOffers: PendingOffer[];
  artistById: Map<string, ArtistLite>;
  monthAnchor: Date;
  tz: string;
}) {
  const availableIds = breakdown.available.map((a) => a.id).join(",");
  const composeHref = availableIds
    ? `/offers/new?date=${dayKey}&artists=${encodeURIComponent(availableIds)}`
    : `/offers/new?date=${dayKey}`;

  return (
    <section className="mt-6 rounded-lg border border-neutral-800 bg-neutral-950">
      <header className="flex items-center justify-between border-b border-neutral-800 px-5 py-3">
        <h2 className="text-lg font-semibold">{dayHeader(dayKey, tz)}</h2>
        <div className="flex items-center gap-3">
          <Link
            href={composeHref}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
          >
            Make offer for this day →
          </Link>
          <Link
            href={`/calendar?month=${monthKey(monthAnchor)}`}
            className="text-sm text-neutral-400 hover:text-neutral-200"
          >
            Close ×
          </Link>
        </div>
      </header>

      {pendingOffers.length > 0 ? (
        <div className="border-b border-neutral-800 bg-blue-950/20 px-5 py-3">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-300">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
            Pending offers out · {pendingOffers.length}
          </h3>
          <ul className="space-y-1 text-sm">
            {pendingOffers.map((o) => {
              const artist = artistById.get(o.artist_id);
              const expires = formatInTimeZone(new Date(o.expires_at), tz, "MMM d, h:mm a");
              return (
                <li key={o.id} className="flex items-center justify-between rounded bg-neutral-900 px-3 py-1.5">
                  <span className="font-medium text-neutral-100">
                    {artist?.full_name ?? "(unknown artist)"}
                  </span>
                  <span className="text-xs text-neutral-400">
                    {o.venue ? `${o.venue} · ` : ""}expires {expires}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-6 p-5 md:grid-cols-2">
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-green-400">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            Available · {breakdown.available.length}
          </h3>
          {breakdown.available.length === 0 ? (
            <p className="text-sm text-neutral-500">No one is fully free today.</p>
          ) : (
            <ul className="space-y-1.5">
              {breakdown.available.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-md bg-neutral-900 px-3 py-2 text-sm">
                  <span className="font-medium text-neutral-100">{a.full_name}</span>
                  <span className="text-xs text-neutral-500">{a.phone_e164 ?? "no phone"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-orange-300">
            <span className="inline-block h-2 w-2 rounded-full bg-orange-400" />
            Busy · {breakdown.busy.length}
          </h3>
          {breakdown.busy.length === 0 ? (
            <p className="text-sm text-neutral-500">Everyone's free today.</p>
          ) : (
            <ul className="space-y-2">
              {breakdown.busy.map(({ artist, ranges }) => (
                <li key={artist.id} className="rounded-md bg-neutral-900 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-neutral-100">{artist.full_name}</span>
                    <span className="text-xs text-neutral-500">{artist.phone_e164 ?? ""}</span>
                  </div>
                  <ul className="mt-1 space-y-0.5 text-xs text-neutral-400">
                    {ranges.map((r, i) => (
                      <li key={i}>
                        <span className="text-neutral-300">
                          {r.start} – {r.end}
                        </span>
                        <span className="ml-2 text-neutral-500">({r.sourceLabel})</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
