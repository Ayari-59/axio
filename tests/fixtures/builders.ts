import type {
  AllocationRuleSpec,
  CoreBudget,
  CoreDimension,
  CoreEntry,
  CoreMember,
  CorePeriod,
  Dataset,
} from "@/core/model/types";
import type { BusinessModelProfile } from "@/core/model/profile";
import { businessModelProfileSchema } from "@/core/model/profile";
import { emptyDataFacts, type Facts } from "@/core/rules/types";

/** Constructeurs de jeux de données pour les tests (aucune base, aucun réseau). */

let counter = 0;
const nextId = () => `e${++counter}`;

export function period(code: string): CorePeriod {
  const [year, month] = code.split("-").map(Number);
  return {
    code,
    start: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
    end: new Date(Date.UTC(year, month, 0)).toISOString(),
    type: "MONTH",
    fiscalYear: year,
    status: "OPEN",
  };
}

export function dimension(
  code: string,
  label: string,
  options: Partial<CoreDimension> = {},
): CoreDimension {
  return {
    code,
    label,
    kind: options.kind ?? "ANALYSIS",
    isCostObject: options.isCostObject ?? false,
    isMandatory: options.isMandatory ?? false,
    hierarchical: options.hierarchical ?? false,
    sortOrder: options.sortOrder ?? 100,
  };
}

export function member(
  dimensionCode: string,
  code: string,
  label = code,
  attributes: Record<string, unknown> = {},
): CoreMember {
  return { dimensionCode, code, label, attributes };
}

export function revenue(
  periodCode: string,
  amount: number,
  dims: Record<string, string> = {},
  extra: Partial<CoreEntry> = {},
): CoreEntry {
  return {
    id: nextId(),
    periodCode,
    date: `${periodCode}-15T00:00:00.000Z`,
    kind: "REVENUE",
    amount,
    quantity: null,
    unitPrice: null,
    unit: null,
    accountNumber: null,
    behavior: "VARIABLE",
    traceability: "DIRECT",
    label: "Vente",
    dims,
    ...extra,
  };
}

export function cost(
  periodCode: string,
  amount: number,
  dims: Record<string, string> = {},
  extra: Partial<CoreEntry> = {},
): CoreEntry {
  return {
    id: nextId(),
    periodCode,
    date: `${periodCode}-15T00:00:00.000Z`,
    kind: "COST",
    amount,
    quantity: null,
    unitPrice: null,
    unit: null,
    accountNumber: null,
    behavior: "VARIABLE",
    traceability: "DIRECT",
    label: "Charge",
    dims,
    ...extra,
  };
}

export function dataset(overrides: Partial<Dataset> = {}): Dataset {
  return {
    companyId: "test",
    currency: "EUR",
    periods: [period("2026-01")],
    dimensions: [dimension("NATURE", "Nature"), dimension("CENTER", "Centre", { kind: "RESPONSIBILITY" })],
    members: [],
    entries: [],
    drivers: [],
    budgets: [],
    ...overrides,
  };
}

export function rule(overrides: Partial<AllocationRuleSpec> & { id: string }): AllocationRuleSpec {
  return {
    name: overrides.id,
    stage: 1,
    sortOrder: 10,
    active: true,
    source: {},
    method: "DIRECT",
    targetDimensionCode: "CENTER",
    ...overrides,
  };
}

export function budget(lines: CoreBudget["lines"], overrides: Partial<CoreBudget> = {}): CoreBudget {
  return {
    id: "b1",
    name: "Budget",
    fiscalYear: 2026,
    kind: "BUDGET",
    scenario: "BASE",
    version: 1,
    status: "APPROVED",
    lines,
    ...overrides,
  };
}

export function profileOf(overrides: Record<string, unknown>): BusinessModelProfile {
  return businessModelProfileSchema.parse(overrides);
}

export function factsOf(
  profile: BusinessModelProfile,
  industry: string,
  data: Partial<Facts["data"]> = {},
): Facts {
  return {
    profile: { ...profile, industry, country: "FR", currency: "EUR" },
    data: { ...emptyDataFacts(), ...data },
  };
}
