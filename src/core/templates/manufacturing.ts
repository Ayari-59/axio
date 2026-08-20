import type { Rule, RulePack } from "../rules/types";
import { when } from "../rules/engine";

/**
 * Pack « production d'unités » (industrie, transformation, agroalimentaire, façonnage).
 * Déclenché par la vente d'unités produites.
 */

const unitBased = when.any(
  when.fact("profile.revenue.models", "includes", "unit"),
  when.fact("profile.industry", "eq", "manufacturing"),
);

const rules: Rule[] = [
  {
    id: "UNIT-01",
    name: "Coût de revient unitaire",
    scope: "configuration",
    salience: 800,
    because: "Vous vendez des unités produites : le coût unitaire pilote la marge.",
    when: unitBased,
    then: [
      { type: "enable_capability", value: "production_costing" },
      { type: "enable_capability", value: "inventory" },
      { type: "set_cost_method", value: "full" },
      {
        type: "create_dimension",
        value: {
          code: "PRODUCT",
          label: "Produit",
          kind: "COST_OBJECT",
          isCostObject: true,
          sortOrder: 28,
        },
      },
      {
        type: "create_dimension",
        value: {
          code: "CENTER",
          label: "Atelier",
          kind: "RESPONSIBILITY",
          isCostObject: false,
          hierarchical: true,
          sortOrder: 20,
        },
      },
      { type: "require_driver", value: "UNITS_PRODUCED" },
      { type: "require_driver", value: "MACHINE_HOURS" },
      { type: "suggest_kpi", value: { code: "UNIT_COST" } },
      { type: "suggest_kpi", value: { code: "OUTPUT_PER_HOUR" } },
      { type: "suggest_kpi", value: { code: "SCRAP_RATE", target: 2 } },
      { type: "suggest_kpi", value: { code: "MATERIAL_RATIO" } },
      {
        type: "add_dashboard_block",
        value: {
          sectionId: "pulse",
          sectionTitle: "Pouls",
          order: 11,
          block: { type: "kpi-row", codes: ["UNIT_COST", "OUTPUT_PER_HOUR", "SCRAP_RATE"] },
        },
      },
      {
        type: "add_dashboard_block",
        value: {
          sectionId: "activity",
          sectionTitle: "Production",
          order: 40,
          block: {
            type: "ranking",
            dimensionCode: "PRODUCT",
            measure: "contributionMargin",
          },
        },
      },
      {
        type: "add_dashboard_block",
        value: {
          sectionId: "activity",
          sectionTitle: "Production",
          order: 41,
          block: {
            type: "ranking",
            dimensionCode: "CENTER",
            measure: "totalCost",
          },
        },
      },
    ],
  },
  {
    id: "UNIT-02",
    name: "Répartition des charges d'atelier aux heures machine",
    scope: "configuration",
    salience: 790,
    because: "L'heure machine est l'unité d'œuvre de référence d'un atelier.",
    when: unitBased,
    then: [
      {
        type: "suggest_allocation_rule",
        value: {
          id: "alloc-center-to-product-machine",
          name: "Ateliers → produits (aux heures machine)",
          stage: 3,
          sortOrder: 40,
          active: true,
          source: { kinds: ["COST"] },
          method: "DRIVER",
          fromDimensionCode: "CENTER",
          targetDimensionCode: "PRODUCT",
          driver: { type: "driver", key: "MACHINE_HOURS" },
        },
      },
    ],
  },
  {
    id: "UNIT-03",
    name: "Écarts sur charges indirectes",
    scope: "configuration",
    salience: 780,
    because:
      "Avec une activité mesurable et des standards, l'écart se décompose en budget, activité et rendement.",
    when: when.all(unitBased, when.fact("profile.maturity", "neq", "starter")),
    then: [
      { type: "enable_capability", value: "standard_costing" },
      { type: "set_cost_method", value: "standard" },
      {
        type: "add_dashboard_block",
        value: {
          sectionId: "budget",
          sectionTitle: "Budget",
          order: 32,
          block: { type: "variance-bridge", title: "Écarts sur charges indirectes" },
        },
      },
    ],
  },
  {
    id: "UNIT-04",
    name: "Alerte de rebut",
    scope: "alert",
    salience: 500,
    because: "Le rebut est une perte sèche de matière et de capacité.",
    when: when.all(
      when.fact("config.capabilities", "includes", "production_costing"),
      when.fact("metrics.scrapRate", "gt", 5),
    ),
    then: [
      {
        type: "raise_alert",
        value: {
          code: "SCRAP_HIGH",
          severity: "WARNING",
          title: "Taux de rebut élevé",
          message: "Le taux de rebut dépasse 5 % de la production : impact direct sur le coût unitaire.",
          factRef: "metrics.scrapRate",
          threshold: 5,
        },
      },
    ],
  },
];

export const manufacturingPack: RulePack = {
  code: "manufacturing",
  label: "Production d'unités",
  description:
    "Industrie et transformation : produits, ateliers, heures machine, coût unitaire, rebut, écarts sur charges indirectes.",
  rules,
};
