import { NextResponse } from "next/server";
import { searchLocations, type SearchParams } from "@/services/search";
import { optionalMobileUser } from "@/lib/mobile-auth";
import { errorResponse } from "@/lib/api-error";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const session = await optionalMobileUser(request);

    const lat = params.get("lat");
    const lng = params.get("lng");
    const radiusMeters = params.get("radiusMeters");

    const results = await searchLocations({
      query: params.get("query") ?? undefined,
      categorySlug: params.get("categorySlug") ?? undefined,
      near:
        lat && lng && radiusMeters
          ? { lat: Number(lat), lng: Number(lng), radiusMeters: Number(radiusMeters) }
          : undefined,
      maxPriceLevel: params.get("maxPriceLevel") ? Number(params.get("maxPriceLevel")) : undefined,
      minRating: params.get("minRating") ? Number(params.get("minRating")) : undefined,
      sort: (params.get("sort") as SearchParams["sort"]) ?? undefined,
      limit: params.get("limit") ? Number(params.get("limit")) : undefined,
      offset: params.get("offset") ? Number(params.get("offset")) : undefined,
      userId: session?.userId,
    });

    return NextResponse.json({ results });
  } catch (err) {
    return errorResponse(err);
  }
}
