import { describe, expect, it } from "vitest";
import { allocateProportional, pctChange, round2, safeDiv, sum } from "@/core/model/money";

describe("arithmétique monétaire", () => {
  it("arrondit au centime", () => {
    expect(round2(10.005)).toBe(10.01);
    expect(round2(10.004)).toBe(10);
    expect(round2(-3.456)).toBe(-3.46);
  });

  it("ne produit jamais NaN ni Infinity", () => {
    expect(round2(Number.NaN)).toBe(0);
    expect(round2(Number.POSITIVE_INFINITY)).toBe(0);
    expect(safeDiv(1, 0)).toBeNull();
    expect(safeDiv(null, 2)).toBeNull();
  });

  it("calcule une variation relative protégée", () => {
    expect(pctChange(110, 100)).toBeCloseTo(10);
    expect(pctChange(90, 100)).toBeCloseTo(-10);
    expect(pctChange(10, 0)).toBeNull();
  });
});

describe("répartition proportionnelle", () => {
  it("répartit selon les poids", () => {
    const result = allocateProportional(30_000, [
      { key: "A", weight: 600 },
      { key: "B", weight: 300 },
      { key: "C", weight: 100 },
    ]);
    expect(result.map((r) => r.amount)).toEqual([18_000, 9_000, 3_000]);
  });

  it("conserve la masse malgré les arrondis", () => {
    const result = allocateProportional(100, [
      { key: "A", weight: 1 },
      { key: "B", weight: 1 },
      { key: "C", weight: 1 },
    ]);
    expect(round2(sum(result.map((r) => r.amount)))).toBe(100);
  });

  it("conserve la masse sur 500 tirages aléatoires", () => {
    for (let i = 0; i < 500; i += 1) {
      const amount = Math.round(Math.random() * 1_000_000) / 100;
      const weights = Array.from({ length: 2 + (i % 7) }, (_, index) => ({
        key: index,
        weight: Math.random() * 100,
      }));
      const result = allocateProportional(amount, weights);
      expect(Math.abs(sum(result.map((r) => r.amount)) - round2(amount))).toBeLessThan(0.011);
    }
  });

  it("retourne une liste vide quand aucun poids n'est exploitable", () => {
    expect(allocateProportional(500, [{ key: "A", weight: 0 }])).toEqual([]);
    expect(allocateProportional(500, [])).toEqual([]);
  });
});
