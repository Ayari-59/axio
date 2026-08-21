import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 : l'URL de la datasource ne vit plus dans schema.prisma.
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  // La CLI (db push, migrate) doit utiliser l'endpoint DIRECT : le pooler Neon
  // ne supporte pas les opérations de schéma.
  datasource: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "" },
  migrations: { seed: "tsx prisma/seed.ts" },
});
