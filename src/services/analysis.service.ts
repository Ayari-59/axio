import { computeMeasures, sortedPeriods, samePeriodLastYear, type MeasureBag } from "@/core/model/dataset";
import { round2 } from "@/core/model/money";
import type { AllocationRuleSpec, ConfigurationPayload, Dataset, KpiSpec } from "@/core/model/types";
import { emptyConfiguration } from "@/core/model/types";
import { splitSemiVariable } from "@/core/costing/classify";
import { runCosting, type CostingResult } from "@/core/costing/allocate";
import { computeMargins, topMemberShare, type MarginResult } from "@/core/costing/margins";
import { computeProgress, progressMeasures, type ProgressLine } from "@/core/costing/progress";
import { computeKpis, type KpiResult } from "@/core/kpi/engine";
import { computeBreakEven, type BreakEvenResult, type EconomicModel } from "@/core/analytics/simulation";
import { runQualityChecks, type QualityReport } from "@/core/quality/checks";
import { evaluate } from "@/core/rules/engine";
import { allRules } from "@/core/templates";
import type { AlertSpec, Facts } from "@/core/rules/types";
import { emptyDataFacts } from "@/core/rules/types";
import { loadAllocationRules, loadConfiguration, loadDataset, loadKpiSpecs, loadProfile } from "@/lib/repository";
import type { BusinessModelProfile } from "@/core/model/profile";

/**
 * Orchestration du calcul (docs/02 §5).
 * Un seul point d'entrée : cockpit, rapports, copilote et scénarios lisent tous ce snapshot,
 * ce qui garantit qu'ils affichent exactement les mêmes chiffres.
 */

export type RaisedAlert = AlertSpec & { ruleId: string; value: number | null };

export type AnalysisSnapshot = {
  companyId: string;
  periodCode: string;
  periodCodes: string[];
  previousPeriodCode: string | null;
  configuration: ConfigurationPayload;
  profile: BusinessModelProfile;
  dataset: Dataset;
  rules: AllocationRuleSpec[];
  kpiSpecs: KpiSpec[];
  measures: MeasureBag;
  previousMeasures: MeasureBag | null;
  lastYearMeasures: MeasureBag | null;
  ytdMeasures: MeasureBag;
  extraMeasures: Record<string, number>;
  costing: CostingResult;
  margins: Record<string, MarginResult>;
  progress: ProgressLine[];
  progressDimension: string | null;
  kpis: KpiResult[];
  breakEven: BreakEvenResult;
  economicModel: EconomicModel;
  quality: QualityReport;
  alerts: RaisedAlert[];
  recommendations: { code: string; title: string; detail: string; expectedImpact?: string }[];
  metrics: Record<string, number>;
};

