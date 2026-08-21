import { describe, expect, it } from "vitest";
import { runCosting } from "@/core/costing/allocate";
import { round2, sum } from "@/core/model/money";
import type { AllocationRuleSpec, Dataset } from "@/core/model/types";
import { cost, dataset, dimension, member, period, rule } from "./fixtures/builders";

/**
 * Cas d'école de la comptabilité par activités.
 *
 * Deux produits consomment le même atelier de façon très différente :
 *   A — gros volume, série simple  : 5 000 h machine,  10 réglages
 *   B — petit volume, très complexe: 1 000 h machine,  40 réglages
 *
 * 100 000 € de charges d'atelier, dont la moitié relève de l'usinage (inducteur : heure machine)
 * et la moitié du réglage (inducteur : nombre de réglages).
 *
 * La méthode traditionnelle, qui répartit tout à l'heure machine, fait porter 83 % du coût au
 * produit A. L'ABC montre que B, qui mobilise 80 % des réglages, en supporte réellement près de
 * la moitié : A subventionnait B. C'est exactement ce que l'ABC est censé révéler.
 */

const build = (): Dataset =>
  dataset({
    periods: [period("2026-01")],
    dimensions: [
      dimension("NATURE", "Nature"),
      dimension("CENTER", "Atelier", { kind: "RESPONSIBILITY" }),
      dimension("ACTIVITY", "Activité"),
      dimension("PRODUCT", "Produit", { kind: "COST_OBJECT", isCostObject: true }),
    ],
    members: [
      member("NATURE", "OVERHEAD", "Charges d'atelier"),
      member("CENTER", "ATELIER", "Atelier mécanique"),
      member("ACTIVITY", "USINAGE", "Usinage"),
      member("ACTIVITY", "REGLAGE", "Réglage des séries"),
      member("PRODUCT", "A", "Produit A"),
      member("PRODUCT", "B", "Produit B"),
    ],
    entries: [
      cost(
        "2026-01",
        100_000,
        { NATURE: "OVERHEAD", CENTER: "ATELIER" },
        { traceability: "INDIRECT", behavior: "FIXED" },
      ),
    ],
    drivers: [
      { periodCode: "2026-01", driverCode: "MACHINE_HOURS", dimensionCode: "PRODUCT", memberCode: "A", value: 5000 },
      { periodCode: "2026-01", driverCode: "MACHINE_HOURS", dimensionCode: "PRODUCT", memberCode: "B", value: 1000 },
      { periodCode: "2026-01", driverCode: "SETUPS", dimensionCode: "PRODUCT", memberCode: "A", value: 10 },
      { periodCode: "2026-01", driverCode: "SETUPS", dimensionCode: "PRODUCT", memberCode: "B", value: 40 },
    ],
  });

const stage1: AllocationRuleSpec = rule({
  id: "s1",
  stage: 1,
  method: "DIRECT",
  targetDimensionCode: "CENTER",
  source: { kinds: ["COST"], traceabilities: ["INDIRECT"], requiresDimensions: ["CENTER"] },
});

const TRADITIONAL: AllocationRuleSpec[] = [
  stage1,
  rule({
    id: "s3-machine",
    stage: 3,
    sortOrder: 40,
    method: "DRIVER",
    fromDimensionCode: "CENTER",
    targetDimensionCode: "PRODUCT",
    driver: { type: "driver", key: "MACHINE_HOURS" },
    source: { kinds: ["COST"] },
  }),
];

const ABC: AllocationRuleSpec[] = [
  stage1,
  // Étape 2 : les ressources du centre se déversent dans les activités.
  rule({
    id: "s2-abc",
    name: "Atelier → activités",
    stage: 2,
    sortOrder: 10,
    method: "PERCENT",
    fromDimensionCode: "CENTER",
    fromMemberCodes: ["ATELIER"],
    targetDimensionCode: "ACTIVITY",
    weights: [
      { memberCode: "USINAGE", weight: 50 },
      { memberCode: "REGLAGE", weight: 50 },
    ],
    source: {},
  }),
  // Étape 3 : chaque activité descend vers les produits avec SON inducteur.
  rule({
    id: "s3-usinage",
    name: "Usinage → produits (heures machine)",
    stage: 3,
    sortOrder: 40,
    method: "DRIVER",
    fromDimensionCode: "ACTIVITY",
    fromMemberCodes: ["USINAGE"],
    targetDimensionCode: "PRODUCT",
    driver: { type: "driver", key: "MACHINE_HOURS" },
    source: { kinds: ["COST"] },
  }),
  rule({
    id: "s3-reglage",
    name: "Réglage → produits (nombre de réglages)",
    stage: 3,
    sortOrder: 41,
    method: "DRIVER",
    fromDimensionCode: "ACTIVITY",
    fromMemberCodes: ["REGLAGE"],
    targetDimensionCode: "PRODUCT",
    driver: { type: "driver", key: "SETUPS" },
    source: { kinds: ["COST"] },
  }),
];

