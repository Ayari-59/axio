import { round2, safeDiv, sum } from "../model/money";
import type { CoreBudget, Dataset, EntryFilter } from "../model/types";
import { matchesFilter } from "../model/dataset";

/**
 * Moteur d'écarts (docs/08 §4).
 * Les décompositions suivent les conventions du contrôle de gestion :
 *  - chiffre d'affaires / marge : écart sur prix + sur volume + sur composition (mix)
 *  - charges directes           : écart sur prix + écart sur quantité
 *  - charges indirectes         : écart sur budget + sur activité + sur rendement (3 écarts)
 * Chaque décomposition est vérifiée par test : la somme des composantes égale l'écart total.
 */

export type VarianceSense = "favorable" | "unfavorable" | "neutral";

export type VarianceLine = {
  key: string;
  label: string;
  kind: "REVENUE" | "COST";
  actual: number;
  budget: number;
  flexibleBudget: number | null;
  forecast: number | null;
  lastYear: number | null;
  variance: number;
  variancePct: number | null;
  sense: VarianceSense;
  contribution: number | null;
};

export type GroupBy = { type: "nature" } | { type: "dimension"; dimensionCode: string } | { type: "kind" };

function groupKey(
  group: GroupBy,
  dims: Record<string, string>,
  natureCode: string | null | undefined,
  kind: string,
): string {
  if (group.type === "nature") return natureCode ?? dims.NATURE ?? "__NONE__";
  if (group.type === "dimension") return dims[group.dimensionCode] ?? "__UNASSIGNED__";
  return kind;
}

export type AggregateOptions = {
  periodCodes?: string[];
  filter?: EntryFilter;
  groupBy: GroupBy;
};

type Bucket = { revenue: number; cost: number; quantity: number };

const emptyBucket = (): Bucket => ({ revenue: 0, cost: 0, quantity: 0 });

export function aggregateActual(dataset: Dataset, options: AggregateOptions): Map<string, Bucket> {
  const periodSet = options.periodCodes ? new Set(options.periodCodes) : null;
  const out = new Map<string, Bucket>();
  for (const entry of dataset.entries) {
    if (periodSet && !periodSet.has(entry.periodCode)) continue;
    if (entry.kind !== "REVENUE" && entry.kind !== "COST") continue;
    if (!matchesFilter(entry, options.filter)) continue;
    const key = groupKey(options.groupBy, entry.dims, entry.dims.NATURE, entry.kind);
    const bucket = out.get(key) ?? emptyBucket();
    if (entry.kind === "REVENUE") bucket.revenue += entry.amount;
    else bucket.cost += entry.amount;
    bucket.quantity += entry.quantity ?? 0;
    out.set(key, bucket);
  }
  return out;
}

export function aggregateBudget(
  budget: CoreBudget | null,
  options: AggregateOptions,
): Map<string, Bucket> {
  const out = new Map<string, Bucket>();
  if (!budget) return out;
  const periodSet = options.periodCodes ? new Set(options.periodCodes) : null;
  for (const line of budget.lines) {
    if (periodSet && !periodSet.has(line.periodCode)) continue;
    const key = groupKey(options.groupBy, line.dims, line.natureCode, line.kind);
    const bucket = out.get(key) ?? emptyBucket();
    if (line.kind === "REVENUE") bucket.revenue += line.amount;
    else bucket.cost += line.amount;
    bucket.quantity += line.quantity ?? 0;
    out.set(key, bucket);
  }
  return out;
}

export type CompareOptions = AggregateOptions & {
  budget: CoreBudget | null;
  forecast?: CoreBudget | null;
  lastYearPeriodCodes?: string[];
  labels?: Map<string, string>;
  /** Ratio d'activité réelle / budgétée pour le budget flexible (1 = pas d'ajustement). */
  activityRatio?: number;
};

