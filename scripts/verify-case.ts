/**
 * Vérification du cas d'école « Atelier Lumen » (docs/19-cas-pratique.md).
 *
 * Le parcours guidé annonce des montants que l'apprenant doit pouvoir refaire à la main. Ce
 * script contrôle que l'application les produit bien — par le vrai chemin (base, dataset, règles,
 * moteurs), et non par une reconstruction de test. Si un moteur dérive, le guide ment : il faut
 * que ça casse ici, bruyamment.
 *
 *   npx tsx scripts/verify-case.ts
 */

import { prisma } from "@/lib/db";
import { loadAllocationRules, loadDataset } from "@/lib/repository";
import { buildSnapshot } from "@/services/analysis.service";
import { buildVarianceView } from "@/services/budget.service";
import { compareAllocationMethods } from "@/core/costing/abc";
import { splitSemiVariable } from "@/core/costing/classify";

const PERIOD = "2026-03";
/**
 * Tolérance d'un centime : celle du produit lui-même (docs/07 §3.3). Une répartition au prorata
 * laisse un résidu d'arrondi que le moteur loge dans le dernier bénéficiaire pour conserver la
 * masse ; exiger l'égalité stricte reviendrait à interdire les divisions non exactes.
 */
const TOLERANCE = 0.01 + 1e-9;

let failures = 0;

function check(label: string, actual: number | null | undefined, expected: number) {
  const value = actual ?? Number.NaN;
  const ok = Math.abs(value - expected) <= TOLERANCE;
  if (!ok) failures += 1;
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n);
  console.log(
    `${ok ? "ok   " : "ÉCHEC"} ${label.padEnd(44)} ${fmt(value).padStart(12)}${ok ? "" : `   attendu ${fmt(expected)}`}`,
  );
}

async function main() {
  const company = await prisma.company.findFirst({ where: { name: "Atelier Lumen" } });
  if (!company) throw new Error("Atelier Lumen absente : lancez npm run db:seed");

  const [snapshot, dataset, rules] = await Promise.all([
    buildSnapshot(company.id, PERIOD),
    loadDataset(company.id),
    loadAllocationRules(company.id),
  ]);

  console.log(`\n=== Atelier Lumen — ${snapshot.periodCode} (docs/19-cas-pratique.md)\n`);

  console.log("Étape 1 — cockpit");
  check("chiffre d'affaires", snapshot.measures.revenue, 170_000);
  check("coûts totaux", snapshot.measures.costTotal, 144_000);
  check("résultat d'exploitation", snapshot.measures.revenue - snapshot.measures.costTotal, 26_000);

  console.log("\nÉtape 2 — cascade de marge");
  check("marge sur coûts variables", snapshot.measures.contributionMargin, 83_600);

  console.log("\nÉtapes 3 et 5 — répartition des indirects");
  const comparison = compareAllocationMethods(dataset, rules, "PRODUCT", { periodCodes: [PERIOD] });
  const line = (code: string) => comparison.lines.find((l) => l.memberCode === code);
  const lampe = line("LAMPE_NOVA");
  const lustre = line("LUSTRE_OPUS");

  check("lampe — indirects clé unique", lampe?.traditionalIndirect, 50_000);
  check("lampe — indirects ABC", lampe?.abcIndirect, 33_500);
  check("lampe — coût unitaire ABC", lampe?.abcUnitCost, 93.5);
  check("lampe — marge ABC", lampe?.abcMargin, 26_500);
  check("lustre — indirects clé unique", lustre?.traditionalIndirect, 10_000);
  check("lustre — indirects ABC", lustre?.abcIndirect, 26_500);
  check("lustre — coût unitaire ABC", lustre?.abcUnitCost, 505);
  check("lustre — marge clé unique", lustre?.traditionalMargin, 16_000);
  check("lustre — marge ABC", lustre?.abcMargin, -500);
  check("charges déplacées par l'ABC", comparison.crossSubsidy, 16_500);

  console.log("\nÉtape 7 — écart de chiffre d'affaires");
  const variance = buildVarianceView(dataset, PERIOD, { dimensionCode: "PRODUCT" });
  check("prix moyen budgété", variance.pvm?.averageBudgetPrice, 160);
  check("écart total", variance.pvm?.total, 10_000);
  check("effet prix", variance.pvm?.price, -2_000);
  check("effet volume", variance.pvm?.volume, 16_000);
  check("effet composition", variance.pvm?.mix, -4_000);
  check(
    "identité prix + volume + mix",
    (variance.pvm?.price ?? 0) + (variance.pvm?.volume ?? 0) + (variance.pvm?.mix ?? 0),
    variance.pvm?.total ?? Number.NaN,
  );

  console.log("\nÉtape 6 — décomposition du semi-variable");
  const { models } = splitSemiVariable(dataset);
  const energy = models.get("ENERGY");
  check("énergie — part fixe mensuelle retrouvée", energy?.fixedPerPeriod, 3_000);
  const energyEntry = dataset.entries.find(
    (e) => e.periodCode === PERIOD && e.behavior === "SEMI_VARIABLE" && e.dims.NATURE === "ENERGY",
  );
  check("énergie — coût du mois (3 000 + 4 × 600 h)", energyEntry?.amount, 5_400);
  if (energy && energy.method === "fallback") {
    failures += 1;
    console.log("ÉCHEC la décomposition est retombée sur le repli : aucun modèle n'a été ajusté.");
  }

  console.log(
    `\n${failures === 0 ? "Tous les chiffres du guide sont exacts." : `${failures} écart(s) : le guide et le produit divergent.`}`,
  );
  await prisma.$disconnect();
  if (failures > 0) process.exit(1);
}

void main();
