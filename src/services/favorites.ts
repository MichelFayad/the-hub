import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

// Favorites, custom lists, and public view-only share links (scope §4.5).

/** Save a location to a user's favorites. Idempotent on (user, location). */
export function addFavorite(userId: string, locationId: string) {
  return prisma.favorite.upsert({
    where: { userId_locationId: { userId, locationId } },
    create: { userId, locationId },
    update: {},
  });
}

export function removeFavorite(userId: string, locationId: string) {
  return prisma.favorite.deleteMany({ where: { userId, locationId } });
}

/** A user's favorites, newest first, with the saved location. */
export function listFavorites(userId: string) {
  return prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { location: true },
  });
}

export function createList(userId: string, name: string) {
  return prisma.list.create({ data: { userId, name } });
}

/** Add a location to a list. Idempotent on (list, location); updates note. */
export function addToList(listId: string, locationId: string, note?: string) {
  return prisma.listItem.upsert({
    where: { listId_locationId: { listId, locationId } },
    create: { listId, locationId, note },
    update: { note },
  });
}

/** Unguessable, URL-safe token for a public share link. */
function generateShareToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Mark a list shared, minting a share token if it lacks one. */
export async function shareList(listId: string) {
  const list = await prisma.list.findUniqueOrThrow({ where: { id: listId } });
  return prisma.list.update({
    where: { id: listId },
    data: {
      isShared: true,
      shareToken: list.shareToken ?? generateShareToken(),
    },
  });
}

/** Public view-only fetch by share token. Null unless the list is shared. */
export async function getSharedList(shareToken: string) {
  const list = await prisma.list.findUnique({
    where: { shareToken },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: { location: true },
      },
    },
  });
  if (!list || !list.isShared) return null;
  return list;
}
