// Mirror of /lib/crypto.ts using Web Crypto (Deno runtime).
// Decrypts AES-256-GCM blobs produced by lib/crypto.ts encrypt().
//
// Layout:  base64( IV[12 bytes] || ciphertext || authTag[16 bytes] )

const IV_LEN = 12;

function base64Decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importKey(): Promise<CryptoKey> {
  const b64 = Deno.env.get("TOKEN_ENCRYPTION_KEY");
  if (!b64) throw new Error("TOKEN_ENCRYPTION_KEY not set in edge function env");
  const raw = base64Decode(b64);
  if (raw.length !== 32) {
    throw new Error(`TOKEN_ENCRYPTION_KEY must decode to 32 bytes (got ${raw.length})`);
  }
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
}

export async function decrypt(blob: string): Promise<string> {
  const buf = base64Decode(blob);
  if (buf.length < IV_LEN + 16 + 1) {
    throw new Error("Ciphertext too short to be a valid AES-GCM payload");
  }
  const iv = buf.subarray(0, IV_LEN);
  // Web Crypto expects ciphertext + tag concatenated (which is what we wrote).
  const ctWithTag = buf.subarray(IV_LEN);
  const key = await importKey();
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ctWithTag);
  return new TextDecoder().decode(pt);
}
