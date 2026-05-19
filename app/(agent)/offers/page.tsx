import Link from "next/link";
import { format } from "date-fns";
import { serviceClient } from "@/lib/supabase";
import { requireServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

interface GroupRow {
  id: string;
  created_at: string;
  notes: string | null;
}

interface OfferRow {
  id: string;
  group_id: string;
  status: string;
  gig_start_ts: string;
  venue: string | null;
  artist_id: string;
  artist?: { full_name: string } | null;
}

export default async function OffersPage() {
  const agencyId = requireServerEnv("AGENCY_ID");
  const sb = serviceClient();

  const [groupsRes, offersRes] = await Promise.all([
    sb
      .from("offer_groups")
      .select("id, created_at, notes")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false })
      .limit(50),
    sb
      .from("offers")
      .select("id, group_id, status, gig_start_ts, venue, artist_id, artist:artists(full_name)")
      .eq("agency_id", agencyId)
      .order("gig_start_ts", { ascending: true }),
  ]);

  const groups = (groupsRes.data ?? []) as GroupRow[];
  const offers = (offersRes.data ?? []) as OfferRow[];
  const offersByGroup = new Map<string, OfferRow[]>();
  for (const o of offers) {
    const list = offersByGroup.get(o.group_id) ?? [];
    list.push(o);
    offersByGroup.set(o.group_id, list);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Offers</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Each batch is one composer submission. Click for the artist-by-artist breakdown.
          </p>
        </div>
        <Link
          href="/offers/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          + New offer batch
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-12 text-center">
          <p className="text-neutral-400">No offers sent yet.</p>
          <Link href="/offers/new" className="mt-2 inline-block text-blue-400 hover:underline">
            Compose the first one →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const groupOffers = offersByGroup.get(g.id) ?? [];
            const counts = bucketCounts(groupOffers.map((o) => o.status));
            return (
              <details key={g.id} className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-3 hover:bg-neutral-900">
                  <div>
                    <div className="text-sm font-medium">
                      {format(new Date(g.created_at), "MMM d, yyyy · h:mm a")}
                    </div>
                    <div className="mt-1 text-xs text-neutral-400">
                      {groupOffers.length} offer{groupOffers.length === 1 ? "" : "s"}
                      {g.notes ? ` · ${g.notes}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(["draft", "pending", "accepted", "declined", "expired", "superseded"] as const).map(
                      (s) =>
                        counts[s] ? (
                          <StatusPill key={s} status={s} count={counts[s]} />
                        ) : null,
                    )}
                  </div>
                </summary>
                <div className="border-t border-neutral-800">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-900 text-left text-xs uppercase tracking-wider text-neutral-400">
                      <tr>
                        <th className="px-4 py-2">Artist</th>
                        <th className="px-4 py-2">Date</th>
                        <th className="px-4 py-2">Venue</th>
                        <th className="px-4 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                      {groupOffers.map((o) => (
                        <tr key={o.id}>
                          <td className="px-4 py-2 font-medium text-neutral-100">
                            {o.artist?.full_name ?? "(unknown)"}
                          </td>
                          <td className="px-4 py-2 text-neutral-400">
                            {format(new Date(o.gig_start_ts), "EEE MMM d, h:mm a")}
                          </td>
                          <td className="px-4 py-2 text-neutral-400">{o.venue ?? "—"}</td>
                          <td className="px-4 py-2">
                            <StatusPill status={o.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}

function bucketCounts(statuses: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of statuses) out[s] = (out[s] ?? 0) + 1;
  return out;
}

function StatusPill({ status, count }: { status: string; count?: number }) {
  const styles: Record<string, string> = {
    draft: "bg-neutral-800 text-neutral-300",
    pending: "bg-blue-900/40 text-blue-300",
    accepted: "bg-green-900/40 text-green-300",
    declined: "bg-orange-900/40 text-orange-300",
    expired: "bg-red-900/40 text-red-300",
    superseded: "bg-neutral-800 text-neutral-500",
  };
  const cls = styles[status] ?? "bg-neutral-800 text-neutral-300";
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${cls}`}>
      {count != null ? <strong className="font-semibold">{count}</strong> : null}
      {status}
    </span>
  );
}
