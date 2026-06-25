import { NextResponse } from "next/server";
import { recommendForUser } from "@/services/preferences";
import { requireMobileUser } from "@/lib/mobile-auth";
import { errorResponse } from "@/lib/api-error";

export async function GET(request: Request) {
  try {
    const { userId } = await requireMobileUser(request);
    const limit = new URL(request.url).searchParams.get("limit");
    const recommendations = await recommendForUser(userId, limit ? Number(limit) : undefined);
    return NextResponse.json({ recommendations });
  } catch (err) {
    return errorResponse(err);
  }
}
