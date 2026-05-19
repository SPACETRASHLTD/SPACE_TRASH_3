import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { requireServerEnv } from "./env";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function key(): Buffer {
  const raw = requireServerEnv("TOKEN_ENCRYPTION_KEY");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must decode to 32 bytes (got ${buf.length}). ` +
        `Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }
  return buf;
}

/**
 * Encrypts a plaintext string with AES-256-GCM. Returns a single
 * base64 blob containing IV || ciphertext || authTag.
 *
 * Used for: Google refresh tokens, Overture API key.
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ct, tag]).toString("base64");
}

export function decrypt(blob: string): string {
  const buf = Buffer.from(blob, "base64");
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("Ciphertext too short to be valid AES-GCM payload");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const ct = buf.subarray(IV_LEN, buf.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, key(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

/**
 * Cryptographically random URL-safe token. Used for invite tokens,
 * iCal feed tokens, offer tokens.
 */
export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}
