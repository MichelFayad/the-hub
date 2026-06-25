import { NextResponse } from "next/server";
import { getReviewsForLocation, submitReview } from "@/services/reviews";
import { requireMobileUser } from "@/lib/mobile-auth";
import { errorResponse } from "@/lib/api-error";

export async function GET(request: Request) {
  try {
    const locationId = new URL(request.url).searchParams.get("locationId");
    if (!locationId) {
      return NextResponse.json({ error: "locationId is required" }, { status: 400 });
    }
    const reviews = await getReviewsForLocation(locationId);
    return NextResponse.json({ reviews });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireMobileUser(request);
    const body = await request.json().catch(() => null);
    const { locationId, rating, text } = body ?? {};
    if (typeof locationId !== "string" || typeof rating !== "number") {
      return NextResponse.json({ error: "locationId and rating are required" }, { status: 400 });
    }
    const review = await submitReview({ userId, locationId, rating, text });
    return NextResponse.json({ review }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
