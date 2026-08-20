import { describe, expect, it } from "vitest";
import { applyOperator, evaluate, evaluateCondition, resolveFact, when } from "@/core/rules/engine";
import { buildPlan, diffConfiguration } from "@/core/rules/plan";
import { allRules, PACKS } from "@/core/templates";
import type { Rule } from "@/core/rules/types";
import { factsOf, profileOf } from "./fixtures/builders";

const facts = factsOf(
  profileOf({
    identity: { revenueBand: 1_000_000, headcount: 12, siteCount: 1 },
    revenue: { models: ["time"], billingUnits: ["day"], topClientSharePct: 45 },
    costs: { payrollSharePct: 60, subcontractingSharePct: 15, indirectSharePct: 20 },
    pilotObjects: ["CLIENT", "PROJECT"],
    objectives: ["improve_margin"],
  }),
  "consulting",
);

describe("résolution des faits", () => {
  it("lit un chemin pointé", () => {
    expect(resolveFact(facts, "profile.costs.payrollSharePct")).toBe(60);
    expect(resolveFact(facts, "profile.revenue.models")).toEqual(["time"]);
  });

  it("refuse les chemins non sûrs", () => {
    expect(resolveFact(facts, "profile.__proto__")).toBeUndefined();
    expect(resolveFact(facts, "constructor.prototype")).toBeUndefined();
    expect(resolveFact(facts, "profile.identity.does.not.exist")).toBeUndefined();
  });
});

describe("opérateurs", () => {
  it("couvre les comparaisons et les collections", () => {
    expect(applyOperator(10, "gte", 10)).toBe(true);
    expect(applyOperator(10, "lt", 10)).toBe(false);
    expect(applyOperator(["a", "b"], "includes", "b")).toBe(true);
    expect(applyOperator(["a"], "excludes", "b")).toBe(true);
    expect(applyOperator("consulting", "in", ["consulting", "retail"])).toBe(true);
    expect(applyOperator(null, "exists", undefined)).toBe(false);
    expect(applyOperator([], "empty", undefined)).toBe(true);
    expect(applyOperator(5, "between", [1, 10])).toBe(true);
    expect(applyOperator("abc", "gt", 3)).toBe(false); // comparaison non numérique = faux, jamais une erreur
  });

  it("évalue les combinaisons logiques", () => {
    const condition = when.all(
      when.fact("profile.costs.payrollSharePct", "gte", 50),
      when.any(
        when.fact("profile.revenue.models", "includes", "time"),
        when.fact("profile.revenue.models", "includes", "unit"),
      ),
      when.not(when.fact("profile.identity.headcount", "gt", 100)),
    );
    expect(evaluateCondition(condition, facts)).toBe(true);
  });
});

describe("moteur de règles", () => {
  it("est déterministe", () => {
    const first = evaluate(allRules(), facts, "configuration");
    for (let i = 0; i < 20; i += 1) {
      expect(evaluate(allRules(), facts, "configuration")).toEqual(first);
    }
  });

  it("respecte l'ordre de salience", () => {
    const rules: Rule[] = [
      {
        id: "low",
        name: "faible",
        scope: "configuration",
        salience: 1,
        because: "",
        when: when.always(),
        then: [{ type: "enable_capability", value: "inventory" }],
      },
      {
        id: "high",
        name: "haute",
        scope: "configuration",
        salience: 100,
        because: "",
        when: when.always(),
        then: [{ type: "enable_capability", value: "timesheets" }],
      },
    ];
    const result = evaluate(rules, facts, "configuration");
    expect(result.effects[0].ruleId).toBe("high");
  });

  it("trace les règles évaluées, y compris celles qui ne déclenchent pas", () => {
    const result = evaluate(allRules(), facts, "configuration");
    expect(result.trace.length).toBeGreaterThan(10);
    expect(result.trace.some((t) => t.matched)).toBe(true);
    expect(result.trace.some((t) => !t.matched)).toBe(true);
  });

  it("ne mélange pas les scopes", () => {
    const configuration = evaluate(allRules(), facts, "configuration");
    expect(configuration.effects.every((e) => e.effect.type !== "raise_alert")).toBe(true);
  });
});

describe("plan de configuration", () => {
  const plan = buildPlan(evaluate(allRules(), facts, "configuration").effects, facts.profile);

  it("déduplique les dimensions et les KPI", () => {
    const codes = plan.dimensions.map((d) => d.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(plan.kpiCodes).size).toBe(plan.kpiCodes.length);
  });

  it("produit une trace exploitable", () => {
    expect(plan.ruleTrace.length).toBeGreaterThan(5);
    for (const entry of plan.ruleTrace) {
      expect(entry.ruleId).toBeTruthy();
      expect(entry.because).toBeTruthy();
    }
  });

  it("compose un cockpit ordonné", () => {
    expect(plan.dashboard.sections.length).toBeGreaterThan(2);
    expect(plan.dashboard.sections[0].id).toBe("pulse");
  });

  it("calcule un diff sans jamais proposer de suppression de dimension", () => {
    const diff = diffConfiguration(
      { ...plan, kpiCodes: ["REVENUE"], capabilities: [], dimensions: [] },
      plan,
    );
    expect(diff.addedDimensions.length).toBe(plan.dimensions.length);
    expect(diff.addedKpis.length).toBe(plan.kpiCodes.length - 1);
    expect(diff.removedKpis).toEqual([]);
  });
});

describe("packs de règles", () => {
  it("expose des identifiants uniques", () => {
    const ids = PACKS.flatMap((pack) => pack.rules.map((rule) => rule.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("documente chaque règle (le « pourquoi » est affiché à l'utilisateur)", () => {
    for (const rule of allRules()) {
      expect(rule.because.length).toBeGreaterThan(10);
      expect(rule.then.length).toBeGreaterThan(0);
    }
  });
});
