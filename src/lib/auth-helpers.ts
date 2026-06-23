import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";

export type AppRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "USER"
  | "AGENCY"
  | "BUSINESS_OWNER";

// Human-readable display names for each role (scope §5). The enum
// identifiers stay UPPER_SNAKE for the DB; UI shows these labels.
const ROLE_LABELS: Record<AppRole, string> = {
  SUPER_ADMIN: "SuperAdmin",
  ADMIN: "Admin",
  USER: "User",
  AGENCY: "Agency",
  BUSINESS_OWNER: "Business Owner",
};

export function roleLabel(role: AppRole): string {
  return ROLE_LABELS[role];
}

export function attachRole(session: Session, token: JWT): Session {
  const role = (token.role as AppRole) ?? "USER";
  return { ...session, user: { ...session.user, role } };
}
