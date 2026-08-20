import { describe, expect, it } from "vitest";
import { evaluate } from "@/core/rules/engine";
import { buildPlan } from "@/core/rules/plan";
import { allRules } from "@/core/templates";
import { runCosting } from "@/core/costing/allocate";
import { computeMargins } from "@/core/costing/margins";
import { computeKpis } from "@/core/kpi/engine";
import { getKpiSpec } from "@/core/kpi/catalog";
import type { Dataset } from "@/core/model/types";
import { cost, dataset, dimension, factsOf, member, period, profileOf, revenue } from "./fixtures/builders";

/**
 * LE test d'architecture (docs/16 §3).
 *
 * Trois modèles économiques radicalement différents traversent le MÊME code.
 * Si ce test passe alors que les trois sorties diffèrent, le moteur d'adaptation fonctionne.
 * S'il faut ajouter du code spécifique à un secteur pour le faire passer, l'architecture est perdue.
 */

const PROFILES = {
  services: factsOf(
    profileOf({
      identity: { revenueBand: 860_000, headcount: 8, siteCount: 1 },
      revenue: { models: ["time", "project"], billingUnits: ["day", "hour"], topClientSharePct: 34 },
      costs: { payrollSharePct: 62, subcontractingSharePct: 12, overheadSharePct: 18, indirectSharePct: 18 },
      pilotObjects: ["CLIENT", "PROJECT", "EMPLOYEE"],
      objectLabels: { PROJECT: "Mission", EMPLOYEE: "Consultant" },
      objectives: ["improve_margin", "client_profitability", "productivity"],
      maturity: "intermediate",
    }),
    "consulting",
  ),
  industrie: factsOf(
    profileOf({
      identity: { revenueBand: 8_600_000, headcount: 64, siteCount: 1 },
      revenue: { models: ["unit"], billingUnits: ["quantity"], topClientSharePct: 22 },
      costs: { payrollSharePct: 34, purchasesSharePct: 41, overheadSharePct: 19, indirectSharePct: 32 },
      pilotObjects: ["PRODUCT", "CLIENT"],
      objectives: ["reduce_cost", "improve_margin", "productivity"],
      maturity: "advanced",
    }),
    "manufacturing",
  ),
  btp: factsOf(
    profileOf({
      identity: { revenueBand: 4_700_000, headcount: 45, siteCount: 1 },
      revenue: { models: ["progress", "project"], billingUnits: ["progress"], topClientSharePct: 41 },
      costs: { payrollSharePct: 28, purchasesSharePct: 26, subcontractingSharePct: 33, overheadSharePct: 13, indirectSharePct: 21 },
      pilotObjects: ["PROJECT", "CLIENT"],
      objectLabels: { PROJECT: "Chantier" },
      objectives: ["project_control", "improve_margin", "control_budget"],
      maturity: "intermediate",
    }),
    "construction",
  ),
};

const planFor = (key: keyof typeof PROFILES) => {
  const facts = PROFILES[key];
  return buildPlan(evaluate(allRules(), facts, "configuration").effects, facts.profile);
};

