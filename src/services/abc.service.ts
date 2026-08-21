import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { audit, loadAllocationRules, loadDataset } from "@/lib/repository";
import { getSector } from "@/core/templates";
import { activitiesForPacks, type ActivityPreset } from "@/core/templates/activities";
import { ACTIVITY_DIMENSION, isActivityRule } from "@/core/costing/abc";
import type { AllocationRuleSpec } from "@/core/model/types";
import { parseJsonLoose } from "@/lib/json";

/**
 * Mise en place de la comptabilité par activités (docs/07 §5).
 *
 * Le produit ne devine pas les activités — il propose celles que le contrôleur de gestion
 * écrirait pour ce modèle économique, avec leur inducteur, et laisse ajuster les parts.
 * La génération est idempotente : elle remplace le dispositif ABC existant, sans toucher au
 * reste du paramétrage.
 */

const RULE_PREFIX = "ABC — ";

export type ActivityRow = {
  code: string;
  label: string;
  driverKey: string;
  driverLabel: string;
  share: number;
  rationale: string;
  /** L'inducteur est-il réellement alimenté ? Sinon l'activité ne pourra pas être répartie. */
  hasDriverData: boolean;
  driverTotal: number;
};

export type ActivityMap = {
  configured: boolean;
  activities: ActivityRow[];
  totalShare: number;
  costObjectLabel: string;
  missingDrivers: string[];
  suggestion: ActivityPreset[];
};

export async function loadActivityMap(companyId: string): Promise<ActivityMap> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const sector = getSector(company?.industry ?? "other");
  const suggestion = activitiesForPacks(sector.packs);

  const [dataset, rules] = await Promise.all([loadDataset(companyId), loadAllocationRules(companyId)]);
  const driverTotals = new Map<string, number>();
  for (const driver of dataset.drivers) {
    driverTotals.set(driver.driverCode, (driverTotals.get(driver.driverCode) ?? 0) + driver.value);
  }

  const members = dataset.members.filter((m) => m.dimensionCode === ACTIVITY_DIMENSION);
  const spreadRule = rules.find((r) => r.stage === 2 && r.targetDimensionCode === ACTIVITY_DIMENSION);
  const configured = members.length > 0 && Boolean(spreadRule);

  const rowFrom = (code: string, label: string, driverKey: string, share: number, rationale: string): ActivityRow => {
    const total = driverTotals.get(driverKey) ?? 0;
    return {
      code,
      label,
      driverKey,
      driverLabel: suggestion.find((a) => a.driverKey === driverKey)?.driverLabel ?? driverKey,
      share,
      rationale,
      hasDriverData: total > 0,
      driverTotal: total,
    };
  };

  const activities: ActivityRow[] = configured
    ? members.map((member) => {
        const weight = spreadRule?.weights?.find((w) => w.memberCode === member.code)?.weight ?? 0;
        const rule = rules.find(
          (r) => r.stage === 3 && (r.fromMemberCodes ?? []).includes(member.code),
        );
        const attributes = member.attributes ?? {};
        return rowFrom(
          member.code,
          member.label,
          rule?.driver?.key ?? String(attributes.driverKey ?? ""),
          weight,
          String(attributes.rationale ?? ""),
        );
      })
    : suggestion.map((preset) =>
        rowFrom(preset.code, preset.label, preset.driverKey, preset.defaultShare, preset.rationale),
      );

  const costObject = dataset.dimensions.find((d) => d.isCostObject);

  return {
    configured,
    activities,
    totalShare: Math.round(activities.reduce((total, a) => total + a.share, 0)),
    costObjectLabel: costObject?.label ?? "objet de coût",
    missingDrivers: activities.filter((a) => !a.hasDriverData).map((a) => a.driverKey),
    suggestion,
  };
}

export type ActivityInput = { code: string; label: string; driverKey: string; share: number; rationale?: string };

/**
 * Crée l'axe et les membres d'activité, puis les deux étages de règles :
 *   étape 2 — les centres se déversent dans les activités selon les parts saisies ;
 *   étape 3 — chaque activité descend vers les objets de coûts avec SON inducteur.
 */
