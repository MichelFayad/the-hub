// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  saveQuestionnaire,
  getPreferences,
  recommendForUser,
} from "@/services/preferences";

let userId: string;
let catFood: string;
let catGym: string;
const locIds: string[] = [];

async function makeLocation(
  name: string,
  categoryId: string,
  opts: { price?: number; rating?: number; status?: "PUBLISHED" | "DRAFT" } = {},
) {
  const loc = await prisma.location.create({
    data: {
      name,
      primaryCategoryId: categoryId,
      status: opts.status ?? "PUBLISHED",
      priceLevel: opts.price ?? null,
      ratingAvg: opts.rating ?? null,
      ratingCount: opts.rating != null ? 5 : 0,
    },
  });
  locIds.push(loc.id);
  return loc;
}

describe("preferences + rule-based recommendations", () => {
  beforeAll(async () => {
    const u = await prisma.user.create({
      data: { email: `pref-${Date.now()}@e.com`, displayName: "Pref", role: "USER" },
    });
    userId = u.id;
    const food = await prisma.category.create({
      data: { slug: `pref-food-${Date.now()}`, nameEn: "Food" },
    });
    const gym = await prisma.category.create({
      data: { slug: `pref-gym-${Date.now()}`, nameEn: "Gym" },
    });
    catFood = food.id;
    catGym = gym.id;
  });

  afterAll(async () => {
    await prisma.userPreference.deleteMany({ where: { userId } });
    await prisma.location.deleteMany({ where: { id: { in: locIds } } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.category.deleteMany({ where: { id: { in: [catFood, catGym] } } });
    await prisma.$disconnect();
  });

  it("saves questionnaire answers and reads them back", async () => {
    const saved = await saveQuestionnaire({
      userId,
      interestCategoryIds: [catFood],
      budgetMax: 2,
      preferredLocale: "ar",
      dietary: ["halal"],
    });
    expect(saved.interestCategoryIds).toEqual([catFood]);
    const got = await getPreferences(userId);
    expect(got?.budgetMax).toBe(2);
    expect(got?.preferredLocale).toBe("ar");
    expect(got?.dietary).toEqual(["halal"]);
  });

  it("upserts on a second save (editable from settings)", async () => {
    await saveQuestionnaire({ userId, interestCategoryIds: [catFood, catGym], budgetMax: 4 });
    const got = await getPreferences(userId);
    expect(got?.interestCategoryIds.sort()).toEqual([catFood, catGym].sort());
    expect(got?.budgetMax).toBe(4);
  });

  it("returns null preferences for a user who never answered", async () => {
    const other = await prisma.user.create({
      data: { email: `pref-none-${Date.now()}@e.com`, displayName: "None", role: "USER" },
    });
    expect(await getPreferences(other.id)).toBeNull();
    await prisma.user.delete({ where: { id: other.id } });
  });

  it("recommends published locations in interest categories, ranked by rating", async () => {
    await makeLocation("Cheap Eats", catFood, { price: 1, rating: 3.0 });
    await makeLocation("Top Bistro", catFood, { price: 2, rating: 4.8 });
    await saveQuestionnaire({ userId, interestCategoryIds: [catFood], budgetMax: 4 });
    const recs = await recommendForUser(userId, 10);
    expect(recs.length).toBeGreaterThanOrEqual(2);
    expect(recs.every((r) => r.primaryCategoryId === catFood)).toBe(true);
    // Higher-rated first.
    expect(recs[0].name).toBe("Top Bistro");
  });

  it("excludes locations above the user's budget", async () => {
    await saveQuestionnaire({ userId, interestCategoryIds: [catFood], budgetMax: 1 });
    const recs = await recommendForUser(userId, 10);
    expect(recs.some((r) => r.name === "Top Bistro")).toBe(false); // price 2 > budget 1
    expect(recs.some((r) => r.name === "Cheap Eats")).toBe(true);
  });

  it("excludes non-PUBLISHED locations", async () => {
    await makeLocation("Draft Diner", catFood, { price: 1, rating: 5.0, status: "DRAFT" });
    await saveQuestionnaire({ userId, interestCategoryIds: [catFood], budgetMax: 4 });
    const recs = await recommendForUser(userId, 10);
    expect(recs.some((r) => r.name === "Draft Diner")).toBe(false);
  });

  it("falls back to top-rated published locations when the user has no preferences", async () => {
    const cold = await prisma.user.create({
      data: { email: `pref-cold-${Date.now()}@e.com`, displayName: "Cold", role: "USER" },
    });
    const recs = await recommendForUser(cold.id, 5);
    expect(recs.length).toBeGreaterThan(0);
    // Ordered by rating desc — Top Bistro (4.8) outranks Cheap Eats (3.0).
    const names = recs.map((r) => r.name);
    expect(names.indexOf("Top Bistro")).toBeLessThan(names.indexOf("Cheap Eats"));
    await prisma.user.delete({ where: { id: cold.id } });
  });
});
