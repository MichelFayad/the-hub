// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  registerLocation,
  submitClaim,
  approveListing,
  rejectListing,
  approveClaim,
  rejectClaim,
} from "@/services/listings";
import { ForbiddenError } from "@/lib/rbac";

let admin: string;
let owner: string;
let claimant: string;
let catId: string;
const created: string[] = [];

describe("listing lifecycle", () => {
  beforeAll(async () => {
    const a = await prisma.user.create({
      data: { email: `ll-admin-${Date.now()}@e.com`, displayName: "Admin", role: "ADMIN" },
    });
    const o = await prisma.user.create({
      data: { email: `ll-owner-${Date.now()}@e.com`, displayName: "Owner", role: "INDIVIDUAL_LOCATION" },
    });
    const c = await prisma.user.create({
      data: { email: `ll-claim-${Date.now()}@e.com`, displayName: "Claimant", role: "INDIVIDUAL_LOCATION" },
    });
    admin = a.id;
    owner = o.id;
    claimant = c.id;
    const cat = await prisma.category.create({
      data: { slug: `ll-cat-${Date.now()}`, nameEn: "LL Cat" },
    });
    catId = cat.id;
  });

  afterAll(async () => {
    await prisma.adminActionLog.deleteMany({ where: { adminUserId: admin } });
    await prisma.locationClaim.deleteMany({ where: { locationId: { in: created } } });
    await prisma.location.deleteMany({ where: { id: { in: created } } });
    await prisma.category.delete({ where: { id: catId } });
    await prisma.user.deleteMany({ where: { id: { in: [admin, owner, claimant] } } });
    await prisma.$disconnect();
  });

  it("self-registers a listing as PENDING owned by the registrant", async () => {
    const loc = await registerLocation({
      ownerUserId: owner,
      name: "Self Reg Cafe",
      primaryCategoryId: catId,
    });
    created.push(loc.id);
    expect(loc.status).toBe("PENDING");
    expect(loc.ownerUserId).toBe(owner);
    expect(loc.claimed).toBe(true);
  });

  it("publishes a pending listing and writes an audit log", async () => {
    const loc = await registerLocation({
      ownerUserId: owner,
      name: "Approvable",
      primaryCategoryId: catId,
    });
    created.push(loc.id);
    const updated = await approveListing({ adminUserId: admin, locationId: loc.id });
    expect(updated.status).toBe("PUBLISHED");
    const log = await prisma.adminActionLog.findFirst({
      where: { adminUserId: admin, action: "APPROVE_LISTING", targetId: loc.id },
    });
    expect(log).not.toBeNull();
  });

  it("rejects approval from a non-admin actor", async () => {
    const loc = await registerLocation({
      ownerUserId: owner,
      name: "Guarded",
      primaryCategoryId: catId,
    });
    created.push(loc.id);
    await expect(
      approveListing({ adminUserId: owner, locationId: loc.id }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("rejects a listing with a reason recorded in the log", async () => {
    const loc = await registerLocation({
      ownerUserId: owner,
      name: "Rejectable",
      primaryCategoryId: catId,
    });
    created.push(loc.id);
    const updated = await rejectListing({
      adminUserId: admin,
      locationId: loc.id,
      reason: "incomplete info",
    });
    expect(updated.status).toBe("REJECTED");
    const log = await prisma.adminActionLog.findFirst({
      where: { adminUserId: admin, action: "REJECT_LISTING", targetId: loc.id },
    });
    expect(log?.metadata).toMatchObject({ reason: "incomplete info" });
  });

  it("files a claim on an unclaimed listing as PENDING", async () => {
    const loc = await prisma.location.create({
      data: { name: "Unclaimed Spot", primaryCategoryId: catId, status: "PUBLISHED" },
    });
    created.push(loc.id);
    const claim = await submitClaim({ userId: claimant, locationId: loc.id });
    expect(claim.status).toBe("PENDING");
  });

  it("refuses a claim on an already-claimed listing", async () => {
    const loc = await prisma.location.create({
      data: {
        name: "Taken Spot",
        primaryCategoryId: catId,
        status: "PUBLISHED",
        claimed: true,
        ownerUserId: owner,
      },
    });
    created.push(loc.id);
    await expect(
      submitClaim({ userId: claimant, locationId: loc.id }),
    ).rejects.toThrow();
  });

  it("approves a claim, assigning ownership and logging it", async () => {
    const loc = await prisma.location.create({
      data: { name: "To Claim", primaryCategoryId: catId, status: "PUBLISHED" },
    });
    created.push(loc.id);
    const claim = await submitClaim({ userId: claimant, locationId: loc.id });
    const result = await approveClaim({ adminUserId: admin, claimId: claim.id });
    expect(result.status).toBe("APPROVED");
    const updated = await prisma.location.findUnique({ where: { id: loc.id } });
    expect(updated?.ownerUserId).toBe(claimant);
    expect(updated?.claimed).toBe(true);
    const log = await prisma.adminActionLog.findFirst({
      where: { adminUserId: admin, action: "APPROVE_CLAIM", targetId: claim.id },
    });
    expect(log).not.toBeNull();
  });

  it("rejects a claim without changing ownership", async () => {
    const loc = await prisma.location.create({
      data: { name: "No Claim", primaryCategoryId: catId, status: "PUBLISHED" },
    });
    created.push(loc.id);
    const claim = await submitClaim({ userId: claimant, locationId: loc.id });
    const result = await rejectClaim({ adminUserId: admin, claimId: claim.id, reason: "not the owner" });
    expect(result.status).toBe("REJECTED");
    const updated = await prisma.location.findUnique({ where: { id: loc.id } });
    expect(updated?.ownerUserId).toBeNull();
    expect(updated?.claimed).toBe(false);
  });
});
