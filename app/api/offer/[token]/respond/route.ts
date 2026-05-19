import { NextResponse, type NextRequest } from "next/server";
import { serviceClient } from "@/lib/supabase";

interface OfferRow {
  id: string;
  agency_id: string;
  artist_id: string;
  status: string;
  gig_start_ts: string;
  gig_end_ts: string;
  expires_at: string;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!/^[A-Za-z0-9_-]+$/.test(token)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const form = await req.formData();
  const action = String(form.get("action") ?? "");
  if (action !== "accept" && action !== "decline") {
    return new NextResponse("Invalid action", { status: 400 });
  }

  const sb = serviceClient();
  const { data: offer, error: offerErr } = await sb
    .from("offers")
    .select("id, agency_id, artist_id, status, gig_start_ts, gig_end_ts, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (offerErr || !offer) return new NextResponse("Not found", { status: 404 });

  const row = offer as OfferRow;
  if (row.status !== "pending") {
    // Already accepted/declined/expired/superseded — re-show the page in its current state.
    return NextResponse.redirect(new URL(`/offer/${token}`, req.url));
  }
  if (new Date(row.expires_at) <= new Date()) {
    await sb.from("offers").update({ status: "expired" }).eq("id", row.id);
    return NextResponse.redirect(new URL(`/offer/${token}`, req.url));
  }

  if (action === "decline") {
    await sb
      .from("offers")
      .update({ status: "declined", declined_at: new Date().toISOString() })
      .eq("id", row.id);
    return NextResponse.redirect(new URL(`/offer/${token}`, req.url));
  }

  // action === 'accept'
  // 1. Mark this offer accepted.
  // 2. Supersede every OTHER pending offer for this exact gig (same agency, same start/end).
  // 3. (Phase 4) Push the booking into Overture + write event to Google Calendar.

  const now = new Date().toISOString();

  const { error: acceptErr } = await sb
    .from("offers")
    .update({ status: "accepted", accepted_at: now })
    .eq("id", row.id);
  if (acceptErr) return new NextResponse(`Accept failed: ${acceptErr.message}`, { status: 500 });

  await sb
    .from("offers")
    .update({ status: "superseded" })
    .eq("agency_id", row.agency_id)
    .eq("gig_start_ts", row.gig_start_ts)
    .eq("gig_end_ts", row.gig_end_ts)
    .eq("status", "pending")
    .neq("id", row.id);

  // Also write the booking into busy_blocks as source='manual' so the
  // agent's calendar reflects it immediately, even if Overture sync
  // hasn't happened yet.
  await sb.from("busy_blocks").insert({
    artist_id: row.artist_id,
    start_ts: row.gig_start_ts,
    end_ts: row.gig_end_ts,
    source: "manual",
    external_id: `offer:${row.id}`,
  });

  return NextResponse.redirect(new URL(`/offer/${token}`, req.url));
}
