import type { Rule, RulePack } from "../rules/types";
import { when } from "../rules/engine";

/** Pack « achat-revente » (commerce, distribution, e-commerce, restauration). */

const resaleBased = when.any(
  when.fact("profile.revenue.models", "includes", "resale"),
  when.fact("profile.industry", "in", ["retail", "ecommerce", "restaurant"]),
);

const rules: Rule[] = [
  {
    id: "RETAIL-01",
    name: "Marge sur coût d'achat",
    scope: "configuration",
    salience: 800,
    because: "En achat-revente, la marge commerciale est le premier niveau de lecture.",
    when: resaleBased,
    then: [
      { type: "enable_capability", value: "inventory" },
      {
        type: "create_dimension",
        value: {
          code: "PRODUCT",
          label: "Famille de produits",
          kind: "COST_OBJECT",
          isCostObject: true,
          sortOrder: 28,
        },
      },
      { type: "suggest_kpi", value: { code: "PURCHASE_RATIO" } },
      { type: "suggest_kpi", value: { code: "AVG_TICKET" } },
      { type: "require_driver", value: "UNITS_SOLD" },
    ],
  },
  {
    id: "RETAIL-02",
    name: "Réseau de points de vente",
    scope: "configuration",
    salience: 790,
    because: "À partir de trois points de vente, la comparaison entre magasins devient l'outil clé.",
    when: when.all(resaleBased, when.fact("profile.identity.siteCount", "gte", 3)),
    then: [
      { type: "enable_capability", value: "store_network" },
      {
        type: "create_dimension",
        value: {
          code: "SITE",
          label: "Magasin",
          kind: "RESPONSIBILITY",
          isCostObject: true,
          sortOrder: 30,
        },
      },
      { type: "require_driver", value: "M2" },
      { type: "suggest_kpi", value: { code: "REVENUE_PER_M2" } },
      {
        type: "add_dashboard_block",
        value: {
          sectionId: "activity",
          sectionTitle: "Réseau",
          order: 40,
          block: {
            type: "ranking",
            dimensionCode: "SITE",
            measure: "contributionMargin",
          },
        },
      },
      {
        type: "suggest_allocation_rule",
        value: {
          id: "alloc-center-to-site-m2",
          name: "Charges de réseau → magasins (à la surface)",
          stage: 3,
          sortOrder: 40,
          active: true,
          source: { kinds: ["COST"] },
          method: "DRIVER",
          fromDimensionCode: "CENTER",
          targetDimensionCode: "SITE",
          driver: { type: "attribute", key: "m2" },
        },
      },
    ],
  },
];

export const retailPack: RulePack = {
  code: "retail",
  label: "Achat-revente et réseau",
  description: "Commerce, distribution, e-commerce, restauration : familles, magasins, marge commerciale.",
  rules,
};
