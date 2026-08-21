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
  const client = new PrismaClient({ adapter: new PrismaPg(pool) });
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
}

/**
 * Connexion **paresseuse** : le pool n'est créé qu'à la première requête réelle.
 *
 * Sans cela, importer ce module suffirait à exiger `DATABASE_URL` — et un build
 * (qui collecte les données de pages sans jamais interroger la base) échouerait avec un
 * message opaque au lieu d'une erreur claire à la première requête.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = globalForPrisma.prisma ?? createClient();
    const value = Reflect.get(client as object, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
