// @vitest-environment node
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { logInteraction } from "@/services/interaction-log";

describe("logInteraction", () => {
  afterAll(async () => {
    await prisma.interactionEvent.deleteMany({ where: { type: "TEST_EVENT" } });
    await prisma.$disconnect();
  });

  it("persists an anonymous interaction event", async () => {
    const event = await logInteraction({
      type: "TEST_EVENT",
      metadata: { query: "ramen" },
    });
    const found = await prisma.interactionEvent.findUnique({
      where: { id: event.id },
    });
    expect(found?.type).toBe("TEST_EVENT");
    expect((found?.metadata as { query: string }).query).toBe("ramen");
    expect(found?.userId).toBeNull();
  });

  it("associates an event with a user when userId is given", async () => {
    const user = await prisma.user.create({
      data: { email: `il-${Date.now()}@example.com`, displayName: "IL" },
    });
    const event = await logInteraction({
      userId: user.id,
      type: "TEST_EVENT",
      metadata: {},
    });
    expect(event.userId).toBe(user.id);
    await prisma.user.delete({ where: { id: user.id } });
  });
});
