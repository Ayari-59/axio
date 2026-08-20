import { allocateProportional, round2, sum } from "../model/money";
import { matchesFilter } from "../model/dataset";
import type { AllocationRuleSpec, CoreEntry, Dataset } from "../model/types";

/**
 * Moteur d'affectation multi-étages (docs/07 §3).
 *
 *   stage 1 : charges indirectes  → centres
 *   stage 2 : centres auxiliaires → centres principaux (prestations réciproques)
 *   stage 3 : centres             → objets de coûts, et charges directes → objets
 *
 * Chaque euro affecté produit une trace : c'est elle qui rend le drill-down exact.
 */

export const UNASSIGNED = "__UNASSIGNED__";
export const UNASSIGNED_LABEL = "Non affecté";

export type Allocation = {
  stage: number;
  ruleId: string;
  ruleName: string;
  sourceKind: "entry" | "center" | "activity";
  sourceRef: string;
  periodCode: string;
  targetDimension: string;
  targetMemberCode: string;
  amount: number;
  driverKey?: string;
  driverValue?: number;
  driverTotal?: number;
};

export type CenterTotal = {
  memberCode: string;
  directIndirect: number; // charges indirectes rattachées au centre
  received: number; // reçu d'autres centres (stage 2)
  given: number; // cédé à d'autres centres (stage 2)
  total: number; // après stage 2, avant redistribution stage 3
};

export type CostingResult = {
  allocations: Allocation[];
  centerTotals: CenterTotal[];
  /** dimension → membre → { direct, indirect } */
  byObject: Record<string, Record<string, { direct: number; indirect: number }>>;
  totals: {
    cost: number;
    directCost: number;
    indirectCost: number;
    allocatedIndirect: number;
    unallocatedIndirect: number;
  };
  warnings: string[];
};

export type CostingOptions = {
  periodCodes?: string[];
  /** Restreint les objets de coûts traités (par défaut : toutes les dimensions marquées). */
  costObjectDimensions?: string[];
};

type Weight = { memberCode: string; weight: number };

function costObjectDims(dataset: Dataset, options?: CostingOptions): string[] {
  if (options?.costObjectDimensions) return options.costObjectDimensions;
  return dataset.dimensions.filter((d) => d.isCostObject).map((d) => d.code);
}

function scopedEntries(dataset: Dataset, options?: CostingOptions): CoreEntry[] {
  if (!options?.periodCodes) return dataset.entries;
  const set = new Set(options.periodCodes);
  return dataset.entries.filter((e) => set.has(e.periodCode));
}

/** Poids d'un inducteur par membre de la dimension cible. */
export function resolveWeights(
  dataset: Dataset,
  entries: CoreEntry[],
  targetDimension: string,
  driver: AllocationRuleSpec["driver"],
): Weight[] {
  const members = dataset.members.filter((m) => m.dimensionCode === targetDimension);
  if (!driver) return members.map((m) => ({ memberCode: m.code, weight: 1 }));

  if (driver.type === "attribute") {
    return members.map((m) => {
      const raw = m.attributes?.[driver.key];
      const value = typeof raw === "number" ? raw : Number(raw);
      return { memberCode: m.code, weight: Number.isFinite(value) ? value : 0 };
    });
  }

  if (driver.type === "driver") {
    const totals = new Map<string, number>();
    const periodScope = new Set(entries.map((e) => e.periodCode));
    for (const dv of dataset.drivers) {
      if (dv.driverCode !== driver.key) continue;
      if (dv.dimensionCode !== targetDimension) continue;
      if (!dv.memberCode) continue;
      if (periodScope.size > 0 && !periodScope.has(dv.periodCode)) continue;
      totals.set(dv.memberCode, (totals.get(dv.memberCode) ?? 0) + dv.value);
    }
    return members.map((m) => ({ memberCode: m.code, weight: totals.get(m.code) ?? 0 }));
  }

  // driver.type === "measure" : mesure calculée sur les écritures du périmètre
  const totals = new Map<string, number>();
  for (const entry of entries) {
    const member = entry.dims[targetDimension];
    if (!member) continue;
    let value = 0;
    if (driver.key === "revenue" && entry.kind === "REVENUE") value = entry.amount;
    else if (driver.key === "directCost" && entry.kind === "COST" && entry.traceability === "DIRECT")
      value = entry.amount;
    else if (driver.key === "totalCost" && entry.kind === "COST") value = entry.amount;
    else if (driver.key === "quantity") value = entry.quantity ?? 0;
    if (value !== 0) totals.set(member, (totals.get(member) ?? 0) + value);
  }
  return members.map((m) => ({ memberCode: m.code, weight: totals.get(m.code) ?? 0 }));
}

