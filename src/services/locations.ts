import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { localizedName } from "@/services/taxonomy";
import type { Locale } from "@/i18n/direction";

export interface MediaInput {
  url: string;
  type?: "PHOTO" | "DOCUMENT";
  sortOrder?: number;
}

export interface CreateLocationInput {
  name: string;
  description?: string;
  primaryCategoryId: string;
  secondaryCategoryIds?: string[];
  tags?: string[];
  latitude?: number;
  longitude?: number;
  hours?: Prisma.InputJsonValue;
  googleMapsUrl?: string;
  website?: string;
  phoneNumber?: string;
  ownerUserId?: string;
  media?: MediaInput[];
}

/** Create a Location. New listings start as DRAFT and unclaimed (scope §5). */
export function createLocation(input: CreateLocationInput) {
  return prisma.location.create({
    data: {
      name: input.name,
      description: input.description,
      primaryCategoryId: input.primaryCategoryId,
      tags: input.tags ?? [],
      latitude: input.latitude,
      longitude: input.longitude,
      hours: input.hours,
      googleMapsUrl: input.googleMapsUrl,
      website: input.website,
      phoneNumber: input.phoneNumber,
      ownerUserId: input.ownerUserId,
      secondaryCategories: input.secondaryCategoryIds
        ? { connect: input.secondaryCategoryIds.map((id) => ({ id })) }
        : undefined,
      media: input.media
        ? {
            create: input.media.map((m, i) => ({
              url: m.url,
              type: m.type ?? "PHOTO",
              sortOrder: m.sortOrder ?? i,
            })),
          }
        : undefined,
    },
  });
}

/** Fetch a Location with its categories and ordered media, or null. */
export function getLocationById(id: string) {
  return prisma.location.findUnique({
    where: { id },
    include: {
      primaryCategory: true,
      secondaryCategories: true,
      media: { orderBy: { sortOrder: "asc" } },
    },
  });
}

export interface LocationProfile {
  id: string;
  name: string;
  description: string | null;
  status: string;
  primaryCategory: { slug: string; name: string };
  secondaryCategories: { slug: string; name: string }[];
  tags: string[];
  latitude: number | null;
  longitude: number | null;
  hours: Prisma.JsonValue;
  googleMapsUrl: string | null;
  website: string | null;
  phoneNumber: string | null;
  phoneVerified: boolean;
  media: { url: string; type: string }[];
}

/** Presentation-ready, locale-resolved profile for the location page (§4.3). */
export async function getLocationProfile(
  id: string,
  locale: Locale,
): Promise<LocationProfile | null> {
  const loc = await getLocationById(id);
  if (!loc) return null;

  return {
    id: loc.id,
    name: loc.name,
    description: loc.description,
    status: loc.status,
    primaryCategory: {
      slug: loc.primaryCategory.slug,
      name: localizedName(loc.primaryCategory, locale),
    },
    secondaryCategories: loc.secondaryCategories.map((c) => ({
      slug: c.slug,
      name: localizedName(c, locale),
    })),
    tags: loc.tags,
    latitude: loc.latitude,
    longitude: loc.longitude,
    hours: loc.hours,
    googleMapsUrl: loc.googleMapsUrl,
    website: loc.website,
    phoneNumber: loc.phoneNumber,
    phoneVerified: loc.phoneVerified,
    media: loc.media.map((m) => ({ url: m.url, type: m.type })),
  };
}
