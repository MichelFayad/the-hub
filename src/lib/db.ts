// Prisma 7 emits the client into src/generated/prisma (see schema generator)
// and its query compiler connects through a driver adapter rather than a
// built-in engine — so we pass @prisma/adapter-pg with the DATABASE_URL.
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
