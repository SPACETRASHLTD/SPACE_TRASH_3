import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { serviceClient } from "@/lib/supabase";
import { requireServerEnv } from "@/lib/env";
import { randomToken } from "@/lib/crypto";
import {
  buildDayBreakdown,
  type ArtistLite,
  type BusyBlock,
} from "@/lib/availability";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ date?: string; showAll?: string }>;
}

async function createOffers(formData: FormData) {
  "use server";
  const date = String(formData.get("date") ?? "");
  const startTime = String(formData.get("start_time") ?? "");
  const endTime = String(formData.get("end_time") ?? "");
  const venue = String(formData.get("venue") ?? "").trim();
  const feeRaw = String(formData.get("fee") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const artistIds = formData.getAll("artist_ids").map(String).filter(Boolean);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Date is required");
  if (!/^\d{2}:\d{2}$/.test(startTime)) throw new Error("Start time is required");
  if (!/^\d{2}:\d{2}$/.test(endTime)) throw new Error("End time is required");
  if (artistIds.length === 0) throw new Error("Pick at least one artist");

  const fee = feeRaw === "" ? null : Math.round(parseFloat(feeRaw) * 100);
  if (fee != null && (isNaN(fee) || fee < 0)) throw new Error("Fee must be a non-negative number");

  const agencyId = requireServerEnv("AGENCY_ID");
  const sb = serviceClient();

  const { data: agency } = await sb
    .from("agencies")
    .select("timezone")
    .eq("id", agencyId)
    .maybeSingle();
  const tz = agency?.timezone ?? "America/New_York";

  const startUtc = fromZonedTime(parseISO(`${date}T${startTime}:00`), tz);
  const endUtc = fromZonedTime(parseISO(`${date}T${endTime}:00`), tz);
  if (endUtc <= startUtc) throw new Error("End time must be after start time");

  // Default offer expiry: 24 hours from now.
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Create the offer_group first.
  const { data: group, error: groupErr } = await sb
    .from("offer_groups")
    .insert({ agency_id: agencyId, notes: notes || null })
    .select("id")
    .single();
  if (groupErr || !group) throw new Error(`Could not create offer group: ${groupErr?.message}`);

  const rows = artistIds.map((artistId) => ({
    agency_id: agencyId,
    group_id: group.id,
    artist_id: artistId,
    gig_start_ts: startUtc.toISOString(),
    gig_end_ts: endUtc.toISOString(),
    venue: venue || null,
    fee_cents: fee,
    notes: notes || null,
    token: randomToken(24),
    expires_at: expiresAt.toISOString(),
    status: "draft" as const,
  }));

  const { error: offersErr } = await sb.from("offers").insert(rows);
  if (offersErr) throw new Error(`Could not create offers: ${offersErr.message}`);

  redirect("/offers");
}

export default async function NewOfferPage({ searchParams }: PageProps) {
  const { date: dateParam, showAll } = await searchParams;
  const today = format(new Date(), "yyyy-MM-dd");
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const showAllFlag = showAll === "1";

  const agencyId = requireServerEnv("AGENCY_ID");
  const sb = serviceClient();

  const { data: agency } = await sb
    .from("agencies")
    .select("timezone")
    .eq("id", agencyId)
    .maybeSingle();
  const tz = agency?.timezone ?? "America/New_York";

  // Compute the UTC bounds for the selected day in agency TZ.
  const dayStartUtc = fromZonedTime(parseISO(`${date}T00:00:00`), tz);
  const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000);

  const [artistsRes, blocksRes] = await Promise.all([
    sb
      .from("artists")
      .select("id, full_name, phone_e164, status")
      .eq("agency_id", agencyId)
      .in("status", ["invited", "connected"])
      .order("full_name", { ascending: true }),
    sb
      .from("busy_blocks")
      .select("artist_id, start_ts, end_ts, source")
      .gte("end_ts", dayStartUtc.toISOString())
      .lt("start_ts", dayEndUtc.toISOString()),
  ]);

  const artists = (artistsRes.data ?? []) as ArtistLite[];
  const blocks = (blocksRes.data ?? []) as BusyBlock[];
  const breakdown = buildDayBreakdown(date, artists, blocks, tz);

  const displayedArtists = showAllFlag ? artists : breakdown.available;
  const dayLabel = format(parseISO(`${date}T12:00:00Z`), "EEEE, MMMM d, yyyy");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">New offer batch</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Compose a gig + pick the artists to fan it out to. First accept wins.
          </p>
        </div>
        <a href="/offers" className="text-sm text-neutral-400 hover:text-neutral-200">
          Cancel
        </a>
      </div>

      <form action={createOffers} className="space-y-6">
        <section className="rounded-lg border border-neutral-800 bg-neutral-950 p-5">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-neutral-400">
            Gig
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Date" name="date" type="date" defaultValue={date} required />
            <Field label="Start time" name="start_time" type="time" defaultValue="20:00" required />
            <Field label="End time" name="end_time" type="time" defaultValue="23:00" required />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Venue" name="venue" placeholder="The Roxy" />
            <Field label="Fee (USD)" name="fee" type="number" step="0.01" min="0" placeholder="800" />
          </div>
          <div className="mt-4">
            <Field label="Notes (sent in SMS body)" name="notes" placeholder="Bring own backline." />
          </div>
        </section>

        <section className="rounded-lg border border-neutral-800 bg-neutral-950 p-5">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium uppercase tracking-wider text-neutral-400">
                Artists
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                {dayLabel} · {breakdown.available.length} available · {breakdown.busy.length} busy
              </p>
            </div>
            <a
              href={`/offers/new?date=${date}&showAll=${showAllFlag ? "0" : "1"}`}
              className="text-xs text-blue-400 hover:underline"
            >
              {showAllFlag ? "Hide busy artists" : "Show all artists"}
            </a>
          </header>

          {displayedArtists.length === 0 ? (
            <p className="rounded-md bg-neutral-900 p-4 text-sm text-neutral-400">
              No artists {showAllFlag ? "" : "available"} on this date.
              {!showAllFlag && breakdown.busy.length > 0 ? (
                <>
                  {" "}
                  <a
                    href={`/offers/new?date=${date}&showAll=1`}
                    className="text-blue-400 hover:underline"
                  >
                    Show all artists →
                  </a>
                </>
              ) : null}
            </p>
          ) : (
            <ul className="space-y-2">
              {displayedArtists.map((a) => {
                const isBusy = breakdown.busy.some((b) => b.artist.id === a.id);
                return (
                  <li key={a.id}>
                    <label
                      className={`flex items-center gap-3 rounded-md border bg-neutral-900 p-3 transition-colors ${
                        isBusy
                          ? "border-orange-900/40 hover:bg-orange-950/20"
                          : "border-neutral-800 hover:bg-neutral-800"
                      }`}
                    >
                      <input
                        type="checkbox"
                        name="artist_ids"
                        value={a.id}
                        className="h-4 w-4 rounded border-neutral-600 bg-neutral-900 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-neutral-100">{a.full_name}</div>
                        <div className="text-xs text-neutral-500">{a.phone_e164 ?? "no phone — won't receive SMS"}</div>
                      </div>
                      {isBusy ? (
                        <span className="inline-flex items-center gap-1 rounded bg-orange-900/40 px-2 py-0.5 text-xs text-orange-300">
                          busy
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-green-900/40 px-2 py-0.5 text-xs text-green-300">
                          available
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="flex items-center justify-between rounded-lg border border-blue-900/40 bg-blue-950/20 p-4 text-sm">
          <p className="text-blue-200">
            Offers will be created as <strong>draft</strong>. SMS dispatch happens in the next slab — for now you can review them on the offers list.
          </p>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Create batch
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  required,
  step,
  min,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  step?: string;
  min?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-neutral-400">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        step={step}
        min={min}
        className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-blue-500 focus:outline-none"
      />
    </label>
  );
}
