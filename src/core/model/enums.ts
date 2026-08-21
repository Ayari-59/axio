import { z } from "zod";

/**
 * Valeurs autorisées du domaine.
 * SQLite ne supporte pas les enum Prisma : la vérité vit ici et est contrôlée par Zod
 * à chaque frontière (import, formulaire, lecture d'une colonne JSON).
 */

export const ENTRY_KINDS = ["REVENUE", "COST", "QUANTITY", "CASH_IN", "CASH_OUT"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];
export const entryKindSchema = z.enum(ENTRY_KINDS);

export const COST_BEHAVIORS = ["FIXED", "VARIABLE", "SEMI_VARIABLE"] as const;
export type CostBehavior = (typeof COST_BEHAVIORS)[number];
export const costBehaviorSchema = z.enum(COST_BEHAVIORS);

export const TRACEABILITIES = ["DIRECT", "INDIRECT"] as const;
export type Traceability = (typeof TRACEABILITIES)[number];
export const traceabilitySchema = z.enum(TRACEABILITIES);

export const DIMENSION_KINDS = ["RESPONSIBILITY", "COST_OBJECT", "ANALYSIS", "RESOURCE"] as const;
export type DimensionKind = (typeof DIMENSION_KINDS)[number];
export const dimensionKindSchema = z.enum(DIMENSION_KINDS);

export const ALLOCATION_METHODS = ["DIRECT", "DRIVER", "PERCENT", "EQUAL", "ABC"] as const;
export type AllocationMethod = (typeof ALLOCATION_METHODS)[number];
export const allocationMethodSchema = z.enum(ALLOCATION_METHODS);

export const BUDGET_KINDS = ["BUDGET", "REVISED", "FORECAST", "ROLLING", "STANDARD"] as const;
export type BudgetKind = (typeof BUDGET_KINDS)[number];
export const budgetKindSchema = z.enum(BUDGET_KINDS);

export const BUDGET_SCENARIOS = ["BASE", "OPTIMISTIC", "PESSIMISTIC"] as const;
export type BudgetScenario = (typeof BUDGET_SCENARIOS)[number];

export const BUDGET_STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "ARCHIVED"] as const;
export type BudgetStatus = (typeof BUDGET_STATUSES)[number];

export const KPI_UNITS = ["EUR", "PCT", "RATIO", "QTY", "DAYS", "HOURS"] as const;
export type KpiUnit = (typeof KPI_UNITS)[number];
export const kpiUnitSchema = z.enum(KPI_UNITS);

export const KPI_CATEGORIES = [
  "growth",
  "profitability",
  "cost",
  "productivity",
  "activity",
  "commercial",
  "budget",
  "cash",
  "hr",
  "project",
] as const;
export type KpiCategory = (typeof KPI_CATEGORIES)[number];

export const SEVERITIES = ["INFO", "WARNING", "CRITICAL"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const ROLES = [
  "ADMIN",
  "EXECUTIVE",
  "CONTROLLER",
  "CFO",
  "OPERATIONS",
  "MANAGER",
  "VIEWER",
] as const;
export type Role = (typeof ROLES)[number];
export const roleSchema = z.enum(ROLES);

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  EXECUTIVE: "Dirigeant",
  CONTROLLER: "Contrôleur de gestion",
  CFO: "Responsable financier",
  OPERATIONS: "Responsable opérationnel",
  MANAGER: "Manager",
  VIEWER: "Lecteur",
};

/** Capacités activables par le moteur de règles. */
export const CAPABILITIES = [
  "budget_control",
  "project_costing",
  "progress_tracking",
  "subcontractor_tracking",
  "timesheets",
  "utilization_rate",
  "inventory",
  "production_costing",
  "abc_costing",
  "store_network",
  "contract_recurring",
  "cash_forecast",
  "standard_costing",
  "client_profitability",
  "product_profitability",
  "multi_site",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const COST_METHODS = ["full", "variable", "direct", "abc", "standard", "marginal"] as const;
export type CostMethod = (typeof COST_METHODS)[number];

/** Codes d'inducteurs / unités d'œuvre standards. */
export const DRIVER_CODES = [
  "HOURS",
  "BILLABLE_HOURS",
  "AVAILABLE_HOURS",
  "HEADCOUNT",
  "FTE",
  "MACHINE_HOURS",
  "M2",
  "ORDERS",
  "LINES",
  "DELIVERIES",
  "UNITS_PRODUCED",
  "UNITS_SOLD",
  "UNITS_SCRAPPED",
  "SETUPS",
  "VISITS",
  "REVENUE",
  // Inducteurs d'activités (ABC) : ce qui déclenche la consommation, pas ce qui est facile à compter.
  "PROPOSALS",
  "PROJECTS",
  "INVOICES",
  "CONTROLS",
  "TICKETS",
] as const;
export type DriverCode = (typeof DRIVER_CODES)[number];
