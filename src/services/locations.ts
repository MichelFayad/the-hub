import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

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
