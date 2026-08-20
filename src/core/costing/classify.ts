import type { CoreEntry, Dataset } from "../model/types";
import { round2 } from "../model/money";

/**
 * Classement des charges (docs/07 §2).
 * La décomposition des charges semi-variables utilise la méthode des points extrêmes
 * (Mini-Maxi) par nature de charge, avec repli sur une régression linéaire simple
 * dès que six périodes sont disponibles.
 */

export type SemiVariableSplit = Map<string, { fixed: number; variable: number }>;

export type SemiVariableModel = {
  natureCode: string;
  fixedPerPeriod: number;
  variablePerUnit: number;
  method: "min-max" | "regression" | "fallback";
  points: number;
  r2?: number;
};

type Point = { activity: number; cost: number };

function linearRegression(points: Point[]): { slope: number; intercept: number; r2: number } {
  const n = points.length;
  const meanX = points.reduce((s, p) => s + p.activity, 0) / n;
  const meanY = points.reduce((s, p) => s + p.cost, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.activity - meanX) * (p.cost - meanY);
    den += (p.activity - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  let ssTot = 0;
  let ssRes = 0;
  for (const p of points) {
    const predicted = intercept + slope * p.activity;
    ssTot += (p.cost - meanY) ** 2;
    ssRes += (p.cost - predicted) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  return { slope, intercept, r2 };
}

/**
 * Construit un modèle de décomposition par nature, à partir de l'activité de référence.
 * L'activité est mesurée par le chiffre d'affaires de la période, faute d'inducteur physique
 * commun à tous les modèles économiques (choix documenté, surchargé par `activityByPeriod`).
 */
export function buildSemiVariableModels(
  dataset: Dataset,
  activityByPeriod?: Map<string, number>,
): Map<string, SemiVariableModel> {
  const activity = activityByPeriod ?? defaultActivity(dataset);
  const byNature = new Map<string, Map<string, number>>();

  for (const entry of dataset.entries) {
    if (entry.kind !== "COST" || entry.behavior !== "SEMI_VARIABLE") continue;
    const nature = entry.dims.NATURE ?? "__NO_NATURE__";
    const perPeriod = byNature.get(nature) ?? new Map<string, number>();
    perPeriod.set(entry.periodCode, (perPeriod.get(entry.periodCode) ?? 0) + entry.amount);
    byNature.set(nature, perPeriod);
  }

  const models = new Map<string, SemiVariableModel>();
  for (const [nature, perPeriod] of byNature) {
    const points: Point[] = [];
    for (const [periodCode, cost] of perPeriod) {
      const a = activity.get(periodCode);
      if (a === undefined || a <= 0) continue;
      points.push({ activity: a, cost });
    }

    if (points.length < 2) {
      models.set(nature, {
        natureCode: nature,
        fixedPerPeriod: 0,
        variablePerUnit: 0,
        method: "fallback",
        points: points.length,
      });
      continue;
    }

    if (points.length >= 6) {
      const { slope, intercept, r2 } = linearRegression(points);
      if (slope >= 0 && intercept >= 0) {
        models.set(nature, {
          natureCode: nature,
          fixedPerPeriod: intercept,
          variablePerUnit: slope,
          method: "regression",
          points: points.length,
          r2,
        });
        continue;
      }
    }

    const sorted = [...points].sort((a, b) => a.activity - b.activity);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const spread = max.activity - min.activity;
    if (spread <= 0) {
      models.set(nature, {
        natureCode: nature,
        fixedPerPeriod: min.cost,
        variablePerUnit: 0,
        method: "fallback",
        points: points.length,
      });
      continue;
    }
    const variablePerUnit = (max.cost - min.cost) / spread;
    const fixedPerPeriod = max.cost - variablePerUnit * max.activity;
    models.set(nature, {
      natureCode: nature,
      fixedPerPeriod: Math.max(0, fixedPerPeriod),
      variablePerUnit: Math.max(0, variablePerUnit),
      method: "min-max",
      points: points.length,
    });
  }

  return models;
}

function defaultActivity(dataset: Dataset): Map<string, number> {
  const activity = new Map<string, number>();
  for (const entry of dataset.entries) {
    if (entry.kind !== "REVENUE") continue;
    activity.set(entry.periodCode, (activity.get(entry.periodCode) ?? 0) + entry.amount);
  }
  return activity;
}

/** Répartit chaque écriture semi-variable en part fixe et part variable. */
export function splitSemiVariable(
  dataset: Dataset,
  activityByPeriod?: Map<string, number>,
): { split: SemiVariableSplit; models: Map<string, SemiVariableModel> } {
  const models = buildSemiVariableModels(dataset, activityByPeriod);
  const activity = activityByPeriod ?? defaultActivity(dataset);
  const split: SemiVariableSplit = new Map();

  // Nombre d'écritures semi-variables par (nature, période) pour répartir la part fixe.
  const counts = new Map<string, number>();
  for (const entry of dataset.entries) {
    if (entry.kind !== "COST" || entry.behavior !== "SEMI_VARIABLE") continue;
    const key = `${entry.dims.NATURE ?? "__NO_NATURE__"}|${entry.periodCode}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  for (const entry of dataset.entries) {
    if (entry.kind !== "COST" || entry.behavior !== "SEMI_VARIABLE") continue;
    const nature = entry.dims.NATURE ?? "__NO_NATURE__";
    const model = models.get(nature);
    const periodActivity = activity.get(entry.periodCode) ?? 0;

    if (!model || model.method === "fallback" || periodActivity <= 0) {
      split.set(entry.id, { fixed: entry.amount, variable: 0 });
      continue;
    }

    const count = counts.get(`${nature}|${entry.periodCode}`) ?? 1;
    const fixedShare = Math.min(entry.amount, model.fixedPerPeriod / count);
    const variableShare = entry.amount - fixedShare;
    split.set(entry.id, { fixed: round2(fixedShare), variable: round2(variableShare) });
  }

  return { split, models };
}

/** Comportement effectif d'une écriture, en tenant compte de la décomposition. */
export function effectiveBehavior(
  entry: CoreEntry,
  split?: SemiVariableSplit,
): { fixed: number; variable: number } {
  if (entry.kind !== "COST") return { fixed: 0, variable: 0 };
  if (entry.behavior === "FIXED") return { fixed: entry.amount, variable: 0 };
  if (entry.behavior === "VARIABLE") return { fixed: 0, variable: entry.amount };
  const found = split?.get(entry.id);
  if (found) return found;
  return entry.quantity ? { fixed: 0, variable: entry.amount } : { fixed: entry.amount, variable: 0 };
}
