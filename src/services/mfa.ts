import { authenticator } from "otplib";
import { prisma } from "@/lib/db";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import type { AppRole } from "@/lib/auth-helpers";

// TOTP second factor (scope §12.1). Available to every account type;
// mandatory enforcement (assertMfaSatisfied) applies only to ADMIN and
// SUPER_ADMIN. The secret is generated and verified with otplib but always
// stored app-level encrypted (src/lib/crypto.ts) — the raw base32 seed
// never touches the database or logs.

export class MfaError extends Error {}

const ROLES_REQUIRING_MFA: AppRole[] = ["ADMIN", "SUPER_ADMIN"];

async function loadUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new MfaError("user not found");
  return user;
}

/** Generate a fresh TOTP secret for a user and store it (unconfirmed). */
export async function beginEnrollment(
  userId: string,
): Promise<{ otpauthUrl: string }> {
  const user = await loadUser(userId);
  const secret = authenticator.generateSecret();
  await prisma.user.update({
    where: { id: userId },
    data: { mfaSecret: encryptSecret(secret), mfaEnabled: false },
  });
  const otpauthUrl = authenticator.keyuri(user.email, "The Hub", secret);
  return { otpauthUrl };
}

/** Confirm enrollment with a code from the authenticator app; enables MFA. */
export async function confirmEnrollment(args: {
  userId: string;
  code: string;
}): Promise<void> {
  const user = await loadUser(args.userId);
  if (!user.mfaSecret) throw new MfaError("no enrollment in progress");
  const secret = decryptSecret(user.mfaSecret);
  if (!authenticator.check(args.code, secret)) {
    throw new MfaError("invalid code");
  }
  await prisma.user.update({
    where: { id: args.userId },
    data: { mfaEnabled: true },
  });
}

/** Verify a TOTP code against an already-enrolled user. */
export async function verifyMfaCode(args: {
  userId: string;
  code: string;
}): Promise<boolean> {
  const user = await loadUser(args.userId);
  if (!user.mfaEnabled || !user.mfaSecret) return false;
  return authenticator.check(args.code, decryptSecret(user.mfaSecret));
}

/** Disable MFA; requires a valid current code to prevent account takeover. */
export async function disableMfa(args: {
  userId: string;
  code: string;
}): Promise<void> {
  const ok = await verifyMfaCode(args);
  if (!ok) throw new MfaError("invalid code");
  await prisma.user.update({
    where: { id: args.userId },
    data: { mfaEnabled: false, mfaSecret: null },
  });
}

/**
 * Enforcement gate (scope §12.1): throws unless the account either doesn't
 * require MFA (not Admin/Super Admin) or has it enabled. Call this from
 * session/login or from privileged-action entry points.
 */
export async function assertMfaSatisfied(userId: string): Promise<void> {
  const user = await loadUser(userId);
  if (!ROLES_REQUIRING_MFA.includes(user.role as AppRole)) return;
  if (!user.mfaEnabled) {
    throw new MfaError("MFA is mandatory for this account role");
  }
}
