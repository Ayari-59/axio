import { round2, safeDiv } from "../model/money";
import { memberLabel } from "../model/dataset";
import type { AllocationRuleSpec, Dataset } from "../model/types";
import { runCosting, UNASSIGNED, type CostingOptions } from "./allocate";

/**
 * Comparaison des méthodes d'affectation (docs/07 §5).
 *
 * L'intérêt de l'ABC ne se démontre pas dans l'absolu : il se démontre par différence avec la
 * répartition traditionnelle sur le MÊME jeu de données. C'est cet écart qui révèle le
 * subventionnement croisé — les gros volumes portant le coût des petites séries.
 */

export const ACTIVITY_DIMENSION = "ACTIVITY";

/** Une règle appartient au dispositif ABC si elle alimente ou vide l'axe des activités. */
export function isActivityRule(rule: AllocationRuleSpec): boolean {
  return (
    rule.targetDimensionCode === ACTIVITY_DIMENSION || rule.fromDimensionCode === ACTIVITY_DIMENSION
  );
}

/** Le même paramétrage, activités retirées : les centres redescendent directement aux objets. */
export function withoutActivities(rules: AllocationRuleSpec[]): AllocationRuleSpec[] {
  return rules.filter((rule) => !isActivityRule(rule));
}

export function hasActivityRouting(rules: AllocationRuleSpec[]): boolean {
  return rules.some((rule) => rule.active && isActivityRule(rule));
}

export type MethodComparisonLine = {
  memberCode: string;
  memberLabel: string;
  revenue: number;
  directCost: number;
  traditionalIndirect: number;
  abcIndirect: number;
  delta: number;
  deltaPct: number | null;
  traditionalTotal: number;
  abcTotal: number;
  /** Marge opérationnelle selon chaque méthode : c'est là que la décision bascule. */
  traditionalMargin: number;
  abcMargin: number;
  quantity: number | null;
  traditionalUnitCost: number | null;
  abcUnitCost: number | null;
};

export type MethodComparison = {
  dimensionCode: string;
  lines: MethodComparisonLine[];
  /** Somme des écarts en valeur absolue : ampleur du subventionnement croisé. */
  crossSubsidy: number;
  indirectTotal: number;
};

export function compareAllocationMethods(
  dataset: Dataset,
  rules: AllocationRuleSpec[],
  dimensionCode: string,
  options: CostingOptions = {},
): MethodComparison {
  const abc = runCosting(dataset, rules, options);
  const traditional = runCosting(dataset, withoutActivities(rules), options);

  const periodSet = options.periodCodes ? new Set(options.periodCodes) : null;
  const revenue = new Map<string, number>();
  const quantities = new Map<string, number>();
  for (const entry of dataset.entries) {
    if (periodSet && !periodSet.has(entry.periodCode)) continue;
    if (entry.kind !== "REVENUE") continue;
    const key = entry.dims[dimensionCode] ?? UNASSIGNED;
    revenue.set(key, (revenue.get(key) ?? 0) + entry.amount);
    if (entry.quantity) quantities.set(key, (quantities.get(key) ?? 0) + entry.quantity);
  }

  const codes = new Set([
    ...Object.keys(abc.byObject[dimensionCode] ?? {}),
    ...Object.keys(traditional.byObject[dimensionCode] ?? {}),
  ]);

  const lines: MethodComparisonLine[] = [];
  for (const code of codes) {
    const abcBucket = abc.byObject[dimensionCode]?.[code] ?? { direct: 0, indirect: 0 };
    const traditionalBucket = traditional.byObject[dimensionCode]?.[code] ?? { direct: 0, indirect: 0 };
    const objectRevenue = revenue.get(code) ?? 0;
    const quantity = quantities.get(code) ?? null;

    const traditionalTotal = traditionalBucket.direct + traditionalBucket.indirect;
    const abcTotal = abcBucket.direct + abcBucket.indirect;
    const delta = abcBucket.indirect - traditionalBucket.indirect;

    lines.push({
      memberCode: code,
      memberLabel: code === UNASSIGNED ? "Non affecté" : memberLabel(dataset, dimensionCode, code),
      revenue: round2(objectRevenue),
      directCost: round2(abcBucket.direct),
      traditionalIndirect: round2(traditionalBucket.indirect),
      abcIndirect: round2(abcBucket.indirect),
      delta: round2(delta),
      deltaPct:
        traditionalBucket.indirect === 0
          ? null
          : round2((delta / Math.abs(traditionalBucket.indirect)) * 100),
      traditionalTotal: round2(traditionalTotal),
      abcTotal: round2(abcTotal),
      traditionalMargin: round2(objectRevenue - traditionalTotal),
      abcMargin: round2(objectRevenue - abcTotal),
      quantity,
      traditionalUnitCost: quantity ? round2(traditionalTotal / quantity) : null,
      abcUnitCost: quantity ? round2(abcTotal / quantity) : null,
    });
  }

  lines.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    dimensionCode,
    lines,
    crossSubsidy: round2(lines.reduce((total, line) => total + Math.abs(line.delta), 0) / 2),
    indirectTotal: round2(abc.totals.allocatedIndirect),
  };
}

/** Phrase de synthèse déterministe, servie telle quelle à l'écran et au copilote. */
export function narrateComparison(comparison: MethodComparison, objectLabel: string): string {
  const overcharged = comparison.lines.filter((l) => l.delta < 0 && l.memberCode !== UNASSIGNED);
  const undercharged = comparison.lines.filter((l) => l.delta > 0 && l.memberCode !== UNASSIGNED);

  if (comparison.crossSubsidy < 1) {
    return `Les deux méthodes donnent le même résultat : sur ces données, l'analyse par activités n'apporte rien de plus que la clé unique.`;
  }

  const worst = undercharged[0];
  const best = overcharged[0];
  const share = safeDiv(comparison.crossSubsidy, comparison.indirectTotal);

  const parts = [
    `Les deux méthodes déplacent ${format(comparison.crossSubsidy)} de charges indirectes${
      share === null ? "" : `, soit ${formatPct(share * 100)} du total réparti`
    }.`,
  ];
  if (worst) {
    parts.push(
      `${worst.memberLabel} supporte ${format(Math.abs(worst.delta))} de plus en coûts par activités : la clé unique le sous-évaluait.`,
    );
  }
  if (best) {
    parts.push(`${best.memberLabel} en supporte ${format(Math.abs(best.delta))} de moins : il subventionnait les autres.`);
  }
  return parts.join(" ");
}

function format(value: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} €`;
}

function formatPct(value: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(round2(value))} %`;
}
