// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  slugify,
  localizedName,
  seedCategories,
  listTree,
} from "@/services/taxonomy";

describe("slugify", () => {
  it("lowercases, strips accents and punctuation, hyphenates spaces", () => {
    expect(slugify("Food & Drink")).toBe("food-drink");
    expect(slugify("Cafés & Coffee Shops")).toBe("cafes-coffee-shops");
  });
});

describe("localizedName", () => {
  const cat = { nameEn: "Restaurants", nameAr: "مطاعم", nameFr: null };

  it("returns the requested locale name when present", () => {
    expect(localizedName(cat, "ar")).toBe("مطاعم");
  });

  it("falls back to English when the locale name is missing", () => {
    expect(localizedName(cat, "fr")).toBe("Restaurants");
    expect(localizedName(cat, "en")).toBe("Restaurants");
  });
});

describe("category taxonomy seed", () => {
  beforeAll(async () => {
    await seedCategories();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("seeds the 16 parent categories", async () => {
    const parents = await prisma.category.count({ where: { parentId: null } });
    expect(parents).toBe(16);
  });

  it("is idempotent — re-running does not duplicate rows", async () => {
    const before = await prisma.category.count();
    await seedCategories();
    const after = await prisma.category.count();
    expect(after).toBe(before);
  });

  it("returns a localized nested tree of parents with children", async () => {
    const tree = await listTree("en");
    expect(tree).toHaveLength(16);
    const food = tree.find((c) => c.slug === "food-drink");
    expect(food?.name).toBe("Food & Drink");
    expect(food?.children.length).toBeGreaterThan(0);
    expect(food?.children.some((c) => c.slug === "restaurants")).toBe(true);
  });
});
