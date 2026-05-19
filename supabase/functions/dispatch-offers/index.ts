// dispatch-offers — cron-triggered. Picks up offers in 'draft' status,
// sends the SMS via Twilio, flips them to 'pending'. On Twilio failure,
// records the error on offers.sms_error and leaves status as 'draft'
// so a later run can retry.
//
// Safety: if OFFERS_ALLOW_DISPATCH != "1" the function exits early
// without sending anything. Default-OFF so dev environments don't
// surprise-text real artists.
//
// Deploy:
//   supabase functions deploy dispatch-offers
//
// Secrets required:
//   OFFERS_ALLOW_DISPATCH=1
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
//   NEXT_PUBLIC_APP_URL          (for building accept/decline URLs)
//
// Cron schedule (Supabase Studio → Database → Cron):
//   */1 * * * *

import { createClient } from "npm:@supabase/supabase-js@2";

const LOOK_BACK_HOURS = 24; // safety cap; older drafts skipped (probably stale)

interface OfferRow {
  id: string;
  artist_id: string;
  gig_start_ts: string;
  gig_end_ts: string;
  venue: string | null;
  fee_cents: number | null;
  notes: string | null;
  token: string;
  artist: { full_name: string; phone_e164: string | null } | null;
  agency: { name: string; timezone: string } | null;
}

function formatGigDate(iso: string, tz: string): string {
  // Crude server-side TZ format. Avoids pulling date-fns into the edge.
  // Outputs e.g. "Sat Jun 14, 9:00 PM"
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };
  return new Intl.DateTimeFormat("en-US", opts).format(d);
}

function buildMessage(o: OfferRow, accept: string, decline: string): string {
  const tz = o.agency?.timezone ?? "America/New_York";
  const firstName = (o.artist?.full_name ?? "").split(" ")[0] || "there";
  const agencyName = o.agency?.name ?? "your agent";
  const dateHuman = formatGigDate(o.gig_start_ts, tz);
  const fee =
    o.fee_cents != null
      ? `$${(o.fee_cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`
      : null;
  const middle = [dateHuman, o.venue, fee].filter(Boolean).join(", ");
  return (
    `Hi ${firstName} — gig offer from ${agencyName}:\n` +
    `${middle}\n` +
    `Accept: ${accept}\n` +
    `Decline: ${decline}\n` +
    `Reply within 24h or it's released.`
  );
}

Deno.serve(async (_req) => {
  if (Deno.env.get("OFFERS_ALLOW_DISPATCH") !== "1") {
    return new Response(
      JSON.stringify({ skipped: true, reason: "OFFERS_ALLOW_DISPATCH not set to 1" }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const twAccount = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twFrom = Deno.env.get("TWILIO_FROM_NUMBER");
  const appUrl = Deno.env.get("NEXT_PUBLIC_APP_URL");

  if (!supabaseUrl || !serviceKey || !twAccount || !twAuth || !twFrom || !appUrl) {
    return new Response(
      JSON.stringify({
        error:
          "Missing required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, NEXT_PUBLIC_APP_URL",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cutoff = new Date(Date.now() - LOOK_BACK_HOURS * 60 * 60 * 1000).toISOString();

  const { data: drafts, error } = await sb
    .from("offers")
    .select(
      "id, artist_id, gig_start_ts, gig_end_ts, venue, fee_cents, notes, token, " +
        "artist:artists(full_name, phone_e164), agency:agencies(name, timezone)",
    )
    .eq("status", "draft")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" } },
    );
  }

  const offers = (drafts ?? []) as unknown as OfferRow[];
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const o of offers) {
    const phone = o.artist?.phone_e164;
    if (!phone) {
      await sb
        .from("offers")
        .update({ sms_error: "No phone on file for artist" })
        .eq("id", o.id);
      results.push({ id: o.id, ok: false, error: "no phone" });
      continue;
    }

    const accept = `${appUrl}/offer/${o.token}?a=accept`;
    const decline = `${appUrl}/offer/${o.token}?a=decline`;
    const body = buildMessage(o, accept, decline);

    try {
      const params = new URLSearchParams({
        From: twFrom,
        To: phone,
        Body: body,
      });
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twAccount}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${twAccount}:${twAuth}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params,
        },
      );
      const json = (await res.json()) as { sid?: string; message?: string };
      if (!res.ok) {
        await sb
          .from("offers")
          .update({ sms_error: json.message ?? `Twilio ${res.status}` })
          .eq("id", o.id);
        results.push({ id: o.id, ok: false, error: json.message ?? `Twilio ${res.status}` });
        continue;
      }

      await sb
        .from("offers")
        .update({ status: "pending", sms_sid: json.sid ?? null, sms_error: null })
        .eq("id", o.id);
      results.push({ id: o.id, ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await sb.from("offers").update({ sms_error: msg }).eq("id", o.id);
      results.push({ id: o.id, ok: false, error: msg });
    }
  }

  return new Response(
    JSON.stringify({
      processed: offers.length,
      ok: results.filter((r) => r.ok).length,
      errored: results.filter((r) => !r.ok).length,
      results,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
