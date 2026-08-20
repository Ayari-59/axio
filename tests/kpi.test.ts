import { describe, expect, it } from "vitest";
import {
  FormulaError,
  evaluateFormula,
  parseFormula,
  validateFormula,
} from "@/core/kpi/formula";
import { computeKpis } from "@/core/kpi/engine";
import { KPI_CATALOG } from "@/core/kpi/catalog";
import { isKnownMeasure } from "@/core/model/dataset";
import { budget, cost, dataset, dimension, member, period, revenue } from "./fixtures/builders";

const ctx = (values: Record<string, number | null>) => ({
  get: (name: string) => values[name] ?? null,
  prev: (name: string) => values[`prev_${name}`] ?? null,
  ytd: (name: string) => values[`ytd_${name}`] ?? null,
  budget: (name: string) => values[`budget_${name}`] ?? null,
});

describe("analyseur de formules", () => {
  it("respecte la priorité des opérateurs", () => {
    expect(evaluateFormula("2 + 3 * 4", ctx({}))).toBe(14);
    expect(evaluateFormula("(2 + 3) * 4", ctx({}))).toBe(20);
    expect(evaluateFormula("-3 + 10", ctx({}))).toBe(7);
  });

  it("résout les mesures et les fonctions", () => {
    const values = { revenue: 1000, variableCost: 400, prev_revenue: 800, budget_revenue: 1200 };
    expect(evaluateFormula("(revenue - variableCost) / revenue * 100", ctx(values))).toBe(60);
    expect(evaluateFormula("(revenue - prev(revenue)) / prev(revenue) * 100", ctx(values))).toBe(25);
    expect(evaluateFormula("(revenue - budget(revenue)) / budget(revenue) * 100", ctx(values))).toBeCloseTo(-16.6667, 3);
    expect(evaluateFormula("min(revenue, 500)", ctx(values))).toBe(500);
    expect(evaluateFormula("round(revenue / 3, 2)", ctx(values))).toBe(333.33);
    expect(evaluateFormula("safe(unknownThing, 42)", ctx(values))).toBe(42);
  });

  it("retourne null au lieu de NaN ou Infinity", () => {
    expect(evaluateFormula("revenue / 0", ctx({ revenue: 100 }))).toBeNull();
    expect(evaluateFormula("revenue / missing", ctx({ revenue: 100 }))).toBeNull();
    expect(evaluateFormula("missing * 2", ctx({}))).toBeNull();
  });

  it("refuse les formules invalides", () => {
    expect(() => parseFormula("revenue +")).toThrow(FormulaError);
    expect(() => parseFormula("revenue * (2")).toThrow(FormulaError);
    expect(() => parseFormula("hack()")).toThrow(FormulaError);
    expect(() => parseFormula("process.exit(1)")).toThrow(FormulaError);
  });

  it("valide les mesures référencées", () => {
    const ok = validateFormula("contributionMargin / revenue * 100", (name) => isKnownMeasure(name));
    expect(ok.ok).toBe(true);

    const ko = validateFormula("chiffreAffaires / 2", (name) => isKnownMeasure(name));
    expect(ko.ok).toBe(false);
    expect(ko.errors[0]).toContain("chiffreAffaires");
  });

  it("valide toutes les formules du catalogue livré", () => {
    for (const spec of KPI_CATALOG) {
      const result = validateFormula(spec.formula, (name) =>
        isKnownMeasure(name) ||
        ["topShare_CLIENT", "progressPct", "marginAtCompletion", "estimateToComplete", "eacDriftPct"].includes(name),
      );
      expect({ code: spec.code, ok: result.ok, errors: result.errors }).toEqual({
        code: spec.code,
        ok: true,
        errors: [],
      });
    }
  });
});

describe("moteur KPI", () => {
  const data = dataset({
    periods: [period("2026-01"), period("2026-02")],
    dimensions: [dimension("NATURE", "Nature")],
    members: [member("NATURE", "PAYROLL", "Salaires")],
    entries: [
      revenue("2026-01", 1000),
      cost("2026-01", 400, { NATURE: "PAYROLL" }, { behavior: "VARIABLE" }),
      revenue("2026-02", 1200),
      cost("2026-02", 500, { NATURE: "PAYROLL" }, { behavior: "VARIABLE" }),
    ],
    drivers: [{ periodCode: "2026-02", driverCode: "FTE", value: 4 }],
    budgets: [
      budget([
        { periodCode: "2026-02", kind: "REVENUE", behavior: "VARIABLE", dims: {}, amount: 1000 },
        { periodCode: "2026-02", kind: "COST", behavior: "VARIABLE", dims: {}, amount: 600 },
      ]),
    ],
  });

  it("calcule, marque les données manquantes et exclut le non-applicable", () => {
    const specs = [
      KPI_CATALOG.find((k) => k.code === "MARGIN_RATE")!,
      KPI_CATALOG.find((k) => k.code === "UTILIZATION")!, // capacité absente
      KPI_CATALOG.find((k) => k.code === "REVENUE_PER_FTE")!,
      KPI_CATALOG.find((k) => k.code === "SCRAP_RATE")!, // capacité absente
    ];

    const results = computeKpis(data, specs, {
      periodCode: "2026-02",
      capabilities: [],
      budget: data.budgets[0],
    });

    const byCode = new Map(results.map((r) => [r.code, r]));
    expect(byCode.get("MARGIN_RATE")!.status).toBe("computed");
    expect(byCode.get("MARGIN_RATE")!.value).toBeCloseTo(58.33, 1);
    expect(byCode.get("REVENUE_PER_FTE")!.value).toBe(300);
    expect(byCode.get("UTILIZATION")!.status).toBe("not_applicable");
    expect(byCode.get("SCRAP_RATE")!.status).toBe("not_applicable");
  });

  it("signale une donnée manquante quand la capacité est active mais la mesure absente", () => {
    const spec = KPI_CATALOG.find((k) => k.code === "UTILIZATION")!;
    const [result] = computeKpis(data, [spec], {
      periodCode: "2026-02",
      capabilities: ["timesheets"],
    });
    expect(result.status).toBe("missing_data");
    expect(result.missingMeasures).toContain("driver_BILLABLE_HOURS");
    expect(result.value).toBeNull();
  });

  it("calcule un écart budgétaire", () => {
    const spec = KPI_CATALOG.find((k) => k.code === "BUDGET_VARIANCE_PCT")!;
    const [result] = computeKpis(data, [spec], {
      periodCode: "2026-02",
      capabilities: ["budget_control"],
      budget: data.budgets[0],
    });
    expect(result.value).toBe(20); // 1 200 vs 1 000
  });

  it("fournit la tendance et la variation", () => {
    const spec = KPI_CATALOG.find((k) => k.code === "REVENUE")!;
    const [result] = computeKpis(data, [spec], { periodCode: "2026-02", capabilities: [] });
    expect(result.value).toBe(1200);
    expect(result.previous).toBe(1000);
    expect(result.deltaPct).toBe(20);
    expect(result.trend.length).toBe(2);
  });
});
