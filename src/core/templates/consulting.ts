import type { Rule, RulePack } from "../rules/types";
import { when } from "../rules/engine";

/**
 * Pack « services facturés au temps » (conseil, ingénierie, agences, professions libérales).
 * Déclenché par le modèle de revenu, pas par le nom du secteur : une société d'ingénierie
 * qui facture au temps reçoit ce pack même si son code secteur est « industrie ».
 */

const timeBased = when.any(
  when.fact("profile.revenue.models", "includes", "time"),
  when.fact("profile.revenue.billingUnits", "includes", "hour"),
  when.fact("profile.revenue.billingUnits", "includes", "day"),
);

const rules: Rule[] = [
  {
    id: "TIME-01",
    name: "Pilotage du temps facturable",
    scope: "configuration",
    salience: 800,
    because: "Vous facturez du temps : la rentabilité se joue sur les heures vendues.",
    when: timeBased,
    then: [
      { type: "enable_capability", value: "timesheets" },
      { type: "enable_capability", value: "utilization_rate" },
      { type: "require_driver", value: "BILLABLE_HOURS" },
      { type: "require_driver", value: "AVAILABLE_HOURS" },
      { type: "require_driver", value: "FTE" },
      {
        type: "create_dimension",
        value: {
          code: "EMPLOYEE",
          label: "Consultant",
          kind: "RESOURCE",
          isCostObject: false,
          sortOrder: 36,
        },
      },
      { type: "suggest_kpi", value: { code: "UTILIZATION", target: 75 } },
      { type: "suggest_kpi", value: { code: "AVG_DAILY_RATE" } },
      { type: "suggest_kpi", value: { code: "REVENUE_PER_FTE" } },
      { type: "suggest_kpi", value: { code: "HOURLY_COST" } },
      {
        type: "add_dashboard_block",
        value: {
          sectionId: "pulse",
          sectionTitle: "Pouls",
          order: 11,
          block: { type: "kpi-row", codes: ["UTILIZATION", "AVG_DAILY_RATE", "REVENUE_PER_FTE"] },
        },
      },
      {
        type: "add_dashboard_block",
        value: {
          sectionId: "activity",
          sectionTitle: "Activité",
          order: 42,
          block: {
            type: "ranking",
            dimensionCode: "EMPLOYEE",
            measure: "contributionMargin",
          },
        },
      },
    ],
  },
  {
    id: "TIME-02",
    name: "Missions comme objets de coûts",
    scope: "configuration",
    salience: 790,
    because: "Le temps vendu s'organise en missions : c'est la maille de rentabilité naturelle.",
    when: timeBased,
    then: [
      { type: "enable_capability", value: "project_costing" },
      {
        type: "create_dimension",
        value: {
          code: "PROJECT",
          label: "Mission",
          kind: "COST_OBJECT",
          isCostObject: true,
          sortOrder: 28,
        },
      },
      {
        type: "add_dashboard_block",
        value: {
          sectionId: "margin",
          sectionTitle: "Marges",
          order: 22,
          block: {
            type: "ranking",
            dimensionCode: "PROJECT",
            measure: "contributionMargin",
          },
        },
      },
    ],
  },
  {
    id: "TIME-03",
    name: "Répartition de la structure aux heures facturables",
    scope: "configuration",
    salience: 780,
    because:
      "Dans une activité de temps, l'heure facturable est le meilleur inducteur de la structure.",
    when: timeBased,
    then: [
      {
        type: "suggest_allocation_rule",
        value: {
          id: "alloc-center-to-object-hours",
          name: "Centres → missions (aux heures facturables)",
          stage: 3,
          sortOrder: 40,
          active: true,
          source: { kinds: ["COST"] },
          method: "DRIVER",
          fromDimensionCode: "CENTER",
          targetDimensionCode: "PROJECT",
          driver: { type: "driver", key: "BILLABLE_HOURS" },
        },
      },
    ],
  },
  {
    id: "TIME-04",
    name: "Alerte de sous-occupation",
    scope: "alert",
    salience: 500,
    because: "Sous 70 % d'occupation, la structure n'est plus couverte.",
    when: when.all(
      when.fact("config.capabilities", "includes", "utilization_rate"),
      when.fact("metrics.utilization", "lt", 70),
    ),
    then: [
      {
        type: "raise_alert",
        value: {
          code: "UTIL_LOW",
          severity: "WARNING",
          title: "Taux d'occupation insuffisant",
          message:
            "Le taux d'occupation est inférieur à 70 %. À TJM constant, la marge se dégrade mécaniquement.",
          factRef: "metrics.utilization",
          threshold: 70,
        },
      },
    ],
  },
];

export const consultingPack: RulePack = {
  code: "consulting",
  label: "Services facturés au temps",
  description:
    "Conseil, ingénierie, agences, professions libérales : missions, heures facturables, taux d'occupation, TJM.",
  rules,
};