export function compare(dataset: Dataset, options: CompareOptions): VarianceLine[] {
  const actual = aggregateActual(dataset, options);
  const budget = aggregateBudget(options.budget, options);
  const forecast = options.forecast ? aggregateBudget(options.forecast, options) : null;
  const lastYear = options.lastYearPeriodCodes
    ? aggregateActual(dataset, { ...options, periodCodes: options.lastYearPeriodCodes })
    : null;

  const keys = new Set<string>([...actual.keys(), ...budget.keys()]);
  const lines: VarianceLine[] = [];

  for (const key of keys) {
    const a = actual.get(key) ?? emptyBucket();
    const b = budget.get(key) ?? emptyBucket();
    const f = forecast?.get(key);
    const ly = lastYear?.get(key);

    for (const kind of ["REVENUE", "COST"] as const) {
      const actualValue = kind === "REVENUE" ? a.revenue : a.cost;
      const budgetValue = kind === "REVENUE" ? b.revenue : b.cost;
      if (actualValue === 0 && budgetValue === 0) continue;

      const variance = actualValue - budgetValue;
      const sense: VarianceSense =
        variance === 0
          ? "neutral"
          : kind === "REVENUE"
            ? variance > 0
              ? "favorable"
              : "unfavorable"
            : variance > 0
              ? "unfavorable"
              : "favorable";

      lines.push({
        key: `${key}|${kind}`,
        label: options.labels?.get(key) ?? key,
        kind,
        actual: round2(actualValue),
        budget: round2(budgetValue),
        flexibleBudget:
          options.activityRatio !== undefined && kind === "COST"
            ? round2(budgetValue * options.activityRatio)
            : null,
        forecast: f ? round2(kind === "REVENUE" ? f.revenue : f.cost) : null,
        lastYear: ly ? round2(kind === "REVENUE" ? ly.revenue : ly.cost) : null,
        variance: round2(variance),
        variancePct: pct(variance, budgetValue),
        sense,
        contribution: null,
      });
    }
  }

  const totalAbs = sum(lines.map((l) => Math.abs(l.variance)));
  for (const line of lines) {
    line.contribution = totalAbs > 0 ? round2((Math.abs(line.variance) / totalAbs) * 100) : null;
  }

  return lines.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
}

// ---------------------------------------------------------------------------
// Décomposition prix / volume / composition
// ---------------------------------------------------------------------------

export type PvmItem = { key: string; label?: string; quantity: number; unitPrice: number };

export type PvmResult = {
  total: number;
  price: number;
  volume: number;
  mix: number;
  budgetTotal: number;
  actualTotal: number;
  averageBudgetPrice: number;
  byItem: {
    key: string;
    label: string;
    price: number;
    volume: number;
    mix: number;
    total: number;
  }[];
};

/**
 * Écart total = Σ Qr·Pr − Σ Qb·Pb
 *   prix   = Σ Qr_i (Pr_i − Pb_i)
 *   volume = (Qr − Qb) × P̄b
 *   mix    = Σ Qr (mixr_i − mixb_i)(Pb_i − P̄b)
 * Identité vérifiée : prix + volume + mix = écart total.
 */
