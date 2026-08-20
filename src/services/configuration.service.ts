import { prisma } from "@/lib/db";
import { audit, loadConfiguration, loadDataset, loadProfile } from "@/lib/repository";
import { evaluate } from "@/core/rules/engine";
import { buildPlan, diffConfiguration, type ConfigurationDiff, type ConfigurationPlan } from "@/core/rules/plan";
import { allRules, getSector } from "@/core/templates";
import { DEFAULT_CHART } from "@/core/templates/accounts";
import { emptyDataFacts, type Facts } from "@/core/rules/types";
import { getKpiSpec } from "@/core/kpi/catalog";
import type { BusinessModelProfile } from "@/core/model/profile";
import type { ConfigurationPayload } from "@/core/model/types";

/**
 * Chaîne de configuration (docs/06 §7 et docs/10 §2).
 * Le plan est toujours calculé puis présenté ; il n'est appliqué que sur décision explicite,
 * et l'application ne supprime jamais rien.
 */

export async function buildFacts(companyId: string): Promise<Facts> {
  const [company, profile, dataset] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }),
    loadProfile(companyId),
    loadDataset(companyId),
  ]);

  const drivers = new Set(dataset.drivers.map((d) => d.driverCode));
  const costs = dataset.entries.filter((e) => e.kind === "COST");
  const indirect = costs.filter((e) => e.traceability === "INDIRECT");
  const indirectShare = costs.length > 0
    ? (indirect.reduce((s, e) => s + e.amount, 0) / costs.reduce((s, e) => s + e.amount, 0)) * 100
    : profile.costs.indirectSharePct;

  return {
    profile: {
      ...profile,
      industry: company?.industry ?? "other",
      country: company?.country ?? "FR",
      currency: company?.currency ?? "EUR",
    },
    data: {
      ...emptyDataFacts(),
      hasEntries: dataset.entries.length > 0,
      entryCount: dataset.entries.length,
      periodCount: dataset.periods.length,
      hasTimesheets: drivers.has("BILLABLE_HOURS") || drivers.has("HOURS"),
      hasQuantities: dataset.entries.some((e) => e.quantity !== null && e.quantity !== undefined),
      hasUnitPrices: dataset.entries.some((e) => e.unitPrice !== null && e.unitPrice !== undefined),
      hasBankData: dataset.entries.some((e) => e.kind === "CASH_IN" || e.kind === "CASH_OUT"),
      hasBudget: dataset.budgets.length > 0,
      hasMachineHours: drivers.has("MACHINE_HOURS"),
      dimensionsPresent: dataset.dimensions.map((d) => d.code),
      indirectSharePct: Math.round(indirectShare),
      topClientSharePct: profile.revenue.topClientSharePct,
    },
  };
}

export type PlanResult = {
  plan: ConfigurationPlan;
  diff: ConfigurationDiff;
  trace: { ruleId: string; ruleName: string; matched: boolean; because: string }[];
  current: ConfigurationPayload | null;
};

export async function buildConfigurationPlan(companyId: string): Promise<PlanResult> {
  const facts = await buildFacts(companyId);
  const evaluation = evaluate(allRules(), facts, "configuration");
  const plan = buildPlan(evaluation.effects, facts.profile as BusinessModelProfile);
  const current = await loadConfiguration(companyId);
  return { plan, diff: diffConfiguration(current, plan), trace: evaluation.trace, current };
}

/**
 * Application transactionnelle. Idempotente : rejouer le même plan ne crée aucun doublon.
 */