export async function buildSnapshot(
  companyId: string,
  requestedPeriod?: string,
): Promise<AnalysisSnapshot> {
  const [dataset, configuration, rules, kpiSpecs, profile] = await Promise.all([
    loadDataset(companyId),
    loadConfiguration(companyId),
    loadAllocationRules(companyId),
    loadKpiSpecs(companyId),
    loadProfile(companyId),
  ]);

  const config = configuration ?? emptyConfiguration();
  const periodCodes = sortedPeriods(dataset);
  const withData = new Set(dataset.entries.map((e) => e.periodCode));
  const defaultPeriod =
    [...periodCodes].reverse().find((code) => withData.has(code)) ??
    periodCodes[periodCodes.length - 1] ??
    "";
  const periodCode = requestedPeriod && periodCodes.includes(requestedPeriod) ? requestedPeriod : defaultPeriod;
  const index = periodCodes.indexOf(periodCode);
  const previousPeriodCode = index > 0 ? periodCodes[index - 1] : null;
  const lastYearCode = samePeriodLastYear(periodCode);

  const { split } = splitSemiVariable(dataset);
  const scope = { periodCodes: [periodCode] };

  const measures = computeMeasures(dataset, { ...scope, semiVariableSplit: split });
  const previousMeasures = previousPeriodCode
    ? computeMeasures(dataset, { periodCodes: [previousPeriodCode], semiVariableSplit: split })
    : null;
  const lastYearMeasures = periodCodes.includes(lastYearCode)
    ? computeMeasures(dataset, { periodCodes: [lastYearCode], semiVariableSplit: split })
    : null;
  const ytdPeriodCodes = periodCodes.filter(
    (code) => code.slice(0, 4) === periodCode.slice(0, 4) && code <= periodCode,
  );
  const ytdMeasures = computeMeasures(dataset, {
    periodCodes: ytdPeriodCodes,
    semiVariableSplit: split,
  });

  const costing = runCosting(dataset, rules, scope);

  const costObjectDimensions = dataset.dimensions.filter((d) => d.isCostObject).map((d) => d.code);
  // Les axes cités par un bloc de classement (par exemple « contribution par collaborateur »)
  // reçoivent aussi une vue de marge, même s'ils ne sont pas des objets de coûts complets.
  const rankedDimensions = config.dashboard.sections
    .flatMap((section) => section.blocks)
    .filter((block): block is Extract<typeof block, { type: "ranking" }> => block.type === "ranking")
    .map((block) => block.dimensionCode)
    .filter((code) => dataset.dimensions.some((d) => d.code === code));
  const marginDimensions = [...new Set([...costObjectDimensions, ...rankedDimensions])];

  const margins: Record<string, MarginResult> = {};
  for (const dimensionCode of marginDimensions) {
    margins[dimensionCode] = computeMargins(dataset, costing, dimensionCode, {
      periodCodes: [periodCode],
      split,
    });
  }

  const progressDimension =
    config.capabilities.includes("progress_tracking") && costObjectDimensions.includes("PROJECT")
      ? "PROJECT"
      : null;
  const progress = progressDimension ? computeProgress(dataset, progressDimension) : [];

  const extraMeasures: Record<string, number> = { ...progressMeasures(progress) };
  for (const [dimensionCode, result] of Object.entries(margins)) {
    extraMeasures[`topShare_${dimensionCode}`] = topMemberShare(result);
  }

  const activeBudget =
    dataset.budgets.find((b) => b.kind === "BUDGET" && b.status === "APPROVED") ??
    dataset.budgets.find((b) => b.kind === "BUDGET") ??
    null;

  const kpis = computeKpis(dataset, kpiSpecs, {
    periodCode,
    capabilities: config.capabilities,
    extraMeasures,
    budget: activeBudget,
    semiVariableSplit: split,
  });

  const economicModel: EconomicModel = {
    revenue: measures.revenue ?? 0,
    variableCost: measures.variableCost ?? 0,
    fixedCost: measures.fixedCost ?? 0,
    payroll: measures.cost_PAYROLL ?? 0,
    subcontracting: measures.cost_SUBCONTRACTING ?? 0,
    purchases: (measures.cost_PURCHASE ?? 0) + (measures.cost_MATERIAL ?? 0),
    quantity: measures.revenueQuantity ?? 0,
    headcount: measures.driver_FTE ?? measures.driver_HEADCOUNT ?? 0,
  };
  const breakEven = computeBreakEven(economicModel);

  const quality = runQualityChecks(dataset, { requiredDrivers: config.requiredDrivers });

  const metrics = buildMetrics({
    measures,
    previousMeasures,
    margins,
    breakEven,
    extraMeasures,
    kpis,
    costObjectDimensions,
    budgetMeasures: activeBudget ? computeBudgetTotals(activeBudget, periodCode) : null,
  });

  const facts: Facts = {
    profile: {
      ...profile,
      industry: "",
      country: "",
      currency: dataset.currency,
    },
    data: { ...emptyDataFacts(), hasEntries: dataset.entries.length > 0 },
    metrics,
    config: { capabilities: config.capabilities },
  };

  const alertEvaluation = evaluate(allRules(), facts, "alert");
  const alerts: RaisedAlert[] = alertEvaluation.effects
    .filter((f) => f.effect.type === "raise_alert")
    .map((f) => {
      const spec = (f.effect as { type: "raise_alert"; value: AlertSpec }).value;
      const value = spec.factRef ? readMetric(metrics, spec.factRef) : null;
      return { ...spec, ruleId: f.ruleId, value };
    });

  const recommendationEvaluation = evaluate(allRules(), facts, "recommendation");
  const recommendations = recommendationEvaluation.effects
    .filter((f) => f.effect.type === "recommend")
    .map((f) => (f.effect as { type: "recommend"; value: { code: string; title: string; detail: string; expectedImpact?: string } }).value);

  return {
    companyId,
    periodCode,
    periodCodes,
    previousPeriodCode,
    configuration: config,
    profile,
    dataset,
    rules,
    kpiSpecs,
    measures,
    previousMeasures,
    lastYearMeasures,
    ytdMeasures,
    extraMeasures,
    costing,
    margins,
    progress,
    progressDimension,
    kpis,
    breakEven,
    economicModel,
    quality,
    alerts,
    recommendations,
    metrics,
  };
}

