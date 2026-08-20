import { computeMeasures, previousPeriod, ytdPeriods, type MeasureBag } from "../model/dataset";
import type { SemiVariableSplit } from "../costing/classify";
import { round2 } from "../model/money";
import type { CoreBudget, Dataset, EntryFilter, KpiSpec } from "../model/types";
import { collectMeasures, evaluateAst, parseFormula, type FormulaContext } from "./formula";

/**
 * Moteur KPI (docs/09).
 * Trois états possibles : calculé, donnée manquante, non applicable.
 * L'état « donnée manquante » est volontairement visible : c'est lui qui guide l'utilisateur
 * vers ce qu'il doit importer pour piloter comme son secteur.
 */

export type KpiStatus = "computed" | "missing_data" | "not_applicable";
export type KpiHealth = "ok" | "warning" | "critical" | "neutral";

export type KpiResult = {
  code: string;
  name: string;
  category: string;
  unit: string;
  direction: "UP" | "DOWN";
  definition: string;
  formula: string;
  interpretation: string;
  limits: string;
  value: number | null;
  previous: number | null;
  deltaPct: number | null;
  target: number | null;
  status: KpiStatus;
  health: KpiHealth;
  missingMeasures: string[];
  usedMeasures: { name: string; value: number | null }[];
  trend: { periodCode: string; value: number | null }[];
};

export type KpiComputeOptions = {
  periodCode: string;
  capabilities: string[];
  /** Mesures supplémentaires injectées par les autres moteurs (avancement, concentration…). */
  extraMeasures?: Record<string, number>;
  budget?: CoreBudget | null;
  filter?: EntryFilter;
  trendLength?: number;
  /** Décomposition des charges semi-variables : la MÊME que celle du moteur de coûts. */
  semiVariableSplit?: SemiVariableSplit;
};

/** Les mesures absentes de ces familles valent 0 (la nature n'existe pas), pas « inconnu ». */
function isZeroDefault(name: string): boolean {
  return name.startsWith("cost_") || name.startsWith("revenue_") || name.startsWith("quantity_");
}

export function computeBudgetMeasures(
  budget: CoreBudget | null | undefined,
  periodCodes: string[],
): MeasureBag {
  const bag: MeasureBag = { revenue: 0, costTotal: 0, totalCost: 0, variableCost: 0, fixedCost: 0 };
  if (!budget) return bag;
  const periodSet = new Set(periodCodes);
  for (const line of budget.lines) {
    if (!periodSet.has(line.periodCode)) continue;
    if (line.kind === "REVENUE") {
      bag.revenue += line.amount;
      if (line.natureCode) bag[`revenue_${line.natureCode}`] = (bag[`revenue_${line.natureCode}`] ?? 0) + line.amount;
    } else {
      bag.costTotal += line.amount;
      if (line.behavior === "VARIABLE") bag.variableCost += line.amount;
      else bag.fixedCost += line.amount;
      if (line.natureCode) bag[`cost_${line.natureCode}`] = (bag[`cost_${line.natureCode}`] ?? 0) + line.amount;
    }
  }
  bag.totalCost = bag.costTotal;
  bag.contributionMargin = bag.revenue - bag.variableCost;
  bag.operatingMargin = bag.revenue - bag.costTotal;
  return bag;
}

function makeContext(
  bag: MeasureBag,
  extra: Record<string, number>,
  previousBag: MeasureBag | null,
  ytdBag: MeasureBag | null,
  budgetBag: MeasureBag | null,
  used: Map<string, number | null>,
): FormulaContext {
  const lookup = (source: MeasureBag | null, name: string): number | null => {
    if (!source) return null;
    const value = source[name] ?? extra[name];
    if (value === undefined) return isZeroDefault(name) ? 0 : null;
    return Number.isFinite(value) ? value : null;
  };
  return {
    get(name) {
      const value = lookup(bag, name);
      used.set(name, value);
      return value;
    },
    prev: (name) => lookup(previousBag, name),
    ytd: (name) => lookup(ytdBag, name),
    budget: (name) => lookup(budgetBag, name),
  };
}

