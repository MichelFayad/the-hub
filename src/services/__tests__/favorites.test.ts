// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  addFavorite,
  removeFavorite,
  listFavorites,
  createList,
  addToList,
  shareList,
  getSharedList,
} from "@/services/favorites";

let userId: string;
let catId: string;
let locA: string;
let locB: string;

describe("favorites and lists", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `fav-${Date.now()}@example.com`, displayName: "Fav" },
    });
    userId = user.id;
    const cat = await prisma.category.create({
      data: { slug: `fav-cat-${Date.now()}`, nameEn: "Fav Cat" },
    });
    catId = cat.id;
    const a = await prisma.location.create({
      data: { name: "Loc A", primaryCategoryId: catId, status: "PUBLISHED" },
    });
    const b = await prisma.location.create({
      data: { name: "Loc B", primaryCategoryId: catId, status: "PUBLISHED" },
    });
    locA = a.id;
    locB = b.id;
  });

  afterAll(async () => {
    await prisma.list.deleteMany({ where: { userId } });
    await prisma.favorite.deleteMany({ where: { userId } });
    await prisma.location.deleteMany({ where: { id: { in: [locA, locB] } } });
    await prisma.category.delete({ where: { id: catId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("adds a favorite idempotently", async () => {
    await addFavorite(userId, locA);
    await addFavorite(userId, locA);
    const favs = await listFavorites(userId);
    expect(favs.filter((f) => f.location.id === locA)).toHaveLength(1);
  });

  it("removes a favorite", async () => {
    await addFavorite(userId, locB);
    await removeFavorite(userId, locB);
    const favs = await listFavorites(userId);
    expect(favs.map((f) => f.location.id)).not.toContain(locB);
  });

  it("creates a list and adds items idempotently", async () => {
    const list = await createList(userId, "Weekend spots");
    await addToList(list.id, locA);
    await addToList(list.id, locA, "great coffee");
    const shared = await shareList(list.id);
    const view = await getSharedList(shared.shareToken!);
    expect(view?.name).toBe("Weekend spots");
    expect(view?.items).toHaveLength(1);
    expect(view?.items[0].location.id).toBe(locA);
  });

  it("shares a list with an unguessable token and exposes it publicly", async () => {
    const list = await createList(userId, "Shareable");
    expect(list.isShared).toBe(false);
    const shared = await shareList(list.id);
    expect(shared.isShared).toBe(true);
    expect(shared.shareToken).toBeTruthy();
    expect(shared.shareToken!.length).toBeGreaterThanOrEqual(20);

    const view = await getSharedList(shared.shareToken!);
    expect(view?.id).toBe(list.id);
  });

  it("returns null for an unknown or unshared token", async () => {
    expect(await getSharedList("nonexistent-token")).toBeNull();
  });
});
