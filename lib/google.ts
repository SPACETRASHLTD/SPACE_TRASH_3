import { google } from "googleapis";
import { env, requireServerEnv } from "./env";

/**
 * Privacy scope: calendar.freebusy returns busy time ranges only —
 * no event titles, locations, descriptions, or attendees. This is the
 * narrowest possible scope that does what we need.
 *
 * Phase 3 (offer acceptance) will require upgrading to
 * `https://www.googleapis.com/auth/calendar.events` so we can write
 * accepted gigs into the artist's calendar. That's a separate OAuth
 * grant the artist authorizes at the moment of their first acceptance.
 */
export const FREEBUSY_SCOPES = [
  "https://www.googleapis.com/auth/calendar.freebusy",
] as const;

export function googleOAuthClient() {
  const clientId = requireServerEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requireServerEnv("GOOGLE_CLIENT_SECRET");
  const redirectUri = `${env().NEXT_PUBLIC_APP_URL}/api/auth/google/callback`;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getAuthUrl(state: string): string {
  return googleOAuthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [...FREEBUSY_SCOPES],
    state,
    include_granted_scopes: true,
  });
}

export interface ExchangedTokens {
  refresh_token: string;
  access_token: string | null;
  expiry_date: number | null;
  scope: string;
}

export async function exchangeCode(code: string): Promise<ExchangedTokens> {
  const oauth = googleOAuthClient();
  const { tokens } = await oauth.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh_token. The user has likely granted " +
        "consent before — prompt=consent should force a fresh refresh token.",
    );
  }
  return {
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token ?? null,
    expiry_date: tokens.expiry_date ?? null,
    scope: tokens.scope ?? FREEBUSY_SCOPES.join(" "),
  };
}

export interface BusyBlock {
  start: string;
  end: string;
}

/**
 * Calls Google's FreeBusy API for the user's primary calendar.
 * Returns busy time ranges only — Google does not return event details
 * for this endpoint regardless of how much access we have.
 *
 * `fromIso` and `toIso` are RFC 3339 timestamps.
 */
export async function getBusyBlocks(
  refreshToken: string,
  fromIso: string,
  toIso: string,
): Promise<BusyBlock[]> {
  const oauth = googleOAuthClient();
  oauth.setCredentials({ refresh_token: refreshToken });
  const calendar = google.calendar({ version: "v3", auth: oauth });
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: fromIso,
      timeMax: toIso,
      items: [{ id: "primary" }],
    },
  });
  const primary = res.data.calendars?.primary;
  if (primary?.errors?.length) {
    throw new Error(
      `FreeBusy errored for primary calendar: ${JSON.stringify(primary.errors)}`,
    );
  }
  const busy = primary?.busy ?? [];
  return busy
    .filter((b): b is { start: string; end: string } => !!b.start && !!b.end)
    .map((b) => ({ start: b.start, end: b.end }));
}
