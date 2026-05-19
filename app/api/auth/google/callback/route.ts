import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { serviceClient } from "@/lib/supabase";
import { exchangeCode } from "@/lib/google";
import { encrypt, randomToken } from "@/lib/crypto";

const COOKIE_NAME = "bb_oauth";

function errorRedirect(req: NextRequest, reason: string) {
  const url = new URL(`/onboard/error?reason=${encodeURIComponent(reason)}`, req.url);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");

  if (oauthError) {
    return errorRedirect(req, oauthError === "access_denied" ? "You declined access" : oauthError);
  }
  if (!code || !state) {
    return errorRedirect(req, "Missing authorization code");
  }

  // Verify the CSRF cookie + state nonce.
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return errorRedirect(req, "Session expired — please open the invite link again");

  let parsed: { invite: string; nonce: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return errorRedirect(req, "Invalid session");
  }
  if (parsed.nonce !== state) return errorRedirect(req, "State mismatch");

  // Look up the artist by invite token.
  const sb = serviceClient();
  const { data: artist, error: artistErr } = await sb
    .from("artists")
    .select("id, agency_id, status")
    .eq("invite_token", parsed.invite)
    .maybeSingle();
  if (artistErr || !artist) {
    return errorRedirect(req, "Invite no longer valid");
  }

  // Exchange the code for tokens.
  let tokens: Awaited<ReturnType<typeof exchangeCode>>;
  try {
    tokens = await exchangeCode(code);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Token exchange failed";
    return errorRedirect(req, msg);
  }

  const encrypted = encrypt(tokens.refresh_token);

  // Upsert google_tokens.
  const { error: tokenErr } = await sb.from("google_tokens").upsert(
    {
      artist_id: artist.id,
      refresh_token_encrypted: encrypted,
      scope: tokens.scope,
      last_error: null,
    },
    { onConflict: "artist_id" },
  );
  if (tokenErr) return errorRedirect(req, `Could not save token: ${tokenErr.message}`);

  // Mint a fresh, unrevoked iCal feed token if none exists.
  const { data: existingFeed } = await sb
    .from("ical_feed_tokens")
    .select("token")
    .eq("artist_id", artist.id)
    .is("revoked_at", null)
    .maybeSingle();

  if (!existingFeed) {
    const feedToken = randomToken(24);
    const { error: feedErr } = await sb.from("ical_feed_tokens").insert({
      token: feedToken,
      artist_id: artist.id,
    });
    if (feedErr) return errorRedirect(req, `Could not mint feed token: ${feedErr.message}`);
  }

  // Mark artist connected.
  await sb.from("artists").update({ status: "connected" }).eq("id", artist.id);

  // Clear the OAuth cookie.
  cookieStore.delete(COOKIE_NAME);

  return NextResponse.redirect(new URL("/onboard/done", req.url));
}