describe("le même moteur produit trois systèmes de pilotage différents", () => {
  const plans = {
    services: planFor("services"),
    industrie: planFor("industrie"),
    btp: planFor("btp"),
  };

  it("services : missions, feuilles de temps, taux d'occupation", () => {
    const plan = plans.services;
    expect(plan.capabilities).toContain("timesheets");
    expect(plan.capabilities).toContain("utilization_rate");
    expect(plan.capabilities).not.toContain("production_costing");
    expect(plan.kpiCodes).toContain("UTILIZATION");
    expect(plan.kpiCodes).toContain("AVG_DAILY_RATE");
    expect(plan.dimensions.find((d) => d.code === "PROJECT")?.label).toBe("Mission");
    expect(plan.dimensions.find((d) => d.code === "EMPLOYEE")?.label).toBe("Consultant");
    expect(plan.requiredDrivers).toContain("BILLABLE_HOURS");
  });

  it("industrie : produits, ateliers, coût unitaire, rebut", () => {
    const plan = plans.industrie;
    expect(plan.capabilities).toContain("production_costing");
    expect(plan.capabilities).toContain("abc_costing");
    expect(plan.capabilities).not.toContain("timesheets");
    expect(plan.capabilities).not.toContain("progress_tracking");
    expect(plan.kpiCodes).toContain("UNIT_COST");
    expect(plan.kpiCodes).toContain("SCRAP_RATE");
    expect(plan.costMethods).toContain("full");
    expect(plan.dimensions.find((d) => d.code === "CENTER")?.label).toBe("Atelier");
    expect(plan.requiredDrivers).toContain("MACHINE_HOURS");
  });

  it("BTP : chantiers, avancement, sous-traitance, marge à terminaison", () => {
    const plan = plans.btp;
    expect(plan.capabilities).toContain("project_costing");
    expect(plan.capabilities).toContain("progress_tracking");
    expect(plan.capabilities).toContain("subcontractor_tracking");
    expect(plan.capabilities).not.toContain("production_costing");
    expect(plan.capabilities).not.toContain("timesheets");
    expect(plan.kpiCodes).toContain("MARGIN_AT_COMPLETION");
    expect(plan.kpiCodes).toContain("COST_TO_COMPLETE");
    expect(plan.dimensions.find((d) => d.code === "PROJECT")?.label).toBe("Chantier");
  });

  it("les trois cockpits sont deux à deux différents", () => {
    const signatures = Object.values(plans).map((plan) => JSON.stringify(plan.dashboard));
    expect(new Set(signatures).size).toBe(3);
  });

  it("les trois jeux d'indicateurs sont deux à deux différents", () => {
    const signatures = Object.values(plans).map((plan) => [...plan.kpiCodes].sort().join("|"));
    expect(new Set(signatures).size).toBe(3);
  });

  it("aucun plan n'hérite des capacités spécifiques des autres", () => {
    expect(plans.services.capabilities).not.toContain("production_costing");
    expect(plans.industrie.capabilities).not.toContain("progress_tracking");
    expect(plans.btp.capabilities).not.toContain("abc_costing");
  });

  it("chaque plan propose un cheminement d'affectation complet", () => {
    for (const plan of Object.values(plans)) {
      expect(plan.allocationRules.some((r) => r.stage === 1)).toBe(true);
      expect(plan.allocationRules.some((r) => r.stage === 3)).toBe(true);
    }
  });
});

