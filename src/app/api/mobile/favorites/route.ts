import { NextResponse } from "next/server";
import { listFavorites, addFavorite } from "@/services/favorites";
import { requireMobileUser } from "@/lib/mobile-auth";
import { errorResponse } from "@/lib/api-error";

export async function GET(request: Request) {
  try {
    const { userId } = await requireMobileUser(request);
    const favorites = await listFavorites(userId);
    return NextResponse.json({ favorites });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireMobileUser(request);
    const body = await request.json().catch(() => null);
    const locationId = body?.locationId;
    if (typeof locationId !== "string") {
      return NextResponse.json({ error: "locationId is required" }, { status: 400 });
    }
    const favorite = await addFavorite(userId, locationId);
    return NextResponse.json({ favorite }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
