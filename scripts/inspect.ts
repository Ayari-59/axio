/**
 * Inspection en ligne de commande du snapshot de calcul.
 * Sert à vérifier, sans passer par l'interface, que le même moteur produit bien
 * des systèmes de pilotage différents selon le profil.
 *
 *   npx tsx scripts/inspect.ts [période]
 */

import { prisma } from "@/lib/db";
import { buildSnapshot } from "@/services/analysis.service";

const period = process.argv[2];

async function main() {
  const companies = await prisma.company.findMany({ orderBy: { name: "asc" } });

  for (const company of companies) {
    const s = await buildSnapshot(company.id, period);
    console.log(`\n=== ${company.name} (${company.industry}) — ${s.periodCode}`);
    console.log("capacités  :", s.configuration.capabilities.join(", ") || "—");
    console.log("axes       :", s.configuration.dimensions.map((d) => `${d.code}=${d.label}`).join(" | "));
    console.log(
      "activité   : CA",
      Math.round(s.measures.revenue),
      "€ | MCV",
      Math.round(s.measures.contributionMargin),
      `€ (${s.measures.contributionMarginRate.toFixed(1)} %)`,
    );
    console.log(
      "coûts      : total",
      Math.round(s.measures.costTotal),
      "| direct",
      Math.round(s.measures.directCost),
      "| indirect",
      Math.round(s.measures.indirectCost),
    );
    console.log(
      "affectation: réparti",
      Math.round(s.costing.totals.allocatedIndirect),
      "| non affecté",
      Math.round(s.costing.totals.unallocatedIndirect),
      "| traces",
      s.costing.allocations.length,
    );
    for (const [dimension, result] of Object.entries(s.margins)) {
      console.log(
        `  marge/${dimension} : CA ${Math.round(result.total.revenue)} | coûts ${Math.round(result.total.totalCost)} | résultat ${Math.round(result.total.operatingMargin)} | ${result.lines.length} membres`,
      );
    }
    console.log("seuil      :", s.breakEven.breakEven, "| marge de sécurité", s.breakEven.safetyMarginRate, "%");
    console.log(
      "KPI OK     :",
      s.kpis.filter((k) => k.status === "computed").map((k) => `${k.code}=${k.value}`).join(", "),
    );
    console.log(
      "KPI absents:",
      s.kpis.filter((k) => k.status !== "computed").map((k) => `${k.code}(${k.status})`).join(", ") || "—",
    );
    console.log("alertes    :", s.alerts.map((a) => a.code).join(", ") || "aucune");
    console.log("qualité    :", s.quality.score, "%", s.quality.issues.map((i) => `${i.code}:${i.count}`).join(", "));
    console.log("cockpit    :", s.configuration.dashboard.sections.map((x) => `${x.title}(${x.blocks.length})`).join(" "));
    if (s.progress.length > 0) {
      console.log(
        "affaires   :",
        s.progress
          .slice(0, 3)
          .map((p) => `${p.memberLabel} ${p.progressPct}% EAC ${Math.round(p.estimateAtCompletion)} dérive ${Math.round(p.drift)}`)
          .join(" | "),
      );
    }
    if (s.costing.warnings.length > 0) console.log("avertissements:", s.costing.warnings.join(" / "));
  }

  await prisma.$disconnect();
}

void main();
