import { detectIntent, type Intent } from "@/core/copilot/intents";
import {
  buildCommentary,
  formatEur,
  formatPct,
  formatSignedEur,
  formatSignedPct,
  narrateAttribution,
  narrateKpi,
} from "@/core/copilot/answer";
import { attribute } from "@/core/budget/attribution";
import { simulate, type Lever, type LeverTarget } from "@/core/analytics/simulation";
import { periodLabel } from "@/lib/format";
import { narrate } from "@/lib/ai";
import { buildSnapshot, type AnalysisSnapshot } from "./analysis.service";

/**
 * Copilote outillé (docs/11 §5).
 * Le modèle de langage n'a accès qu'aux sorties des moteurs : il rédige, il ne calcule pas.
 */

export type CopilotTable = {
  columns: string[];
  rows: (string | number)[][];
};

export type CopilotAnswer = {
  intent: Intent;
  question: string;
  text: string;
  provider: "local" | "anthropic";
  verified: boolean;
  table?: CopilotTable;
  sources: string[];
  computation: string[];
  suggestions: string[];
  confidence: "high" | "medium" | "low";
};

export async function ask(
  companyId: string,
  question: string,
  periodCode?: string,
): Promise<CopilotAnswer> {
  const snapshot = await buildSnapshot(companyId, periodCode);
  const detection = detectIntent(question);
  const built = buildAnswer(snapshot, question, detection.intent, detection);

  const narration = await narrate({
    question,
    context: built.context,
    fallback: built.text,
  });

  return {
    intent: detection.intent,
    question,
    text: narration.text,
    provider: narration.provider,
    verified: narration.verified,
    table: built.table,
    sources: built.sources,
    computation: built.computation,
    suggestions: built.suggestions,
    confidence: snapshot.quality.confidence,
  };
}

type BuiltAnswer = {
  text: string;
  context: unknown;
  table?: CopilotTable;
  sources: string[];
  computation: string[];
  suggestions: string[];
};

