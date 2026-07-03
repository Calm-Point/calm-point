import { PrismaClient } from "@prisma/client";

// Single Prisma instance per process (Next.js hot-reload safe).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "@prisma/client";
export * from "./audit";
