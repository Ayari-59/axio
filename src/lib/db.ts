import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Client Prisma (Prisma 7 : l'URL vit dans prisma.config.ts, le client reçoit un adaptateur).
 *
 * PostgreSQL (Neon en production comme en développement).
 *
 * Réglages du pool calés sur le comportement de Neon : un compute en veille met environ
 * 7,5 s à se réveiller. Un `connectionTimeoutMillis` trop court provoque des
 * « Connection terminated » au premier accès après une période d'inactivité, et un
 * `idleTimeoutMillis` supérieur à la coupure serveur laisse des sockets mortes dans le pool.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; pool?: Pool };

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL manquante. Copiez .env.example vers .env et renseignez l'URL PostgreSQL (endpoint -pooler pour Neon).",
    );
  }

  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    keepAlive: true,
  });

  // Sans ce listener, une erreur de socket sur un client inactif fait tomber le process.
  pool.on("error", (error) => {
    console.error("[pool postgres] erreur sur un client inactif :", error.message);
  });

  return pool;
}

function createClient(): PrismaClient {
  const pool = globalForPrisma.pool ?? createPool();
  if (process.env.NODE_ENV !== "production") globalForPrisma.pool = pool;
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
