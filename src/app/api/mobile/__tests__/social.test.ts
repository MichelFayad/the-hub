// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { GET as listReviewsRoute, POST as submitReviewRoute } from "@/app/api/mobile/reviews/route";
import { GET as notificationsRoute } from "@/app/api/mobile/notifications/route";
import { GET as getPrefsRoute, POST as savePrefsRoute } from "@/app/api/mobile/preferences/route";
import { GET as recommendationsRoute } from "@/app/api/mobile/recommendations/route";
import { issueMobileToken } from "@/lib/mobile-auth";
import { createNotification } from "@/services/notifications";

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

describe("mobile reviews/notifications/preferences/recommendations routes", () => {
  beforeAll(async () => {
    const u = await prisma.user.create({
      data: {
        email: `mob-soc-${Date.now()}@e.com`,
        displayName: "Soc",
        role: "USER",
        emailVerified: true,
      },
    });
    userId = u.id;
    token = await issueMobileToken({ sub: userId, role: "USER" });

    const cat = await prisma.category.create({
      data: { slug: `mob-soc-${Date.now()}`, nameEn: "Mobile Social" },
    });
    catId = cat.id;
    const loc = await prisma.location.create({
      data: { name: "Social Spot", primaryCategoryId: catId, status: "PUBLISHED" },
    });
    locId = loc.id;

    await createNotification({ userId, type: "LISTING_APPROVED", title: "hi" });
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.review.deleteMany({ where: { locationId: locId } });
    await prisma.userPreference.deleteMany({ where: { userId } });
    await prisma.location.delete({ where: { id: locId } });
    await prisma.category.delete({ where: { id: catId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("requires auth to submit a review but not to list them", async () => {
    const unauthed = await submitReviewRoute(
      new Request("https://e.com/api/mobile/reviews", {
        method: "POST",
        body: JSON.stringify({ locationId: locId, rating: 5 }),
      }),
    );
    expect(unauthed.status).toBe(401);

    const submitted = await submitReviewRoute(
      authedRequest("https://e.com/api/mobile/reviews", {
        method: "POST",
        body: JSON.stringify({ locationId: locId, rating: 5, text: "Great" }),
      }),
    );
    expect(submitted.status).toBe(201);

    const listed = await listReviewsRoute(
      new Request(`https://e.com/api/mobile/reviews?locationId=${locId}`),
    );
    const body = await listed.json();
    expect(body.reviews).toHaveLength(1);
  });

  it("lists notifications for the authenticated user", async () => {
    const res = await notificationsRoute(authedRequest("https://e.com/api/mobile/notifications"));
    const body = await res.json();
    expect(body.notifications.length).toBeGreaterThanOrEqual(1);
  });

  it("saves and reads the questionnaire", async () => {
    const save = await savePrefsRoute(
      authedRequest("https://e.com/api/mobile/preferences", {
        method: "POST",
        body: JSON.stringify({ interestCategoryIds: [catId], budgetMax: 3 }),
      }),
    );
    expect(save.status).toBe(200);

    const read = await getPrefsRoute(authedRequest("https://e.com/api/mobile/preferences"));
    const body = await read.json();
    expect(body.preferences.interestCategoryIds).toEqual([catId]);
  });

  it("returns recommendations for the authenticated user", async () => {
    const res = await recommendationsRoute(
      authedRequest("https://e.com/api/mobile/recommendations"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.recommendations)).toBe(true);
  });
});
