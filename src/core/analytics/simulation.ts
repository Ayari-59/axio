import { round2, safeDiv } from "../model/money";

/**
 * Seuil de rentabilité et simulateur what-if (docs/13 W6).
 * Fonctions pures et sans I/O : le même code tourne côté serveur (enregistrement du scénario)
 * et côté navigateur (aperçu instantané pendant que l'utilisateur bouge les curseurs).
 */

export type EconomicModel = {
  revenue: number;
  variableCost: number;
  fixedCost: number;
  /** Décomposition facultative des charges, pour cibler les leviers. */
  payroll: number;
  subcontracting: number;
  purchases: number;
  quantity: number;
  headcount: number;
};

export type BreakEvenResult = {
  contributionMargin: number;
  contributionMarginRate: number | null;
  breakEven: number | null;
  safetyMargin: number | null;
  safetyMarginRate: number | null;
  operatingLeverage: number | null;
  result: number;
  /** Jour de l'exercice où le point mort est atteint (base 360). */
  breakEvenDay: number | null;
};

export function computeBreakEven(model: EconomicModel): BreakEvenResult {
  const contributionMargin = model.revenue - model.variableCost;
  const rate = safeDiv(contributionMargin, model.revenue);
  const breakEven = rate && rate > 0 ? model.fixedCost / rate : null;
  const result = contributionMargin - model.fixedCost;
  const safetyMargin = breakEven === null ? null : model.revenue - breakEven;
  return {
    contributionMargin: round2(contributionMargin),
    contributionMarginRate: rate === null ? null : round2(rate * 100),
    breakEven: breakEven === null ? null : round2(breakEven),
    safetyMargin: safetyMargin === null ? null : round2(safetyMargin),
    safetyMarginRate:
      safetyMargin === null || model.revenue <= 0 ? null : round2((safetyMargin / model.revenue) * 100),
    operatingLeverage: result === 0 ? null : round2(contributionMargin / result),
    result: round2(result),
    breakEvenDay:
      breakEven === null || model.revenue <= 0 ? null : Math.round((breakEven / model.revenue) * 360),
  };
}

export const LEVER_TARGETS = [
  "price",
  "volume",
  "variableCost",
  "fixedCost",
  "payroll",
  "headcount",
  "subcontracting",
  "purchases",
  "productivity",
  "fxRate",
  "investment",
] as const;
export type LeverTarget = (typeof LEVER_TARGETS)[number];

export const LEVER_LABELS: Record<LeverTarget, string> = {
  price: "Prix de vente",
  volume: "Volume vendu",
  variableCost: "Coûts variables",
  fixedCost: "Charges fixes",
  payroll: "Masse salariale",
  headcount: "Effectif",
  subcontracting: "Sous-traitance",
  purchases: "Achats / matières",
  productivity: "Productivité",
  fxRate: "Taux de change",
  investment: "Investissement",
};

export type Lever = {
  id: string;
  target: LeverTarget;
  /** `pct` = variation en %, `abs` = variation en valeur, `set` = valeur imposée. */
  changeType: "pct" | "abs" | "set";
  value: number;
  /** Paramètres spécifiques : exposition au change, durée d'amortissement… */
  params?: { exposurePct?: number; amortizationYears?: number };
};

export type SimulationResult = {
  before: BreakEvenResult & { revenue: number; variableCost: number; fixedCost: number };
  after: BreakEvenResult & { revenue: number; variableCost: number; fixedCost: number };
  deltas: {
    revenue: number;
    contributionMargin: number;
    result: number;
    breakEven: number | null;
    cashImpact: number;
  };
  model: EconomicModel;
  notes: string[];
};

