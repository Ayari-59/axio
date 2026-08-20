import { describe, expect, it } from "vitest";
import {
  decomposeDirectCost,
  decomposeIndirectCost,
  decomposePriceVolumeMix,
} from "@/core/budget/variance";

/**
 * Cas d'école à résultat connu, calculé à la main dans les commentaires.
 * Toute évolution du moteur qui casserait la méthode est détectée ici.
 */

describe("écart sur chiffre d'affaires — prix / volume / composition", () => {
  // Produit A : budget 1 000 u × 10 € = 10 000 ; réel 1 200 u × 9,50 € = 11 400
  // Produit B : budget 1 000 u × 20 € = 20 000 ; réel   700 u × 21,00 € = 14 700
  // Budget 30 000 · réel 26 100 → écart total = −3 900
  const budget = [
    { key: "A", quantity: 1000, unitPrice: 10 },
    { key: "B", quantity: 1000, unitPrice: 20 },
  ];
  const actual = [
    { key: "A", quantity: 1200, unitPrice: 9.5 },
    { key: "B", quantity: 700, unitPrice: 21 },
  ];

  const result = decomposePriceVolumeMix(budget, actual);

  it("calcule l'écart total", () => {
    expect(result.budgetTotal).toBe(30_000);
    expect(result.actualTotal).toBe(26_100);
    expect(result.total).toBe(-3_900);
  });

  it("isole l'effet prix", () => {
    // 1 200 × (9,50 − 10) + 700 × (21 − 20) = −600 + 700 = +100
    expect(result.price).toBe(100);
  });

  it("isole l'effet volume", () => {
    // prix moyen budgété = 30 000 / 2 000 = 15 ; (1 900 − 2 000) × 15 = −1 500
    expect(result.averageBudgetPrice).toBe(15);
    expect(result.volume).toBe(-1_500);
  });

  it("isole l'effet composition", () => {
    // Σ Qr·Pb − Qr·P̄b = (1 200×10 + 700×20) − 1 900×15 = 26 000 − 28 500 = −2 500
    expect(result.mix).toBe(-2_500);
  });

  it("vérifie l'identité prix + volume + mix = écart total", () => {
    expect(result.price + result.volume + result.mix).toBeCloseTo(result.total, 2);
  });

  it("vérifie l'identité sur des jeux aléatoires", () => {
    for (let i = 0; i < 200; i += 1) {
      const keys = ["A", "B", "C", "D"].slice(0, 2 + (i % 3));
      const b = keys.map((key) => ({ key, quantity: 10 + Math.random() * 500, unitPrice: 5 + Math.random() * 90 }));
      const a = keys.map((key) => ({ key, quantity: 10 + Math.random() * 500, unitPrice: 5 + Math.random() * 90 }));
      const r = decomposePriceVolumeMix(b, a);
      expect(Math.abs(r.price + r.volume + r.mix - r.total)).toBeLessThan(0.05);
    }
  });
});

describe("écart sur charges directes", () => {
  it("sépare prix et quantité", () => {
    // Réel 1 100 kg × 4,20 € = 4 620 ; préétabli 1 000 kg × 4 € = 4 000
    const result = decomposeDirectCost({
      actualQuantity: 1100,
      actualPrice: 4.2,
      standardQuantity: 1000,
      standardPrice: 4,
    });
    expect(result.total).toBe(620);
    expect(result.price).toBe(220); // 1 100 × 0,20
    expect(result.quantity).toBe(400); // 100 × 4
    expect(result.price + result.quantity).toBeCloseTo(result.total, 2);
  });
});

describe("écart sur charges indirectes — méthode des trois écarts", () => {
  // AN 10 000 h · f = 40 000 € · v = 3 €/h · AR = 9 000 h · AP = 8 500 h · CR = 70 000 €
  const result = decomposeIndirectCost({
    normalActivity: 10_000,
    budgetedFixed: 40_000,
    budgetedVariableUnit: 3,
    actualActivity: 9_000,
    standardActivity: 8_500,
    actualCost: 70_000,
  });

  it("calcule le coût préétabli unitaire", () => {
    expect(result.standardUnitCost).toBe(7); // 40 000 / 10 000 + 3
  });

  it("calcule les trois écarts", () => {
    expect(result.flexibleBudget).toBe(67_000); // 40 000 + 3 × 9 000
    expect(result.standardCostOfActualActivity).toBe(63_000); // 7 × 9 000
    expect(result.standardCostOfOutput).toBe(59_500); // 7 × 8 500

    expect(result.budget).toBe(3_000); // 70 000 − 67 000
    expect(result.activity).toBe(4_000); // 67 000 − 63 000
    expect(result.yield).toBe(3_500); // 63 000 − 59 500
    expect(result.total).toBe(10_500); // 70 000 − 59 500
  });

  it("vérifie l'identité budget + activité + rendement = écart total", () => {
    expect(result.budget + result.activity + result.yield).toBeCloseTo(result.total, 2);
  });

  it("donne un écart d'activité nul quand l'activité réelle égale l'activité normale", () => {
    const r = decomposeIndirectCost({
      normalActivity: 10_000,
      budgetedFixed: 40_000,
      budgetedVariableUnit: 3,
      actualActivity: 10_000,
      standardActivity: 10_000,
      actualCost: 70_000,
    });
    expect(r.activity).toBe(0);
    expect(r.yield).toBe(0);
  });
});
