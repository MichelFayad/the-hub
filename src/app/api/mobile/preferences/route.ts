import { NextResponse } from "next/server";
import { getPreferences, saveQuestionnaire } from "@/services/preferences";
import { requireMobileUser } from "@/lib/mobile-auth";
import { errorResponse } from "@/lib/api-error";

export async function GET(request: Request) {
  try {
    const { userId } = await requireMobileUser(request);
    const preferences = await getPreferences(userId);
    return NextResponse.json({ preferences });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireMobileUser(request);
    const body = (await request.json().catch(() => ({}))) ?? {};
    const preferences = await saveQuestionnaire({ ...body, userId });
    return NextResponse.json({ preferences });
  } catch (err) {
    return errorResponse(err);
  }
}
