import { round2, safeDiv } from "./money";
import type { CoreEntry, CoreMember, Dataset, EntryFilter } from "./types";

/**
 * Filtrage et mesures canoniques.
 * Le « namespace des mesures » est la seule interface entre les données et les formules
 * de KPI, les règles d'alerte et le copilote (cf. docs/03 §4).
 */

export function matchesFilter(entry: CoreEntry, filter?: EntryFilter): boolean {
  if (!filter) return true;
  if (filter.kinds && !filter.kinds.includes(entry.kind)) return false;
  if (filter.behaviors && !filter.behaviors.includes(entry.behavior)) return false;
  if (filter.traceabilities && !filter.traceabilities.includes(entry.traceability)) return false;
  if (filter.periodCodes && !filter.periodCodes.includes(entry.periodCode)) return false;

  if (filter.accountPrefixes && filter.accountPrefixes.length > 0) {
    const account = entry.accountNumber ?? "";
    if (!filter.accountPrefixes.some((p) => account.startsWith(p))) return false;
  }

  if (filter.natureCodes && filter.natureCodes.length > 0) {
    const nature = entry.dims.NATURE;
    if (!nature || !filter.natureCodes.includes(nature)) return false;
  }

  if (filter.requiresDimensions) {
    for (const code of filter.requiresDimensions) {
      if (!entry.dims[code]) return false;
    }
  }

  if (filter.missingDimensions) {
    for (const code of filter.missingDimensions) {
      if (entry.dims[code]) return false;
    }
  }

  if (filter.dimensionFilters) {
    for (const df of filter.dimensionFilters) {
      const value = entry.dims[df.dimensionCode];
      const hit = value !== undefined && df.memberCodes.includes(value);
      if (df.negate ? hit : !hit) return false;
    }
  }

  return true;
}

export function filterEntries(dataset: Dataset, filter?: EntryFilter): CoreEntry[] {
  if (!filter) return dataset.entries;
  return dataset.entries.filter((e) => matchesFilter(e, filter));
}

export type MeasureBag = Record<string, number>;

export type MeasureOptions = {
  periodCodes?: string[];
  filter?: EntryFilter;
  /** Décomposition des charges semi-variables : id d'écriture → part fixe / part variable. */
  semiVariableSplit?: Map<string, { fixed: number; variable: number }>;
};

const add = (bag: MeasureBag, key: string, value: number): void => {
  bag[key] = (bag[key] ?? 0) + value;
};

/**
 * Calcule toutes les mesures d'un périmètre.
 * Les mesures dynamiques (`cost_<NATURE>`, `revenue_<NATURE>`) sont dérivées des données :
 * ajouter une nature de charge ne demande aucune modification de code.
 */
export function computeMeasures(dataset: Dataset, options: MeasureOptions = {}): MeasureBag {
  const { periodCodes, filter, semiVariableSplit } = options;
  const periodSet = periodCodes ? new Set(periodCodes) : null;
  const bag: MeasureBag = {
    revenue: 0,
    revenueQuantity: 0,
    costTotal: 0,
    variableCost: 0,
    fixedCost: 0,
    semiVariableCost: 0,
    directCost: 0,
    indirectCost: 0,
    cashIn: 0,
    cashOut: 0,
    entryCount: 0,
  };

  for (const entry of dataset.entries) {
    if (periodSet && !periodSet.has(entry.periodCode)) continue;
    if (!matchesFilter(entry, filter)) continue;
    bag.entryCount += 1;

    const nature = entry.dims.NATURE;

    switch (entry.kind) {
      case "REVENUE": {
        bag.revenue += entry.amount;
        bag.revenueQuantity += entry.quantity ?? 0;
        if (nature) add(bag, `revenue_${nature}`, entry.amount);
        break;
      }
      case "COST": {
        bag.costTotal += entry.amount;
        if (entry.traceability === "DIRECT") bag.directCost += entry.amount;
        else bag.indirectCost += entry.amount;

        if (entry.behavior === "VARIABLE") {
          bag.variableCost += entry.amount;
        } else if (entry.behavior === "FIXED") {
          bag.fixedCost += entry.amount;
        } else {
          bag.semiVariableCost += entry.amount;
          const split = semiVariableSplit?.get(entry.id);
          if (split) {
            bag.variableCost += split.variable;
            bag.fixedCost += split.fixed;
          } else if (entry.quantity && entry.quantity !== 0) {
            bag.variableCost += entry.amount;
          } else {
            bag.fixedCost += entry.amount;
          }
        }
        if (nature) add(bag, `cost_${nature}`, entry.amount);
        break;
      }
      case "QUANTITY": {
        if (nature) add(bag, `quantity_${nature}`, entry.quantity ?? entry.amount);
        break;
      }
      case "CASH_IN":
        bag.cashIn += entry.amount;
        break;
      case "CASH_OUT":
        bag.cashOut += entry.amount;
        break;
    }
  }

  // Inducteurs.
  // Un même inducteur peut être saisi sur plusieurs axes (heures par mission ET par
  // collaborateur) : sommer toutes les lignes doublerait le total. On agrège donc par
  // (inducteur, axe) puis on retient UNE ventilation — le total d'un inducteur ne doit
  // jamais dépendre de l'axe utilisé pour le décomposer.
  const dimFilters = filter?.dimensionFilters ?? [];
  const byDriver = new Map<string, Map<string, number>>();

  for (const driver of dataset.drivers) {
    if (periodSet && !periodSet.has(driver.periodCode)) continue;

    const axis = driver.dimensionCode ?? "";
    if (dimFilters.length > 0) {
      const applicable = dimFilters.filter((f) => f.dimensionCode === axis);
      if (applicable.length > 0) {
        const ok = applicable.every((f) => {
          const hit = driver.memberCode ? f.memberCodes.includes(driver.memberCode) : false;
          return f.negate ? !hit : hit;
        });
        if (!ok) continue;
      } else if (axis !== "") {
        // L'inducteur est porté par un autre axe que celui filtré : non rattachable.
        continue;
      }
    }

    const perAxis = byDriver.get(driver.driverCode) ?? new Map<string, number>();
    perAxis.set(axis, (perAxis.get(axis) ?? 0) + driver.value);
    byDriver.set(driver.driverCode, perAxis);
  }

  for (const [driverCode, perAxis] of byDriver) {
    // Priorité à la valeur d'entreprise (sans axe) ; sinon premier axe par ordre alphabétique,
    // choix déterministe et sans effet si les ventilations sont cohérentes.
    const axes = [...perAxis.keys()].sort();
    const chosen = perAxis.has("") ? "" : axes[0];
    add(bag, driverMeasureName(driverCode), perAxis.get(chosen) ?? 0);
  }

  // Mesures dérivées
  bag.totalCost = bag.costTotal;
  bag.contributionMargin = bag.revenue - bag.variableCost;
  bag.grossMargin = bag.revenue - bag.directCost;
  bag.operatingMargin = bag.revenue - bag.costTotal;
  bag.cashNet = bag.cashIn - bag.cashOut;
  bag.contributionMarginRate = (safeDiv(bag.contributionMargin, bag.revenue) ?? 0) * 100;
  bag.operatingMarginRate = (safeDiv(bag.operatingMargin, bag.revenue) ?? 0) * 100;
  bag.grossMarginRate = (safeDiv(bag.grossMargin, bag.revenue) ?? 0) * 100;
  bag.breakEven = bag.contributionMarginRate > 0 ? (bag.fixedCost / bag.contributionMarginRate) * 100 : 0;

  return bag;
}

