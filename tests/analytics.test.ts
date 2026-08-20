import { describe, expect, it } from "vitest";
import { backtest, forecast, mape, nextPeriodCode } from "@/core/analytics/forecast";
import { applyLevers, computeBreakEven, priceVolumeTradeOff, simulate } from "@/core/analytics/simulation";
import { detectDrift, detectOutliers, detectTrendBreak } from "@/core/analytics/anomaly";

const series = (values: number[], start = 1) =>
  values.map((value, index) => ({
    periodCode: `2025-${String(start + index).padStart(2, "0")}`,
    value,
  }));

describe("prévision", () => {
  it("incrémente les codes de période", () => {
    expect(nextPeriodCode("2026-01")).toBe("2026-02");
    expect(nextPeriodCode("2026-12")).toBe("2027-01");
    expect(nextPeriodCode("2026-11", 3)).toBe("2027-02");
  });

  it("prolonge exactement une tendance linéaire", () => {
    const result = forecast(series([100, 200, 300, 400, 500, 600]), 3, "linear_trend");
    expect(result.points.map((p) => Math.round(p.value))).toEqual([700, 800, 900]);
  });

  it("reproduit la dernière valeur en méthode naïve", () => {
    const result = forecast(series([10, 20, 15, 30]), 2, "naive");
    expect(result.points.map((p) => p.value)).toEqual([30, 30]);
  });

  it("choisit la méthode la plus fiable par backtest", () => {
    const linear = series([100, 200, 300, 400, 500, 600, 700, 800, 900]);
    const result = forecast(linear, 3);
    expect(result.method).toBe("linear_trend");
    expect(result.mape).toBeLessThan(1);
    expect(result.reason).toContain("backtest");
  });

  it("calcule un MAPE exact", () => {
    expect(mape([100, 200], [110, 180])).toBe(10); // (10 % + 10 %) / 2
    expect(mape([0], [10])).toBeNull();
  });

  it("ne prétend rien départager sur un historique trop court", () => {
    expect(backtest(series([100, 110]), "linear_trend")).toBeNull();
  });
});

describe("seuil de rentabilité", () => {
  const model = {
    revenue: 1_000_000,
    variableCost: 600_000,
    fixedCost: 300_000,
    payroll: 250_000,
    subcontracting: 50_000,
    purchases: 300_000,
    quantity: 1000,
    headcount: 10,
  };

  it("applique les formules du contrôle de gestion", () => {
    const result = computeBreakEven(model);
    expect(result.contributionMargin).toBe(400_000);
    expect(result.contributionMarginRate).toBe(40);
    expect(result.breakEven).toBe(750_000); // 300 000 / 0,40
    expect(result.result).toBe(100_000);
    expect(result.operatingLeverage).toBe(4); // 400 000 / 100 000
    expect(result.safetyMarginRate).toBe(25); // (1 000 000 − 750 000) / 1 000 000
  });

  it("ne calcule pas de seuil quand la marge sur coûts variables est négative", () => {
    const result = computeBreakEven({ ...model, variableCost: 1_200_000 });
    expect(result.breakEven).toBeNull();
  });
});

describe("simulateur what-if", () => {
  const model = {
    revenue: 1_000_000,
    variableCost: 600_000,
    fixedCost: 300_000,
    payroll: 250_000,
    subcontracting: 50_000,
    purchases: 300_000,
    quantity: 1000,
    headcount: 10,
  };

  it("un effet prix ne touche pas les coûts", () => {
    const { model: after } = applyLevers(model, [
      { id: "1", target: "price", changeType: "pct", value: 5 },
    ]);
    expect(after.revenue).toBe(1_050_000);
    expect(after.variableCost).toBe(600_000);
  });

  it("un effet volume touche le CA et les coûts variables", () => {
    const { model: after } = applyLevers(model, [
      { id: "1", target: "volume", changeType: "pct", value: -10 },
    ]);
    expect(after.revenue).toBeCloseTo(900_000);
    expect(after.variableCost).toBeCloseTo(540_000);
  });

  it("combine prix +5 % et volume −3 %", () => {
    const result = simulate(model, [
      { id: "1", target: "price", changeType: "pct", value: 5 },
      { id: "2", target: "volume", changeType: "pct", value: -3 },
    ]);
    // CA = 1 000 000 × 1,05 × 0,97 = 1 018 500 ; CV = 600 000 × 0,97 = 582 000
    expect(result.after.revenue).toBeCloseTo(1_018_500, 0);
    expect(result.after.variableCost).toBeCloseTo(582_000, 0);
    expect(result.after.result).toBeCloseTo(136_500, 0);
    expect(result.deltas.result).toBeCloseTo(36_500, 0);
  });

  it("chiffre une embauche au coût moyen constaté", () => {
    const result = simulate(model, [{ id: "1", target: "headcount", changeType: "abs", value: 2 }]);
    // coût moyen = 250 000 / 10 = 25 000 → +50 000 de charges fixes
    expect(result.after.fixedCost).toBe(350_000);
    expect(result.deltas.result).toBe(-50_000);
  });

  it("un gain de productivité réduit les coûts variables", () => {
    const { model: after } = applyLevers(model, [
      { id: "1", target: "productivity", changeType: "pct", value: 10 },
    ]);
    expect(after.variableCost).toBeCloseTo(600_000 / 1.1, 2);
  });

  it("calcule le volume nécessaire pour compenser une baisse de prix", () => {
    // taux de marge 40 % ; −5 points de prix → nouveau taux 35 % → +14,3 % de volume
    expect(priceVolumeTradeOff(model, -5)).toBeCloseTo(14.29, 1);
  });

  it("signale les leviers non chiffrables plutôt que d'inventer", () => {
    const result = simulate(
      { ...model, headcount: 0, payroll: 0 },
      [{ id: "1", target: "headcount", changeType: "abs", value: 3 }],
    );
    expect(result.notes.join(" ")).toContain("coût moyen");
  });
});

describe("détection", () => {
  it("repère une valeur aberrante", () => {
    const detections = detectOutliers(series([100, 102, 98, 101, 99, 103, 400]), "revenue");
    expect(detections.length).toBe(1);
    expect(detections[0].periodCode).toBe("2025-07");
  });

  it("ne signale rien sur une série régulière", () => {
    expect(detectOutliers(series([100, 101, 99, 100, 102, 98]), "revenue")).toEqual([]);
  });

  it("repère une rupture de tendance", () => {
    const detections = detectTrendBreak(series([100, 100, 100, 200, 210, 190]), "revenue");
    expect(detections.length).toBe(1);
    expect(detections[0].code).toBe("TREND_BREAK");
  });

  it("repère une dérive coûts / activité", () => {
    const activity = series([100, 101, 102]);
    const costs = series([100, 120, 140]);
    const detections = detectDrift(activity, costs, "costTotal");
    expect(detections.length).toBe(1);
    expect(detections[0].deviation).toBeGreaterThan(10);
  });
});
