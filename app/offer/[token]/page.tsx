import { notFound } from "next/navigation";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { serviceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

interface OfferRow {
  id: string;
  status: string;
  gig_start_ts: string;
  gig_end_ts: string;
  venue: string | null;
  fee_cents: number | null;
  notes: string | null;
  expires_at: string;
  artist: { full_name: string } | null;
  agency: { name: string; timezone: string } | null;
}

export default async function OfferPage({ params }: PageProps) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]+$/.test(token)) notFound();

  const sb = serviceClient();
  const { data, error } = await sb
    .from("offers")
    .select(
      "id, status, gig_start_ts, gig_end_ts, venue, fee_cents, notes, expires_at, " +
        "artist:artists(full_name), agency:agencies(name, timezone)",
    )
    .eq("token", token)
    .maybeSingle();

  if (error || !data) notFound();

  const offer = data as unknown as OfferRow;
  const tz = offer.agency?.timezone ?? "America/New_York";
  const now = new Date();
  const expired = new Date(offer.expires_at) <= now;

  if (offer.status === "accepted") {
    return (
      <ResultScreen
        tone="success"
        title="You accepted this gig"
        body={`We've told ${offer.agency?.name ?? "your agent"}. They'll be in touch with the details.`}
      />
    );
  }
  if (offer.status === "declined") {
    return (
      <ResultScreen
        tone="muted"
        title="You declined this offer"
        body="No worries — your agent has been notified."
      />
    );
  }
  if (offer.status === "superseded") {
    return (
      <ResultScreen
        tone="muted"
        title="This gig has already been filled"
        body="Another artist accepted before you. Sorry about that."
      />
    );
  }
  if (offer.status === "expired" || expired) {
    return (
      <ResultScreen
        tone="muted"
        title="This offer has expired"
        body="It was open for 24 hours. Talk to your agent if you'd still like to take it."
      />
    );
  }
  if (offer.status === "draft") {
    return (
      <ResultScreen
        tone="muted"
        title="This offer hasn't gone out yet"
        body="Your agent hasn't sent it. Hang tight."
      />
    );
  }

  // status === 'pending' and not yet expired
  const gigDateHuman = formatInTimeZone(new Date(offer.gig_start_ts), tz, "EEEE, MMMM d");
  const gigTimeHuman = `${formatInTimeZone(new Date(offer.gig_start_ts), tz, "h:mm a")} – ${formatInTimeZone(new Date(offer.gig_end_ts), tz, "h:mm a")}`;
  const feeStr =
    offer.fee_cents != null
      ? `$${(offer.fee_cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`
      : null;

  const expiresHuman = formatInTimeZone(new Date(offer.expires_at), tz, "MMM d, h:mm a zzz");

  return (
    <div className="mx-auto mt-12 max-w-md px-6">
      <p className="text-sm uppercase tracking-wider text-neutral-500">
        Gig offer from {offer.agency?.name ?? "your agent"}
      </p>
      <h1 className="mt-1 text-3xl font-semibold">{gigDateHuman}</h1>
      <p className="mt-2 text-lg text-neutral-200">{gigTimeHuman}</p>

      <dl className="mt-6 space-y-3 rounded-lg border border-neutral-800 bg-neutral-950 p-5 text-sm">
        {offer.venue ? (
          <Row label="Venue" value={offer.venue} />
        ) : null}
        {feeStr ? <Row label="Fee" value={feeStr} /> : null}
        {offer.notes ? <Row label="Notes" value={offer.notes} /> : null}
        <Row label="Expires" value={expiresHuman} />
      </dl>

      <form
        action={`/api/offer/${token}/respond`}
        method="post"
        className="mt-6 space-y-3"
      >
        <button
          type="submit"
          name="action"
          value="accept"
          className="w-full rounded-md bg-green-600 px-6 py-3.5 text-base font-semibold text-white hover:bg-green-500"
        >
          Accept this gig
        </button>
        <button
          type="submit"
          name="action"
          value="decline"
          className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-6 py-3.5 text-base font-medium text-neutral-300 hover:bg-neutral-900"
        >
          Decline
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-neutral-500">
        First artist to accept wins. Other offers for this gig will be automatically released.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right text-neutral-100">{value}</dd>
    </div>
  );
}

function ResultScreen({
  tone,
  title,
  body,
}: {
  tone: "success" | "muted";
  title: string;
  body: string;
}) {
  const ring = tone === "success" ? "bg-green-600/20 text-green-400" : "bg-neutral-800 text-neutral-400";
  const icon =
    tone === "success" ? (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    ) : (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    );
  return (
    <div className="mx-auto mt-24 max-w-md px-6 text-center">
      <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${ring}`}>
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icon}
        </svg>
      </div>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-3 text-neutral-400">{body}</p>
    </div>
  );
}