export async function applyActivityMap(
  companyId: string,
  activities: ActivityInput[],
  actorId?: string | null,
): Promise<{ activities: number; rules: number }> {
  const kept = activities.filter((a) => a.share > 0 && a.code.trim() !== "");
  if (kept.length === 0) throw new Error("NO_ACTIVITY");

  const dimension = await prisma.dimension.upsert({
    where: { companyId_code: { companyId, code: ACTIVITY_DIMENSION } },
    create: {
      companyId,
      code: ACTIVITY_DIMENSION,
      label: "Activité",
      kind: "ANALYSIS",
      isCostObject: false,
      sortOrder: 40,
      source: "user",
    },
    update: { active: true },
  });

  for (const activity of kept) {
    await prisma.dimensionMember.upsert({
      where: { dimensionId_code: { dimensionId: dimension.id, code: activity.code } },
      create: {
        companyId,
        dimensionId: dimension.id,
        code: activity.code,
        label: activity.label,
        attributes: JSON.stringify({ driverKey: activity.driverKey, rationale: activity.rationale ?? "" }),
      },
      update: {
        label: activity.label,
        attributes: JSON.stringify({ driverKey: activity.driverKey, rationale: activity.rationale ?? "" }),
      },
    });
  }

  // Remplacement intégral du dispositif ABC précédent (idempotence).
  const existing = await prisma.allocationRule.findMany({ where: { companyId } });
  const abcRuleIds = existing
    .filter((row) => {
      const definition = parseJsonLoose<Partial<AllocationRuleSpec>>(row.definition, {});
      return (
        row.name.startsWith(RULE_PREFIX) ||
        definition.targetDimensionCode === ACTIVITY_DIMENSION ||
        definition.fromDimensionCode === ACTIVITY_DIMENSION
      );
    })
    .map((row) => row.id);
  if (abcRuleIds.length > 0) {
    await prisma.allocationRule.deleteMany({ where: { id: { in: abcRuleIds } } });
  }

  await prisma.allocationRule.create({
    data: {
      id: randomUUID(),
      companyId,
      name: `${RULE_PREFIX}centres → activités`,
      stage: 2,
      sortOrder: 10,
      active: true,
      suggested: false,
      definition: JSON.stringify({
        source: {},
        method: "PERCENT",
        fromDimensionCode: "CENTER",
        targetDimensionCode: ACTIVITY_DIMENSION,
        weights: kept.map((a) => ({ memberCode: a.code, weight: a.share })),
      }),
    },
  });

  let sortOrder = 30;
  for (const activity of kept) {
    await prisma.allocationRule.create({
      data: {
        id: randomUUID(),
        companyId,
        name: `${RULE_PREFIX}${activity.label} → objets de coûts`,
        stage: 3,
        sortOrder: (sortOrder += 1),
        active: true,
        suggested: false,
        definition: JSON.stringify({
          source: { kinds: ["COST"] },
          method: "DRIVER",
          fromDimensionCode: ACTIVITY_DIMENSION,
          fromMemberCodes: [activity.code],
          targetDimensionCode: "AUTO_COST_OBJECT",
          driver: { type: "driver", key: activity.driverKey },
        }),
      },
    });
  }

  await audit({
    companyId,
    actorId,
    action: "abc.apply",
    entity: "AllocationRule",
    diff: { activities: kept.map((a) => ({ code: a.code, driver: a.driverKey, share: a.share })) },
  });

  return { activities: kept.length, rules: kept.length + 1 };
}

/** Retire le dispositif ABC : les centres redescendent directement aux objets de coûts. */
export async function removeActivityMap(companyId: string, actorId?: string | null): Promise<number> {
  const rules = await loadAllocationRules(companyId);
  const ids = rules.filter(isActivityRule).map((r) => r.id);
  if (ids.length > 0) await prisma.allocationRule.deleteMany({ where: { id: { in: ids } } });
  await audit({ companyId, actorId, action: "abc.remove", entity: "AllocationRule", diff: { removed: ids.length } });
  return ids.length;
}
