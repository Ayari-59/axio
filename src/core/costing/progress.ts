import { round2, safeDiv } from "../model/money";
import type { Dataset } from "../model/types";

/**
 * Suivi à l'avancement (docs/07 §7).
 * S'applique à tout objet de coût portant un budget et, si disponible, un avancement physique.
 * Aucune notion sectorielle : « chantier », « mission » ou « opération » ne sont que des libellés.
 */

export type ProgressLine = {
  memberCode: string;
  memberLabel: string;
  contractValue: number;
  budgetTotal: number;
  costIncurred: number;
  revenueBilled: number;
  progressPct: number;
  progressMethod: "physical" | "cost-to-cost" | "none";
  estimateAtCompletion: number;
  estimateToComplete: number;
  marginAtCompletion: number;
  marginAtCompletionRate: number | null;
  budgetedMargin: number;
  budgetedMarginRate: number | null;
  drift: number;
  driftPct: number | null;
  consumptionPct: number | null;
  consumptionGapPts: number | null;
  status: "ok" | "watch" | "critical";
};

export function computeProgress(
  dataset: Dataset,
  dimensionCode: string,
  options: { periodCodes?: string[] } = {},
): ProgressLine[] {
  const periodSet = options.periodCodes ? new Set(options.periodCodes) : null;
  const members = dataset.members.filter((m) => m.dimensionCode === dimensionCode);
  const costs = new Map<string, number>();
  const revenues = new Map<string, number>();

  for (const entry of dataset.entries) {
    if (periodSet && !periodSet.has(entry.periodCode)) continue;
    const member = entry.dims[dimensionCode];
    if (!member) continue;
    if (entry.kind === "COST") costs.set(member, (costs.get(member) ?? 0) + entry.amount);
    if (entry.kind === "REVENUE") revenues.set(member, (revenues.get(member) ?? 0) + entry.amount);
  }

  const lines: ProgressLine[] = [];
  for (const member of members) {
    const attributes = member.attributes ?? {};
    const budgetTotal = numberAttr(attributes.budgetTotal);
    const contractValue = numberAttr(attributes.contractValue) || numberAttr(attributes.revenueTotal);
    if (budgetTotal <= 0 && contractValue <= 0) continue;

    const costIncurred = costs.get(member.code) ?? 0;
    const revenueBilled = revenues.get(member.code) ?? 0;

    const physical = numberAttr(attributes.progress);
    let progressPct: number;
    let progressMethod: ProgressLine["progressMethod"];
    if (physical > 0) {
      progressPct = physical > 1 ? physical : physical * 100;
      progressMethod = "physical";
    } else if (budgetTotal > 0) {
      progressPct = (costIncurred / budgetTotal) * 100;
      progressMethod = "cost-to-cost";
    } else {
      progressPct = 0;
      progressMethod = "none";
    }
    progressPct = Math.min(progressPct, 999);

    const eac = progressPct > 0 ? (costIncurred / progressPct) * 100 : budgetTotal;
    const etc = Math.max(0, eac - costIncurred);
    const marginAtCompletion = contractValue - eac;
    const budgetedMargin = contractValue - budgetTotal;
    const drift = eac - budgetTotal;
    const consumptionPct = budgetTotal > 0 ? (costIncurred / budgetTotal) * 100 : null;
    const consumptionGapPts =
      consumptionPct !== null && progressMethod === "physical" ? consumptionPct - progressPct : null;

    const driftPct = safeDiv(drift, budgetTotal);
    const status: ProgressLine["status"] =
      driftPct !== null && driftPct > 0.05
        ? "critical"
        : (consumptionGapPts ?? 0) > 15 || (driftPct ?? 0) > 0
          ? "watch"
          : "ok";

    lines.push({
      memberCode: member.code,
      memberLabel: member.label,
      contractValue: round2(contractValue),
      budgetTotal: round2(budgetTotal),
      costIncurred: round2(costIncurred),
      revenueBilled: round2(revenueBilled),
      progressPct: round2(progressPct),
      progressMethod,
      estimateAtCompletion: round2(eac),
      estimateToComplete: round2(etc),
      marginAtCompletion: round2(marginAtCompletion),
      marginAtCompletionRate: pct(marginAtCompletion, contractValue),
      budgetedMargin: round2(budgetedMargin),
      budgetedMarginRate: pct(budgetedMargin, contractValue),
      drift: round2(drift),
      driftPct: driftPct === null ? null : round2(driftPct * 100),
      consumptionPct: consumptionPct === null ? null : round2(consumptionPct),
      consumptionGapPts: consumptionGapPts === null ? null : round2(consumptionGapPts),
      status,
    });
  }

  return lines.sort((a, b) => (b.drift ?? 0) - (a.drift ?? 0));
}

function numberAttr(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function pct(numerator: number, denominator: number): number | null {
  const r = safeDiv(numerator, denominator);
  return r === null ? null : round2(r * 100);
}

/** Mesures agrégées exposées aux KPI de projet. */
export function progressMeasures(lines: ProgressLine[]): Record<string, number> {
  if (lines.length === 0) return {};
  const contract = lines.reduce((s, l) => s + l.contractValue, 0);
  const budget = lines.reduce((s, l) => s + l.budgetTotal, 0);
  const incurred = lines.reduce((s, l) => s + l.costIncurred, 0);
  const eac = lines.reduce((s, l) => s + l.estimateAtCompletion, 0);
  const etc = lines.reduce((s, l) => s + l.estimateToComplete, 0);
  return {
    contractValue: round2(contract),
    budgetAtCompletion: round2(budget),
    costIncurred: round2(incurred),
    estimateAtCompletion: round2(eac),
    estimateToComplete: round2(etc),
    marginAtCompletion: round2(contract - eac),
    progressPct: budget > 0 ? round2((incurred / budget) * 100) : 0,
    eacDriftPct: budget > 0 ? round2(((eac - budget) / budget) * 100) : 0,
    consumptionGapPts: round2(
      Math.max(0, ...lines.map((l) => l.consumptionGapPts ?? 0)),
    ),
  };
}
