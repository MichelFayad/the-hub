import type { AppRole } from "@/lib/auth-helpers";

// Higher number = more authority. SUPER_ADMIN outranks all.
// AGENCY and INDIVIDUAL_LOCATION are business roles, not above END_USER
// in the admin sense; they get the same baseline authority level here and
// are gated by ownership checks (added in later phases), not the hierarchy.
const RANK: Record<AppRole, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 80,
  AGENCY: 40,
  INDIVIDUAL_LOCATION: 40,
  END_USER: 20,
};

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function hasRole(actual: AppRole, required: AppRole): boolean {
  return RANK[actual] >= RANK[required];
}

export function assertRole(actual: AppRole, required: AppRole): void {
  if (!hasRole(actual, required)) {
    throw new ForbiddenError(`Requires ${required}, has ${actual}`);
  }
}
