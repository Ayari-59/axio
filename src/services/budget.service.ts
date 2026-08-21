import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { audit, loadDataset } from "@/lib/repository";
import { round2 } from "@/core/model/money";
import type { CoreBudget, Dataset } from "@/core/model/types";
import {
  compare,
  decomposePriceVolumeMix,
  type PvmItem,
  type PvmResult,
  type VarianceLine,
} from "@/core/budget/variance";

/**
 * Budgets et écarts (docs/08).
 * Un budget approuvé est immuable : toute modification crée une version.
 */

export async function listBudgets(companyId: string) {
  return prisma.budget.findMany({
    where: { companyId },
    orderBy: [{ fiscalYear: "desc" }, { version: "desc" }],
    include: { _count: { select: { lines: true } } },
  });
}

/**
 * Construction depuis l'historique : réel de l'exercice source × coefficient,
 * saisonnalité conservée (chaque mois garde son poids).
 */
export async function createBudgetFromHistory(input: {
  companyId: string;
  name: string;
  fiscalYear: number;
  sourceFiscalYear: number;
  growthPct: number;
  costGrowthPct?: number;
  actorId?: string | null;
}): Promise<{ budgetId: string; lines: number }> {
  const { companyId, fiscalYear, sourceFiscalYear, growthPct } = input;
  const costGrowthPct = input.costGrowthPct ?? growthPct;

  const periods = await prisma.period.findMany({ where: { companyId } });
  const sourcePeriods = periods.filter((p) => p.fiscalYear === sourceFiscalYear);
  const targetPeriods = periods.filter((p) => p.fiscalYear === fiscalYear);
  if (sourcePeriods.length === 0) throw new Error("NO_SOURCE_DATA");

  const entries = await prisma.entry.findMany({
    where: { companyId, periodId: { in: sourcePeriods.map((p) => p.id) } },
    include: { dimensions: true },
  });
  const dimensions = await prisma.dimension.findMany({ where: { companyId } });
  const members = await prisma.dimensionMember.findMany({ where: { companyId } });
  const dimensionById = new Map(dimensions.map((d) => [d.id, d.code]));
  const memberById = new Map(members.map((m) => [m.id, m.code]));
  const periodById = new Map(periods.map((p) => [p.id, p]));

  // Agrégation par (mois, type, nature, comportement, ventilation sur les objets de coûts).
  // Conserver la ventilation est indispensable : sans elle, l'écart ne peut pas être
  // décomposé en prix / volume / composition (docs/08 §4).
  const costObjectCodes = dimensions.filter((d) => d.isCostObject).map((d) => d.code);

  type Bucket = {
    month: number;
    kind: string;
    natureCode: string | null;
    behavior: string;
    dims: Record<string, string>;
    amount: number;
    quantity: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const entry of entries) {
    if (entry.kind !== "REVENUE" && entry.kind !== "COST") continue;
    const period = periodById.get(entry.periodId);
    if (!period) continue;
    const month = Number(period.code.split("-")[1]);

    const dims: Record<string, string> = {};
    for (const link of entry.dimensions) {
      const dimensionCode = dimensionById.get(link.dimensionId);
      const memberCode = memberById.get(link.memberId);
      if (!dimensionCode || !memberCode) continue;
      if (dimensionCode === "NATURE" || costObjectCodes.includes(dimensionCode)) {
        dims[dimensionCode] = memberCode;
      }
    }
    const natureCode = dims.NATURE ?? null;
    const key = `${month}|${entry.kind}|${entry.behavior}|${JSON.stringify(dims)}`;

    const bucket = buckets.get(key) ?? {
      month,
      kind: entry.kind,
      natureCode,
      behavior: entry.behavior,
      dims,
      amount: 0,
      quantity: 0,
    };
    bucket.amount += entry.amount;
    bucket.quantity += entry.quantity ?? 0;
    buckets.set(key, bucket);
  }

  const last = await prisma.budget.findFirst({
    where: { companyId, fiscalYear, kind: "BUDGET" },
    orderBy: { version: "desc" },
  });

  const budget = await prisma.budget.create({
    data: {
      companyId,
      name: input.name,
      fiscalYear,
      kind: "BUDGET",
      scenario: "BASE",
      version: (last?.version ?? 0) + 1,
      status: "DRAFT",
    },
  });

  const targetByMonth = new Map(targetPeriods.map((p) => [Number(p.code.split("-")[1]), p]));

  // Insertion groupée : une base distante ne supporte pas quelques centaines de créations
  // ligne à ligne dans le temps d'une requête HTTP.
  const lines: Record<string, unknown>[] = [];
  for (const bucket of buckets.values()) {
    const period = targetByMonth.get(bucket.month);
    if (!period) continue;
    const factor = 1 + (bucket.kind === "REVENUE" ? growthPct : costGrowthPct) / 100;
    const amount = round2(bucket.amount * factor);
    if (amount === 0) continue;
    const quantity = bucket.quantity > 0 ? round2(bucket.quantity * (bucket.kind === "REVENUE" ? factor : 1)) : null;

    lines.push({
      id: randomUUID(),
      budgetId: budget.id,
      periodId: period.id,
      kind: bucket.kind,
      natureCode: bucket.natureCode,
      behavior: bucket.behavior,
      dimensions: JSON.stringify(bucket.dims),
      quantity,
      unitPrice: quantity && quantity !== 0 ? round2(amount / quantity) : null,
      amount,
      label: bucket.natureCode ?? (bucket.kind === "REVENUE" ? "Chiffre d'affaires" : "Charges"),
    });
  }

  for (let i = 0; i < lines.length; i += 500) {
    await prisma.budgetLine.createMany({ data: lines.slice(i, i + 500) as never });
  }
  const created = lines.length;

  await audit({
    companyId,
    actorId: input.actorId,
    action: "budget.create",
    entity: "Budget",
    entityId: budget.id,
    diff: { fiscalYear, sourceFiscalYear, growthPct, costGrowthPct, lines: created },
  });

  return { budgetId: budget.id, lines: created };
}

