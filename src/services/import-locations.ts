import { prisma } from "@/lib/db";

// Admin bulk seed/import (scope §5.1). Format-agnostic: callers parse
// CSV/JSON/etc. into ImportRecords; this engine validates and upserts.
// Idempotent by googleMapsUrl (the address of record). One bad row never
// aborts the batch — failures are collected and reported.
//
// The actual seed dataset source (Google-Maps-breadth data for Lebanon)
// is a business decision tracked as a risk gate (scope §18); this is the
// mechanism that ingests whatever source is chosen.

export interface ImportRecord {
  name: string;
  primaryCategorySlug: string;
  description?: string;
  googleMapsUrl?: string;
  latitude?: number;
  longitude?: number;
  phoneNumber?: string;
  website?: string;
  priceLevel?: number;
  tags?: string[];
  secondaryCategorySlugs?: string[];
  status?: "DRAFT" | "PUBLISHED";
}

export interface ImportError {
  index: number;
  name: string;
  error: string;
}

export interface ImportResult {
  created: number;
  updated: number;
  errors: ImportError[];
}

export async function importLocations(
  records: ImportRecord[],
): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, errors: [] };

  // Resolve every referenced category slug once.
  const slugs = new Set<string>();
  for (const r of records) {
    slugs.add(r.primaryCategorySlug);
    r.secondaryCategorySlugs?.forEach((s) => slugs.add(s));
  }
  const categories = await prisma.category.findMany({
    where: { slug: { in: [...slugs] } },
    select: { id: true, slug: true },
  });
  const idBySlug = new Map(categories.map((c) => [c.slug, c.id]));

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    try {
      if (!rec.name?.trim()) throw new Error("name is required");

      const primaryId = idBySlug.get(rec.primaryCategorySlug);
      if (!primaryId) {
        throw new Error(`unknown category: ${rec.primaryCategorySlug}`);
      }

      const secondaryIds = (rec.secondaryCategorySlugs ?? [])
        .map((s) => idBySlug.get(s))
        .filter((id): id is string => Boolean(id))
        .map((id) => ({ id }));

      const scalars = {
        name: rec.name.trim(),
        description: rec.description,
        primaryCategoryId: primaryId,
        tags: rec.tags ?? [],
        latitude: rec.latitude,
        longitude: rec.longitude,
        phoneNumber: rec.phoneNumber,
        website: rec.website,
        priceLevel: rec.priceLevel,
        status: rec.status ?? "PUBLISHED",
      };

      const existing = rec.googleMapsUrl
        ? await prisma.location.findUnique({
            where: { googleMapsUrl: rec.googleMapsUrl },
            select: { id: true },
          })
        : null;

      if (existing) {
        await prisma.location.update({
          where: { id: existing.id },
          data: {
            ...scalars,
            secondaryCategories: { set: secondaryIds },
          },
        });
        result.updated++;
      } else {
        await prisma.location.create({
          data: {
            ...scalars,
            googleMapsUrl: rec.googleMapsUrl,
            secondaryCategories: { connect: secondaryIds },
          },
        });
        result.created++;
      }
    } catch (err) {
      result.errors.push({
        index: i,
        name: rec.name ?? "",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
