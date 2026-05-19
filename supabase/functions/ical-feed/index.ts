// ical-feed — public HTTP endpoint serving per-artist busy-only .ics feeds.
//
// URL shape after deploy:
//   https://<project-ref>.supabase.co/functions/v1/ical-feed/<token>.ics
//
// This is the URL the agent pastes into Overture's "Internet Calendars"
// field for each artist. No auth header required — the long random token
// in the path IS the auth. Revoke by setting ical_feed_tokens.revoked_at.
//
// Deploy:
//   supabase functions deploy ical-feed --no-verify-jwt
//
// (verify-jwt must be disabled because Overture won't be sending a JWT
// when it polls the feed.)

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildBusyFeed, type BusyBlockRow } from "../_shared/ical.ts";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // Path: /functions/v1/ical-feed/<token>.ics   (or <token> with no extension)
  // We grab the last path segment.
  const segments = url.pathname.split("/").filter(Boolean);
  const lastRaw = segments[segments.length - 1] ?? "";
  const token = lastRaw.replace(/\.ics$/i, "");

  if (!token || !/^[A-Za-z0-9_-]+$/.test(token)) {
    return new Response("Not found", { status: 404 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response("Server misconfigured", { status: 500 });
  }
  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: feedRow, error: feedErr } = await sb
    .from("ical_feed_tokens")
    .select("artist_id, revoked_at")
    .eq("token", token)
    .maybeSingle();

  if (feedErr) return new Response("Internal error", { status: 500 });
  if (!feedRow || feedRow.revoked_at) {
    return new Response("Not found", { status: 404 });
  }

  // Pull busy blocks from 1 day ago through 365 days ahead.
  // (Overture only cares about future blocks, but including the recent
  // past helps if its poll clock is skewed.)
  const now = new Date();
  const from = new Date(now.getTime() - 86_400_000);
  const to = new Date(now.getTime() + 365 * 86_400_000);

  const { data: blocks, error: blocksErr } = await sb
    .from("busy_blocks")
    .select("artist_id, start_ts, end_ts, source")
    .eq("artist_id", feedRow.artist_id)
    .gte("end_ts", from.toISOString())
    .lt("start_ts", to.toISOString())
    .order("start_ts", { ascending: true });

  if (blocksErr) return new Response("Internal error", { status: 500 });

  const ics = await buildBusyFeed(
    feedRow.artist_id,
    (blocks ?? []) as BusyBlockRow[],
    { excludeSources: ["overture"] },
  );

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="unavailable.ics"',
      "Cache-Control": "public, max-age=60",
    },
  });
});
