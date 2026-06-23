// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { searchLocations } from "@/services/search";

// Beirut downtown vs. Tripoli (~70 km north) — far enough to fall outside
// a city-scale radius.
const BEIRUT = { lat: 33.8938, lng: 35.5018 };
const TRIPOLI = { lat: 34.4333, lng: 35.8497 };

let catId: string;
const ids: string[] = [];

async function makeLocation(data: {
  name: string;
  lat: number;
  lng: number;
  status?: "PUBLISHED" | "DRAFT";
  ratingAvg?: number;
  priceLevel?: number;
}) {
  const loc = await prisma.location.create({
    data: {
      name: data.name,
      primaryCategoryId: catId,
      latitude: data.lat,
      longitude: data.lng,
      status: data.status ?? "PUBLISHED",
      ratingAvg: data.ratingAvg ?? null,
      priceLevel: data.priceLevel ?? null,
    },
  });
  ids.push(loc.id);
  return loc;
}

describe("searchLocations", () => {
  beforeAll(async () => {
    const cat = await prisma.category.create({
      data: { slug: `search-cat-${Date.now()}`, nameEn: "Search Cat" },
    });
    catId = cat.id;
    await makeLocation({ name: "Ramen House", ...BEIRUT, ratingAvg: 4.5, priceLevel: 2 });
    await makeLocation({ name: "Sushi Bar", ...BEIRUT, ratingAvg: 3.0, priceLevel: 3 });
    await makeLocation({ name: "Tripoli Ramen", ...TRIPOLI, ratingAvg: 4.0 });
    await makeLocation({ name: "Hidden Ramen", ...BEIRUT, status: "DRAFT" });
  });

  afterAll(async () => {
    await prisma.location.deleteMany({ where: { id: { in: ids } } });
    await prisma.category.delete({ where: { id: catId } });
    await prisma.$disconnect();
  });

  it("matches a keyword against the name via full-text search", async () => {
    const results = await searchLocations({ query: "ramen" });
    const names = results.map((r) => r.name);
    expect(names).toContain("Ramen House");
    expect(names).toContain("Tripoli Ramen");
    expect(names).not.toContain("Sushi Bar");
  });

  it("never returns non-PUBLISHED listings", async () => {
    const results = await searchLocations({ query: "ramen" });
    expect(results.map((r) => r.name)).not.toContain("Hidden Ramen");
  });

  it("filters by category slug", async () => {
    const cat = await prisma.category.findUnique({ where: { id: catId } });
    const results = await searchLocations({ categorySlug: cat!.slug });
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it("filters by distance radius and reports distance", async () => {
    const results = await searchLocations({
      near: { lat: BEIRUT.lat, lng: BEIRUT.lng, radiusMeters: 10_000 },
    });
    const names = results.map((r) => r.name);
    expect(names).toContain("Ramen House");
    expect(names).not.toContain("Tripoli Ramen");
    const rh = results.find((r) => r.name === "Ramen House");
    expect(rh?.distanceMeters).toBeLessThan(1000);
  });

  it("sorts by distance ascending when a location is given", async () => {
    const results = await searchLocations({
      near: { lat: BEIRUT.lat, lng: BEIRUT.lng, radiusMeters: 100_000 },
      sort: "distance",
    });
    const distances = results.map((r) => r.distanceMeters ?? Infinity);
    const sorted = [...distances].sort((a, b) => a - b);
    expect(distances).toEqual(sorted);
  });

  it("filters by minimum rating", async () => {
    const results = await searchLocations({ minRating: 4.0 });
    const names = results.map((r) => r.name);
    expect(names).toContain("Ramen House");
    expect(names).not.toContain("Sushi Bar");
  });

  it("filters by maximum price level", async () => {
    const results = await searchLocations({ maxPriceLevel: 2 });
    const names = results.map((r) => r.name);
    expect(names).toContain("Ramen House");
    expect(names).not.toContain("Sushi Bar");
  });
});