function readMetric(metrics: Record<string, number>, factRef: string): number | null {
  const key = factRef.replace(/^metrics\./, "");
  const value = metrics[key];
  return value === undefined ? null : value;
}

function computeBudgetTotals(budget: { lines: { periodCode: string; kind: string; amount: number }[] }, periodCode: string) {
  let revenue = 0;
  let cost = 0;
  for (const line of budget.lines) {
    if (line.periodCode !== periodCode) continue;
    if (line.kind === "REVENUE") revenue += line.amount;
    else cost += line.amount;
  }
  return { revenue, cost };
}

function buildMetrics(input: {
  measures: MeasureBag;
  previousMeasures: MeasureBag | null;
  margins: Record<string, MarginResult>;
  breakEven: BreakEvenResult;
  extraMeasures: Record<string, number>;
  kpis: KpiResult[];
  costObjectDimensions: string[];
  budgetMeasures: { revenue: number; cost: number } | null;
}): Record<string, number> {
  const {
    measures,
    previousMeasures,
    margins,
    breakEven,
    extraMeasures,
    kpis,
    costObjectDimensions,
    budgetMeasures,
  } = input;

  const growth = (key: string): number => {
    const current = measures[key] ?? 0;
    const previous = previousMeasures?.[key] ?? 0;
    if (previous === 0) return 0;
    return round2(((current - previous) / Math.abs(previous)) * 100);
  };

  // Seuls les objets de coûts comptent : un axe de ressource (collaborateur, machine)
  // ne porte pas de chiffre d'affaires et serait toujours « en perte ».
  const objectsInLoss = Object.entries(margins)
    .filter(([dimensionCode]) => costObjectDimensions.includes(dimensionCode))
    .reduce(
      (count, [, result]) =>
        count + result.lines.filter((l) => l.memberCode !== "__UNASSIGNED__" && l.contributiveMargin < 0).length,
      0,
    );

  const kpiValue = (code: string): number | null => kpis.find((k) => k.code === code)?.value ?? null;

  const metrics: Record<string, number> = {
    revenue: round2(measures.revenue ?? 0),
    costTotal: round2(measures.costTotal ?? 0),
    marginRatePct: round2(measures.contributionMarginRate ?? 0),
    marginRateDeltaPts: round2(
      (measures.contributionMarginRate ?? 0) - (previousMeasures?.contributionMarginRate ?? measures.contributionMarginRate ?? 0),
    ),
    revenueGrowthPct: growth("revenue"),
    costGrowthPct: growth("costTotal"),
    fixedCostSharePct:
      (measures.costTotal ?? 0) > 0 ? round2(((measures.fixedCost ?? 0) / measures.costTotal) * 100) : 0,
    safetyMarginPct: breakEven.safetyMarginRate ?? 0,
    objectsInLoss,
    topClientSharePct: extraMeasures.topShare_CLIENT ?? 0,
    eacDriftPct: extraMeasures.eacDriftPct ?? 0,
    consumptionGapPts: extraMeasures.consumptionGapPts ?? 0,
    utilization: kpiValue("UTILIZATION") ?? 0,
    scrapRate: kpiValue("SCRAP_RATE") ?? 0,
  };

  if (budgetMeasures) {
    metrics.costBudgetVariancePct =
      budgetMeasures.cost > 0
        ? round2((((measures.costTotal ?? 0) - budgetMeasures.cost) / budgetMeasures.cost) * 100)
        : 0;
    metrics.revenueBudgetVariancePct =
      budgetMeasures.revenue > 0
        ? round2((((measures.revenue ?? 0) - budgetMeasures.revenue) / budgetMeasures.revenue) * 100)
        : 0;
  }

  return metrics;
}
