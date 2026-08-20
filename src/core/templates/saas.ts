import type { Rule, RulePack } from "../rules/types";
import { when } from "../rules/engine";

/** Pack « revenu récurrent » (abonnement, SaaS, maintenance, services managés). */

const recurring = when.any(
  when.fact("profile.revenue.models", "includes", "subscription"),
  when.fact("profile.revenue.billingUnits", "includes", "subscription"),
);

const rules: Rule[] = [
  {
    id: "REC-01",
    name: "Pilotage du revenu récurrent",
    scope: "configuration",
    salience: 800,
    because: "Un revenu récurrent se pilote en base installée, pas en facturation ponctuelle.",
    when: recurring,
    then: [
      { type: "enable_capability", value: "contract_recurring" },
      {
        type: "create_dimension",
        value: {
          code: "CONTRACT",
          label: "Contrat",
          kind: "COST_OBJECT",
          isCostObject: true,
          sortOrder: 28,
        },
      },
      { type: "suggest_kpi", value: { code: "MRR" } },
      { type: "suggest_kpi", value: { code: "MARGIN_RATE" } },
      {
        type: "add_dashboard_block",
        value: {
          sectionId: "margin",
          sectionTitle: "Marges",
          order: 23,
          block: {
            type: "ranking",
            dimensionCode: "CONTRACT",
            measure: "contributionMargin",
          },
        },
      },
    ],
  },
  {
    id: "REC-02",
    name: "Coût de service d'un contrat",
    scope: "configuration",
    salience: 790,
    because:
      "Le coût de service détermine la marge unitaire d'un abonnement, indépendamment du volume.",
    when: recurring,
    then: [
      {
        type: "suggest_allocation_rule",
        value: {
          id: "alloc-center-to-contract-revenue",
          name: "Centres → contrats (au prorata du revenu récurrent)",
          stage: 3,
          sortOrder: 40,
          active: true,
          source: { kinds: ["COST"] },
          method: "DRIVER",
          fromDimensionCode: "CENTER",
          targetDimensionCode: "CONTRACT",
          driver: { type: "measure", key: "revenue" },
        },
      },
    ],
  },
];

export const saasPack: RulePack = {
  code: "saas",
  label: "Revenu récurrent",
  description: "Abonnement, SaaS, maintenance : contrats, revenu récurrent, coût de service.",
  rules,
};
