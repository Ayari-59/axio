import { prisma } from "./db";
import { parseJsonLoose } from "./json";
import type {
  AllocationRuleSpec,
  ConfigurationPayload,
  CoreBudget,
  Dataset,
  KpiSpec,
} from "@/core/model/types";
import type { BusinessModelProfile } from "@/core/model/profile";
import { businessModelProfileSchema, emptyProfile } from "@/core/model/profile";
import type { CostBehavior, EntryKind, Traceability } from "@/core/model/enums";

/**
 * Chargement du `Dataset` consommé par le cœur.
 * C'est la seule frontière entre Prisma et les moteurs : au-delà, plus aucune notion de base.
 */

export async function loadDataset(
  companyId: string,
  options: { periodCodes?: string[] } = {},
): Promise<Dataset> {
  const [company, periods, dimensions, members, budgets] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }),
    prisma.period.findMany({ where: { companyId }, orderBy: { code: "asc" } }),
    prisma.dimension.findMany({ where: { companyId, active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.dimensionMember.findMany({ where: { companyId } }),
    prisma.budget.findMany({ where: { companyId }, include: { lines: true } }),
  ]);

  const periodById = new Map(periods.map((p) => [p.id, p.code]));
  const dimensionById = new Map(dimensions.map((d) => [d.id, d.code]));
  const memberById = new Map(members.map((m) => [m.id, m.code]));

  const periodFilter = options.periodCodes
    ? { periodId: { in: periods.filter((p) => options.periodCodes?.includes(p.code)).map((p) => p.id) } }
    : {};

  const [entries, drivers] = await Promise.all([
    prisma.entry.findMany({
      where: { companyId, ...periodFilter },
      include: { dimensions: true, account: { select: { number: true } } },
    }),
    prisma.driverValue.findMany({ where: { companyId, ...periodFilter } }),
  ]);

  return {
    companyId,
    currency: company?.currency ?? "EUR",
    periods: periods.map((p) => ({
      code: p.code,
      start: p.start.toISOString(),
      end: p.end.toISOString(),
      type: p.type as "MONTH" | "QUARTER" | "YEAR",
      fiscalYear: p.fiscalYear,
      status: p.status as "OPEN" | "CLOSED",
    })),
    dimensions: dimensions.map((d) => ({
      code: d.code,
      label: d.label,
      kind: d.kind as Dataset["dimensions"][number]["kind"],
      isCostObject: d.isCostObject,
      isMandatory: d.isMandatory,
      hierarchical: d.hierarchical,
      sortOrder: d.sortOrder,
    })),
    members: members.map((m) => ({
      dimensionCode: dimensionById.get(m.dimensionId) ?? "",
      code: m.code,
      label: m.label,
      parentCode: m.parentId ? (memberById.get(m.parentId) ?? null) : null,
      attributes: parseJsonLoose<Record<string, unknown>>(m.attributes, {}),
    })),
    entries: entries.map((e) => ({
      id: e.id,
      periodCode: periodById.get(e.periodId) ?? "",
      date: e.date.toISOString(),
      kind: e.kind as EntryKind,
      amount: e.amount,
      quantity: e.quantity,
      unitPrice: e.unitPrice,
      unit: e.unit,
      accountNumber: e.account?.number ?? null,
      behavior: e.behavior as CostBehavior,
      traceability: e.traceability as Traceability,
      label: e.label,
      dims: Object.fromEntries(
        e.dimensions
          .map((link) => [dimensionById.get(link.dimensionId) ?? "", memberById.get(link.memberId) ?? ""])
          .filter(([dimension, member]) => dimension !== "" && member !== ""),
      ),
    })),
    drivers: drivers.map((d) => ({
      periodCode: periodById.get(d.periodId) ?? "",
      driverCode: d.driverCode,
      dimensionCode: d.dimensionId ? (dimensionById.get(d.dimensionId) ?? null) : null,
      memberCode: d.memberId ? (memberById.get(d.memberId) ?? null) : null,
      value: d.value,
      unit: d.unit,
    })),
    budgets: budgets.map((b) => toCoreBudget(b, periodById, dimensionById)),
  };
}

