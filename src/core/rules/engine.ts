import type {
  Condition,
  EvaluationResult,
  Facts,
  FiredEffect,
  Operator,
  Rule,
  RuleScope,
} from "./types";

/**
 * Moteur de règles déclaratif (docs/06).
 * - aucune exécution de code : `fact` est un chemin de propriété résolu de façon sécurisée
 * - déterministe : mêmes règles + mêmes faits = même résultat
 * - traçable : chaque effet porte la règle qui l'a produit
 */

const SAFE_SEGMENT = /^[A-Za-z0-9_]+$/;
/** Segments interdits : une règle ne doit jamais atteindre la chaîne de prototypes. */
const FORBIDDEN_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);

export function resolveFact(facts: Facts, path: string): unknown {
  const segments = path.split(".");
  let current: unknown = facts;
  for (const segment of segments) {
    if (!SAFE_SEGMENT.test(segment) || FORBIDDEN_SEGMENTS.has(segment)) return undefined;
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function applyOperator(actual: unknown, op: Operator, expected: unknown): boolean {
  switch (op) {
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const a = toNumber(actual);
      const b = toNumber(expected);
      if (a === null || b === null) return false;
      if (op === "gt") return a > b;
      if (op === "gte") return a >= b;
      if (op === "lt") return a < b;
      return a <= b;
    }
    case "in":
      return Array.isArray(expected) && expected.includes(actual as never);
    case "nin":
      return Array.isArray(expected) && !expected.includes(actual as never);
    case "includes":
      return Array.isArray(actual) && actual.includes(expected as never);
    case "excludes":
      return Array.isArray(actual) ? !actual.includes(expected as never) : true;
    case "exists":
      return actual !== undefined && actual !== null && actual !== "";
    case "empty":
      if (Array.isArray(actual)) return actual.length === 0;
      return actual === undefined || actual === null || actual === "";
    case "between": {
      const a = toNumber(actual);
      if (a === null || !Array.isArray(expected) || expected.length !== 2) return false;
      const min = toNumber(expected[0]);
      const max = toNumber(expected[1]);
      if (min === null || max === null) return false;
      return a >= min && a <= max;
    }
    default:
      return false;
  }
}

export function evaluateCondition(condition: Condition, facts: Facts): boolean {
  if ("all" in condition) return condition.all.every((c) => evaluateCondition(c, facts));
  if ("any" in condition) return condition.any.some((c) => evaluateCondition(c, facts));
  if ("not" in condition) return !evaluateCondition(condition.not, facts);
  const actual = resolveFact(facts, condition.fact);
  return applyOperator(actual, condition.op, condition.value);
}

export function evaluate(rules: Rule[], facts: Facts, scope?: RuleScope): EvaluationResult {
  const applicable = (scope ? rules.filter((r) => r.scope === scope) : rules)
    .slice()
    .sort((a, b) => b.salience - a.salience || a.id.localeCompare(b.id));

  const effects: FiredEffect[] = [];
  const trace: EvaluationResult["trace"] = [];

  for (const rule of applicable) {
    const matched = evaluateCondition(rule.when, facts);
    trace.push({ ruleId: rule.id, ruleName: rule.name, matched, because: rule.because });
    if (!matched) continue;
    for (const effect of rule.then) {
      effects.push({ ruleId: rule.id, ruleName: rule.name, because: rule.because, effect });
    }
    if (rule.stopOnMatch) break;
  }

  return { effects, trace };
}

/** Aide à l'écriture des règles. */
export const when = {
  all: (...conditions: Condition[]): Condition => ({ all: conditions }),
  any: (...conditions: Condition[]): Condition => ({ any: conditions }),
  not: (condition: Condition): Condition => ({ not: condition }),
  fact: (fact: string, op: Operator, value?: unknown): Condition => ({ fact, op, value }),
  always: (): Condition => ({ fact: "profile", op: "exists" }),
};