export function runCosting(
  dataset: Dataset,
  rules: AllocationRuleSpec[],
  options: CostingOptions = {},
): CostingResult {
  const entries = scopedEntries(dataset, options).filter((e) => e.kind === "COST" || e.kind === "REVENUE");
  const costEntries = entries.filter((e) => e.kind === "COST");
  const active = rules.filter((r) => r.active);
  const allocations: Allocation[] = [];
  const warnings: string[] = [];
  const objectDims = costObjectDims(dataset, options);

  // ---------------------------------------------------------------- stage 1
  const stage1 = active.filter((r) => r.stage === 1).sort((a, b) => a.sortOrder - b.sortOrder);
  const centerDirect = new Map<string, number>();
  const consumed = new Set<string>();
  let unallocatedIndirect = 0;

  const indirectEntries = costEntries.filter((e) => e.traceability === "INDIRECT");

  for (const rule of stage1) {
    const matched = indirectEntries.filter((e) => !consumed.has(e.id) && matchesFilter(e, rule.source));
    if (matched.length === 0) continue;

    if (rule.method === "DIRECT") {
      for (const entry of matched) {
        const member = entry.dims[rule.targetDimensionCode];
        if (!member) continue;
        consumed.add(entry.id);
        centerDirect.set(member, (centerDirect.get(member) ?? 0) + entry.amount);
        allocations.push({
          stage: 1,
          ruleId: rule.id,
          ruleName: rule.name,
          sourceKind: "entry",
          sourceRef: entry.id,
          periodCode: entry.periodCode,
          targetDimension: rule.targetDimensionCode,
          targetMemberCode: member,
          amount: round2(entry.amount),
        });
      }
      continue;
    }

    const weights =
      rule.method === "PERCENT"
        ? (rule.weights ?? []).map((w) => ({ memberCode: w.memberCode, weight: w.weight }))
        : rule.method === "EQUAL"
          ? dataset.members
              .filter((m) => m.dimensionCode === rule.targetDimensionCode)
              .map((m) => ({ memberCode: m.code, weight: 1 }))
          : resolveWeights(dataset, entries, rule.targetDimensionCode, rule.driver);

    const weightTotal = sum(weights.map((w) => w.weight));
    for (const entry of matched) {
      consumed.add(entry.id);
      const spread = allocateProportional(
        entry.amount,
        weights.map((w) => ({ key: w.memberCode, weight: w.weight })),
      );
      if (spread.length === 0) {
        unallocatedIndirect += entry.amount;
        continue;
      }
      for (const part of spread) {
        centerDirect.set(part.key, (centerDirect.get(part.key) ?? 0) + part.amount);
        allocations.push({
          stage: 1,
          ruleId: rule.id,
          ruleName: rule.name,
          sourceKind: "entry",
          sourceRef: entry.id,
          periodCode: entry.periodCode,
          targetDimension: rule.targetDimensionCode,
          targetMemberCode: part.key,
          amount: part.amount,
          driverKey: rule.driver?.key,
          driverValue: part.weight,
          driverTotal: weightTotal,
        });
      }
    }
  }

  // Charges indirectes non prises en charge par une règle : masse conservée et signalée.
  for (const entry of indirectEntries) {
    if (consumed.has(entry.id)) continue;
    unallocatedIndirect += entry.amount;
  }
  if (unallocatedIndirect > 0) {
    warnings.push(
      `${round2(unallocatedIndirect)} € de charges indirectes n'ont pu être rattachées à un centre.`,
    );
  }

  // ---------------------------------------------------------------- stage 2
  const stage2 = active.filter((r) => r.stage === 2).sort((a, b) => a.sortOrder - b.sortOrder);
  const centerTotalsMap = new Map<string, CenterTotal>();
  for (const [memberCode, amount] of centerDirect) {
    centerTotalsMap.set(memberCode, {
      memberCode,
      directIndirect: round2(amount),
      received: 0,
      given: 0,
      total: amount,
    });
  }

  if (stage2.length > 0) {
    // Résolution itérative des prestations réciproques (point fixe).
    const balances = new Map<string, number>();
    for (const [code, total] of centerDirect) balances.set(code, total);

    let iteration = 0;
    let moved = Number.POSITIVE_INFINITY;
    while (iteration < 50 && moved > 0.01) {
      moved = 0;
      for (const rule of stage2) {
        const sources = rule.fromMemberCodes ?? [];
        for (const source of sources) {
          const amount = balances.get(source) ?? 0;
          if (Math.abs(amount) < 0.01) continue;
          const weights = (rule.weights ?? []).map((w) => ({ key: w.memberCode, weight: w.weight }));
          const spread = allocateProportional(amount, weights);
          if (spread.length === 0) continue;
          balances.set(source, 0);
          const sourceTotal = centerTotalsMap.get(source);
          if (sourceTotal) sourceTotal.given = round2(sourceTotal.given + amount);
          for (const part of spread) {
            balances.set(part.key, (balances.get(part.key) ?? 0) + part.amount);
            const target =
              centerTotalsMap.get(part.key) ??
              ({ memberCode: part.key, directIndirect: 0, received: 0, given: 0, total: 0 } as CenterTotal);
            target.received = round2(target.received + part.amount);
            centerTotalsMap.set(part.key, target);
            moved += Math.abs(part.amount);
            allocations.push({
              stage: 2,
              ruleId: rule.id,
              ruleName: rule.name,
              sourceKind: "center",
              sourceRef: source,
              periodCode: "",
              targetDimension: rule.targetDimensionCode,
              targetMemberCode: part.key,
              amount: part.amount,
            });
          }
        }
      }
      iteration += 1;
    }
    if (moved > 0.01) {
      warnings.push(
        "Les prestations réciproques entre centres n'ont pas convergé : vérifiez les pourcentages saisis.",
      );
    }
    for (const [code, balance] of balances) {
      const entry =
        centerTotalsMap.get(code) ??
        ({ memberCode: code, directIndirect: 0, received: 0, given: 0, total: 0 } as CenterTotal);
      entry.total = round2(balance);
      centerTotalsMap.set(code, entry);
    }
  }

  const centerTotals = [...centerTotalsMap.values()].map((c) => ({ ...c, total: round2(c.total) }));
  const redistributable = sum(centerTotals.map((c) => c.total));

  // ---------------------------------------------------------------- stage 3
  const byObject: CostingResult["byObject"] = {};
  const stage3 = active.filter((r) => r.stage === 3).sort((a, b) => a.sortOrder - b.sortOrder);
  const directRule =
    stage3.find((r) => r.method === "DIRECT") ??
    ({
      id: "alloc-direct",
      name: "Charges directes → objet de coût",
      stage: 3,
      sortOrder: 10,
      active: true,
      source: { kinds: ["COST"], traceabilities: ["DIRECT"] },
      method: "DIRECT",
      targetDimensionCode: "AUTO_COST_OBJECT",
    } as AllocationRuleSpec);

  for (const dimensionCode of objectDims) {
    const bucket: Record<string, { direct: number; indirect: number }> = {};
    const ensure = (code: string) => {
      bucket[code] = bucket[code] ?? { direct: 0, indirect: 0 };
      return bucket[code];
    };

    // 1) charges directes
    for (const entry of costEntries) {
      if (entry.traceability !== "DIRECT") continue;
      if (!matchesFilter(entry, directRule.source)) continue;
      const member = entry.dims[dimensionCode] ?? UNASSIGNED;
      ensure(member).direct += entry.amount;
      allocations.push({
        stage: 3,
        ruleId: directRule.id,
        ruleName: directRule.name,
        sourceKind: "entry",
        sourceRef: entry.id,
        periodCode: entry.periodCode,
        targetDimension: dimensionCode,
        targetMemberCode: member,
        amount: round2(entry.amount),
      });
    }

    // 2) redistribution des centres
    const rule =
      stage3.find((r) => r.method !== "DIRECT" && r.targetDimensionCode === dimensionCode) ??
      stage3.find((r) => r.method !== "DIRECT" && r.targetDimensionCode === "AUTO_COST_OBJECT");

    if (!rule || redistributable === 0) {
      if (redistributable !== 0) {
        ensure(UNASSIGNED).indirect += redistributable;
        warnings.push(
          `Aucune règle ne redistribue les centres vers l'axe ${dimensionCode} : les charges indirectes restent non affectées.`,
        );
      }
      byObject[dimensionCode] = bucket;
      continue;
    }

    const weights =
      rule.method === "PERCENT"
        ? (rule.weights ?? []).map((w) => ({ memberCode: w.memberCode, weight: w.weight }))
        : rule.method === "EQUAL"
          ? dataset.members
              .filter((m) => m.dimensionCode === dimensionCode)
              .map((m) => ({ memberCode: m.code, weight: 1 }))
          : resolveWeights(dataset, entries, dimensionCode, rule.driver);

    const weightTotal = sum(weights.map((w) => w.weight));

    for (const center of centerTotals) {
      if (Math.abs(center.total) < 0.01) continue;
      const spread = allocateProportional(
        center.total,
        weights.map((w) => ({ key: w.memberCode, weight: w.weight })),
      );
      if (spread.length === 0) {
        ensure(UNASSIGNED).indirect += center.total;
        continue;
      }
      for (const part of spread) {
        ensure(part.key).indirect += part.amount;
        allocations.push({
          stage: 3,
          ruleId: rule.id,
          ruleName: rule.name,
          sourceKind: "center",
          sourceRef: center.memberCode,
          periodCode: "",
          targetDimension: dimensionCode,
          targetMemberCode: part.key,
          amount: part.amount,
          driverKey: rule.driver?.key,
          driverValue: part.weight,
          driverTotal: weightTotal,
        });
      }
    }

    // Les charges indirectes non rattachées à un centre restent visibles.
    if (unallocatedIndirect > 0) ensure(UNASSIGNED).indirect += unallocatedIndirect;

    for (const key of Object.keys(bucket)) {
      bucket[key] = { direct: round2(bucket[key].direct), indirect: round2(bucket[key].indirect) };
    }
    byObject[dimensionCode] = bucket;
  }

  const totalCost = sum(costEntries.map((e) => e.amount));
  const directCost = sum(costEntries.filter((e) => e.traceability === "DIRECT").map((e) => e.amount));

  return {
    allocations,
    centerTotals,
    byObject,
    totals: {
      cost: round2(totalCost),
      directCost: round2(directCost),
      indirectCost: round2(totalCost - directCost),
      allocatedIndirect: round2(redistributable),
      unallocatedIndirect: round2(unallocatedIndirect),
    },
    warnings,
  };
}