export function applyLevers(model: EconomicModel, levers: Lever[]): { model: EconomicModel; notes: string[] } {
  const next: EconomicModel = { ...model };
  const notes: string[] = [];

  const factor = (lever: Lever, current: number): number => {
    if (lever.changeType === "pct") return current * (1 + lever.value / 100);
    if (lever.changeType === "abs") return current + lever.value;
    return lever.value;
  };

  for (const lever of levers) {
    switch (lever.target) {
      case "price": {
        // Un effet prix ne touche que le chiffre d'affaires, jamais les coûts unitaires.
        next.revenue = factor(lever, next.revenue);
        break;
      }
      case "volume": {
        const ratio = next.revenue === 0 ? 1 : factor(lever, next.revenue) / next.revenue;
        next.revenue *= ratio;
        next.variableCost *= ratio;
        next.quantity *= ratio;
        break;
      }
      case "variableCost":
        next.variableCost = factor(lever, next.variableCost);
        break;
      case "fixedCost":
        next.fixedCost = factor(lever, next.fixedCost);
        break;
      case "payroll": {
        const updated = factor(lever, next.payroll);
        next.fixedCost += updated - next.payroll;
        next.payroll = updated;
        break;
      }
      case "headcount": {
        const costPerHead = next.headcount > 0 ? next.payroll / next.headcount : 0;
        const updated = factor(lever, next.headcount);
        const delta = (updated - next.headcount) * costPerHead;
        next.headcount = updated;
        next.payroll += delta;
        next.fixedCost += delta;
        if (costPerHead === 0) {
          notes.push(
            "Effectif modifié sans coût moyen connu : importez la masse salariale et l'effectif pour chiffrer ce levier.",
          );
        }
        break;
      }
      case "subcontracting": {
        const updated = factor(lever, next.subcontracting);
        next.variableCost += updated - next.subcontracting;
        next.subcontracting = updated;
        break;
      }
      case "purchases": {
        const updated = factor(lever, next.purchases);
        next.variableCost += updated - next.purchases;
        next.purchases = updated;
        break;
      }
      case "productivity": {
        // +x % de productivité = même production avec (1/(1+x)) de ressources variables.
        const gain = lever.changeType === "pct" ? lever.value / 100 : 0;
        if (gain !== 0) next.variableCost = next.variableCost / (1 + gain);
        else notes.push("Le levier de productivité s'exprime en pourcentage.");
        break;
      }
      case "fxRate": {
        const exposure = (lever.params?.exposurePct ?? 0) / 100;
        if (exposure === 0) {
          notes.push(
            "Taux de change : renseignez la part du chiffre d'affaires exposée pour que le levier ait un effet.",
          );
          break;
        }
        const variation = lever.value / 100;
        next.revenue += next.revenue * exposure * variation;
        break;
      }
      case "investment": {
        const years = lever.params?.amortizationYears ?? 5;
        const annual = lever.value / years;
        next.fixedCost += annual;
        notes.push(
          `Investissement de ${round2(lever.value)} € amorti sur ${years} ans : +${round2(annual)} € de charges fixes annuelles.`,
        );
        break;
      }
    }
  }

  return { model: next, notes };
}

export function simulate(model: EconomicModel, levers: Lever[]): SimulationResult {
  const before = computeBreakEven(model);
  const { model: after, notes } = applyLevers(model, levers);
  const afterResult = computeBreakEven(after);

  return {
    before: { ...before, revenue: round2(model.revenue), variableCost: round2(model.variableCost), fixedCost: round2(model.fixedCost) },
    after: { ...afterResult, revenue: round2(after.revenue), variableCost: round2(after.variableCost), fixedCost: round2(after.fixedCost) },
    deltas: {
      revenue: round2(after.revenue - model.revenue),
      contributionMargin: round2(afterResult.contributionMargin - before.contributionMargin),
      result: round2(afterResult.result - before.result),
      breakEven:
        afterResult.breakEven === null || before.breakEven === null
          ? null
          : round2(afterResult.breakEven - before.breakEven),
      cashImpact: round2(afterResult.result - before.result),
    },
    model: after,
    notes,
  };
}

/** Volume de vente supplémentaire nécessaire pour compenser une baisse de prix. */
export function priceVolumeTradeOff(model: EconomicModel, pricePct: number): number | null {
  const rate = safeDiv(model.revenue - model.variableCost, model.revenue);
  if (rate === null || rate === 0) return null;
  const newRate = rate + pricePct / 100;
  if (newRate <= 0) return null;
  return round2((rate / newRate - 1) * 100);
}
