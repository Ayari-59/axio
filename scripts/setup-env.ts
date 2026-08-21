/**
 * Dérive les deux endpoints Neon à partir d'une seule chaîne de connexion.
 *
 * Neon expose la même base par deux portes qui ne diffèrent que par « -pooler » dans le
 * nom d'hôte : l'une passe par le pooler (utilisée par l'application), l'autre attaque
 * PostgreSQL directement (exigée par la CLI Prisma, qui fait des opérations de schéma).
 * La console n'affiche pas toujours les deux : ce script complète celle qui manque.
 *
 *   npx tsx scripts/setup-env.ts          → complète .env à partir de ce qu'il contient
 *   npx tsx scripts/setup-env.ts "<url>"  → écrit les deux à partir d'une chaîne fournie
 *
 * Le mot de passe n'est jamais affiché.
 */

import { readFileSync, writeFileSync } from "node:fs";

const ENV_PATH = ".env";

function readEnv(): Map<string, string> {
  const entries = new Map<string, string>();
  for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
    if (!line.includes("=") || line.trim().startsWith("#")) continue;
    const index = line.indexOf("=");
    entries.set(line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^"|"$/g, ""));
  }
  return entries;
}

function withPooler(url: string): string {
  const parsed = new URL(url);
  if (parsed.hostname.includes("-pooler")) return url;
  // ep-cool-name-123456.eu-central-1.aws.neon.tech → ep-cool-name-123456-pooler.eu-…
  const [endpoint, ...rest] = parsed.hostname.split(".");
  parsed.hostname = [`${endpoint}-pooler`, ...rest].join(".");
  return parsed.toString();
}

function withoutPooler(url: string): string {
  const parsed = new URL(url);
  parsed.hostname = parsed.hostname.replace("-pooler", "");
  return parsed.toString();
}

function mask(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//***@${parsed.host}${parsed.pathname}`;
  } catch {
    return "chaîne illisible";
  }
}

function main() {
  const env = readEnv();
  const source = process.argv[2] ?? env.get("DATABASE_URL") ?? env.get("DIRECT_URL") ?? "";

  if (!source) {
    console.error(
      "Aucune chaîne de connexion trouvée.\n" +
        "Collez celle donnée par Neon dans .env (DATABASE_URL), ou passez-la en argument :\n" +
        '  npx tsx scripts/setup-env.ts "postgresql://…"',
    );
    process.exit(1);
  }

  let parsed: URL;
  try {
    parsed = new URL(source);
  } catch {
    console.error("La chaîne fournie n'est pas une URL valide (attendu : postgresql://user:mdp@hôte/base?sslmode=require).");
    process.exit(1);
    return;
  }

  if (!parsed.protocol.startsWith("postgres")) {
    console.error(`Protocole inattendu : ${parsed.protocol} — une URL PostgreSQL est attendue.`);
    process.exit(1);
  }

  const pooled = withPooler(source);
  const direct = withoutPooler(source);

  let content = readFileSync(ENV_PATH, "utf8");
  content = content.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${pooled}"`);
  content = content.replace(/^DIRECT_URL=.*$/m, `DIRECT_URL="${direct}"`);
  writeFileSync(ENV_PATH, content);

  console.log("Les deux endpoints ont été écrits dans .env :");
  console.log("  DATABASE_URL (application, via le pooler) :", mask(pooled));
  console.log("  DIRECT_URL   (CLI Prisma, direct)         :", mask(direct));
  if (pooled === direct) {
    console.log(
      "\n⚠️  Les deux chaînes sont identiques : l'hôte ne suit pas la convention Neon.\n" +
        "   Vérifiez dans la console laquelle est la connexion « pooled ».",
    );
  }
}

main();