export function computeKpis(
  dataset: Dataset,
  specs: KpiSpec[],
  options: KpiComputeOptions,
): KpiResult[] {
  const {
    periodCode,
    capabilities,
    extraMeasures = {},
    budget,
    filter,
    trendLength = 12,
    semiVariableSplit,
  } = options;
  const periods = [...dataset.periods].map((p) => p.code).sort();
  const index = periods.indexOf(periodCode);
  const trendPeriods = index >= 0 ? periods.slice(Math.max(0, index - trendLength + 1), index + 1) : [];

  const bag = computeMeasures(dataset, { periodCodes: [periodCode], filter, semiVariableSplit });
  const previousCode = previousPeriod(dataset, periodCode);
  const previousBag = previousCode
    ? computeMeasures(dataset, { periodCodes: [previousCode], filter, semiVariableSplit })
    : null;
  const ytdBag = computeMeasures(dataset, { periodCodes: ytdPeriods(dataset, periodCode), filter, semiVariableSplit });
  const budgetBag = computeBudgetMeasures(budget, [periodCode]);

  const results: KpiResult[] = [];

  for (const spec of specs) {
    const requires = spec.requires ?? [];
    const capabilityMissing = requires.filter((r) => !capabilities.includes(r));
    if (capabilityMissing.length > 0) {
      results.push(
        baseResult(spec, {
          value: null,
          status: "not_applicable",
          missingMeasures: capabilityMissing,
        }),
      );
      continue;
    }

    let ast;
    try {
      ast = parseFormula(spec.formula);
    } catch {
      results.push(baseResult(spec, { value: null, status: "not_applicable", missingMeasures: [] }));
      continue;
    }

    const used = new Map<string, number | null>();
    const context = makeContext(bag, extraMeasures, previousBag, ytdBag, budgetBag, used);
    const value = evaluateAst(ast, context);

    const referenced = [...collectMeasures(ast)];
    const missing = referenced.filter((name) => {
      if (isZeroDefault(name)) return false;
      const present = bag[name] ?? extraMeasures[name];
      return present === undefined;
    });

    const previousValue = previousBag
      ? evaluateAst(
          ast,
          makeContext(previousBag, extraMeasures, null, null, budgetBag, new Map()),
        )
      : null;

    const trend = trendPeriods.map((code) => {
      const periodBag = computeMeasures(dataset, { periodCodes: [code], filter, semiVariableSplit });
      const periodPrevious = previousPeriod(dataset, code);
      const periodPreviousBag = periodPrevious
        ? computeMeasures(dataset, { periodCodes: [periodPrevious], filter, semiVariableSplit })
        : null;
      const periodBudget = computeBudgetMeasures(budget, [code]);
      return {
        periodCode: code,
        value: evaluateAst(
          ast,
          makeContext(periodBag, extraMeasures, periodPreviousBag, null, periodBudget, new Map()),
        ),
      };
    });

    const status: KpiStatus = value === null && missing.length > 0 ? "missing_data" : "computed";
    const rounded = value === null ? null : round2(value);
    const previousRounded = previousValue === null ? null : round2(previousValue);

    results.push(
      baseResult(spec, {
        value: rounded,
        previous: previousRounded,
        status,
        missingMeasures: missing,
        usedMeasures: [...used.entries()].map(([name, v]) => ({ name, value: v })),
        trend,
      }),
    );
  }

  return results;
}

function baseResult(
  spec: KpiSpec,
  partial: Partial<KpiResult> & { value: number | null; status: KpiStatus },
): KpiResult {
  const value = partial.value;
  const previous = partial.previous ?? null;
  const deltaPct =
    value !== null && previous !== null && previous !== 0
      ? round2(((value - previous) / Math.abs(previous)) * 100)
      : null;

  return {
    code: spec.code,
    name: spec.name,
    category: spec.category,
    unit: spec.unit,
    direction: spec.direction,
    definition: spec.definition,
    formula: spec.formula,
    interpretation: spec.interpretation,
    limits: spec.limits,
    value,
    previous,
    deltaPct,
    target: spec.target ?? null,
    status: partial.status,
    health: evaluateHealth(spec, value),
    missingMeasures: partial.missingMeasures ?? [],
    usedMeasures: partial.usedMeasures ?? [],
    trend: partial.trend ?? [],
  };
}

export function evaluateHealth(spec: KpiSpec, value: number | null): KpiHealth {
  if (value === null) return "neutral";
  const { direction, target, warningThreshold, criticalThreshold } = spec;
  if (target === null || target === undefined) return "neutral";

  if (direction === "UP") {
    if (value >= target) return "ok";
    if (warningThreshold !== null && warningThreshold !== undefined && value >= warningThreshold)
      return "warning";
    if (criticalThreshold !== null && criticalThreshold !== undefined && value < criticalThreshold)
      return "critical";
    return warningThreshold === null || warningThreshold === undefined ? "warning" : "critical";
  }

  if (value <= target) return "ok";
  if (warningThreshold !== null && warningThreshold !== undefined && value <= warningThreshold)
    return "warning";
  if (criticalThreshold !== null && criticalThreshold !== undefined && value > criticalThreshold)
    return "critical";
  return warningThreshold === null || warningThreshold === undefined ? "warning" : "critical";
}
