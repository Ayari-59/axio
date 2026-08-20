import { z } from "zod";

/**
 * BusinessModelProfile — l'objet central qui décrit le fonctionnement économique
 * de l'entreprise. C'est l'entrée du moteur de règles (docs/06).
 */

export const REVENUE_MODELS = [
  "time",
  "unit",
  "subscription",
  "commission",
  "project",
  "progress",
  "resale",
  "mixed",
] as const;
export type RevenueModel = (typeof REVENUE_MODELS)[number];

export const BILLING_UNITS = [
  "hour",
  "day",
  "fixed_price",
  "quantity",
  "subscription",
  "commission",
  "percentage",
  "progress",
  "contract",
  "other",
] as const;
export type BillingUnit = (typeof BILLING_UNITS)[number];

export const PILOT_OBJECTS = [
  "CLIENT",
  "PRODUCT",
  "SERVICE",
  "PROJECT",
  "CONTRACT",
  "EMPLOYEE",
  "SITE",
  "ACTIVITY",
] as const;
export type PilotObject = (typeof PILOT_OBJECTS)[number];

export const OBJECTIVES = [
  "reduce_cost",
  "improve_margin",
  "control_budget",
  "client_profitability",
  "project_control",
  "productivity",
  "resource_optimization",
  "cash_forecast",
  "pricing",
] as const;
export type Objective = (typeof OBJECTIVES)[number];

export const ORG_UNIT_TYPES = [
  "department",
  "service",
  "agency",
  "store",
  "site",
  "workshop",
  "team",
  "project",
] as const;
export type OrgUnitType = (typeof ORG_UNIT_TYPES)[number];

export const MARGIN_DRIVERS = [
  "price",
  "volume",
  "utilization",
  "material_cost",
  "labour_cost",
  "subcontracting",
  "productivity",
  "mix",
  "scrap",
  "footfall",
] as const;
export type MarginDriver = (typeof MARGIN_DRIVERS)[number];

export const businessModelProfileSchema = z.object({
  identity: z.object({
    activity: z.string().default(""),
    revenueBand: z.number().nonnegative().default(0),
    headcount: z.number().int().nonnegative().default(0),
    siteCount: z.number().int().nonnegative().default(1),
    establishmentCount: z.number().int().nonnegative().default(1),
  }).prefault({}),
  revenue: z.object({
    models: z.array(z.enum(REVENUE_MODELS)).default([]),
    billingUnits: z.array(z.enum(BILLING_UNITS)).default([]),
    recurringSharePct: z.number().min(0).max(100).default(0),
    seasonality: z.enum(["none", "moderate", "strong"]).default("none"),
    topClientSharePct: z.number().min(0).max(100).default(0),
  }).prefault({}),
  costs: z.object({
    payrollSharePct: z.number().min(0).max(100).default(0),
    purchasesSharePct: z.number().min(0).max(100).default(0),
    subcontractingSharePct: z.number().min(0).max(100).default(0),
    overheadSharePct: z.number().min(0).max(100).default(0),
    indirectSharePct: z.number().min(0).max(100).default(0),
    marginDrivers: z.array(z.enum(MARGIN_DRIVERS)).default([]),
  }).prefault({}),
  organization: z.object({
    units: z
      .array(
        z.object({
          type: z.enum(ORG_UNIT_TYPES),
          label: z.string(),
          count: z.number().int().nonnegative().default(1),
        }),
      )
      .default([]),
  }).prefault({}),
  pilotObjects: z.array(z.enum(PILOT_OBJECTS)).default([]),
  /** Renommage utilisateur : { PROJECT: "Chantier" } */
  objectLabels: z.record(z.string(), z.string()).default({}),
  objectives: z.array(z.enum(OBJECTIVES)).default([]),
  maturity: z.enum(["starter", "intermediate", "advanced"]).default("starter"),
  dataSources: z
    .array(z.enum(["accounting", "excel", "erp", "bank", "crm", "payroll", "timesheets", "manual"]))
    .default([]),
});

export type BusinessModelProfile = z.infer<typeof businessModelProfileSchema>;

export function emptyProfile(): BusinessModelProfile {
  return businessModelProfileSchema.parse({});
}
