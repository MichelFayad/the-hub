import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { parseEnv } from "@/lib/env";

// App-level encryption for sensitive secrets at rest (scope §12.1/§12.3),
// e.g. MFA TOTP seeds — defense in depth beyond DB-level encryption.
// AES-256-GCM with a key derived from AUTH_SECRET (already a 32+ char
// secret managed outside the repo); IV and auth tag travel with the
// ciphertext, all base64-joined with ':' so one column holds it all.

function key(): Buffer {
  return createHash("sha256").update(parseEnv().AUTH_SECRET).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((b) => b.toString("base64")).join(":");
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, ciphertextB64] = payload.split(":");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
