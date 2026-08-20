import type { Rule, RulePack } from "../rules/types";
import { when } from "../rules/engine";

/**
 * Règles d'alerte et de recommandation universelles.
 * Elles consomment le même moteur que la configuration : seuls les faits changent
 * (`metrics` au lieu de `profile`).
 */

const rules: Rule[] = [
  {
    id: "ALERT-MARGIN-01",
    name: "Dégradation du taux de marge",
    scope: "alert",
    salience: 900,
    because: "Une perte de 2 points de marge en un mois est rarement conjoncturelle.",
    when: when.fact("metrics.marginRateDeltaPts", "lte", -2),
    then: [
      {
        type: "raise_alert",
        value: {
          code: "MARGIN_DROP",
          severity: "CRITICAL",
          title: "Le taux de marge se dégrade",
          message:
            "Le taux de marge sur coûts variables perd au moins 2 points par rapport à la période précédente.",
          factRef: "metrics.marginRateDeltaPts",
          threshold: -2,
        },
      },
    ],
  },
  {
    id: "ALERT-BUDGET-01",
    name: "Dépassement budgétaire",
    scope: "alert",
    salience: 890,
    because: "Un dépassement de 10 % sur une période close ne se rattrape pas sans décision.",
    when: when.fact("metrics.costBudgetVariancePct", "gte", 10),
    then: [
      {
        type: "raise_alert",
        value: {
          code: "BUDGET_OVERRUN",
          severity: "WARNING",
          title: "Dépassement budgétaire des charges",
          message: "Les charges réelles dépassent le budget de plus de 10 % sur la période.",
          factRef: "metrics.costBudgetVariancePct",
          threshold: 10,
        },
      },
    ],
  },
  {
    id: "ALERT-COST-01",
    name: "Dérive des coûts",
    scope: "alert",
    salience: 880,
    because: "Des coûts qui progressent trois fois plus vite que l'activité détruisent la marge.",
    when: when.all(
      when.fact("metrics.costGrowthPct", "gte", 15),
      when.fact("metrics.revenueGrowthPct", "lt", 5),
    ),
    then: [
      {
        type: "raise_alert",
        value: {
          code: "COST_DRIFT",
          severity: "CRITICAL",
          title: "Les coûts progressent plus vite que l'activité",
          message:
            "Les charges augmentent d'au moins 15 % alors que le chiffre d'affaires progresse de moins de 5 %.",
          factRef: "metrics.costGrowthPct",
          threshold: 15,
        },
      },
    ],
  },
  {
    id: "ALERT-CONC-01",
    name: "Dépendance client",
    scope: "alert",
    salience: 870,
    because: "Au-delà de 40 % du chiffre d'affaires, la perte d'un client menace l'équilibre.",
    when: when.fact("metrics.topClientSharePct", "gte", 40),
    then: [
      {
        type: "raise_alert",
        value: {
          code: "CLIENT_CONCENTRATION",
          severity: "WARNING",
          title: "Concentration client élevée",
          message: "Un seul client représente plus de 40 % du chiffre d'affaires de la période.",
          factRef: "metrics.topClientSharePct",
          threshold: 40,
        },
      },
    ],
  },
  {
    id: "ALERT-LOSS-01",
    name: "Objets de coûts en perte",
    scope: "alert",
    salience: 860,
    because: "Une marge contributive négative signifie que l'objet détruit de la valeur.",
    when: when.fact("metrics.objectsInLoss", "gte", 1),
    then: [
      {
        type: "raise_alert",
        value: {
          code: "OBJECT_IN_LOSS",
          severity: "WARNING",
          title: "Des objets de coûts sont en perte",
          message:
            "Au moins un client, produit ou projet présente une marge contributive négative sur la période.",
          factRef: "metrics.objectsInLoss",
          threshold: 1,
        },
      },
    ],
  },
  {
    id: "ALERT-SAFETY-01",
    name: "Marge de sécurité faible",
    scope: "alert",
    salience: 850,
    because: "Sous 10 % de marge de sécurité, une baisse d'activité fait passer sous le point mort.",
    when: when.all(
      when.fact("metrics.safetyMarginPct", "lt", 10),
      when.fact("metrics.revenue", "gt", 0),
    ),
    then: [
      {
        type: "raise_alert",
        value: {
          code: "LOW_SAFETY_MARGIN",
          severity: "WARNING",
          title: "Marge de sécurité faible",
          message:
            "L'activité dépasse le seuil de rentabilité de moins de 10 % : la structure est peu résiliente.",
          factRef: "metrics.safetyMarginPct",
          threshold: 10,
        },
      },
    ],
  },
  {
    id: "REC-LOSS-01",
    name: "Arbitrer les objets en perte",
    scope: "recommendation",
    salience: 800,
    because: "Un objet durablement en perte doit être renégocié, repositionné ou arrêté.",
    when: when.fact("metrics.objectsInLoss", "gte", 1),
    then: [
      {
        type: "recommend",
        value: {
          code: "REVIEW_LOSS_OBJECTS",
          title: "Renégocier ou arrêter les objets en perte",
          detail:
            "Comparez la marge contributive perdue et les coûts fixes qui resteraient : un arrêt n'améliore le résultat que si la marge contributive est négative.",
          expectedImpact: "Récupération de la marge contributive négative",
        },
      },
    ],
  },
  {
    id: "REC-FIXED-01",
    name: "Structure de coûts trop rigide",
    scope: "recommendation",
    salience: 790,
    because: "Une part de coûts fixes élevée amplifie mécaniquement les baisses d'activité.",
    when: when.all(
      when.fact("metrics.fixedCostSharePct", "gte", 60),
      when.fact("metrics.safetyMarginPct", "lt", 20),
    ),
    then: [
      {
        type: "recommend",
        value: {
          code: "FLEXIBILISE_COSTS",
          title: "Rendre une part des coûts variable",
          detail:
            "Le levier opérationnel est élevé : externaliser ou mensualiser une partie des charges fixes réduit le seuil de rentabilité.",
          expectedImpact: "Baisse du seuil de rentabilité",
        },
      },
    ],
  },
];

export const alertPack: RulePack = {
  code: "alerts",
  label: "Alertes et recommandations",
  description: "Détection universelle des dérives et propositions d'action associées.",
  rules,
};