export async function applyConfiguration(
  companyId: string,
  plan: ConfigurationPlan,
  actorId?: string | null,
): Promise<{ version: number }> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new Error("COMPANY_NOT_FOUND");
  const sector = getSector(company.industry);

  const last = await prisma.configurationVersion.findFirst({
    where: { companyId },
    orderBy: { version: "desc" },
  });
  const version = (last?.version ?? 0) + 1;

  await prisma.$transaction(async (tx) => {
    // 1. Dimensions (création ou mise à jour du libellé, jamais de suppression)
    for (const dimension of plan.dimensions) {
      await tx.dimension.upsert({
        where: { companyId_code: { companyId, code: dimension.code } },
        create: {
          companyId,
          code: dimension.code,
          label: dimension.label,
          kind: dimension.kind,
          isCostObject: dimension.isCostObject,
          isMandatory: dimension.isMandatory ?? false,
          hierarchical: dimension.hierarchical ?? false,
          sortOrder: dimension.sortOrder ?? 100,
          source: "rule",
        },
        update: {
          label: dimension.label,
          isCostObject: dimension.isCostObject,
          sortOrder: dimension.sortOrder ?? 100,
          active: true,
        },
      });
    }

    // 2. Référentiels sectoriels : natures de charges et centres par défaut
    const natureDimension = await tx.dimension.findUnique({
      where: { companyId_code: { companyId, code: "NATURE" } },
    });
    if (natureDimension) {
      for (const nature of sector.natures) {
        await tx.dimensionMember.upsert({
          where: { dimensionId_code: { dimensionId: natureDimension.id, code: nature.code } },
          create: {
            companyId,
            dimensionId: natureDimension.id,
            code: nature.code,
            label: nature.label,
            attributes: JSON.stringify({
              defaultBehavior: nature.behavior,
              defaultTraceability: nature.traceability,
            }),
          },
          update: { label: nature.label },
        });
      }
    }

    const centerDimension = await tx.dimension.findUnique({
      where: { companyId_code: { companyId, code: "CENTER" } },
    });
    if (centerDimension) {
      for (const center of sector.centers) {
        await tx.dimensionMember.upsert({
          where: { dimensionId_code: { dimensionId: centerDimension.id, code: center.code } },
          create: { companyId, dimensionId: centerDimension.id, code: center.code, label: center.label },
          update: { label: center.label },
        });
      }
    }

    // 3. Plan de comptes par défaut : il fournit le classement des écritures importées
    for (const account of DEFAULT_CHART) {
      await tx.account.upsert({
        where: { companyId_number: { companyId, number: account.number } },
        create: {
          companyId,
          number: account.number,
          label: account.label,
          type: account.type,
          defaultNatureCode: account.defaultNatureCode,
          defaultBehavior: account.defaultBehavior,
          defaultTraceability: account.defaultTraceability,
        },
        update: {},
      });
    }

    // 4. Règles d'affectation proposées (identifiant stable = nom de la règle)
    for (const rule of plan.allocationRules) {
      const existing = await tx.allocationRule.findFirst({ where: { companyId, name: rule.name } });
      const definition = JSON.stringify({
        source: rule.source,
        method: rule.method,
        targetDimensionCode: rule.targetDimensionCode,
        driver: rule.driver,
        weights: rule.weights,
        activity: rule.activity,
        fromDimensionCode: rule.fromDimensionCode,
        fromMemberCodes: rule.fromMemberCodes,
      });
      if (existing) {
        await tx.allocationRule.update({
          where: { id: existing.id },
          data: { stage: rule.stage, sortOrder: rule.sortOrder, definition },
        });
      } else {
        await tx.allocationRule.create({
          data: {
            companyId,
            name: rule.name,
            stage: rule.stage,
            sortOrder: rule.sortOrder,
            active: true,
            suggested: true,
            definition,
          },
        });
      }
    }

    // 5. Indicateurs
    let sortOrder = 10;
    for (const code of plan.kpiCodes) {
      const spec = getKpiSpec(code);
      if (!spec) continue;
      const override = plan.kpiOverrides[code];
      await tx.kpiDefinition.upsert({
        where: { companyId_code: { companyId, code } },
        create: {
          companyId,
          code,
          name: spec.name,
          category: spec.category,
          definition: spec.definition,
          formula: spec.formula,
          unit: spec.unit,
          frequency: spec.frequency ?? "MONTH",
          direction: spec.direction,
          target: override?.target ?? spec.target ?? null,
          warningThreshold: spec.warningThreshold ?? null,
          criticalThreshold: spec.criticalThreshold ?? null,
          dimensionCode: spec.dimensionCode ?? null,
          requires: JSON.stringify(spec.requires ?? []),
          interpretation: spec.interpretation,
          limits: spec.limits,
          sortOrder,
        },
        update: { sortOrder, target: override?.target ?? spec.target ?? null },
      });
      sortOrder += 10;
    }

    // 6. Version de configuration (immuable)
    const payload: ConfigurationPayload = {
      capabilities: plan.capabilities,
      costMethods: plan.costMethods,
      dimensions: plan.dimensions,
      kpiCodes: plan.kpiCodes,
      kpiOverrides: plan.kpiOverrides,
      allocationRules: plan.allocationRules,
      requiredDrivers: plan.requiredDrivers,
      dashboard: plan.dashboard,
      ruleTrace: plan.ruleTrace,
    };

    await tx.configurationVersion.create({
      data: {
        companyId,
        version,
        payload: JSON.stringify(payload),
        createdBy: actorId ?? null,
        note: version === 1 ? "Configuration initiale" : "Reconfiguration",
      },
    });

    await tx.company.update({ where: { id: companyId }, data: { configuredAt: new Date() } });
  });

  await audit({
    companyId,
    actorId,
    action: "configuration.apply",
    entity: "ConfigurationVersion",
    entityId: String(version),
    diff: { capabilities: plan.capabilities, kpis: plan.kpiCodes.length, dimensions: plan.dimensions.length },
  });

  return { version };
}

/** Crée les périodes mensuelles d'un exercice si elles n'existent pas. */
export async function ensurePeriods(companyId: string, year: number, months = 12): Promise<void> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const startMonth = company?.fiscalYearStartMonth ?? 1;

  for (let i = 0; i < months; i += 1) {
    const absolute = (startMonth - 1 + i) % 12;
    const yearOffset = Math.floor((startMonth - 1 + i) / 12);
    const periodYear = year + yearOffset;
    const code = `${periodYear}-${String(absolute + 1).padStart(2, "0")}`;
    const start = new Date(Date.UTC(periodYear, absolute, 1));
    const end = new Date(Date.UTC(periodYear, absolute + 1, 0));
    await prisma.period.upsert({
      where: { companyId_code: { companyId, code } },
      create: { companyId, code, start, end, type: "MONTH", fiscalYear: year, status: "OPEN" },
      update: {},
    });
  }
}

export async function saveProfile(
  companyId: string,
  profile: BusinessModelProfile,
  actorId?: string | null,
): Promise<void> {
  await prisma.businessModelProfile.upsert({
    where: { companyId },
    create: { companyId, payload: JSON.stringify(profile) },
    update: { payload: JSON.stringify(profile) },
  });
  await audit({ companyId, actorId, action: "profile.save", entity: "BusinessModelProfile", diff: profile });
}
