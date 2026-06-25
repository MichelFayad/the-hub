import { NextResponse } from "next/server";
import { registerWithPassword } from "@/services/password-auth";
import { issueMobileToken } from "@/lib/mobile-auth";
import type { AppRole } from "@/lib/auth-helpers";
import { errorResponse } from "@/lib/api-error";

// Mobile registration is End User only (scope §2) — Agency/Individual
// Location accounts are console-managed business signups, web-only.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { email, password, displayName } = body ?? {};
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof displayName !== "string"
  ) {
    return NextResponse.json(
      { error: "email, password, and displayName are required" },
      { status: 400 },
    );
  }

  try {
    const user = await registerWithPassword({ email, password, displayName, role: "USER" });
    const token = await issueMobileToken({ sub: user.id, role: user.role as AppRole });
    return NextResponse.json(
      { token, user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role } },
      { status: 201 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