type BudgetWithLines = Awaited<ReturnType<typeof prisma.budget.findMany>>[number] & {
  lines: Awaited<ReturnType<typeof prisma.budgetLine.findMany>>;
};

function toCoreBudget(
  budget: BudgetWithLines,
  periodById: Map<string, string>,
  _dimensionById: Map<string, string>,
): CoreBudget {
  return {
    id: budget.id,
    name: budget.name,
    fiscalYear: budget.fiscalYear,
    kind: budget.kind as CoreBudget["kind"],
    scenario: budget.scenario as CoreBudget["scenario"],
    version: budget.version,
    status: budget.status,
    lines: budget.lines.map((line) => ({
      periodCode: periodById.get(line.periodId) ?? "",
      kind: line.kind as "REVENUE" | "COST",
      natureCode: line.natureCode,
      behavior: line.behavior as CostBehavior,
      dims: parseJsonLoose<Record<string, string>>(line.dimensions, {}),
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      amount: line.amount,
      label: line.label,
    })),
  };
}

export async function loadConfiguration(companyId: string): Promise<ConfigurationPayload | null> {
  const version = await prisma.configurationVersion.findFirst({
    where: { companyId },
    orderBy: { version: "desc" },
  });
  if (!version) return null;
  return parseJsonLoose<ConfigurationPayload | null>(version.payload, null);
}

export async function loadProfile(companyId: string): Promise<BusinessModelProfile> {
  const row = await prisma.businessModelProfile.findUnique({ where: { companyId } });
  if (!row) return emptyProfile();
  const parsed = businessModelProfileSchema.safeParse(parseJsonLoose(row.payload, {}));
  return parsed.success ? parsed.data : emptyProfile();
}

export async function loadAllocationRules(companyId: string): Promise<AllocationRuleSpec[]> {
  const rows = await prisma.allocationRule.findMany({
    where: { companyId },
    orderBy: [{ stage: "asc" }, { sortOrder: "asc" }],
  });
  return rows.map((row) => {
    const definition = parseJsonLoose<Partial<AllocationRuleSpec>>(row.definition, {});
    return {
      id: row.id,
      name: row.name,
      stage: row.stage,
      sortOrder: row.sortOrder,
      active: row.active,
      source: definition.source ?? {},
      method: definition.method ?? "DIRECT",
      targetDimensionCode: definition.targetDimensionCode ?? "AUTO_COST_OBJECT",
      driver: definition.driver,
      weights: definition.weights,
      activity: definition.activity,
      fromDimensionCode: definition.fromDimensionCode,
      fromMemberCodes: definition.fromMemberCodes,
    };
  });
}

export async function loadKpiSpecs(companyId: string): Promise<KpiSpec[]> {
  const rows = await prisma.kpiDefinition.findMany({
    where: { companyId },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    category: row.category as KpiSpec["category"],
    definition: row.definition,
    formula: row.formula,
    unit: row.unit as KpiSpec["unit"],
    frequency: row.frequency as KpiSpec["frequency"],
    direction: row.direction as "UP" | "DOWN",
    target: row.target,
    warningThreshold: row.warningThreshold,
    criticalThreshold: row.criticalThreshold,
    dimensionCode: row.dimensionCode,
    requires: parseJsonLoose<string[]>(row.requires, []),
    interpretation: row.interpretation,
    limits: row.limits,
  }));
}

export async function listCompanies(organizationId: string) {
  return prisma.company.findMany({
    where: { organizationId, archivedAt: null },
    orderBy: { name: "asc" },
  });
}

export async function getCompany(companyId: string, organizationId: string) {
  return prisma.company.findFirst({ where: { id: companyId, organizationId, archivedAt: null } });
}

export async function audit(input: {
  companyId: string;
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string;
  diff?: unknown;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      companyId: input.companyId,
      actorId: input.actorId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? "",
      diff: JSON.stringify(input.diff ?? {}),
    },
  });
}
