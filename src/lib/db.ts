import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Client Prisma (Prisma 7 : l'URL vit dans prisma.config.ts, le client reçoit un adaptateur).
 *
 * Développement : SQLite via better-sqlite3 — aucune infrastructure à installer.
 * Production   : remplacer par `PrismaPg` (@prisma/adapter-pg) et `provider = "postgresql"`.
 *                Aucun autre fichier n'est concerné (cf. docs/02 §2.1).
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
