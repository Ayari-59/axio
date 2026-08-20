import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 : l'URL de la datasource ne vit plus dans schema.prisma.
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: { url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" },
  migrations: { seed: "tsx prisma/seed.ts" },
});
