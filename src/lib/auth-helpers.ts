import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";

export type AppRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "END_USER"
  | "AGENCY"
  | "INDIVIDUAL_LOCATION";

export function attachRole(session: Session, token: JWT): Session {
  const role = (token.role as AppRole) ?? "END_USER";
  return { ...session, user: { ...session.user, role } };
}