export function decomposePriceVolumeMix(budget: PvmItem[], actual: PvmItem[]): PvmResult {
  const keys = [...new Set([...budget.map((i) => i.key), ...actual.map((i) => i.key)])];
  const bMap = new Map(budget.map((i) => [i.key, i]));
  const aMap = new Map(actual.map((i) => [i.key, i]));

  const qBudget = sum(budget.map((i) => i.quantity));
  const qActual = sum(actual.map((i) => i.quantity));
  const budgetTotal = sum(budget.map((i) => i.quantity * i.unitPrice));
  const actualTotal = sum(actual.map((i) => i.quantity * i.unitPrice));
  const avgBudgetPrice = qBudget > 0 ? budgetTotal / qBudget : 0;

  let price = 0;
  let mix = 0;
  const byItem: PvmResult["byItem"] = [];

  for (const key of keys) {
    const b = bMap.get(key);
    const a = aMap.get(key);
    const qb = b?.quantity ?? 0;
    const qa = a?.quantity ?? 0;
    const pb = b?.unitPrice ?? a?.unitPrice ?? 0;
    const pa = a?.unitPrice ?? pb;

    const itemPrice = qa * (pa - pb);
    const mixBudget = qBudget > 0 ? qb / qBudget : 0;
    const mixActual = qActual > 0 ? qa / qActual : 0;
    const itemMix = qActual * (mixActual - mixBudget) * (pb - avgBudgetPrice);
    const itemVolume = (qActual - qBudget) * mixBudget * avgBudgetPrice;

    price += itemPrice;
    mix += itemMix;

    byItem.push({
      key,
      label: a?.label ?? b?.label ?? key,
      price: round2(itemPrice),
      volume: round2(itemVolume),
      mix: round2(itemMix),
      total: round2(qa * pa - qb * pb),
    });
  }

  const volume = (qActual - qBudget) * avgBudgetPrice;

  return {
    total: round2(actualTotal - budgetTotal),
    price: round2(price),
    volume: round2(volume),
    mix: round2(mix),
    budgetTotal: round2(budgetTotal),
    actualTotal: round2(actualTotal),
    averageBudgetPrice: round2(avgBudgetPrice),
    byItem: byItem.sort((x, y) => Math.abs(y.total) - Math.abs(x.total)),
  };
}

// ---------------------------------------------------------------------------
// Écart sur charges directes
// ---------------------------------------------------------------------------

export type DirectCostVariance = {
  total: number;
  price: number;
  quantity: number;
};

/**
 * Qr·Pr − Qp·Pp = Qr(Pr − Pp) + (Qr − Qp)Pp
 * `Qp` est la quantité préétablie de la production réelle.
 */
export function decomposeDirectCost(input: {
  actualQuantity: number;
  actualPrice: number;
  standardQuantity: number;
  standardPrice: number;
}): DirectCostVariance {
  const { actualQuantity: qr, actualPrice: pr, standardQuantity: qp, standardPrice: pp } = input;
  return {
    total: round2(qr * pr - qp * pp),
    price: round2(qr * (pr - pp)),
    quantity: round2((qr - qp) * pp),
  };
}

// ---------------------------------------------------------------------------
// Écart sur charges indirectes — méthode des trois écarts
// ---------------------------------------------------------------------------

export type ThreeVarianceInput = {
  normalActivity: number; // AN
  budgetedFixed: number; // f
  budgetedVariableUnit: number; // v
  actualActivity: number; // AR
  standardActivity: number; // AP (activité préétablie de la production réelle)
  actualCost: number; // CR
};

export type ThreeVarianceResult = {
  total: number;
  budget: number;
  activity: number;
  yield: number;
  standardUnitCost: number;
  flexibleBudget: number;
  standardCostOfActualActivity: number;
  standardCostOfOutput: number;
};

export function decomposeIndirectCost(input: ThreeVarianceInput): ThreeVarianceResult {
  const {
    normalActivity: an,
    budgetedFixed: f,
    budgetedVariableUnit: v,
    actualActivity: ar,
    standardActivity: ap,
    actualCost: cr,
  } = input;

  const standardUnitCost = an > 0 ? f / an + v : v;
  const flexibleBudget = f + v * ar;
  const standardCostOfActualActivity = standardUnitCost * ar;
  const standardCostOfOutput = standardUnitCost * ap;

  return {
    total: round2(cr - standardCostOfOutput),
    budget: round2(cr - flexibleBudget),
    activity: round2(flexibleBudget - standardCostOfActualActivity),
    yield: round2(standardCostOfActualActivity - standardCostOfOutput),
    standardUnitCost: round2(standardUnitCost),
    flexibleBudget: round2(flexibleBudget),
    standardCostOfActualActivity: round2(standardCostOfActualActivity),
    standardCostOfOutput: round2(standardCostOfOutput),
  };
}

function pct(numerator: number, denominator: number): number | null {
  const r = safeDiv(numerator, denominator === 0 ? null : Math.abs(denominator));
  return r === null ? null : round2(r * 100);
}
