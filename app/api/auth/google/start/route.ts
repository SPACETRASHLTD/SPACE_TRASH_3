import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { serviceClient } from "@/lib/supabase";
import { getAuthUrl } from "@/lib/google";
import { randomToken } from "@/lib/crypto";

// Kicks off the artist's Google OAuth flow.
//
// Flow:
//   1. Validate the invite token (must match an unconnected artist).
//   2. Set a short-lived signed cookie containing { invite, nonce }.
//   3. Redirect to Google with `state = nonce`. Cookie + state pair
//      prevents CSRF on the callback.

const COOKIE_NAME = "bb_oauth";
const COOKIE_MAX_AGE_SEC = 10 * 60;

export async function GET(req: NextRequest) {
  const invite = req.nextUrl.searchParams.get("invite") ?? "";
  if (!/^[A-Za-z0-9_-]+$/.test(invite)) {
    return NextResponse.redirect(
      new URL("/onboard/error?reason=Invalid+invite+token", req.url),
    );
  }

  const sb = serviceClient();
  const { data: artist } = await sb
    .from("artists")
    .select("id, status")
    .eq("invite_token", invite)
    .maybeSingle();

  if (!artist) {
    return NextResponse.redirect(
      new URL("/onboard/error?reason=Invite+not+found", req.url),
    );
  }

  const nonce = randomToken(16);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, JSON.stringify({ invite, nonce }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SEC,
  });

  return NextResponse.redirect(getAuthUrl(nonce));
}
