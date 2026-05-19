import twilio from "twilio";
import { createHmac } from "node:crypto";
import { env } from "./env";

/**
 * Returns a configured Twilio REST client, or null if the env vars
 * aren't fully set (so the caller can degrade gracefully — e.g., leave
 * offers in 'draft' state instead of crashing).
 */
export function twilioClient() {
  const e = env();
  if (!e.TWILIO_ACCOUNT_SID || !e.TWILIO_AUTH_TOKEN || !e.TWILIO_FROM_NUMBER) return null;
  return twilio(e.TWILIO_ACCOUNT_SID, e.TWILIO_AUTH_TOKEN);
}

export function twilioFromNumber(): string | null {
  return env().TWILIO_FROM_NUMBER ?? null;
}

/**
 * Verifies a Twilio webhook request signature.
 * https://www.twilio.com/docs/usage/security#validating-requests
 *
 * Twilio signs (fullUrl + sortedParamsConcatenated) with the account
 * auth token via HMAC-SHA1, base64-encoded. The signature comes in the
 * `X-Twilio-Signature` header.
 */
export function verifyTwilioSignature(
  fullUrl: string,
  params: Record<string, string>,
  signature: string,
): boolean {
  const authToken = env().TWILIO_AUTH_TOKEN;
  if (!authToken) return false;
  const sorted = Object.keys(params).sort();
  let data = fullUrl;
  for (const k of sorted) data += k + params[k];
  const expected = createHmac("sha1", authToken).update(data).digest("base64");
  return timingSafeEqual(expected, signature);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let acc = 0;
  for (let i = 0; i < a.length; i++) acc |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return acc === 0;
}

export interface OfferSmsContext {
  artistFirstName: string;
  agencyName: string;
  gigDateHuman: string;
  venue: string | null;
  feeCents: number | null;
  acceptUrl: string;
  declineUrl: string;
}

/**
 * Composes the SMS body. Kept short — long-code US SMS bills per 160
 * GSM-7 chars. We aim to stay under 320 chars (2 segments) by default.
 */
export function buildOfferMessage(ctx: OfferSmsContext): string {
  const feeStr =
    ctx.feeCents != null
      ? `$${(ctx.feeCents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`
      : null;
  const lines = [
    `Hi ${ctx.artistFirstName} — gig offer from ${ctx.agencyName}:`,
    [ctx.gigDateHuman, ctx.venue, feeStr].filter(Boolean).join(", "),
    `Accept: ${ctx.acceptUrl}`,
    `Decline: ${ctx.declineUrl}`,
    `Reply within 24h or it's released.`,
  ];
  return lines.join("\n");
}
