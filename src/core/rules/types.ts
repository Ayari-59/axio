import type { Capability, CostMethod, Severity } from "../model/enums";
import type { AllocationRuleSpec, DashboardBlock, DimensionSpec } from "../model/types";
import type { BusinessModelProfile } from "../model/profile";

export type Operator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "nin"
  | "includes"
  | "excludes"
  | "exists"
  | "empty"
  | "between";

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { fact: string; op: Operator; value?: unknown };

export type AlertSpec = {
  code: string;
  severity: Severity;
  title: string;
  message: string;
  factRef?: string;
  threshold?: number;
};

export type RecommendationSpec = {
  code: string;
  title: string;
  detail: string;
  expectedImpact?: string;
};

export type Effect =
  | { type: "enable_capability"; value: Capability }
  | { type: "set_cost_method"; value: CostMethod }
  | { type: "create_dimension"; value: DimensionSpec }
  | { type: "suggest_allocation_rule"; value: AllocationRuleSpec }
  | { type: "suggest_kpi"; value: { code: string; target?: number | null } }
  | {
      type: "add_dashboard_block";
      value: { sectionId: string; sectionTitle: string; order: number; block: DashboardBlock };
    }
  | { type: "require_driver"; value: string }
  | { type: "raise_alert"; value: AlertSpec }
  | { type: "recommend"; value: RecommendationSpec };

export type RuleScope = "configuration" | "alert" | "recommendation";

export type Rule = {
  id: string;
  name: string;
  scope: RuleScope;
  salience: number;
  when: Condition;
  then: Effect[];
  because: string;
  stopOnMatch?: boolean;
};

export type DataFacts = {
  hasEntries: boolean;
  entryCount: number;
  periodCount: number;
  hasTimesheets: boolean;
  hasQuantities: boolean;
  hasUnitPrices: boolean;
  hasBankData: boolean;
  hasBudget: boolean;
  hasMachineHours: boolean;
  dimensionsPresent: string[];
  indirectSharePct: number;
  topClientSharePct: number;
};

export type MetricFacts = Record<string, number | string | boolean | null>;

export type Facts = {
  profile: BusinessModelProfile & {
    industry: string;
    country: string;
    currency: string;
  };
  data: DataFacts;
  metrics?: MetricFacts;
  config?: { capabilities: string[] };
  context?: Record<string, unknown>;
};

export type FiredEffect = {
  ruleId: string;
  ruleName: string;
  because: string;
  effect: Effect;
};

export type EvaluationResult = {
  effects: FiredEffect[];
  trace: { ruleId: string; ruleName: string; matched: boolean; because: string }[];
};

export type RulePack = {
  code: string;
  label: string;
  description: string;
  rules: Rule[];
};

export function emptyDataFacts(): DataFacts {
  return {
    hasEntries: false,
    entryCount: 0,
    periodCount: 0,
    hasTimesheets: false,
    hasQuantities: false,
    hasUnitPrices: false,
    hasBankData: false,
    hasBudget: false,
    hasMachineHours: false,
    dimensionsPresent: [],
    indirectSharePct: 0,
    topClientSharePct: 0,
  };
}
