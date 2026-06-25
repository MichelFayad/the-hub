// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  signupToQuestionnaireRate,
  listingClaimRate,
  distinctUserCount,
  searchToViewConversion,
  viewToFavoriteConversion,
  retention30Day,
  getAnalyticsDashboard,
} from "@/services/analytics";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import { ForbiddenError } from "@/lib/rbac";

const DAY_MS = 24 * 60 * 60 * 1000;
// Far ahead of "real" wall-clock time so events logged by other test files
// running in parallel (timestamped at real now()) never fall inside this
// suite's analysis windows — the only way to keep window-based assertions
// exact against a shared, concurrently-written DB.
const FUTURE_NOW = new Date(Date.now() + 400 * DAY_MS);

let admin: string;
let plainUser: string;
const userIds: string[] = [];
const eventIds: string[] = [];

async function logEventAt(userId: string | null, type: string, createdAt: Date) {
  const event = await prisma.interactionEvent.create({ data: { userId, type, createdAt } });
  eventIds.push(event.id);
  return event;
}

describe("analytics dashboard", () => {
  beforeAll(async () => {
    const a = await prisma.user.create({
      data: { email: `an-admin-${Date.now()}@e.com`, displayName: "Admin", role: "ADMIN" },
    });
    const u = await prisma.user.create({
      data: { email: `an-user-${Date.now()}@e.com`, displayName: "User", role: "USER" },
    });
    admin = a.id;
    plainUser = u.id;
    userIds.push(admin, plainUser);
  });

  afterAll(async () => {
    await prisma.interactionEvent.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.adminActionLog.deleteMany({ where: { adminUserId: admin } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("rejects a non-admin actor", async () => {
    await expect(getAnalyticsDashboard(plainUser)).rejects.toThrow(ForbiddenError);
  });

  it("computes signup-to-questionnaire and listing-claim rates as sane ratios", async () => {
    const signupRate = await signupToQuestionnaireRate();
    const claimRate = await listingClaimRate();
    expect(signupRate).toBeGreaterThanOrEqual(0);
    expect(signupRate).toBeLessThanOrEqual(1);
    expect(claimRate).toBeGreaterThanOrEqual(0);
    expect(claimRate).toBeLessThanOrEqual(1);
  });

  it("counts distinct users for an event type in a window, isolated by a far-future clock", async () => {
    const since = new Date(FUTURE_NOW.getTime() - 30 * DAY_MS);
    const u1 = await prisma.user.create({ data: { email: `an-d1-${Date.now()}@e.com`, displayName: "D1", role: "USER" } });
    const u2 = await prisma.user.create({ data: { email: `an-d2-${Date.now()}@e.com`, displayName: "D2", role: "USER" } });
    userIds.push(u1.id, u2.id);
    await logEventAt(u1.id, ANALYTICS_EVENTS.LOGIN, FUTURE_NOW);
    await logEventAt(u2.id, ANALYTICS_EVENTS.LOGIN, FUTURE_NOW);
    await logEventAt(u2.id, ANALYTICS_EVENTS.LOGIN, FUTURE_NOW); // same user twice — still 1 distinct

    const count = await distinctUserCount(ANALYTICS_EVENTS.LOGIN, since);
    expect(count).toBe(2);
  });

  it("computes search-to-view and view-to-favorite conversion in an isolated window", async () => {
    const since = new Date(FUTURE_NOW.getTime() - 30 * DAY_MS);
    const u = await prisma.user.create({ data: { email: `an-conv-${Date.now()}@e.com`, displayName: "Conv", role: "USER" } });
    userIds.push(u.id);

    await logEventAt(u.id, ANALYTICS_EVENTS.SEARCH_PERFORMED, FUTURE_NOW);
    await logEventAt(u.id, ANALYTICS_EVENTS.SEARCH_PERFORMED, FUTURE_NOW);
    await logEventAt(u.id, ANALYTICS_EVENTS.LOCATION_VIEWED, FUTURE_NOW);
    await logEventAt(u.id, ANALYTICS_EVENTS.FAVORITE_ADDED, FUTURE_NOW);

    expect(await searchToViewConversion(since)).toBeCloseTo(0.5);
    expect(await viewToFavoriteConversion(since)).toBeCloseTo(1);
  });

  it("computes 30-day cohort retention", async () => {
    const cohortTime = new Date(FUTURE_NOW.getTime() - 45 * DAY_MS);
    const recentTime = new Date(FUTURE_NOW.getTime() - 10 * DAY_MS);

    const retained = await prisma.user.create({ data: { email: `an-ret-${Date.now()}@e.com`, displayName: "Ret", role: "USER" } });
    const churned = await prisma.user.create({ data: { email: `an-chu-${Date.now()}@e.com`, displayName: "Chu", role: "USER" } });
    userIds.push(retained.id, churned.id);

    await logEventAt(retained.id, ANALYTICS_EVENTS.LOGIN, cohortTime);
    await logEventAt(retained.id, ANALYTICS_EVENTS.LOGIN, recentTime);
    await logEventAt(churned.id, ANALYTICS_EVENTS.LOGIN, cohortTime);

    const rate = await retention30Day(FUTURE_NOW);
    expect(rate).toBeCloseTo(0.5);
  });

  it("bundles every metric into the admin dashboard", async () => {
    const dashboard = await getAnalyticsDashboard(admin, FUTURE_NOW);
    expect(dashboard).toHaveProperty("signupToQuestionnaireRate");
    expect(dashboard).toHaveProperty("listingClaimRate");
    expect(dashboard).toHaveProperty("dau");
    expect(dashboard).toHaveProperty("mau");
    expect(dashboard).toHaveProperty("retention30Day");
    expect(dashboard.boosts).toHaveProperty("individual");
    expect(dashboard.boosts).toHaveProperty("agency");
  });
});
