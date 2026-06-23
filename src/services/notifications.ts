import { prisma } from "@/lib/db";
import type { NotificationType, Prisma } from "@/generated/prisma/client";

// In-app notification center (scope §4.6). Channel: in-app only here —
// push/email need a provider integration and are out of scope for this
// slice. Wired today from listings.ts approval/rejection decisions; new-
// listing-match and review-response triggers are deferred follow-ups.

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  metadata?: Prisma.InputJsonValue;
}

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      metadata: input.metadata ?? {},
    },
  });
}

export async function listNotifications(
  userId: string,
  opts: { unreadOnly?: boolean } = {},
) {
  return prisma.notification.findMany({
    where: { userId, ...(opts.unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: "desc" },
  });
}

/** Mark one notification read; throws if it doesn't belong to userId. */
export async function markRead(args: { userId: string; notificationId: string }) {
  const notif = await prisma.notification.findUnique({
    where: { id: args.notificationId },
  });
  if (!notif || notif.userId !== args.userId) {
    throw new Error("notification not found");
  }
  return prisma.notification.update({
    where: { id: args.notificationId },
    data: { readAt: new Date() },
  });
}
