import { SignJWT, jwtVerify } from "jose";
import type { AppRole } from "@/lib/auth-helpers";

// Mobile auth (scope §9, §11: Expo app). NextAuth's web session is a
// browser cookie — a non-trivial fit for React Native's fetch. Mobile
// instead gets a bearer JWT from /api/mobile/auth/{login,register},
// stored in SecureStore client-side and sent as `Authorization: Bearer
// <token>` on every request. Same AUTH_SECRET as the web session, just a
// different transport.

const TOKEN_TTL = "30d";

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export interface MobileTokenPayload {
  sub: string;
  role: AppRole;
}

export async function issueMobileToken(payload: MobileTokenPayload): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(secretKey());
}

export async function verifyMobileToken(
  token: string,
): Promise<{ userId: string; role: AppRole } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== "string" || typeof payload.role !== "string") return null;
    return { userId: payload.sub, role: payload.role as AppRole };
  } catch {
    return null;
  }
}

export class MobileAuthError extends Error {}

/** Extract + verify the bearer token from a request, or throw MobileAuthError. */
export async function requireMobileUser(
  request: Request,
): Promise<{ userId: string; role: AppRole }> {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    throw new MobileAuthError("missing bearer token");
  }
  const session = await verifyMobileToken(token);
  if (!session) throw new MobileAuthError("invalid or expired token");
  return session;
}

/** Same as requireMobileUser but returns null instead of throwing — for routes where auth is optional. */
export async function optionalMobileUser(
  request: Request,
): Promise<{ userId: string; role: AppRole } | null> {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return verifyMobileToken(token);
}
