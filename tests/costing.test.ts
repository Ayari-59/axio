import { describe, expect, it } from "vitest";
import { runCosting, UNASSIGNED } from "@/core/costing/allocate";
import { computeMargins } from "@/core/costing/margins";
import { splitSemiVariable } from "@/core/costing/classify";
import { computeProgress } from "@/core/costing/progress";
import { round2, sum } from "@/core/model/money";
import { cost, dataset, dimension, member, period, revenue, rule } from "./fixtures/builders";

const base = () =>
  dataset({
    periods: [period("2026-01")],
    dimensions: [
      dimension("NATURE", "Nature"),
      dimension("CENTER", "Centre", { kind: "RESPONSIBILITY" }),
      dimension("PROJECT", "Chantier", { kind: "COST_OBJECT", isCostObject: true }),
    ],
    members: [
      member("NATURE", "MATERIAL", "Matériaux"),
      member("NATURE", "OVERHEAD", "Structure"),
      member("CENTER", "WORKS", "Travaux"),
      member("CENTER", "ADMIN", "Administration"),
      member("PROJECT", "A", "Chantier A"),
      member("PROJECT", "B", "Chantier B"),
      member("PROJECT", "C", "Chantier C"),
    ],
  });

describe("moteur d'affectation", () => {
  it("répartit une charge indirecte selon un inducteur", () => {
    const data = base();
    data.entries = [
      cost("2026-01", 30_000, { NATURE: "OVERHEAD" }, { traceability: "INDIRECT", behavior: "FIXED" }),
    ];
    data.drivers = [
      { periodCode: "2026-01", driverCode: "HOURS", dimensionCode: "PROJECT", memberCode: "A", value: 600 },
      { periodCode: "2026-01", driverCode: "HOURS", dimensionCode: "PROJECT", memberCode: "B", value: 300 },
      { periodCode: "2026-01", driverCode: "HOURS", dimensionCode: "PROJECT", memberCode: "C", value: 100 },
    ];

    const rules = [
      rule({
        id: "r1",
        stage: 1,
        method: "EQUAL",
        targetDimensionCode: "CENTER",
        source: { kinds: ["COST"], traceabilities: ["INDIRECT"] },
      }),
      rule({
        id: "r3",
        stage: 3,
        sortOrder: 40,
        method: "DRIVER",
        fromDimensionCode: "CENTER",
        targetDimensionCode: "PROJECT",
        driver: { type: "driver", key: "HOURS" },
        source: { kinds: ["COST"] },
      }),
    ];

    const result = runCosting(data, rules, { periodCodes: ["2026-01"] });
    const project = result.byObject.PROJECT;

    expect(project.A.indirect).toBe(18_000);
    expect(project.B.indirect).toBe(9_000);
    expect(project.C.indirect).toBe(3_000);
  });

  it("conserve la masse : total affecté = total des charges", () => {
    const data = base();
    data.entries = [
      cost("2026-01", 12_345.67, { NATURE: "MATERIAL", PROJECT: "A" }),
      cost("2026-01", 8_910.11, { NATURE: "MATERIAL", PROJECT: "B" }),
      cost("2026-01", 4_444.44, { NATURE: "OVERHEAD", CENTER: "ADMIN" }, { traceability: "INDIRECT", behavior: "FIXED" }),
      cost("2026-01", 2_222.22, { NATURE: "OVERHEAD", CENTER: "WORKS" }, { traceability: "INDIRECT", behavior: "FIXED" }),
    ];
    data.drivers = [
      { periodCode: "2026-01", driverCode: "HOURS", dimensionCode: "PROJECT", memberCode: "A", value: 70 },
      { periodCode: "2026-01", driverCode: "HOURS", dimensionCode: "PROJECT", memberCode: "B", value: 30 },
    ];

    const rules = [
      rule({
        id: "s1",
        stage: 1,
        method: "DIRECT",
        targetDimensionCode: "CENTER",
        source: { kinds: ["COST"], traceabilities: ["INDIRECT"], requiresDimensions: ["CENTER"] },
      }),
      rule({
        id: "s3",
        stage: 3,
        sortOrder: 10,
        method: "DIRECT",
        targetDimensionCode: "AUTO_COST_OBJECT",
        source: { kinds: ["COST"], traceabilities: ["DIRECT"] },
      }),
      rule({
        id: "s3b",
        stage: 3,
        sortOrder: 40,
        method: "DRIVER",
        fromDimensionCode: "CENTER",
        targetDimensionCode: "PROJECT",
        driver: { type: "driver", key: "HOURS" },
        source: { kinds: ["COST"] },
      }),
    ];

    const result = runCosting(data, rules, { periodCodes: ["2026-01"] });
    const project = result.byObject.PROJECT;
    const allocated = sum(Object.values(project).map((b) => b.direct + b.indirect));

    expect(round2(allocated)).toBe(round2(result.totals.cost));
    expect(result.totals.unallocatedIndirect).toBe(0);
  });

  it("isole les charges directes sans objet de coût plutôt que de les perdre", () => {
    const data = base();
    data.entries = [
      cost("2026-01", 1_000, { NATURE: "MATERIAL", PROJECT: "A" }),
      cost("2026-01", 500, { NATURE: "MATERIAL" }), // directe mais non ventilée
    ];
    const rules = [
      rule({
        id: "direct",
        stage: 3,
        method: "DIRECT",
        targetDimensionCode: "AUTO_COST_OBJECT",
        source: { kinds: ["COST"], traceabilities: ["DIRECT"] },
      }),
    ];
    const result = runCosting(data, rules, { periodCodes: ["2026-01"] });
    expect(result.byObject.PROJECT[UNASSIGNED].direct).toBe(500);
    expect(result.byObject.PROJECT.A.direct).toBe(1_000);
  });

  it("produit le même résultat quel que soit l'ordre des écritures", () => {
    const data = base();
    const entries = [
      cost("2026-01", 800, { NATURE: "MATERIAL", PROJECT: "A" }),
      cost("2026-01", 400, { NATURE: "MATERIAL", PROJECT: "B" }),
      cost("2026-01", 1_200, { NATURE: "OVERHEAD", CENTER: "ADMIN" }, { traceability: "INDIRECT" }),
    ];
    const rules = [
      rule({ id: "s1", stage: 1, method: "DIRECT", targetDimensionCode: "CENTER", source: { traceabilities: ["INDIRECT"] } }),
      rule({ id: "s3", stage: 3, method: "DIRECT", targetDimensionCode: "AUTO_COST_OBJECT", source: { traceabilities: ["DIRECT"] } }),
      rule({
        id: "s3b",
        stage: 3,
        sortOrder: 40,
        method: "EQUAL",
        fromDimensionCode: "CENTER",
        targetDimensionCode: "PROJECT",
        source: {},
      }),
    ];

    data.entries = entries;
    const first = runCosting(data, rules, { periodCodes: ["2026-01"] }).byObject.PROJECT;
    data.entries = [...entries].reverse();
    const second = runCosting(data, rules, { periodCodes: ["2026-01"] }).byObject.PROJECT;

    expect(second).toEqual(first);
  });
});