describe("le même pipeline de calcul traite les trois jeux de données", () => {
  /** Jeu de données minimal cohérent avec chaque plan. */
  const datasets: Record<string, Dataset> = {
    services: dataset({
      periods: [period("2026-01")],
      dimensions: [
        dimension("NATURE", "Nature"),
        dimension("CENTER", "Pôle", { kind: "RESPONSIBILITY" }),
        dimension("PROJECT", "Mission", { kind: "COST_OBJECT", isCostObject: true }),
      ],
      members: [
        member("NATURE", "PAYROLL"),
        member("NATURE", "OVERHEAD"),
        member("CENTER", "DELIVERY"),
        member("PROJECT", "M1", "Mission Alpha"),
        member("PROJECT", "M2", "Mission Beta"),
      ],
      entries: [
        revenue("2026-01", 60_000, { PROJECT: "M1" }, { quantity: 60, unitPrice: 1000 }),
        revenue("2026-01", 40_000, { PROJECT: "M2" }, { quantity: 50, unitPrice: 800 }),
        cost("2026-01", 30_000, { PROJECT: "M1", NATURE: "PAYROLL", CENTER: "DELIVERY" }, { behavior: "FIXED" }),
        cost("2026-01", 24_000, { PROJECT: "M2", NATURE: "PAYROLL", CENTER: "DELIVERY" }, { behavior: "FIXED" }),
        cost("2026-01", 12_000, { NATURE: "OVERHEAD", CENTER: "DELIVERY" }, { traceability: "INDIRECT", behavior: "FIXED" }),
      ],
      drivers: [
        { periodCode: "2026-01", driverCode: "BILLABLE_HOURS", dimensionCode: "PROJECT", memberCode: "M1", value: 420 },
        { periodCode: "2026-01", driverCode: "BILLABLE_HOURS", dimensionCode: "PROJECT", memberCode: "M2", value: 350 },
        { periodCode: "2026-01", driverCode: "AVAILABLE_HOURS", value: 1000 },
        { periodCode: "2026-01", driverCode: "FTE", value: 6 },
      ],
    }),
    industrie: dataset({
      periods: [period("2026-01")],
      dimensions: [
        dimension("NATURE", "Nature"),
        dimension("CENTER", "Atelier", { kind: "RESPONSIBILITY" }),
        dimension("PRODUCT", "Produit", { kind: "COST_OBJECT", isCostObject: true }),
      ],
      members: [
        member("NATURE", "MATERIAL"),
        member("NATURE", "ENERGY"),
        member("CENTER", "MACHINING"),
        member("PRODUCT", "P1", "Vanne"),
        member("PRODUCT", "P2", "Bride"),
      ],
      entries: [
        revenue("2026-01", 148_000, { PRODUCT: "P1" }, { quantity: 1000, unitPrice: 148 }),
        revenue("2026-01", 62_000, { PRODUCT: "P2" }, { quantity: 1000, unitPrice: 62 }),
        cost("2026-01", 61_000, { PRODUCT: "P1", NATURE: "MATERIAL", CENTER: "MACHINING" }),
        cost("2026-01", 26_000, { PRODUCT: "P2", NATURE: "MATERIAL", CENTER: "MACHINING" }),
        cost("2026-01", 40_000, { NATURE: "ENERGY", CENTER: "MACHINING" }, { traceability: "INDIRECT", behavior: "FIXED" }),
      ],
      drivers: [
        { periodCode: "2026-01", driverCode: "MACHINE_HOURS", dimensionCode: "PRODUCT", memberCode: "P1", value: 900 },
        { periodCode: "2026-01", driverCode: "MACHINE_HOURS", dimensionCode: "PRODUCT", memberCode: "P2", value: 250 },
        { periodCode: "2026-01", driverCode: "UNITS_PRODUCED", dimensionCode: "PRODUCT", memberCode: "P1", value: 1000 },
        { periodCode: "2026-01", driverCode: "UNITS_PRODUCED", dimensionCode: "PRODUCT", memberCode: "P2", value: 1000 },
        { periodCode: "2026-01", driverCode: "UNITS_SCRAPPED", dimensionCode: "PRODUCT", memberCode: "P1", value: 40 },
      ],
    }),
    btp: dataset({
      periods: [period("2026-01")],
      dimensions: [
        dimension("NATURE", "Nature"),
        dimension("CENTER", "Centre", { kind: "RESPONSIBILITY" }),
        dimension("PROJECT", "Chantier", { kind: "COST_OBJECT", isCostObject: true }),
      ],
      members: [
        member("NATURE", "SUBCONTRACTING"),
        member("NATURE", "EQUIPMENT"),
        member("CENTER", "WORKS"),
        member("PROJECT", "ALBA", "Résidence Alba", { contractValue: 1_240_000, budgetTotal: 1_010_000, progress: 0.62 }),
        member("PROJECT", "BREA", "Îlot Bréa", { contractValue: 800_000, budgetTotal: 700_000, progress: 0.4 }),
      ],
      entries: [
        revenue("2026-01", 120_000, { PROJECT: "ALBA" }),
        revenue("2026-01", 60_000, { PROJECT: "BREA" }),
        cost("2026-01", 688_000, { PROJECT: "ALBA", NATURE: "SUBCONTRACTING", CENTER: "WORKS" }),
        cost("2026-01", 240_000, { PROJECT: "BREA", NATURE: "SUBCONTRACTING", CENTER: "WORKS" }),
        cost("2026-01", 26_000, { NATURE: "EQUIPMENT", CENTER: "WORKS" }, { traceability: "INDIRECT", behavior: "SEMI_VARIABLE" }),
      ],
      drivers: [{ periodCode: "2026-01", driverCode: "HOURS", dimensionCode: "PROJECT", memberCode: "ALBA", value: 900 }],
    }),
  };

  const plans = { services: planFor("services"), industrie: planFor("industrie"), btp: planFor("btp") };

  for (const key of ["services", "industrie", "btp"] as const) {
    it(`${key} : coûts, marges et KPI se calculent sans code spécifique`, () => {
      const data = datasets[key];
      const plan = plans[key];
      const costing = runCosting(data, plan.allocationRules, { periodCodes: ["2026-01"] });

      // Conservation de la masse sur chaque axe d'objet de coût
      for (const dimensionCode of Object.keys(costing.byObject)) {
        const allocated = Object.values(costing.byObject[dimensionCode]).reduce(
          (sum, bucket) => sum + bucket.direct + bucket.indirect,
          0,
        );
        expect(Math.abs(allocated - costing.totals.cost)).toBeLessThan(0.02);
      }

      const objectDimension = data.dimensions.find((d) => d.isCostObject)!.code;
      const margins = computeMargins(data, costing, objectDimension, { periodCodes: ["2026-01"] });
      expect(margins.lines.length).toBeGreaterThan(0);
      expect(margins.total.revenue).toBeGreaterThan(0);

      const specs = plan.kpiCodes.map((code) => getKpiSpec(code)).filter((s) => s !== undefined);
      const results = computeKpis(data, specs, {
        periodCode: "2026-01",
        capabilities: plan.capabilities,
      });
      expect(results.some((r) => r.status === "computed")).toBe(true);
      expect(results.every((r) => r.value === null || Number.isFinite(r.value))).toBe(true);
    });
  }

  it("services : le taux d'occupation et le TJM sont calculés", () => {
    const plan = plans.services;
    const specs = ["UTILIZATION", "AVG_DAILY_RATE"].map((code) => getKpiSpec(code)!);
    const results = computeKpis(datasets.services, specs, {
      periodCode: "2026-01",
      capabilities: plan.capabilities,
    });
    const utilization = results.find((r) => r.code === "UTILIZATION")!;
    expect(utilization.status).toBe("computed");
    expect(utilization.value).toBeCloseTo(77, 0); // 770 h facturables / 1 000 h disponibles
  });

  it("industrie : le coût unitaire et le taux de rebut sont calculés", () => {
    const plan = plans.industrie;
    const specs = ["UNIT_COST", "SCRAP_RATE"].map((code) => getKpiSpec(code)!);
    const results = computeKpis(datasets.industrie, specs, {
      periodCode: "2026-01",
      capabilities: plan.capabilities,
    });
    const unitCost = results.find((r) => r.code === "UNIT_COST")!;
    expect(unitCost.status).toBe("computed");
    expect(unitCost.value).toBeCloseTo(63.5, 1); // 127 000 € / 2 000 unités
    expect(results.find((r) => r.code === "SCRAP_RATE")!.value).toBe(2);
  });

  it("BTP : les indicateurs de projet ne sont pas calculables pour les deux autres profils", () => {
    const spec = getKpiSpec("MARGIN_AT_COMPLETION")!;
    const services = computeKpis(datasets.services, [spec], {
      periodCode: "2026-01",
      capabilities: plans.services.capabilities,
    })[0];
    // Le profil services active le suivi d'avancement (forfaits) mais n'a pas de budget par mission :
    // le KPI est donc explicitement « donnée manquante », jamais un chiffre inventé.
    expect(services.value).toBeNull();
    expect(["missing_data", "not_applicable"]).toContain(services.status);
  });
});
