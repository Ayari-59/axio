import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Configuration de la CLI Prisma (Prisma 7 : l'URL ne vit plus dans schema.prisma).
 *
 * La CLI ne charge PAS `.env` toute seule depuis Prisma 7 : sans ce chargement explicite,
 * `prisma db push` échoue sur « Connection url is empty ». On passe par le chargeur intégré
 * de Node — aucune dépendance — et l'absence du fichier est tolérée : en production, les
 * variables viennent de l'hébergeur.
 */
try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // .env absent : les variables sont déjà dans l'environnement.
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  // La CLI (db push, migrate) doit utiliser l'endpoint DIRECT : le pooler Neon
  // ne supporte pas les opérations de schéma.
  datasource: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "" },
  migrations: { seed: "tsx --env-file=.env prisma/seed.ts" },
});