describe("cascade de marge", () => {
  it("calcule les trois niveaux de marge", () => {
    // CA 100 000 · variables 60 000 · fixes directs 15 000 · indirects affectés 12 000
    const data = base();
    data.entries = [
      revenue("2026-01", 100_000, { PROJECT: "A" }),
      cost("2026-01", 60_000, { NATURE: "MATERIAL", PROJECT: "A" }, { behavior: "VARIABLE" }),
      cost("2026-01", 15_000, { NATURE: "MATERIAL", PROJECT: "A" }, { behavior: "FIXED" }),
      cost("2026-01", 12_000, { NATURE: "OVERHEAD", CENTER: "ADMIN" }, { traceability: "INDIRECT", behavior: "FIXED" }),
    ];
    const rules = [
      rule({ id: "s1", stage: 1, method: "DIRECT", targetDimensionCode: "CENTER", source: { traceabilities: ["INDIRECT"] } }),
      rule({ id: "s3", stage: 3, method: "DIRECT", targetDimensionCode: "AUTO_COST_OBJECT", source: { traceabilities: ["DIRECT"] } }),
      rule({
        id: "s3b",
        stage: 3,
        sortOrder: 40,
        method: "DRIVER",
        fromDimensionCode: "CENTER",
        targetDimensionCode: "PROJECT",
        driver: { type: "measure", key: "revenue" },
        source: {},
      }),
    ];

    const costing = runCosting(data, rules, { periodCodes: ["2026-01"] });
    const margins = computeMargins(data, costing, "PROJECT", { periodCodes: ["2026-01"] });
    const line = margins.lines.find((l) => l.memberCode === "A")!;

    expect(line.contributionMargin).toBe(40_000);
    expect(line.contributionMarginRate).toBe(40);
    expect(line.contributiveMargin).toBe(25_000);
    expect(line.allocatedIndirect).toBe(12_000);
    expect(line.operatingMargin).toBe(13_000);
  });
});

