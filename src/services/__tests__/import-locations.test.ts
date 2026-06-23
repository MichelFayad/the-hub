// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { importLocations } from "@/services/import-locations";

let primarySlug: string;
let secondarySlug: string;
const urls: string[] = [];

describe("importLocations", () => {
  beforeAll(async () => {
    const p = await prisma.category.create({
      data: { slug: `imp-primary-${Date.now()}`, nameEn: "Imp Primary" },
    });
    const s = await prisma.category.create({
      data: { slug: `imp-secondary-${Date.now()}`, nameEn: "Imp Secondary" },
    });
    primarySlug = p.slug;
    secondarySlug = s.slug;
  });

  afterAll(async () => {
    await prisma.location.deleteMany({ where: { googleMapsUrl: { in: urls } } });
    await prisma.location.deleteMany({ where: { name: "No-URL Place" } });
    await prisma.category.deleteMany({
      where: { slug: { in: [primarySlug, secondarySlug] } },
    });
    await prisma.$disconnect();
  });

  it("imports valid records as PUBLISHED and links the primary category", async () => {
    const url = `https://maps.example/a-${Date.now()}`;
    urls.push(url);
    const result = await importLocations([
      { name: "Imported Cafe", primaryCategorySlug: primarySlug, googleMapsUrl: url },
    ]);
    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(0);

    const loc = await prisma.location.findUnique({ where: { googleMapsUrl: url } });
    expect(loc?.status).toBe("PUBLISHED");
    expect(loc?.primaryCategoryId).toBeTruthy();
  });

  it("is idempotent — re-import by googleMapsUrl updates instead of duplicating", async () => {
    const url = `https://maps.example/b-${Date.now()}`;
    urls.push(url);
    const rec = { name: "Repeat Place", primaryCategorySlug: primarySlug, googleMapsUrl: url };
    await importLocations([rec]);
    const second = await importLocations([{ ...rec, name: "Repeat Place v2" }]);
    expect(second.updated).toBe(1);
    expect(second.created).toBe(0);

    const count = await prisma.location.count({ where: { googleMapsUrl: url } });
    expect(count).toBe(1);
    const loc = await prisma.location.findUnique({ where: { googleMapsUrl: url } });
    expect(loc?.name).toBe("Repeat Place v2");
  });

  it("records errors for unknown categories without aborting the batch", async () => {
    const url = `https://maps.example/c-${Date.now()}`;
    urls.push(url);
    const result = await importLocations([
      { name: "Bad Cat", primaryCategorySlug: "no-such-category" },
      { name: "Good One", primaryCategorySlug: primarySlug, googleMapsUrl: url },
    ]);
    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].name).toBe("Bad Cat");
  });

  it("records an error for a missing name", async () => {
    const result = await importLocations([
      { name: "   ", primaryCategorySlug: primarySlug },
    ]);
    expect(result.created).toBe(0);
    expect(result.errors).toHaveLength(1);
  });

  it("links secondary categories and tags", async () => {
    const url = `https://maps.example/d-${Date.now()}`;
    urls.push(url);
    await importLocations([
      {
        name: "No-URL Place",
        primaryCategorySlug: primarySlug,
        googleMapsUrl: url,
        secondaryCategorySlugs: [secondarySlug],
        tags: ["halal", "wifi"],
      },
    ]);
    const loc = await prisma.location.findUnique({
      where: { googleMapsUrl: url },
      include: { secondaryCategories: true },
    });
    expect(loc?.tags).toEqual(["halal", "wifi"]);
    expect(loc?.secondaryCategories.map((c) => c.slug)).toContain(secondarySlug);
  });
});
