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

/** Bassin de charges intermédiaire : un centre, une activité, tout axe qui reçoit avant de redistribuer. */
export type Pool = {
  dimensionCode: string;
  memberCode: string;
  directIndirect: number;
  received: number;
  given: number;
  total: number;
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
  /** Vue historique, restreinte aux centres. */
  centerTotals: CenterTotal[];
  /** Tous les bassins intermédiaires, centres et activités confondus. */
  pools: Pool[];
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
  const stage1Dimension = stage1[0]?.targetDimensionCode ?? "CENTER";
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
  // Les charges rattachées à l'étape 1 forment des « bassins » identifiés par (axe, membre) —
  // le plus souvent des centres. L'étape 2 déplace ces bassins :
  //   centre → centre   : prestations réciproques (cycles, résolution itérative) ;
  //   centre → activité : comptabilité par activités, où le coût transite par les activités
  //                       avant d'atteindre les objets de coûts (docs/07 §5).
  const stage2 = active.filter((r) => r.stage === 2).sort((a, b) => a.sortOrder - b.sortOrder);

  const poolKey = (dimensionCode: string, memberCode: string) => `${dimensionCode}|${memberCode}`;
  const pools = new Map<string, Pool>();
  const ensurePool = (dimensionCode: string, memberCode: string): Pool => {
    const existing = pools.get(poolKey(dimensionCode, memberCode));
    if (existing) return existing;
    const created: Pool = {
      dimensionCode,
      memberCode,
      directIndirect: 0,
      received: 0,
      given: 0,
      total: 0,
    };
    pools.set(poolKey(dimensionCode, memberCode), created);
    return created;
  };

  for (const [memberCode, amount] of centerDirect) {
    const pool = ensurePool(stage1Dimension, memberCode);
    pool.directIndirect = round2(amount);
    pool.total = amount;
  }

  if (stage2.length > 0) {
    let iteration = 0;
    let moved = Number.POSITIVE_INFINITY;

    while (iteration < 50 && moved > 0.01) {
      moved = 0;
      for (const rule of stage2) {
        const fromDimension = rule.fromDimensionCode ?? stage1Dimension;
        const sources =
          rule.fromMemberCodes ??
          [...pools.values()].filter((p) => p.dimensionCode === fromDimension).map((p) => p.memberCode);

        for (const source of sources) {
          const pool = pools.get(poolKey(fromDimension, source));
          if (!pool || Math.abs(pool.total) < 0.01) continue;

          const amount = pool.total;
          const weights =
            rule.method === "PERCENT"
              ? (rule.weights ?? []).map((w) => ({ key: w.memberCode, weight: w.weight }))
              : resolveWeights(dataset, entries, rule.targetDimensionCode, rule.driver).map((w) => ({
                  key: w.memberCode,
                  weight: w.weight,
                }));

          const spread = allocateProportional(amount, weights);
          if (spread.length === 0) continue;

          pool.total = 0;
          pool.given = round2(pool.given + amount);

          for (const part of spread) {
            const target = ensurePool(rule.targetDimensionCode, part.key);
            target.total += part.amount;
            target.received = round2(target.received + part.amount);
            moved += Math.abs(part.amount);
            allocations.push({
              stage: 2,
              ruleId: rule.id,
              ruleName: rule.name,
              sourceKind: fromDimension === "ACTIVITY" ? "activity" : "center",
              sourceRef: source,
              periodCode: "",
              targetDimension: rule.targetDimensionCode,
              targetMemberCode: part.key,
              amount: part.amount,
              driverKey: rule.driver?.key,
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
  }

  const poolList = [...pools.values()].map((pool) => ({ ...pool, total: round2(pool.total) }));
  const centerTotals: CenterTotal[] = poolList
    .filter((pool) => pool.dimensionCode === stage1Dimension)
    .map(({ memberCode, directIndirect, received, given, total }) => ({
      memberCode,
      directIndirect,
      received,
      given,
      total,
    }));
  const redistributable = sum(poolList.map((pool) => pool.total));

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

  /**
   * Règle applicable à un bassin, de la plus spécifique à la plus générale :
   *   1. une règle nommant explicitement ce membre  → cas ABC, un inducteur par activité ;
   *   2. une règle portant sur l'axe du bassin      → cas classique, tous les centres ;
   *   3. une règle sans origine déclarée.
   * À spécificité égale, l'ordre de tri de la règle tranche.
   */
  const pickRule = (pool: Pool, dimensionCode: string): AllocationRuleSpec | undefined => {
    const candidates = stage3
      .filter(
        (rule) =>
          rule.method !== "DIRECT" &&
          (rule.targetDimensionCode === dimensionCode || rule.targetDimensionCode === "AUTO_COST_OBJECT"),
      )
      .sort((a, b) => {
        const exact = (rule: AllocationRuleSpec) => (rule.targetDimensionCode === dimensionCode ? 0 : 1);
        return exact(a) - exact(b) || a.sortOrder - b.sortOrder;
      });

    return (
      candidates.find(
        (rule) =>
          rule.fromDimensionCode === pool.dimensionCode &&
          (rule.fromMemberCodes?.includes(pool.memberCode) ?? false),
      ) ??
      candidates.find(
        (rule) =>
          rule.fromDimensionCode === pool.dimensionCode &&
          (rule.fromMemberCodes ?? []).length === 0,
      ) ??
      candidates.find((rule) => !rule.fromDimensionCode)
    );
  };

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

    // 2) redistribution des bassins (centres, activités…), chacun selon SA règle
    const missingRules = new Set<string>();
    for (const pool of poolList) {
      if (Math.abs(pool.total) < 0.01) continue;

      const rule = pickRule(pool, dimensionCode);
      if (!rule) {
        ensure(UNASSIGNED).indirect += pool.total;
        missingRules.add(pool.dimensionCode);
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
      const spread = allocateProportional(
        pool.total,
        weights.map((w) => ({ key: w.memberCode, weight: w.weight })),
      );

      if (spread.length === 0) {
        ensure(UNASSIGNED).indirect += pool.total;
        warnings.push(
          `L'inducteur « ${rule.driver?.key ?? rule.method} » est absent : ${round2(pool.total)} € issus de ${pool.memberCode} restent non affectés sur l'axe ${dimensionCode}.`,
        );
        continue;
      }

      for (const part of spread) {
        ensure(part.key).indirect += part.amount;
        allocations.push({
          stage: 3,
          ruleId: rule.id,
          ruleName: rule.name,
          sourceKind: pool.dimensionCode === "ACTIVITY" ? "activity" : "center",
          sourceRef: pool.memberCode,
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

    for (const dimension of missingRules) {
      warnings.push(
        `Aucune règle ne redistribue l'axe ${dimension} vers l'axe ${dimensionCode} : ces charges restent non affectées.`,
      );
    }

    // Les charges indirectes non rattachées à un bassin restent visibles.
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
    pools: poolList,
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
