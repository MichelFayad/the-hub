import { NextResponse } from "next/server";
import { listNotifications } from "@/services/notifications";
import { requireMobileUser } from "@/lib/mobile-auth";
import { errorResponse } from "@/lib/api-error";

export async function GET(request: Request) {
  try {
    const { userId } = await requireMobileUser(request);
    const unreadOnly = new URL(request.url).searchParams.get("unreadOnly") === "true";
    const notifications = await listNotifications(userId, { unreadOnly });
    return NextResponse.json({ notifications });
  } catch (err) {
    return errorResponse(err);
  }
}
