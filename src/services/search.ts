import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { logInteraction } from "@/services/interaction-log";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";

// Discovery search over locations (scope §4.2): keyword full-text,
// category, distance radius (PostGIS), price, and rating, with sorting.
// All user input is bound as query parameters — never interpolated — so
// the raw SQL is injection-safe. Only PUBLISHED listings are surfaced.
//
// Follow-ups (later phases): secondary-category match (Phase 1 enhancement),
// open-now via the hours schema (Phase 2), boosted-listing surfacing
// (Phase 3), and GIN/GiST indexes in a hardening pass.

export interface SearchParams {
  query?: string;
  categorySlug?: string;
  near?: { lat: number; lng: number; radiusMeters: number };
  maxPriceLevel?: number;
  minRating?: number;
  sort?: "relevance" | "distance" | "rating" | "newest";
  limit?: number;
  offset?: number;
  // Attributes the search to a user for the analytics dashboard's
  // search-to-view conversion metric (scope §14). Omit for anonymous search.
  userId?: string;
}

export interface SearchResult {
  id: string;
  name: string;
  ratingAvg: number | null;
  priceLevel: number | null;
  distanceMeters: number | null;
}

export async function searchLocations(
  params: SearchParams,
): Promise<SearchResult[]> {
  const distExpr = params.near
    ? Prisma.sql`ST_Distance(
        ST_SetSRID(ST_MakePoint(l."longitude", l."latitude"), 4326)::geography,
        ST_SetSRID(ST_MakePoint(${params.near.lng}, ${params.near.lat}), 4326)::geography
      )`
    : Prisma.sql`NULL::double precision`;

  const tsquery = params.query
    ? Prisma.sql`plainto_tsquery('simple', ${params.query})`
    : null;
  const tsvector = Prisma.sql`to_tsvector('simple', coalesce(l."name", '') || ' ' || coalesce(l."description", ''))`;

  const where: Prisma.Sql[] = [Prisma.sql`l."status" = 'PUBLISHED'`];
  if (tsquery) where.push(Prisma.sql`${tsvector} @@ ${tsquery}`);
  if (params.categorySlug) {
    where.push(
      Prisma.sql`l."primaryCategoryId" IN (SELECT id FROM "Category" WHERE slug = ${params.categorySlug})`,
    );
  }
  if (params.near) {
    where.push(Prisma.sql`${distExpr} <= ${params.near.radiusMeters}`);
  }
  if (params.maxPriceLevel != null) {
    where.push(Prisma.sql`l."priceLevel" <= ${params.maxPriceLevel}`);
  }
  if (params.minRating != null) {
    where.push(Prisma.sql`l."ratingAvg" >= ${params.minRating}`);
  }

  const sort = params.sort ?? (params.near ? "distance" : params.query ? "relevance" : "newest");
  let orderBy: Prisma.Sql;
  switch (sort) {
    case "distance":
      orderBy = Prisma.sql`"distanceMeters" ASC NULLS LAST`;
      break;
    case "rating":
      orderBy = Prisma.sql`l."ratingAvg" DESC NULLS LAST`;
      break;
    case "relevance":
      orderBy = tsquery
        ? Prisma.sql`ts_rank(${tsvector}, ${tsquery}) DESC`
        : Prisma.sql`l."createdAt" DESC`;
      break;
    default:
      orderBy = Prisma.sql`l."createdAt" DESC`;
  }

  const limit = Math.min(params.limit ?? 50, 100);
  const offset = params.offset ?? 0;

  const results = await prisma.$queryRaw<SearchResult[]>(Prisma.sql`
    SELECT l.id, l.name, l."ratingAvg", l."priceLevel",
           ${distExpr} AS "distanceMeters"
    FROM "Location" l
    WHERE ${Prisma.join(where, " AND ")}
    ORDER BY ${orderBy}
    LIMIT ${limit} OFFSET ${offset}
  `);

  if (params.userId) {
    await logInteraction({
      userId: params.userId,
      type: ANALYTICS_EVENTS.SEARCH_PERFORMED,
      metadata: { query: params.query ?? null, resultCount: results.length },
    });
  }

  return results;
}
