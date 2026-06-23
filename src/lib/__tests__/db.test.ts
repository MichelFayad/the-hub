// @vitest-environment node
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";

describe("database", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("has the PostGIS extension installed", async () => {
    const rows = await prisma.$queryRaw<{ postgis_version: string }[]>`
      SELECT postgis_version() AS postgis_version
    `;
    expect(rows[0].postgis_version).toMatch(/^\d+\.\d+/);
  });

  it("can create and read a User", async () => {
    const email = `t-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: { email, displayName: "Test" },
    });
    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.email).toBe(email);
    expect(found?.role).toBe("END_USER");
    await prisma.user.delete({ where: { id: user.id } });
  });
});
