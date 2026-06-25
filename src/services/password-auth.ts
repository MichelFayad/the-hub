import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { verifyMfaCode } from "@/services/mfa";
import type { AppRole } from "@/lib/auth-helpers";
import { logInteraction } from "@/services/interaction-log";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";

// Email/password auth (scope §2, §12.1). OAuth (End Users only) is a
// separate credential-less path, not implemented here. Mandatory MFA for
// ADMIN/SUPER_ADMIN is enforced inline: a TOTP code is required on every
// login once enrolled, not just gated after the fact.

export class AuthError extends Error {}

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const ROLES_REQUIRING_MFA: AppRole[] = ["ADMIN", "SUPER_ADMIN"];

export interface RegisterWithPasswordInput {
  email: string;
  password: string;
  displayName: string;
  role?: AppRole;
}

export async function registerWithPassword(input: RegisterWithPasswordInput) {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  return prisma.user.create({
    data: {
      email: input.email,
      displayName: input.displayName,
      passwordHash,
      role: input.role ?? "USER",
    },
  });
}

export interface AuthenticateInput {
  email: string;
  password: string;
  mfaCode?: string;
}

/** Verify credentials (+ TOTP if the role mandates MFA); applies lockout. */
export async function authenticateWithPassword(input: AuthenticateInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.passwordHash) {
    throw new AuthError("invalid email or password");
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AuthError("account locked, try again later");
  }

  if (user.suspendedAt) {
    throw new AuthError("account suspended");
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    const lockedOut = attempts >= MAX_FAILED_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: lockedOut ? 0 : attempts,
        lockedUntil: lockedOut ? new Date(Date.now() + LOCKOUT_MS) : user.lockedUntil,
      },
    });
    throw new AuthError("invalid email or password");
  }

  if (ROLES_REQUIRING_MFA.includes(user.role as AppRole)) {
    if (!user.mfaEnabled) {
      throw new AuthError("MFA enrollment required for this account role");
    }
    if (!input.mfaCode || !(await verifyMfaCode({ userId: user.id, code: input.mfaCode }))) {
      throw new AuthError("invalid or missing MFA code");
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  await logInteraction({ userId: user.id, type: ANALYTICS_EVENTS.LOGIN });

  return user;
}
