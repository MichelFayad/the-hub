import { NextResponse } from "next/server";
import { removeFavorite } from "@/services/favorites";
import { requireMobileUser } from "@/lib/mobile-auth";
import { errorResponse } from "@/lib/api-error";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ locationId: string }> },
) {
  try {
    const { userId } = await requireMobileUser(request);
    const { locationId } = await params;
    await removeFavorite(userId, locationId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
