import { round2, safeDiv, sum } from "../model/money";
import { memberLabel } from "../model/dataset";
import type { Dataset } from "../model/types";
import { effectiveBehavior, type SemiVariableSplit } from "./classify";
import { UNASSIGNED, UNASSIGNED_LABEL, type CostingResult } from "./allocate";

/**
 * Cascade de marge par objet de coût (docs/07 §4).
 *
 *   CA
 *   − coûts variables directs    = MARGE SUR COÛTS VARIABLES
 *   − coûts fixes directs        = MARGE CONTRIBUTIVE      (décision : arrêter ou continuer ?)
 *   − indirects affectés         = MARGE OPÉRATIONNELLE    (couverture de la structure)
 */

export type MarginLine = {
  dimensionCode: string;
  memberCode: string;
  memberLabel: string;
  revenue: number;
  variableDirectCost: number;
  fixedDirectCost: number;
  directCost: number;
  allocatedIndirect: number;
  totalCost: number;
  contributionMargin: number;
  contributiveMargin: number;
  operatingMargin: number;
  contributionMarginRate: number | null;
  operatingMarginRate: number | null;
  revenueShare: number | null;
  marginShare: number | null;
};

export type MarginResult = {
  dimensionCode: string;
  lines: MarginLine[];
  total: MarginLine;
};

export function computeMargins(
  dataset: Dataset,
  costing: CostingResult,
  dimensionCode: string,
  options: { periodCodes?: string[]; split?: SemiVariableSplit } = {},
): MarginResult {
  const periodSet = options.periodCodes ? new Set(options.periodCodes) : null;
  const buckets = new Map<
    string,
    { revenue: number; variableDirect: number; fixedDirect: number; indirect: number }
  >();

  const ensure = (code: string) => {
    const existing = buckets.get(code);
    if (existing) return existing;
    const created = { revenue: 0, variableDirect: 0, fixedDirect: 0, indirect: 0 };
    buckets.set(code, created);
    return created;
  };

  for (const entry of dataset.entries) {
    if (periodSet && !periodSet.has(entry.periodCode)) continue;
    if (entry.kind === "REVENUE") {
      ensure(entry.dims[dimensionCode] ?? UNASSIGNED).revenue += entry.amount;
      continue;
    }
    if (entry.kind !== "COST" || entry.traceability !== "DIRECT") continue;
    const bucket = ensure(entry.dims[dimensionCode] ?? UNASSIGNED);
    const { fixed, variable } = effectiveBehavior(entry, options.split);
    bucket.variableDirect += variable;
    bucket.fixedDirect += fixed;
  }

  const allocated = costing.byObject[dimensionCode] ?? {};
  for (const [code, value] of Object.entries(allocated)) {
    ensure(code).indirect += value.indirect;
  }

  const lines: MarginLine[] = [];
  for (const [code, bucket] of buckets) {
    const directCost = bucket.variableDirect + bucket.fixedDirect;
    const totalCost = directCost + bucket.indirect;
    const contributionMargin = bucket.revenue - bucket.variableDirect;
    const contributiveMargin = contributionMargin - bucket.fixedDirect;
    const operatingMargin = bucket.revenue - totalCost;
    lines.push({
      dimensionCode,
      memberCode: code,
      memberLabel: code === UNASSIGNED ? UNASSIGNED_LABEL : memberLabel(dataset, dimensionCode, code),
      revenue: round2(bucket.revenue),
      variableDirectCost: round2(bucket.variableDirect),
      fixedDirectCost: round2(bucket.fixedDirect),
      directCost: round2(directCost),
      allocatedIndirect: round2(bucket.indirect),
      totalCost: round2(totalCost),
      contributionMargin: round2(contributionMargin),
      contributiveMargin: round2(contributiveMargin),
      operatingMargin: round2(operatingMargin),
      contributionMarginRate: rate(contributionMargin, bucket.revenue),
      operatingMarginRate: rate(operatingMargin, bucket.revenue),
      revenueShare: null,
      marginShare: null,
    });
  }

  const totalRevenue = sum(lines.map((l) => l.revenue));
  const totalMargin = sum(lines.map((l) => l.contributionMargin));
  for (const line of lines) {
    line.revenueShare = rate(line.revenue, totalRevenue);
    line.marginShare = rate(line.contributionMargin, totalMargin);
  }

  lines.sort((a, b) => b.contributionMargin - a.contributionMargin);

  const total: MarginLine = {
    dimensionCode,
    memberCode: "__TOTAL__",
    memberLabel: "Total",
    revenue: round2(totalRevenue),
    variableDirectCost: round2(sum(lines.map((l) => l.variableDirectCost))),
    fixedDirectCost: round2(sum(lines.map((l) => l.fixedDirectCost))),
    directCost: round2(sum(lines.map((l) => l.directCost))),
    allocatedIndirect: round2(sum(lines.map((l) => l.allocatedIndirect))),
    totalCost: round2(sum(lines.map((l) => l.totalCost))),
    contributionMargin: round2(totalMargin),
    contributiveMargin: round2(sum(lines.map((l) => l.contributiveMargin))),
    operatingMargin: round2(sum(lines.map((l) => l.operatingMargin))),
    contributionMarginRate: rate(totalMargin, totalRevenue),
    operatingMarginRate: rate(sum(lines.map((l) => l.operatingMargin)), totalRevenue),
    revenueShare: 100,
    marginShare: 100,
  };

  return { dimensionCode, lines, total };
}

function rate(numerator: number, denominator: number): number | null {
  const r = safeDiv(numerator, denominator);
  return r === null ? null : round2(r * 100);
}

/** Concentration : part cumulée des n premiers membres (analyse de Pareto). */
export function concentration(result: MarginResult, measure: "revenue" | "contributionMargin" = "revenue") {
  const sorted = [...result.lines]
    .filter((l) => l.memberCode !== UNASSIGNED)
    .sort((a, b) => b[measure] - a[measure]);
  const total = sum(sorted.map((l) => l[measure]));
  let cumulative = 0;
  return sorted.map((line) => {
    cumulative += line[measure];
    return {
      memberCode: line.memberCode,
      memberLabel: line.memberLabel,
      value: line[measure],
      share: rate(line[measure], total) ?? 0,
      cumulativeShare: rate(cumulative, total) ?? 0,
    };
  });
}

/** Part du premier membre — mesure de dépendance (client, produit, chantier…). */
export function topMemberShare(result: MarginResult): number {
  const list = concentration(result, "revenue");
  return list.length > 0 ? list[0].share : 0;
}
