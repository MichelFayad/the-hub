import { NextResponse } from "next/server";
import { MobileAuthError } from "@/lib/mobile-auth";
import { ForbiddenError } from "@/lib/rbac";

/** Shared error->status mapping for mobile API routes. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof MobileAuthError) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  if (err instanceof Error) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  return NextResponse.json({ error: "unexpected error" }, { status: 500 });
}
