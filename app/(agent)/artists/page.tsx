import Link from "next/link";
import { serviceClient } from "@/lib/supabase";
import { env, requireServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

interface ArtistRow {
  id: string;
  full_name: string;
  phone_e164: string | null;
  email: string | null;
  status: "invited" | "connected" | "revoked";
  invite_token: string | null;
  created_at: string;
}

interface TokenRow {
  artist_id: string;
  last_polled_at: string | null;
  last_error: string | null;
}

interface FeedRow {
  artist_id: string;
  token: string;
}

export default async function ArtistsPage() {
  const agencyId = requireServerEnv("AGENCY_ID");
  const supabaseUrl = env().NEXT_PUBLIC_SUPABASE_URL;
  const appUrl = env().NEXT_PUBLIC_APP_URL;
  const sb = serviceClient();

  const [artistsRes, tokensRes, feedsRes] = await Promise.all([
    sb
      .from("artists")
      .select("id, full_name, phone_e164, email, status, invite_token, created_at")
      .eq("agency_id", agencyId)
      .order("created_at", { ascending: false }),
    sb.from("google_tokens").select("artist_id, last_polled_at, last_error"),
    sb.from("ical_feed_tokens").select("artist_id, token").is("revoked_at", null),
  ]);

  const artists = (artistsRes.data ?? []) as ArtistRow[];
  const tokenByArtist = new Map(
    ((tokensRes.data ?? []) as TokenRow[]).map((t) => [t.artist_id, t]),
  );
  const feedByArtist = new Map(
    ((feedsRes.data ?? []) as FeedRow[]).map((f) => [f.artist_id, f.token]),
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Artists</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {artists.length} total · invite artists, see sync status, copy the iCal URL to paste into Overture.
          </p>
        </div>
        <Link
          href="/artists/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          + Invite artist
        </Link>
      </div>

      {artists.length === 0 ? (
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-8 text-center">
          <p className="text-neutral-400">No artists yet.</p>
          <Link href="/artists/new" className="mt-2 inline-block text-blue-400 hover:underline">
            Invite the first one →
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900 text-left text-xs uppercase tracking-wider text-neutral-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last sync</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800 bg-neutral-950">
              {artists.map((a) => {
                const token = tokenByArtist.get(a.id);
                const feedToken = feedByArtist.get(a.id);
                const feedUrl = feedToken
                  ? `${supabaseUrl}/functions/v1/ical-feed/${feedToken}.ics`
                  : null;
                const inviteUrl = a.invite_token
                  ? `${appUrl}/onboard/${a.invite_token}`
                  : null;
                return (
                  <tr key={a.id}>
                    <td className="px-4 py-3 font-medium">{a.full_name}</td>
                    <td className="px-4 py-3 text-neutral-400">{a.phone_e164 ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={a.status} error={token?.last_error ?? null} />
                    </td>
                    <td className="px-4 py-3 text-neutral-400">
                      {token?.last_polled_at
                        ? new Date(token.last_polled_at).toLocaleString()
                        : "never"}
                    </td>
                    <td className="px-4 py-3">
                      {a.status === "connected" && feedUrl ? (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-blue-400">
                            Show iCal URL
                          </summary>
                          <code className="mt-2 block break-all rounded bg-neutral-900 p-2 text-neutral-200">
                            {feedUrl}
                          </code>
                          <p className="mt-1 text-neutral-500">
                            Paste into Overture → artist → Further Information → Internet Calendars.
                          </p>
                        </details>
                      ) : inviteUrl ? (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-blue-400">
                            Show invite link
                          </summary>
                          <code className="mt-2 block break-all rounded bg-neutral-900 p-2 text-neutral-200">
                            {inviteUrl}
                          </code>
                          <p className="mt-1 text-neutral-500">
                            Send this to the artist — they click, sign into Google, done.
                          </p>
                        </details>
                      ) : (
                        <span className="text-neutral-500">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  status,
  error,
}: {
  status: "invited" | "connected" | "revoked";
  error: string | null;
}) {
  if (error) {
    return (
      <span title={error} className="inline-flex items-center gap-1 rounded bg-red-900/40 px-2 py-0.5 text-xs text-red-300">
        sync error
      </span>
    );
  }
  const styles: Record<typeof status, string> = {
    invited: "bg-yellow-900/40 text-yellow-300",
    connected: "bg-green-900/40 text-green-300",
    revoked: "bg-neutral-800 text-neutral-400",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${styles[status]}`}>
      {status}
    </span>
  );
}
