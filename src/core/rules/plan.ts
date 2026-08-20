import type { Capability, CostMethod } from "../model/enums";
import type { BusinessModelProfile } from "../model/profile";
import type {
  AllocationRuleSpec,
  ConfigurationPayload,
  DashboardSection,
  DimensionSpec,
} from "../model/types";
import { emptyConfiguration } from "../model/types";
import type { AlertSpec, FiredEffect, RecommendationSpec } from "./types";

/**
 * Transformation des effets en plan de configuration (docs/06 §7).
 * Déduplication : union pour les listes, dernier gagnant pour les scalaires.
 */

export type ConfigurationPlan = ConfigurationPayload & {
  alerts: (AlertSpec & { ruleId: string })[];
  recommendations: (RecommendationSpec & { ruleId: string })[];
};

type SectionAccumulator = {
  id: string;
  title: string;
  order: number;
  blocks: { order: number; block: DashboardSection["blocks"][number] }[];
};

/** Identité d'un bloc de cockpit : ce qu'il montre, indépendamment de son titre. */
function blockSignature(block: DashboardSection["blocks"][number]): string {
  const anyBlock = block as Record<string, unknown>;
  return [block.type, anyBlock.dimensionCode ?? "", anyBlock.measure ?? "", anyBlock.code ?? "", (anyBlock.codes as string[] | undefined)?.join(",") ?? ""].join("|");
}

export function buildPlan(
  effects: FiredEffect[],
  profile?: BusinessModelProfile,
): ConfigurationPlan {
  const base = emptyConfiguration();
  const capabilities = new Set<Capability>();
  const costMethods = new Set<CostMethod>();
  const dimensions = new Map<string, DimensionSpec>();
  const kpiCodes: string[] = [];
  const kpiOverrides: Record<string, { target?: number | null }> = {};
  const allocationRules = new Map<string, AllocationRuleSpec>();
  const requiredDrivers = new Set<string>();
  const sections = new Map<string, SectionAccumulator>();
  const alerts: (AlertSpec & { ruleId: string })[] = [];
  const recommendations: (RecommendationSpec & { ruleId: string })[] = [];
  const ruleTrace: ConfigurationPayload["ruleTrace"] = [];

  const note = (fired: FiredEffect, effect: string, target: string) => {
    ruleTrace.push({
      ruleId: fired.ruleId,
      ruleName: fired.ruleName,
      because: fired.because,
      effect,
      target,
    });
  };

  for (const fired of effects) {
    const e = fired.effect;
    switch (e.type) {
      case "enable_capability":
        capabilities.add(e.value);
        note(fired, "Capacité activée", e.value);
        break;
      case "set_cost_method":
        costMethods.add(e.value);
        note(fired, "Méthode de coût", e.value);
        break;
      case "create_dimension": {
        const existing = dimensions.get(e.value.code);
        dimensions.set(e.value.code, {
          sortOrder: 100,
          isMandatory: false,
          hierarchical: false,
          ...existing,
          ...e.value,
        });
        note(fired, "Axe d'analyse", e.value.label);
        break;
      }
      case "suggest_allocation_rule":
        if (!allocationRules.has(e.value.id)) {
          allocationRules.set(e.value.id, e.value);
          note(fired, "Règle d'affectation", e.value.name);
        }
        break;
      case "suggest_kpi":
        if (!kpiCodes.includes(e.value.code)) {
          kpiCodes.push(e.value.code);
          note(fired, "Indicateur", e.value.code);
        }
        if (e.value.target !== undefined) kpiOverrides[e.value.code] = { target: e.value.target };
        break;
      case "require_driver":
        requiredDrivers.add(e.value);
        note(fired, "Donnée nécessaire", e.value);
        break;
      case "add_dashboard_block": {
        const acc = sections.get(e.value.sectionId) ?? {
          id: e.value.sectionId,
          title: e.value.sectionTitle,
          order: e.value.order,
          blocks: [],
        };
        acc.order = Math.min(acc.order, e.value.order);
        // Déduplication : deux packs peuvent proposer le même bloc (par exemple un
        // classement sur l'axe PROJECT). L'utilisateur ne doit le voir qu'une fois.
        const signature = blockSignature(e.value.block);
        if (!acc.blocks.some((existing) => blockSignature(existing.block) === signature)) {
          acc.blocks.push({ order: e.value.order, block: e.value.block });
        }
        sections.set(e.value.sectionId, acc);
        break;
      }
      case "raise_alert":
        alerts.push({ ...e.value, ruleId: fired.ruleId });
        break;
      case "recommend":
        recommendations.push({ ...e.value, ruleId: fired.ruleId });
        break;
    }
  }

  // Renommage utilisateur : « Projet » → « Chantier ».
  const labels = profile?.objectLabels ?? {};
  const dimensionList = [...dimensions.values()]
    .map((d) => ({ ...d, label: labels[d.code] ?? d.label }))
    .sort((a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100) || a.code.localeCompare(b.code));

  const dashboardSections: DashboardSection[] = [...sections.values()]
    .sort((a, b) => a.order - b.order)
    .map((section) => ({
      id: section.id,
      title: section.title,
      blocks: section.blocks.sort((a, b) => a.order - b.order).map((b) => b.block),
    }));

  return {
    ...base,
    capabilities: [...capabilities],
    costMethods: [...costMethods],
    dimensions: dimensionList,
    kpiCodes,
    kpiOverrides,
    allocationRules: [...allocationRules.values()].sort(
      (a, b) => a.stage - b.stage || a.sortOrder - b.sortOrder,
    ),
    requiredDrivers: [...requiredDrivers],
    dashboard: { sections: dashboardSections },
    ruleTrace,
    alerts,
    recommendations,
  };
}

/** Diff entre configuration existante et plan proposé (aucune suppression automatique). */
export type ConfigurationDiff = {
  addedCapabilities: string[];
  removedCapabilities: string[];
  addedDimensions: DimensionSpec[];
  addedKpis: string[];
  removedKpis: string[];
  addedRules: AllocationRuleSpec[];
  dashboardChanged: boolean;
};

export function diffConfiguration(
  current: ConfigurationPayload | null,
  next: ConfigurationPayload,
): ConfigurationDiff {
  const currentCaps = new Set(current?.capabilities ?? []);
  const nextCaps = new Set(next.capabilities);
  const currentDims = new Set((current?.dimensions ?? []).map((d) => d.code));
  const currentKpis = new Set(current?.kpiCodes ?? []);
  const nextKpis = new Set(next.kpiCodes);
  const currentRules = new Set((current?.allocationRules ?? []).map((r) => r.id));

  return {
    addedCapabilities: [...nextCaps].filter((c) => !currentCaps.has(c)),
    removedCapabilities: [...currentCaps].filter((c) => !nextCaps.has(c as Capability)),
    addedDimensions: next.dimensions.filter((d) => !currentDims.has(d.code)),
    addedKpis: [...nextKpis].filter((k) => !currentKpis.has(k)),
    removedKpis: [...currentKpis].filter((k) => !nextKpis.has(k)),
    addedRules: next.allocationRules.filter((r) => !currentRules.has(r.id)),
    dashboardChanged:
      JSON.stringify(current?.dashboard ?? {}) !== JSON.stringify(next.dashboard),
  };
}
