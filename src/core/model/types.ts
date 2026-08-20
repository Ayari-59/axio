import type {
  AllocationMethod,
  BudgetKind,
  BudgetScenario,
  Capability,
  CostBehavior,
  CostMethod,
  DimensionKind,
  EntryKind,
  KpiCategory,
  KpiUnit,
  Traceability,
} from "./enums";

/**
 * Types du cœur. Ils sont volontairement détachés de Prisma : les moteurs reçoivent
 * un `Dataset` en mémoire, ce qui les rend testables sans base et exécutables côté client.
 */

export type CorePeriod = {
  code: string; // "2026-03"
  start: string; // ISO
  end: string; // ISO
  type: "MONTH" | "QUARTER" | "YEAR";
  fiscalYear: number;
  status: "OPEN" | "CLOSED";
};

export type CoreDimension = {
  code: string;
  label: string;
  kind: DimensionKind;
  isCostObject: boolean;
  isMandatory: boolean;
  hierarchical: boolean;
  sortOrder: number;
};

export type CoreMember = {
  dimensionCode: string;
  code: string;
  label: string;
  parentCode?: string | null;
  attributes: Record<string, unknown>;
};

export type CoreEntry = {
  id: string;
  periodCode: string;
  date: string;
  kind: EntryKind;
  amount: number;
  quantity?: number | null;
  unitPrice?: number | null;
  unit?: string | null;
  accountNumber?: string | null;
  behavior: CostBehavior;
  traceability: Traceability;
  label: string;
  /** Ventilation : { CLIENT: "FONCIA", PROJECT: "ALBA", NATURE: "SUBCONTRACTING" } */
  dims: Record<string, string>;
};

export type CoreDriverValue = {
  periodCode: string;
  driverCode: string;
  dimensionCode?: string | null;
  memberCode?: string | null;
  value: number;
  unit?: string;
};

export type CoreBudgetLine = {
  periodCode: string;
  kind: Extract<EntryKind, "REVENUE" | "COST">;
  natureCode?: string | null;
  behavior: CostBehavior;
  dims: Record<string, string>;
  quantity?: number | null;
  unitPrice?: number | null;
  amount: number;
  label?: string;
};

export type CoreBudget = {
  id: string;
  name: string;
  fiscalYear: number;
  kind: BudgetKind;
  scenario: BudgetScenario;
  version: number;
  status: string;
  lines: CoreBudgetLine[];
};

export type Dataset = {
  companyId: string;
  currency: string;
  periods: CorePeriod[];
  dimensions: CoreDimension[];
  members: CoreMember[];
  entries: CoreEntry[];
  drivers: CoreDriverValue[];
  budgets: CoreBudget[];
};

export function emptyDataset(companyId = "", currency = "EUR"): Dataset {
  return {
    companyId,
    currency,
    periods: [],
    dimensions: [],
    members: [],
    entries: [],
    drivers: [],
    budgets: [],
  };
}

/** Filtre d'écritures — sert aux règles d'affectation, aux requêtes et au drill-down. */
export type EntryFilter = {
  kinds?: EntryKind[];
  behaviors?: CostBehavior[];
  traceabilities?: Traceability[];
  accountPrefixes?: string[];
  natureCodes?: string[];
  periodCodes?: string[];
  /** Contraintes dimensionnelles : toutes doivent être satisfaites. */
  dimensionFilters?: { dimensionCode: string; memberCodes: string[]; negate?: boolean }[];
  /** Exige la présence (ou l'absence) d'une ventilation sur ces axes. */
  requiresDimensions?: string[];
  missingDimensions?: string[];
};

export type AllocationRuleSpec = {
  id: string;
  name: string;
  stage: number;
  sortOrder: number;
  active: boolean;
  source: EntryFilter;
  method: AllocationMethod;
  targetDimensionCode: string;
  driver?: { type: "driver" | "attribute" | "measure"; key: string };
  weights?: { memberCode: string; weight: number }[];
  activity?: { code: string; label: string; driverKey: string };
  /** Pour les stages > 1 : dimension source (centres) dont on redistribue les cumuls. */
  fromDimensionCode?: string;
  fromMemberCodes?: string[];
};

export type DimensionSpec = {
  code: string;
  label: string;
  kind: DimensionKind;
  isCostObject: boolean;
  isMandatory?: boolean;
  hierarchical?: boolean;
  sortOrder?: number;
};

export type KpiSpec = {
  code: string;
  name: string;
  category: KpiCategory;
  definition: string;
  formula: string;
  unit: KpiUnit;
  frequency?: "MONTH" | "QUARTER" | "YEAR";
  direction: "UP" | "DOWN";
  target?: number | null;
  warningThreshold?: number | null;
  criticalThreshold?: number | null;
  dimensionCode?: string | null;
  requires?: string[];
  interpretation: string;
  limits: string;
};

export type DashboardBlock =
  | { type: "kpi"; code: string }
  | { type: "kpi-row"; codes: string[]; title?: string }
  | { type: "margin-cascade"; title?: string }
  | { type: "ranking"; dimensionCode: string; measure: string; title?: string; order?: "asc" | "desc" }
  | { type: "variance-bridge"; title?: string }
  | { type: "breakeven"; title?: string }
  | { type: "trend"; measure: string; title?: string }
  | { type: "progress-table"; dimensionCode: string; title?: string }
  | { type: "alerts"; title?: string }
  | { type: "missing-data"; title?: string };

export type DashboardSection = {
  id: string;
  title: string;
  blocks: DashboardBlock[];
};

export type DashboardSpec = { sections: DashboardSection[] };

export type ConfigurationPayload = {
  capabilities: Capability[];
  costMethods: CostMethod[];
  dimensions: DimensionSpec[];
  kpiCodes: string[];
  kpiOverrides: Record<string, { target?: number | null }>;
  allocationRules: AllocationRuleSpec[];
  requiredDrivers: string[];
  dashboard: DashboardSpec;
  ruleTrace: { ruleId: string; ruleName: string; because: string; effect: string; target: string }[];
};

export function emptyConfiguration(): ConfigurationPayload {
  return {
    capabilities: [],
    costMethods: [],
    dimensions: [],
    kpiCodes: [],
    kpiOverrides: {},
    allocationRules: [],
    requiredDrivers: [],
    dashboard: { sections: [] },
    ruleTrace: [],
  };
}
