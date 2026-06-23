import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export interface InteractionInput {
  userId?: string;
  type: string;
  metadata?: Prisma.InputJsonValue;
}

export function logInteraction(input: InteractionInput) {
  return prisma.interactionEvent.create({
    data: {
      userId: input.userId ?? null,
      type: input.type,
      metadata: input.metadata ?? {},
    },
  });
}
