import { NextResponse } from "next/server";
import { getLocationProfile } from "@/services/locations";
import { optionalMobileUser } from "@/lib/mobile-auth";
import type { Locale } from "@/i18n/direction";
import { errorResponse } from "@/lib/api-error";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const locale = (new URL(request.url).searchParams.get("locale") as Locale) ?? "en";
    const session = await optionalMobileUser(request);

    const profile = await getLocationProfile(id, locale, session?.userId);
    if (!profile) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ location: profile });
  } catch (err) {
    return errorResponse(err);
  }
}