describe("comptabilité par activités", () => {
  it("la méthode traditionnelle répartit tout à l'heure machine", () => {
    const result = runCosting(build(), TRADITIONAL, { periodCodes: ["2026-01"] });
    const product = result.byObject.PRODUCT;

    // 100 000 × 5 000/6 000 = 83 333,33 ; 100 000 × 1 000/6 000 = 16 666,67
    expect(product.A.indirect).toBeCloseTo(83_333.33, 1);
    expect(product.B.indirect).toBeCloseTo(16_666.67, 1);
  });

  it("l'ABC fait transiter les coûts par les activités, chacune avec son inducteur", () => {
    const result = runCosting(build(), ABC, { periodCodes: ["2026-01"] });
    const product = result.byObject.PRODUCT;

    // Usinage 50 000 aux heures : A 41 666,67 · B 8 333,33
    // Réglage 50 000 aux réglages (10 / 40) : A 10 000 · B 40 000
    expect(product.A.indirect).toBeCloseTo(51_666.67, 1);
    expect(product.B.indirect).toBeCloseTo(48_333.33, 1);
  });

  it("révèle le subventionnement croisé", () => {
    const traditional = runCosting(build(), TRADITIONAL, { periodCodes: ["2026-01"] }).byObject.PRODUCT;
    const abc = runCosting(build(), ABC, { periodCodes: ["2026-01"] }).byObject.PRODUCT;

    // Le produit de gros volume était surchargé, celui de petite série sous-évalué.
    expect(abc.A.indirect).toBeLessThan(traditional.A.indirect);
    expect(abc.B.indirect).toBeGreaterThan(traditional.B.indirect);
    expect(round2(traditional.B.indirect - abc.B.indirect)).toBeCloseTo(-31_666.66, 0);
  });

  it("conserve la masse dans les deux méthodes", () => {
    for (const rules of [TRADITIONAL, ABC]) {
      const result = runCosting(build(), rules, { periodCodes: ["2026-01"] });
      const allocated = sum(
        Object.values(result.byObject.PRODUCT).map((b) => b.direct + b.indirect),
      );
      expect(allocated).toBeCloseTo(100_000, 2);
      expect(result.totals.unallocatedIndirect).toBe(0);
    }
  });

  it("trace le passage par l'activité, inducteur et base compris", () => {
    const result = runCosting(build(), ABC, { periodCodes: ["2026-01"] });

    const viaActivity = result.allocations.filter((a) => a.stage === 3 && a.sourceKind === "activity");
    expect(viaActivity.length).toBe(4); // 2 activités × 2 produits

    const reglageVersB = viaActivity.find((a) => a.sourceRef === "REGLAGE" && a.targetMemberCode === "B")!;
    expect(reglageVersB.driverKey).toBe("SETUPS");
    expect(reglageVersB.driverValue).toBe(40);
    expect(reglageVersB.driverTotal).toBe(50);
    expect(reglageVersB.amount).toBeCloseTo(40_000, 2);
  });

  it("expose les bassins d'activité, centre vidé au profit des activités", () => {
    const result = runCosting(build(), ABC, { periodCodes: ["2026-01"] });

    const atelier = result.pools.find((p) => p.dimensionCode === "CENTER" && p.memberCode === "ATELIER")!;
    expect(atelier.given).toBeCloseTo(100_000, 2);
    expect(atelier.total).toBe(0);

    const activities = result.pools.filter((p) => p.dimensionCode === "ACTIVITY");
    expect(activities.length).toBe(2);
    expect(sum(activities.map((p) => p.received))).toBeCloseTo(100_000, 2);
  });

  it("signale l'inducteur manquant au lieu d'inventer une répartition", () => {
    const data = build();
    data.drivers = data.drivers.filter((d) => d.driverCode !== "SETUPS");
    const result = runCosting(data, ABC, { periodCodes: ["2026-01"] });

    expect(result.byObject.PRODUCT.__UNASSIGNED__.indirect).toBeCloseTo(50_000, 2);
    expect(result.warnings.join(" ")).toContain("SETUPS");
  });
});
