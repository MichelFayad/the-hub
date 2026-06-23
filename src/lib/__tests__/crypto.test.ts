import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

describe("crypto", () => {
  it("round-trips a secret through encrypt/decrypt", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const encrypted = encryptSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(decryptSecret(encrypted)).toBe(secret);
  });

  it("produces a different ciphertext each call (random IV)", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    expect(encryptSecret(secret)).not.toBe(encryptSecret(secret));
  });
});
