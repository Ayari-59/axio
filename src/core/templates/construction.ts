import type { Rule, RulePack } from "../rules/types";
import { when } from "../rules/engine";

/**
 * Pack « affaires à l'avancement » (BTP, travaux, installation, intégration).
 * Déclenché par la facturation à l'avancement ou le modèle « projet », pas par le libellé
 * du secteur : une ESN au forfait long reçoit les mêmes outils.
 */

const progressBased = when.any(
  when.fact("profile.revenue.models", "includes", "progress"),
  when.fact("profile.revenue.models", "includes", "project"),
  when.fact("profile.revenue.billingUnits", "includes", "progress"),
  when.fact("profile.industry", "eq", "construction"),
);

const rules: Rule[] = [
  {
    id: "PROGRESS-01",
    name: "Affaires suivies à l'avancement",
    scope: "configuration",
    salience: 800,
    because:
      "Vos contrats se déroulent sur plusieurs périodes : le résultat ne se lit qu'à l'avancement.",
    when: progressBased,
    then: [
      { type: "enable_capability", value: "project_costing" },
      { type: "enable_capability", value: "progress_tracking" },
      {
        type: "create_dimension",
        value: {
          code: "PROJECT",
          label: "Chantier",
          kind: "COST_OBJECT",
          isCostObject: true,
          sortOrder: 28,
        },
      },
      { type: "suggest_kpi", value: { code: "PROGRESS_RATE" } },
      { type: "suggest_kpi", value: { code: "MARGIN_AT_COMPLETION" } },
      { type: "suggest_kpi", value: { code: "COST_TO_COMPLETE" } },
      { type: "suggest_kpi", value: { code: "EAC_DRIFT" } },
      {
        type: "add_dashboard_block",
        value: {
          sectionId: "pulse",
          sectionTitle: "Pouls",
          order: 11,
          block: {
            type: "kpi-row",
            codes: ["PROGRESS_RATE", "MARGIN_AT_COMPLETION", "COST_TO_COMPLETE"],
          },
        },
      },
      {
        type: "add_dashboard_block",
        value: {
          sectionId: "projects",
          sectionTitle: "Affaires",
          order: 50,
          block: { type: "progress-table", dimensionCode: "PROJECT", title: "Suivi des affaires" },
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
    id: "PROGRESS-02",
    name: "Sous-traitance et matériel",
    scope: "configuration",
    salience: 790,
    because: "Les affaires à l'avancement portent une part élevée de sous-traitance.",
    when: progressBased,
    then: [
      { type: "enable_capability", value: "subcontractor_tracking" },
      { type: "suggest_kpi", value: { code: "SUBCONTRACTING_RATIO" } },
      { type: "suggest_kpi", value: { code: "MATERIAL_RATIO" } },
    ],
  },
  {
    id: "PROGRESS-03",
    name: "Répartition des frais de chantier au coût direct engagé",
    scope: "configuration",
    salience: 780,
    because:
      "Faute d'inducteur physique commun, le coût direct engagé reste la clé la plus fidèle sur des affaires hétérogènes.",
    when: progressBased,
    then: [
      {
        type: "suggest_allocation_rule",
        value: {
          id: "alloc-center-to-project-directcost",
          name: "Centres → chantiers (au coût direct engagé)",
          stage: 3,
          sortOrder: 40,
          active: true,
          source: { kinds: ["COST"] },
          method: "DRIVER",
          fromDimensionCode: "CENTER",
          targetDimensionCode: "PROJECT",
          driver: { type: "measure", key: "directCost" },
        },
      },
      { type: "require_driver", value: "HOURS" },
    ],
  },
  {
    id: "PROGRESS-04",
    name: "Alerte de dérive à terminaison",
    scope: "alert",
    salience: 520,
    because: "Une affaire dont le coût à terminaison dépasse le budget ne se rattrape jamais seule.",
    when: when.all(
      when.fact("config.capabilities", "includes", "progress_tracking"),
      when.fact("metrics.eacDriftPct", "gt", 5),
    ),
    then: [
      {
        type: "raise_alert",
        value: {
          code: "EAC_DRIFT",
          severity: "CRITICAL",
          title: "Dérive du coût à terminaison",
          message:
            "Le coût à terminaison projeté dépasse le budget de plus de 5 %. Un arbitrage est nécessaire avant la fin du chantier.",
          factRef: "metrics.eacDriftPct",
          threshold: 5,
        },
      },
    ],
  },
  {
    id: "PROGRESS-05",
    name: "Alerte consommation supérieure à l'avancement",
    scope: "alert",
    salience: 510,
    because: "Consommer plus vite qu'on avance est le signal le plus précoce d'une dérive.",
    when: when.all(
      when.fact("config.capabilities", "includes", "progress_tracking"),
      when.fact("metrics.consumptionGapPts", "gt", 15),
    ),
    then: [
      {
        type: "raise_alert",
        value: {
          code: "BUDGET_BURN",
          severity: "WARNING",
          title: "Budget consommé plus vite que l'avancement",
          message:
            "Le budget consommé dépasse l'avancement physique de plus de 15 points sur au moins une affaire.",
          factRef: "metrics.consumptionGapPts",
          threshold: 15,
        },
      },
    ],
  },
];

export const constructionPack: RulePack = {
  code: "construction",
  label: "Affaires à l'avancement",
  description:
    "BTP, travaux, installation : chantiers, avancement, reste à engager, coût et marge à terminaison.",
  rules,
};