export function driverMeasureName(driverCode: string): string {
  return `driver_${driverCode}`;
}

/** Liste des mesures « connues » exposées aux formules de KPI, pour la validation. */
export const BASE_MEASURES = [
  "revenue",
  "revenueQuantity",
  "costTotal",
  "totalCost",
  "variableCost",
  "fixedCost",
  "semiVariableCost",
  "directCost",
  "indirectCost",
  "contributionMargin",
  "grossMargin",
  "operatingMargin",
  "contributionMarginRate",
  "grossMarginRate",
  "operatingMarginRate",
  "breakEven",
  "cashIn",
  "cashOut",
  "cashNet",
  "entryCount",
] as const;

export function isKnownMeasure(name: string, bag?: MeasureBag): boolean {
  if ((BASE_MEASURES as readonly string[]).includes(name)) return true;
  if (name.startsWith("driver_")) return true;
  if (name.startsWith("cost_") || name.startsWith("revenue_") || name.startsWith("quantity_")) return true;
  return bag ? name in bag : false;
}

/** Membres d'une dimension, triés par libellé. */
export function membersOf(dataset: Dataset, dimensionCode: string): CoreMember[] {
  return dataset.members
    .filter((m) => m.dimensionCode === dimensionCode)
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
}

export function memberLabel(dataset: Dataset, dimensionCode: string, memberCode: string): string {
  const found = dataset.members.find(
    (m) => m.dimensionCode === dimensionCode && m.code === memberCode,
  );
  return found?.label ?? memberCode;
}

export function dimensionLabel(dataset: Dataset, dimensionCode: string): string {
  return dataset.dimensions.find((d) => d.code === dimensionCode)?.label ?? dimensionCode;
}

/** Périodes triées chronologiquement. */
export function sortedPeriods(dataset: Dataset): string[] {
  return [...dataset.periods].sort((a, b) => a.code.localeCompare(b.code)).map((p) => p.code);
}

export function previousPeriod(dataset: Dataset, periodCode: string): string | null {
  const codes = sortedPeriods(dataset);
  const idx = codes.indexOf(periodCode);
  return idx > 0 ? codes[idx - 1] : null;
}

export function samePeriodLastYear(periodCode: string): string {
  const [year, month] = periodCode.split("-");
  const y = Number(year);
  if (!Number.isFinite(y) || !month) return periodCode;
  return `${y - 1}-${month}`;
}

export function ytdPeriods(dataset: Dataset, periodCode: string): string[] {
  const period = dataset.periods.find((p) => p.code === periodCode);
  if (!period) return [periodCode];
  return dataset.periods
    .filter((p) => p.fiscalYear === period.fiscalYear && p.code <= periodCode)
    .map((p) => p.code);
}

export function roundBag(bag: MeasureBag): MeasureBag {
  const out: MeasureBag = {};
  for (const [key, value] of Object.entries(bag)) out[key] = round2(value);
  return out;
}
