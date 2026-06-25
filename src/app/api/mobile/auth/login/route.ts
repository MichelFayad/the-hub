import { NextResponse } from "next/server";
import { authenticateWithPassword, AuthError } from "@/services/password-auth";
import { issueMobileToken } from "@/lib/mobile-auth";
import type { AppRole } from "@/lib/auth-helpers";
import { errorResponse } from "@/lib/api-error";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { email, password, mfaCode } = body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "email and password are required" }, { status: 400 });
  }

  try {
    const user = await authenticateWithPassword({
      email,
      password,
      mfaCode: typeof mfaCode === "string" ? mfaCode : undefined,
    });
    const token = await issueMobileToken({ sub: user.id, role: user.role as AppRole });
    return NextResponse.json({
      token,
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return errorResponse(err);
  }
}
