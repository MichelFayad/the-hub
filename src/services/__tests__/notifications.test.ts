// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  createNotification,
  listNotifications,
  markRead,
} from "@/services/notifications";

let userId: string;
const notifIds: string[] = [];

describe("notification center", () => {
  beforeAll(async () => {
    const u = await prisma.user.create({
      data: { email: `notif-${Date.now()}@e.com`, displayName: "Notif", role: "USER" },
    });
    userId = u.id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("creates a notification, unread by default", async () => {
    const n = await createNotification({
      userId,
      type: "LISTING_APPROVED",
      title: "Your listing was approved",
    });
    notifIds.push(n.id);
    expect(n.readAt).toBeNull();
  });

  it("lists a user's notifications newest first", async () => {
    const n2 = await createNotification({
      userId,
      type: "LISTING_REJECTED",
      title: "Your listing was rejected",
      body: "missing photos",
    });
    notifIds.push(n2.id);
    const list = await listNotifications(userId);
    expect(list[0].id).toBe(n2.id);
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it("filters to unread only", async () => {
    await markRead({ userId, notificationId: notifIds[0] });
    const unread = await listNotifications(userId, { unreadOnly: true });
    expect(unread.some((n) => n.id === notifIds[0])).toBe(false);
  });

  it("marking read is scoped to the owning user", async () => {
    const other = await prisma.user.create({
      data: { email: `notif-other-${Date.now()}@e.com`, displayName: "Other", role: "USER" },
    });
    await expect(
      markRead({ userId: other.id, notificationId: notifIds[1] }),
    ).rejects.toThrow();
    await prisma.user.delete({ where: { id: other.id } });
  });
});
