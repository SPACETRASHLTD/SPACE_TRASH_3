// poll-availability — cron-triggered Edge Function.
//
// Iterates every artist with a Google refresh token, queries the Google
// FreeBusy API for the next 6 months, replaces source='google' busy_blocks
// for that artist with the fresh results. Per-artist failures are isolated
// and recorded on google_tokens.last_error.
//
// Deploy:
//   supabase functions deploy poll-availability
//
// Required secrets (set via `supabase secrets set <KEY>=<VAL>`):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY
//   (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-provided.)
//
// Schedule (paste into Supabase Studio → Database → Cron Jobs):
//   schedule: */15 * * * *
//   command:  select net.http_post(
//               url := 'https://<project-ref>.supabase.co/functions/v1/poll-availability',
//               headers := jsonb_build_object(
//                 'Authorization', 'Bearer ' || current_setting('supabase.service_role_key'),
//                 'Content-Type', 'application/json'
//               ),
//               body := '{}'::jsonb
//             );

import { createClient } from "npm:@supabase/supabase-js@2";
import { decrypt } from "../_shared/crypto.ts";
import { getBusyBlocks } from "../_shared/google.ts";

const HORIZON_PAST_DAYS = 1;
const HORIZON_FUTURE_DAYS = 180;

interface TokenRow {
  artist_id: string;
  refresh_token_encrypted: string;
}

Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: tokens, error: listErr } = await sb
    .from("google_tokens")
    .select("artist_id, refresh_token_encrypted");
  if (listErr) {
    return new Response(
      JSON.stringify({ error: `Failed to list google_tokens: ${listErr.message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const now = new Date();
  const from = new Date(now.getTime() - HORIZON_PAST_DAYS * 86_400_000);
  const to = new Date(now.getTime() + HORIZON_FUTURE_DAYS * 86_400_000);

  let okCount = 0;
  const errors: Array<{ artist_id: string; error: string }> = [];

  for (const row of (tokens ?? []) as TokenRow[]) {
    try {
      const refreshToken = await decrypt(row.refresh_token_encrypted);
      const ranges = await getBusyBlocks(refreshToken, from, to);

      // Replace all source='google' rows within the polled window for this artist.
      const { error: delErr } = await sb
        .from("busy_blocks")
        .delete()
        .eq("artist_id", row.artist_id)
        .eq("source", "google")
        .gte("start_ts", from.toISOString())
        .lt("start_ts", to.toISOString());
      if (delErr) throw new Error(`delete failed: ${delErr.message}`);

      if (ranges.length > 0) {
        const rows = ranges.map((r) => ({
          artist_id: row.artist_id,
          start_ts: r.start,
          end_ts: r.end,
          source: "google" as const,
        }));
        const { error: insErr } = await sb.from("busy_blocks").insert(rows);
        if (insErr) throw new Error(`insert failed: ${insErr.message}`);
      }

      await sb
        .from("google_tokens")
        .update({ last_polled_at: now.toISOString(), last_error: null })
        .eq("artist_id", row.artist_id);

      okCount++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ artist_id: row.artist_id, error: msg });
      await sb
        .from("google_tokens")
        .update({ last_polled_at: now.toISOString(), last_error: msg })
        .eq("artist_id", row.artist_id);
    }
  }

  return new Response(
    JSON.stringify({
      polled: tokens?.length ?? 0,
      ok: okCount,
      errored: errors.length,
      errors,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