describe("charges semi-variables", () => {
  it("décompose par la méthode des points extrêmes", () => {
    // Activité (CA) 100 → coût 700 ; activité 200 → coût 900 ⇒ b = 2, a = 500
    const data = dataset({
      periods: [period("2026-01"), period("2026-02")],
      dimensions: [dimension("NATURE", "Nature")],
      members: [member("NATURE", "ENERGY", "Énergie")],
      entries: [
        revenue("2026-01", 100),
        revenue("2026-02", 200),
        cost("2026-01", 700, { NATURE: "ENERGY" }, { behavior: "SEMI_VARIABLE" }),
        cost("2026-02", 900, { NATURE: "ENERGY" }, { behavior: "SEMI_VARIABLE" }),
      ],
    });

    const { models, split } = splitSemiVariable(data);
    const model = models.get("ENERGY")!;
    expect(model.variablePerUnit).toBeCloseTo(2, 6);
    expect(model.fixedPerPeriod).toBeCloseTo(500, 6);

    const january = data.entries.find((e) => e.periodCode === "2026-01" && e.kind === "COST")!;
    expect(split.get(january.id)).toEqual({ fixed: 500, variable: 200 });
  });
});

describe("suivi à l'avancement", () => {
  it("calcule EAC, reste à engager et dérive", () => {
    const data = dataset({
      periods: [period("2026-01")],
      dimensions: [
        dimension("NATURE", "Nature"),
        dimension("PROJECT", "Chantier", { kind: "COST_OBJECT", isCostObject: true }),
      ],
      members: [
        member("PROJECT", "ALBA", "Résidence Alba", {
          contractValue: 1_240_000,
          budgetTotal: 1_010_000,
          progress: 0.62,
        }),
      ],
      entries: [cost("2026-01", 688_000, { PROJECT: "ALBA" })],
    });

    const [line] = computeProgress(data, "PROJECT");
    expect(line.progressPct).toBe(62);
    expect(line.estimateAtCompletion).toBe(round2(688_000 / 0.62));
    expect(line.estimateToComplete).toBe(round2(688_000 / 0.62 - 688_000));
    expect(line.drift).toBeGreaterThan(0);
    expect(line.marginAtCompletion).toBe(round2(1_240_000 - 688_000 / 0.62));
    expect(line.progressMethod).toBe("physical");
  });

  it("bascule sur la méthode cost-to-cost sans avancement physique", () => {
    const data = dataset({
      periods: [period("2026-01")],
      dimensions: [dimension("PROJECT", "Chantier", { kind: "COST_OBJECT", isCostObject: true })],
      members: [member("PROJECT", "X", "Affaire X", { contractValue: 200, budgetTotal: 100 })],
      entries: [cost("2026-01", 50, { PROJECT: "X" })],
    });
    const [line] = computeProgress(data, "PROJECT");
    expect(line.progressMethod).toBe("cost-to-cost");
    expect(line.progressPct).toBe(50);
  });
});
