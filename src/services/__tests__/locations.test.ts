// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  createLocation,
  getLocationById,
  getLocationProfile,
} from "@/services/locations";

let primaryId: string;
let secondaryId: string;
const createdLocationIds: string[] = [];

describe("locations service", () => {
  beforeAll(async () => {
    const primary = await prisma.category.create({
      data: { slug: `test-primary-${Date.now()}`, nameEn: "Test Primary" },
    });
    const secondary = await prisma.category.create({
      data: { slug: `test-secondary-${Date.now()}`, nameEn: "Test Secondary" },
    });
    primaryId = primary.id;
    secondaryId = secondary.id;
  });

  afterAll(async () => {
    await prisma.location.deleteMany({
      where: { id: { in: createdLocationIds } },
    });
    await prisma.category.deleteMany({
      where: { id: { in: [primaryId, secondaryId] } },
    });
    await prisma.$disconnect();
  });

  it("creates a location defaulting to DRAFT and linking the primary category", async () => {
    const loc = await createLocation({
      name: "Ramen House",
      primaryCategoryId: primaryId,
      latitude: 33.8938,
      longitude: 35.5018,
    });
    createdLocationIds.push(loc.id);

    expect(loc.status).toBe("DRAFT");
    expect(loc.primaryCategoryId).toBe(primaryId);
    expect(loc.claimed).toBe(false);
  });

  it("attaches secondary categories, tags, and media on create", async () => {
    const loc = await createLocation({
      name: "Spa Hotel",
      primaryCategoryId: primaryId,
      secondaryCategoryIds: [secondaryId],
      tags: ["luxury", "rooftop"],
      media: [{ url: "https://cdn.example/1.jpg" }],
    });
    createdLocationIds.push(loc.id);

    const found = await getLocationById(loc.id);
    expect(found?.primaryCategory.id).toBe(primaryId);
    expect(found?.secondaryCategories.map((c) => c.id)).toContain(secondaryId);
    expect(found?.tags).toEqual(["luxury", "rooftop"]);
    expect(found?.media).toHaveLength(1);
    expect(found?.media[0].type).toBe("PHOTO");
  });

  it("returns null for an unknown id", async () => {
    expect(await getLocationById("does-not-exist")).toBeNull();
  });

  it("builds a localized profile view-model with category fallback", async () => {
    const loc = await createLocation({
      name: "Localized Place",
      primaryCategoryId: primaryId,
      secondaryCategoryIds: [secondaryId],
      tags: ["x"],
    });
    createdLocationIds.push(loc.id);

    const profile = await getLocationProfile(loc.id, "ar");
    // Test categories have no Arabic name → fall back to English.
    expect(profile?.primaryCategory.name).toBe("Test Primary");
    expect(profile?.secondaryCategories[0].name).toBe("Test Secondary");
    expect(profile?.name).toBe("Localized Place");
    expect(profile?.tags).toEqual(["x"]);
  });

  it("returns null profile for an unknown id", async () => {
    expect(await getLocationProfile("nope", "en")).toBeNull();
  });
});
