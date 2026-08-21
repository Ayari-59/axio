/**
 * Test de fumée : parcourt toutes les routes de l'application avec une session valide
 * et vérifie qu'elles répondent 200 sans trace d'erreur de rendu.
 *
 *   npm run dev        (dans un autre terminal)
 *   npx tsx scripts/smoke.ts [http://localhost:3020]
 */

import { SignJWT } from "jose";
import { prisma } from "@/lib/db";

const BASE = process.argv[2] ?? "http://localhost:3020";

async function sessionCookie(): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET manquant");
  const membership = await prisma.membership.findFirst({ include: { user: true } });
  if (!membership) throw new Error("aucun utilisateur : lancez npm run db:seed");

  const token = await new SignJWT({
    userId: membership.userId,
    organizationId: membership.organizationId,
    email: membership.user.email,
    name: membership.user.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));

  return `axio_session=${token}`;
}

async function main() {
  const cookie = await sessionCookie();
  const companies = await prisma.company.findMany({ orderBy: { name: "asc" } });

  const routes: string[] = ["/", "/login", "/register", "/app"];
  for (const company of companies) {
    const base = `/app/${company.id}`;
    routes.push(
      base,
      `${base}?period=2026-03`,
      `${base}/margins`,
      `${base}/costs`,
      `${base}/budgets`,
      `${base}/variances`,
      `${base}/forecast`,
      `${base}/scenarios`,
      `${base}/kpis`,
      `${base}/alerts`,
      `${base}/reports`,
      `${base}/copilot`,
      `${base}/data`,
      `${base}/settings`,
      `${base}/settings/rules`,
      `${base}/settings/activities`,
      `${base}/onboarding`,
      `${base}/onboarding/plan`,
    );

    const costObject = await prisma.dimension.findFirst({ where: { companyId: company.id, isCostObject: true } });
    if (costObject) {
      routes.push(`${base}/objects/${costObject.code}`);
      const member = await prisma.dimensionMember.findFirst({ where: { dimensionId: costObject.id } });
      if (member) routes.push(`${base}/objects/${costObject.code}/${member.code}`);
    }
  }

  let failures = 0;
  for (const route of routes) {
    const started = Date.now();
    const response = await fetch(BASE + route, { headers: { cookie }, redirect: "manual" });
    const redirected = response.status >= 300 && response.status < 400;
    const body = redirected || response.status >= 400 ? "" : await response.text();
    const broken =
      body.includes("Application error") ||
      body.includes("Unhandled Runtime Error") ||
      body.includes("__next_error__");
    // Une redirection est un comportement attendu (page d'accueil, garde d'authentification).
    const ok = (response.status === 200 || redirected) && !broken;
    if (!ok) failures += 1;
    console.log(
      `${ok ? "ok  " : "ÉCHEC"} ${String(response.status).padEnd(3)} ${String(Date.now() - started).padStart(5)} ms  ${route}`,
    );
  }

  console.log(`\n${routes.length - failures}/${routes.length} routes valides`);
  await prisma.$disconnect();
  if (failures > 0) process.exit(1);
}

void main();
