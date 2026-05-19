// Google Calendar FreeBusy reader for Deno edge runtime.
// Privacy: only fetches busy time ranges. Never event details.

export interface BusyRange {
  start: string;
  end: string;
}

interface AccessTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface FreeBusyResponse {
  calendars?: {
    primary?: {
      busy?: Array<{ start: string; end: string }>;
      errors?: Array<{ domain: string; reason: string }>;
    };
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set");
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as AccessTokenResponse;
  return json.access_token;
}

/**
 * Calls Google FreeBusy for the primary calendar over [from, to].
 * FreeBusy enforces a maximum query range; we chunk to 30 days to stay safe.
 */
export async function getBusyBlocks(
  refreshToken: string,
  from: Date,
  to: Date,
): Promise<BusyRange[]> {
  const accessToken = await refreshAccessToken(refreshToken);
  const chunks: BusyRange[] = [];
  const CHUNK_DAYS = 30;
  let cursor = new Date(from);

  while (cursor < to) {
    const next = new Date(cursor);
    next.setUTCDate(next.getUTCDate() + CHUNK_DAYS);
    const chunkEnd = next > to ? to : next;

    const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: cursor.toISOString(),
        timeMax: chunkEnd.toISOString(),
        items: [{ id: "primary" }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`FreeBusy query failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as FreeBusyResponse;
    const primary = data.calendars?.primary;
    if (primary?.errors?.length) {
      throw new Error(`FreeBusy errored: ${JSON.stringify(primary.errors)}`);
    }
    for (const b of primary?.busy ?? []) {
      if (b.start && b.end) chunks.push({ start: b.start, end: b.end });
    }
    cursor = chunkEnd;
  }

  return chunks;
}