function buildAnswer(
  snapshot: AnalysisSnapshot,
  question: string,
  intent: Intent,
  detection: ReturnType<typeof detectIntent>,
): BuiltAnswer {
  const label = periodLabel(snapshot.periodCode);
  const sources = [
    `${snapshot.dataset.entries.filter((e) => e.periodCode === snapshot.periodCode).length} écritures sur ${label}`,
    `qualité des données ${snapshot.quality.score} %`,
  ];

  switch (intent) {
    case "measure_value": {
      const measure = detection.measure ?? "revenue";
      const value = snapshot.measures[measure] ?? 0;
      const previous = snapshot.previousMeasures?.[measure] ?? null;
      const delta = previous === null || previous === 0 ? null : ((value - previous) / Math.abs(previous)) * 100;
      return {
        text: `${measureLabel(measure)} s'élève à ${formatEur(value)} sur ${label}${
          delta === null ? "" : `, soit ${formatSignedPct(delta)} par rapport à la période précédente`
        }.`,
        context: { measure, value, previous, deltaPct: delta, period: snapshot.periodCode },
        sources,
        computation: [`${measureLabel(measure)} = somme des écritures de la période`],
        suggestions: ["Pourquoi ma marge baisse ?", "Quels sont mes clients les moins rentables ?"],
      };
    }

    case "explain_variance": {
      const measure = detection.measure ?? "contributionMargin";
      const dimensionCode =
        detection.dimensionHint ?? primaryCostObject(snapshot) ?? snapshot.dataset.dimensions[0]?.code ?? "NATURE";
      const reference = snapshot.previousPeriodCode ? [snapshot.previousPeriodCode] : [];
      if (reference.length === 0) {
        return {
          text: "Je ne dispose pas d'une période antérieure pour expliquer une variation.",
          context: {},
          sources,
          computation: [],
          suggestions: ["Quelle est ma marge ce mois-ci ?"],
        };
      }
      const result = attribute(snapshot.dataset, {
        measure,
        dimensionCode,
        currentPeriods: [snapshot.periodCode],
        referencePeriods: reference,
      });
      return {
        text: narrateAttribution(result, measureLabel(measure)),
        context: result,
        table: {
          columns: [dimensionLabel(snapshot, dimensionCode), "Période", "Référence", "Écart", "Part"],
          rows: result.principal.map((c) => [
            c.memberLabel,
            c.current,
            c.reference,
            c.delta,
            `${c.share} %`,
          ]),
        },
        sources,
        computation: [
          `Écart = ${measureLabel(measure)} (${snapshot.periodCode}) − ${measureLabel(measure)} (${reference[0]})`,
          `Contributeurs classés par |écart| décroissant, cumul jusqu'à 80 %`,
        ],
        suggestions: [
          `Quel ${dimensionLabel(snapshot, dimensionCode).toLowerCase()} est le moins rentable ?`,
          "Quel département dépasse son budget ?",
        ],
      };
    }

    case "rank_objects": {
      const dimensionCode = detection.dimensionHint ?? primaryCostObject(snapshot) ?? "CLIENT";
      const result = snapshot.margins[dimensionCode];
      if (!result) {
        return {
          text: `L'axe ${dimensionCode} n'est pas configuré comme objet de coût : je ne peux pas classer sa rentabilité.`,
          context: {},
          sources,
          computation: [],
          suggestions: ["Quels sont mes objets de coûts ?"],
        };
      }
      const order = detection.order ?? "desc";
      const lines = [...result.lines]
        .filter((l) => l.memberCode !== "__UNASSIGNED__")
        .sort((a, b) =>
          order === "asc" ? a.contributionMargin - b.contributionMargin : b.contributionMargin - a.contributionMargin,
        )
        .slice(0, detection.topN ?? 5);

      const text =
        lines.length === 0
          ? "Aucun élément à classer sur cette période."
          : `${order === "asc" ? "Les moins rentables" : "Les plus rentables"} sur ${label} : ${lines
              .map((l) => `${l.memberLabel} (${formatEur(l.contributionMargin)}, ${formatPct(l.contributionMarginRate)})`)
              .join(", ")}.`;

      return {
        text,
        context: lines,
        table: {
          columns: [dimensionLabel(snapshot, dimensionCode), "CA", "Marge sur CV", "Taux", "Marge contributive"],
          rows: lines.map((l) => [
            l.memberLabel,
            l.revenue,
            l.contributionMargin,
            `${l.contributionMarginRate ?? 0} %`,
            l.contributiveMargin,
          ]),
        },
        sources,
        computation: ["Marge sur coûts variables = CA − coûts variables directs de l'objet"],
        suggestions: ["Pourquoi ma marge baisse ?", "Quel chantier présente le plus grand risque ?"],
      };
    }

    case "check_budget": {
      const budgetKpi = snapshot.kpis.find((k) => k.code === "BUDGET_VARIANCE_PCT");
      const consumption = snapshot.kpis.find((k) => k.code === "BUDGET_CONSUMPTION");
      if (!budgetKpi || budgetKpi.status !== "computed") {
        return {
          text: "Aucun budget n'est disponible pour cette période : importez ou construisez un budget pour obtenir les écarts.",
          context: {},
          sources,
          computation: [],
          suggestions: ["Construire un budget depuis l'historique"],
        };
      }
      return {
        text: `${narrateKpi(budgetKpi)} ${consumption ? narrateKpi(consumption) : ""}`.trim(),
        context: { budgetKpi, consumption },
        sources,
        computation: [budgetKpi.formula, consumption?.formula ?? ""].filter(Boolean),
        suggestions: ["Pourquoi mes charges augmentent ?"],
      };
    }

    case "list_risks": {
      const risky = snapshot.progress.filter((p) => p.status !== "ok").slice(0, 5);
      const alerts = snapshot.alerts.slice(0, 5);
      const text =
        risky.length > 0
          ? `${risky.length} affaire${risky.length > 1 ? "s présentent" : " présente"} un risque : ${risky
              .map((p) => `${p.memberLabel} (dérive ${formatEur(p.drift)}, avancement ${formatPct(p.progressPct)})`)
              .join(", ")}.`
          : alerts.length > 0
            ? `${alerts.length} alerte${alerts.length > 1 ? "s ouvertes" : " ouverte"} : ${alerts.map((a) => a.title).join(", ")}.`
            : "Aucun risque détecté sur la période.";
      return {
        text,
        context: { risky, alerts },
        table:
          risky.length > 0
            ? {
                columns: ["Affaire", "Avancement", "Encouru", "Coût à terminaison", "Dérive"],
                rows: risky.map((p) => [
                  p.memberLabel,
                  `${p.progressPct} %`,
                  p.costIncurred,
                  p.estimateAtCompletion,
                  p.drift,
                ]),
              }
            : undefined,
        sources,
        computation: ["Coût à terminaison = coût encouru / avancement", "Dérive = coût à terminaison − budget"],
        suggestions: ["Prépare-moi l'analyse mensuelle."],
      };
    }

    case "simulate": {
      const levers: Lever[] = (detection.levers ?? []).map((l, index) => ({
        id: `lever-${index}`,
        target: l.target as LeverTarget,
        changeType: l.target === "headcount" ? "abs" : "pct",
        value: l.value,
      }));
      if (levers.length === 0) {
        return {
          text: "Précisez le levier à simuler (par exemple « et si j'augmente mes prix de 5 % ? ») ou utilisez l'écran Scénarios.",
          context: {},
          sources,
          computation: [],
          suggestions: ["Que se passe-t-il si j'augmente mes prix de 5 % ?"],
        };
      }
      const result = simulate(snapshot.economicModel, levers);
      return {
        text: `Avec ce scénario, le chiffre d'affaires passe à ${formatEur(result.after.revenue)} (${formatSignedEur(result.deltas.revenue)}), le résultat à ${formatEur(result.after.result)} (${formatSignedEur(result.deltas.result)}) et le seuil de rentabilité à ${formatEur(result.after.breakEven)}.`,
        context: result,
        sources,
        computation: [
          "Marge sur coûts variables = CA − coûts variables",
          "Seuil de rentabilité = charges fixes / taux de marge sur coûts variables",
        ],
        suggestions: ["Que se passe-t-il si j'embauche deux personnes ?"],
      };
    }

    case "build_report": {
      const attribution = snapshot.previousPeriodCode
        ? attribute(snapshot.dataset, {
            measure: "contributionMargin",
            dimensionCode: primaryCostObject(snapshot) ?? "NATURE",
            currentPeriods: [snapshot.periodCode],
            referencePeriods: [snapshot.previousPeriodCode],
          })
        : null;
      const text = buildCommentary({
        periodLabel: label,
        revenue: snapshot.measures.revenue ?? 0,
        revenueDeltaPct: snapshot.metrics.revenueGrowthPct ?? null,
        marginRate: snapshot.measures.contributionMarginRate ?? null,
        marginRateDeltaPts: snapshot.metrics.marginRateDeltaPts ?? null,
        attribution,
        topAlert: snapshot.alerts[0] ? { title: snapshot.alerts[0].title, message: snapshot.alerts[0].message } : null,
        breakEven: snapshot.breakEven,
      });
      return {
        text,
        context: { measures: snapshot.measures, metrics: snapshot.metrics, attribution, breakEven: snapshot.breakEven },
        sources,
        computation: ["Synthèse construite à partir du snapshot de calcul de la période"],
        suggestions: ["Pourquoi ma marge baisse ?"],
      };
    }

    case "explain_kpi": {
      const kpi =
        snapshot.kpis.find((k) => question.toLowerCase().includes(k.name.toLowerCase().slice(0, 8))) ??
        snapshot.kpis[0];
      if (!kpi) {
        return { text: "Aucun indicateur configuré.", context: {}, sources, computation: [], suggestions: [] };
      }
      return {
        text: `${kpi.name} : ${kpi.definition} Formule : ${kpi.formula}. ${kpi.interpretation} Limite : ${kpi.limits}`,
        context: { kpi: { code: kpi.code, value: kpi.value, target: kpi.target } },
        sources,
        computation: [kpi.formula],
        suggestions: ["Quelle est ma marge ce mois-ci ?"],
      };
    }

    default:
      return {
        text: "Je n'ai pas compris la question. Essayez : « pourquoi ma marge baisse ? », « mes cinq clients les moins rentables », « que se passe-t-il si j'augmente mes prix de 5 % ? ».",
        context: {},
        sources,
        computation: [],
        suggestions: [
          "Quelle est ma marge ce mois-ci ?",
          "Pourquoi ma marge baisse ?",
          "Prépare-moi l'analyse mensuelle.",
        ],
      };
  }
}

function primaryCostObject(snapshot: AnalysisSnapshot): string | null {
  const objects = snapshot.dataset.dimensions.filter((d) => d.isCostObject);
  return objects[0]?.code ?? null;
}

function dimensionLabel(snapshot: AnalysisSnapshot, code: string): string {
  return snapshot.dataset.dimensions.find((d) => d.code === code)?.label ?? code;
}

const MEASURE_LABELS: Record<string, string> = {
  revenue: "Le chiffre d'affaires",
  contributionMargin: "La marge sur coûts variables",
  operatingMargin: "La marge opérationnelle",
  costTotal: "Les charges",
  fixedCost: "Les charges fixes",
  variableCost: "Les charges variables",
  cashNet: "Le flux de trésorerie",
};

function measureLabel(measure: string): string {
  return MEASURE_LABELS[measure] ?? measure;
}
