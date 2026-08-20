import type { Rule, RulePack } from "../rules/types";
import { when } from "../rules/engine";

/**
 * Pack universel : appliqué à TOUTES les entreprises, quel que soit le secteur.
 * Il pose les axes système, la méthode de coût par défaut, le cheminement d'affectation
 * de base et le noyau d'indicateurs.
 */

const rules: Rule[] = [
  {
    id: "BASE-01",
    name: "Socle universel",
    scope: "configuration",
    salience: 1000,
    because: "Tout système de pilotage a besoin d'une nature de charge et d'un responsable.",
    when: when.always(),
    then: [
      { type: "set_cost_method", value: "variable" },
      {
        type: "create_dimension",
        value: {
          code: "NATURE",
          label: "Nature",
          kind: "ANALYSIS",
          isCostObject: false,
          isMandatory: true,
          sortOrder: 10,
        },
      },
      {
        type: "create_dimension",
        value: {
          code: "CENTER",
          label: "Centre de responsabilité",
          kind: "RESPONSIBILITY",
          isCostObject: false,
          hierarchical: true,
          sortOrder: 20,
        },
      },
      { type: "suggest_kpi", value: { code: "REVENUE" } },
      { type: "suggest_kpi", value: { code: "CONTRIBUTION_MARGIN" } },
      { type: "suggest_kpi", value: { code: "MARGIN_RATE" } },
      { type: "suggest_kpi", value: { code: "TOTAL_COST" } },
      { type: "suggest_kpi", value: { code: "OPERATING_MARGIN_RATE" } },
      { type: "suggest_kpi", value: { code: "BREAK_EVEN" } },
      {
        type: "add_dashboard_block",
        value: {
          sectionId: "pulse",
          sectionTitle: "Pouls",
          order: 10,
          block: {
            type: "kpi-row",
            codes: ["REVENUE", "CONTRIBUTION_MARGIN", "MARGIN_RATE", "TOTAL_COST"],
          },
        },
      },
      {
        type: "add_dashboard_block",
        value: {
          sectionId: "pulse",
          sectionTitle: "Pouls",
          order: 12,
          block: { type: "trend", measure: "revenue", title: "Évolution du chiffre d'affaires" },
        },
      },
      {
        type: "add_dashboard_block",
        value: {
          sectionId: "margin",
          sectionTitle: "Marges",
          order: 20,
          block: { type: "margin-cascade", title: "Formation de la marge" },
        },
      },
      {
        type: "add_dashboard_block",
        value: {
          sectionId: "risks",
          sectionTitle: "Points d'attention",
          order: 90,
          block: { type: "alerts" },
        },
      },
      {
        type: "add_dashboard_block",
        value: {
          sectionId: "risks",
          sectionTitle: "Points d'attention",
          order: 95,
          block: { type: "missing-data", title: "Ce qui vous manque pour aller plus loin" },
        },
      },
    ],
  },
  {
    id: "BASE-ALLOC-01",
    name: "Affectation directe aux objets de coûts",
    scope: "configuration",
    salience: 950,
    because: "Une charge directe doit rejoindre l'objet qu'elle concerne, sans clé de répartition.",
    when: when.always(),
    then: [
      {
        type: "suggest_allocation_rule",
        value: {
          id: "alloc-direct",
          name: "Charges directes → objet de coût",
          stage: 3,
          sortOrder: 10,
          active: true,
          source: { kinds: ["COST"], traceabilities: ["DIRECT"] },
          method: "DIRECT",
          targetDimensionCode: "AUTO_COST_OBJECT",
        },
      },
    ],
  },
  {
    id: "BASE-ALLOC-02",
    name: "Charges indirectes vers les centres",
    scope: "configuration",
    salience: 940,
    because: "Les charges indirectes transitent par les centres de responsabilité avant répartition.",
    when: when.always(),
    then: [
      {
        type: "suggest_allocation_rule",
        value: {
          id: "alloc-indirect-center",
          name: "Charges indirectes → centre porteur",
          stage: 1,
          sortOrder: 10,
          active: true,
          source: {
            kinds: ["COST"],
            traceabilities: ["INDIRECT"],
            requiresDimensions: ["CENTER"],
          },
          method: "DIRECT",
          targetDimensionCode: "CENTER",
        },
      },
      {
        type: "suggest_allocation_rule",
        value: {
          id: "alloc-indirect-headcount",
          name: "Charges de structure sans centre → répartition à l'effectif",
          stage: 1,
          sortOrder: 20,
          active: true,
          source: {
            kinds: ["COST"],
            traceabilities: ["INDIRECT"],
            missingDimensions: ["CENTER"],
          },
          method: "DRIVER",
          targetDimensionCode: "CENTER",
          driver: { type: "driver", key: "HEADCOUNT" },
        },
      },
      {
        type: "suggest_allocation_rule",
        value: {
          id: "alloc-center-to-object",
          name: "Centres → objets de coûts (au prorata du chiffre d'affaires)",
          stage: 3,
          sortOrder: 50,
          active: true,
          source: { kinds: ["COST"] },
          method: "DRIVER",
          fromDimensionCode: "CENTER",
          targetDimensionCode: "AUTO_COST_OBJECT",
          driver: { type: "measure", key: "revenue" },
        },
      },
      { type: "require_driver", value: "HEADCOUNT" },
    ],
  },
  {
    id: "BASE-02",
    name: "Rentabilité par client",
    scope: "configuration",
    salience: 900,
    because: "Vous avez retenu le client comme objet de pilotage.",
    when: when.fact("profile.pilotObjects", "includes", "CLIENT"),
    then: [
      { type: "enable_capability", value: "client_profitability" },
      {
        type: "create_dimension",
        value: {
          code: "CLIENT",
          label: "Client",
          kind: "COST_OBJECT",
          isCostObject: true,
          sortOrder: 30,
        },
      },
      { type: "suggest_kpi", value: { code: "CLIENT_CONCENTRATION" } },
      {
        type: "add_dashboard_block",
        value: {
          sectionId: "margin",
          sectionTitle: "Marges",
          order: 24,
          block: {
            type: "ranking",
            dimensionCode: "CLIENT",
            measure: "contributionMargin",
          },
        },
      },
    ],
  },
  {
    id: "BASE-03",
    name: "Rentabilité par produit",
    scope: "configuration",
    salience: 890,
    because: "Vous avez retenu le produit comme objet de pilotage.",
    when: when.any(
      when.fact("profile.pilotObjects", "includes", "PRODUCT"),
      when.fact("profile.pilotObjects", "includes", "SERVICE"),
    ),
    then: [
      { type: "enable_capability", value: "product_profitability" },
      {
        type: "create_dimension",
        value: {
          code: "PRODUCT",
          label: "Produit",
          kind: "COST_OBJECT",
          isCostObject: true,
          sortOrder: 32,
        },
      },
      {
        type: "add_dashboard_block",
        value: {
          sectionId: "margin",
          sectionTitle: "Marges",
          order: 26,
          block: {
            type: "ranking",
            dimensionCode: "PRODUCT",
            measure: "contributionMargin",
          },
        },
      },
    ],
  },
  {
    id: "BASE-04",
    name: "Comptabilité par activités",
    scope: "configuration",
    salience: 700,
    because:
      "Vos charges indirectes dépassent 30 % : une répartition par activités devient plus juste qu'une clé unique.",
    when: when.any(
      when.fact("profile.costs.indirectSharePct", "gte", 30),
      when.fact("profile.maturity", "eq", "advanced"),
    ),
    then: [
      { type: "enable_capability", value: "abc_costing" },
      { type: "set_cost_method", value: "abc" },
      {
        type: "create_dimension",
        value: {
          code: "ACTIVITY",
          label: "Activité",
          kind: "ANALYSIS",
          isCostObject: false,
          sortOrder: 40,
        },
      },
    ],
  },
  {
    id: "BASE-05",
    name: "Multi-sites",
    scope: "configuration",
    salience: 690,
    because: "Vous exploitez plusieurs sites : la comparaison inter-sites devient pertinente.",
    when: when.any(
      when.fact("profile.identity.siteCount", "gte", 2),
      when.fact("profile.pilotObjects", "includes", "SITE"),
    ),
    then: [
      { type: "enable_capability", value: "multi_site" },
      {
        type: "create_dimension",
        value: {
          code: "SITE",
          label: "Site",
          kind: "RESPONSIBILITY",
          isCostObject: true,
          sortOrder: 34,
        },
      },
      {
        type: "add_dashboard_block",
        value: {
          sectionId: "activity",
          sectionTitle: "Activité",
          order: 44,
          block: {
            type: "ranking",
            dimensionCode: "SITE",
            measure: "operatingMargin",
          },
        },
      },
    ],
  },
  {
    id: "BASE-06",
    name: "Prévision de trésorerie",
    scope: "configuration",
    salience: 680,
    because: "Prévoir la trésorerie fait partie de vos objectifs et les flux sont disponibles.",
    when: when.all(
      when.fact("profile.objectives", "includes", "cash_forecast"),
      when.fact("data.hasBankData", "eq", true),
    ),
    then: [
      { type: "enable_capability", value: "cash_forecast" },
      { type: "suggest_kpi", value: { code: "CASH_NET" } },
    ],
  },
  {
    id: "BASE-08",
    name: "Concentration client",
    scope: "configuration",
    salience: 670,
    because: "Un client pèse plus de 30 % de votre activité : le risque de dépendance doit être suivi.",
    when: when.fact("profile.revenue.topClientSharePct", "gte", 30),
    then: [{ type: "suggest_kpi", value: { code: "CLIENT_CONCENTRATION", target: 30 } }],
  },
  {
    id: "BASE-09",
    name: "Suivi de la sous-traitance",
    scope: "configuration",
    salience: 660,
    because: "La sous-traitance dépasse 10 % de vos coûts.",
    when: when.fact("profile.costs.subcontractingSharePct", "gte", 10),
    then: [
      { type: "enable_capability", value: "subcontractor_tracking" },
      { type: "suggest_kpi", value: { code: "SUBCONTRACTING_RATIO" } },
    ],
  },
  {
    id: "BASE-10",
    name: "Contrôle budgétaire",
    scope: "configuration",
    salience: 650,
    because: "Un budget est disponible : les écarts peuvent être calculés.",
    when: when.any(
      when.fact("data.hasBudget", "eq", true),
      when.fact("profile.objectives", "includes", "control_budget"),
    ),
    then: [
      { type: "enable_capability", value: "budget_control" },
      { type: "suggest_kpi", value: { code: "BUDGET_VARIANCE_PCT" } },
      {
        type: "add_dashboard_block",
        value: {
          sectionId: "budget",
          sectionTitle: "Budget",
          order: 30,
          block: { type: "variance-bridge", title: "Du budget au réel" },
        },
      },
    ],
  },
  {
    id: "BASE-11",
    name: "Pilotage par collaborateur",
    scope: "configuration",
    salience: 640,
    because: "Vous pilotez la performance au niveau des collaborateurs.",
    when: when.fact("profile.pilotObjects", "includes", "EMPLOYEE"),
    then: [
      {
        type: "create_dimension",
        value: {
          code: "EMPLOYEE",
          label: "Collaborateur",
          kind: "RESOURCE",
          isCostObject: false,
          sortOrder: 36,
        },
      },
      { type: "suggest_kpi", value: { code: "REVENUE_PER_FTE" } },
      { type: "require_driver", value: "FTE" },
    ],
  },
  {
    id: "BASE-12",
    name: "Seuil de rentabilité",
    scope: "configuration",
    salience: 630,
    because: "Le seuil de rentabilité est le repère commun à tous les modèles économiques.",
    when: when.always(),
    then: [
      {
        type: "add_dashboard_block",
        value: {
          sectionId: "margin",
          sectionTitle: "Marges",
          order: 28,
          block: { type: "breakeven", title: "Seuil de rentabilité" },
        },
      },
    ],
  },
  {
    id: "BASE-13",
    name: "Suivi des contrats récurrents",
    scope: "configuration",
    salience: 620,
    because: "Une part significative de votre chiffre d'affaires est récurrente.",
    when: when.any(
      when.fact("profile.revenue.models", "includes", "subscription"),
      when.fact("profile.revenue.recurringSharePct", "gte", 30),
    ),
    then: [
      { type: "enable_capability", value: "contract_recurring" },
      {
        type: "create_dimension",
        value: {
          code: "CONTRACT",
          label: "Contrat",
          kind: "COST_OBJECT",
          isCostObject: true,
          sortOrder: 38,
        },
      },
    ],
  },
  {
    id: "BASE-14",
    name: "Analyse du coût du personnel",
    scope: "configuration",
    salience: 610,
    because: "La masse salariale dépasse 30 % de vos coûts.",
    when: when.fact("profile.costs.payrollSharePct", "gte", 30),
    then: [{ type: "suggest_kpi", value: { code: "PAYROLL_RATIO" } }],
  },
];

export const basePack: RulePack = {
  code: "base",
  label: "Socle universel",
  description:
    "Axes système, cheminement d'affectation par défaut et noyau d'indicateurs communs à tous les secteurs.",
  rules,
};
