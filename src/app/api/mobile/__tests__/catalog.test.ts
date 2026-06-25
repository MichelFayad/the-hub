// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { GET as searchRoute } from "@/app/api/mobile/locations/search/route";
import { GET as locationRoute } from "@/app/api/mobile/locations/[id]/route";
import { GET as listFavoritesRoute, POST as addFavoriteRoute } from "@/app/api/mobile/favorites/route";
import { DELETE as removeFavoriteRoute } from "@/app/api/mobile/favorites/[locationId]/route";
import { issueMobileToken } from "@/lib/mobile-auth";

let userId: string;
let token: string;
let catId: string;
let locId: string;

function authedRequest(url: string, init: RequestInit = {}) {
  return new Request(url, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${token}` },
  });
}

describe("mobile catalog + favorites routes", () => {
  beforeAll(async () => {
    const u = await prisma.user.create({
      data: { email: `mob-cat-${Date.now()}@e.com`, displayName: "Cat", role: "USER" },
    });
    userId = u.id;
    token = await issueMobileToken({ sub: userId, role: "USER" });

    const cat = await prisma.category.create({
      data: { slug: `mob-cat-${Date.now()}`, nameEn: "Mobile Cat" },
    });
    catId = cat.id;
    const loc = await prisma.location.create({
      data: { name: "Mobile Spot", primaryCategoryId: catId, status: "PUBLISHED" },
    });
    locId = loc.id;
  });

  afterAll(async () => {
    await prisma.favorite.deleteMany({ where: { locationId: locId } });
    await prisma.location.delete({ where: { id: locId } });
    await prisma.category.delete({ where: { id: catId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("searches published locations", async () => {
    const res = await searchRoute(new Request(`https://e.com/api/mobile/locations/search?query=Mobile`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.some((r: { id: string }) => r.id === locId)).toBe(true);
  });

  it("fetches a location profile, 404 on unknown id", async () => {
    const ok = await locationRoute(new Request(`https://e.com/api/mobile/locations/${locId}`), {
      params: Promise.resolve({ id: locId }),
    });
    expect(ok.status).toBe(200);

    const missing = await locationRoute(new Request(`https://e.com/api/mobile/locations/nope`), {
      params: Promise.resolve({ id: "nope" }),
    });
    expect(missing.status).toBe(404);
  });

  it("requires auth to list favorites", async () => {
    const res = await listFavoritesRoute(new Request("https://e.com/api/mobile/favorites"));
    expect(res.status).toBe(401);
  });

  it("adds, lists, then removes a favorite", async () => {
    const add = await addFavoriteRoute(
      authedRequest("https://e.com/api/mobile/favorites", {
        method: "POST",
        body: JSON.stringify({ locationId: locId }),
      }),
    );
    expect(add.status).toBe(201);

    const list = await listFavoritesRoute(authedRequest("https://e.com/api/mobile/favorites"));
    const listed = await list.json();
    expect(listed.favorites.some((f: { locationId: string }) => f.locationId === locId)).toBe(true);

    const remove = await removeFavoriteRoute(
      authedRequest(`https://e.com/api/mobile/favorites/${locId}`, { method: "DELETE" }),
      { params: Promise.resolve({ locationId: locId }) },
    );
    expect(remove.status).toBe(200);
  });
});