export async function approveBudget(companyId: string, budgetId: string, actorId?: string | null) {
  const budget = await prisma.budget.findFirst({ where: { id: budgetId, companyId } });
  if (!budget) throw new Error("BUDGET_NOT_FOUND");
  await prisma.budget.update({ where: { id: budgetId }, data: { status: "APPROVED" } });
  await audit({ companyId, actorId, action: "budget.approve", entity: "Budget", entityId: budgetId });
}

export async function deleteBudget(companyId: string, budgetId: string, actorId?: string | null) {
  const budget = await prisma.budget.findFirst({ where: { id: budgetId, companyId } });
  if (!budget) throw new Error("BUDGET_NOT_FOUND");
  if (budget.status === "APPROVED") throw new Error("BUDGET_APPROVED_IMMUTABLE");
  await prisma.budget.delete({ where: { id: budgetId } });
  await audit({ companyId, actorId, action: "budget.delete", entity: "Budget", entityId: budgetId });
}

export type VarianceView = {
  budget: CoreBudget | null;
  lines: VarianceLine[];
  totals: { actualRevenue: number; budgetRevenue: number; actualCost: number; budgetCost: number };
  pvm: PvmResult | null;
  pvmDimension: string | null;
};

export function buildVarianceView(
  dataset: Dataset,
  periodCode: string,
  options: { dimensionCode?: string } = {},
): VarianceView {
  const budget =
    dataset.budgets.find((b) => b.kind === "BUDGET" && b.status === "APPROVED") ??
    dataset.budgets.find((b) => b.kind === "BUDGET") ??
    null;

  const lines = compare(dataset, {
    groupBy: { type: "nature" },
    periodCodes: [periodCode],
    budget,
    lastYearPeriodCodes: [lastYear(periodCode)],
    labels: new Map([
      ...dataset.members.filter((m) => m.dimensionCode === "NATURE").map((m) => [m.code, m.label] as [string, string]),
      ["__NONE__", "Non ventilé"],
      ["__UNASSIGNED__", "Non affecté"],
    ]),
  });

  const totals = {
    actualRevenue: round2(lines.filter((l) => l.kind === "REVENUE").reduce((s, l) => s + l.actual, 0)),
    budgetRevenue: round2(lines.filter((l) => l.kind === "REVENUE").reduce((s, l) => s + l.budget, 0)),
    actualCost: round2(lines.filter((l) => l.kind === "COST").reduce((s, l) => s + l.actual, 0)),
    budgetCost: round2(lines.filter((l) => l.kind === "COST").reduce((s, l) => s + l.budget, 0)),
  };

  const dimensionCode =
    options.dimensionCode ?? dataset.dimensions.find((d) => d.isCostObject)?.code ?? null;

  const pvm = dimensionCode && budget ? buildPvm(dataset, budget, dimensionCode, periodCode) : null;

  return { budget, lines, totals, pvm, pvmDimension: dimensionCode };
}

/** Construit les couples (quantité, prix) nécessaires à la décomposition prix / volume / mix. */
export function buildPvm(
  dataset: Dataset,
  budget: CoreBudget,
  dimensionCode: string,
  periodCode: string,
): PvmResult | null {
  const actualMap = new Map<string, { quantity: number; amount: number }>();
  for (const entry of dataset.entries) {
    if (entry.kind !== "REVENUE" || entry.periodCode !== periodCode) continue;
    const key = entry.dims[dimensionCode] ?? "__UNASSIGNED__";
    const bucket = actualMap.get(key) ?? { quantity: 0, amount: 0 };
    bucket.quantity += entry.quantity ?? 0;
    bucket.amount += entry.amount;
    actualMap.set(key, bucket);
  }

  const budgetMap = new Map<string, { quantity: number; amount: number }>();
  for (const line of budget.lines) {
    if (line.kind !== "REVENUE" || line.periodCode !== periodCode) continue;
    const key = line.dims[dimensionCode] ?? "__UNASSIGNED__";
    const bucket = budgetMap.get(key) ?? { quantity: 0, amount: 0 };
    bucket.quantity += line.quantity ?? 0;
    bucket.amount += line.amount;
    budgetMap.set(key, bucket);
  }

  const toItems = (map: Map<string, { quantity: number; amount: number }>): PvmItem[] =>
    [...map.entries()]
      .filter(([, v]) => v.quantity > 0)
      .map(([key, v]) => ({
        key,
        label: dataset.members.find((m) => m.dimensionCode === dimensionCode && m.code === key)?.label ?? key,
        quantity: v.quantity,
        unitPrice: v.amount / v.quantity,
      }));

  const actual = toItems(actualMap);
  const budgeted = toItems(budgetMap);
  if (actual.length === 0 || budgeted.length === 0) return null;

  return decomposePriceVolumeMix(budgeted, actual);
}

function lastYear(periodCode: string): string {
  const [year, month] = periodCode.split("-");
  return `${Number(year) - 1}-${month}`;
}

export async function loadDatasetForCompany(companyId: string) {
  return loadDataset(companyId);
}
