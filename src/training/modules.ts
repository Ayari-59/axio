import { Tutorial, Scenario, Resource, TrainingPath } from "./types";

// ============ TUTORIALS ============

export const TUTORIALS: Record<string, Tutorial> = {
  "settings-rules-intro": {
    id: "settings-rules-intro",
    type: "tutorial",
    title: "Comprendre les règles d'affectation",
    description: "Guide interactif pour paramétrer vos premières règles d'affectation en 3 étapes.",
    difficulty: "beginner",
    estimatedTime: 8,
    tags: ["rules", "allocation", "beginner"],
    pageRoute: "/app/[companyId]/settings/rules",
    icon: "⚙️",
    steps: [
      {
        id: "step-1",
        title: "Sélectionner une source de charges",
        description:
          "Chaque règle commence par identifier d'où viennent les charges : un type (achats, salaires), une catégorie, ou toutes les charges.",
        targetElement: "[data-tutorial='rule-source']",
        action: "Cliquez sur 'Source' pour voir les filtres disponibles.",
        hint: "Vous pouvez commencer simple : 'toutes les charges' pour votre première règle.",
        position: "right",
      },
      {
        id: "step-2",
        title: "Choisir une méthode de répartition",
        description:
          "Décidez comment distribuer : affectation directe, clé unique, pourcentages, égal ou ABC (activités).",
        targetElement: "[data-tutorial='rule-method']",
        action: "Explorez les 5 méthodes pour comprendre leurs différences.",
        hint: "Commencez par 'Clé de répartition' pour les frais généraux.",
        position: "right",
      },
      {
        id: "step-3",
        title: "Cibler vos objets de coûts",
        description:
          "Spécifiez qui reçoit ces charges : tous les objets, une catégorie spécifique, ou une dimension particulière.",
        targetElement: "[data-tutorial='rule-target']",
        action: "Sélectionnez 'Tous les objets de coûts' pour débuter.",
        hint: "Les objets de coûts sont définis dans vos paramètres — produits, clients, projets, etc.",
        position: "right",
      },
    ],
  },

  "settings-activities-abc": {
    id: "settings-activities-abc",
    type: "tutorial",
    title: "Paramétrer l'ABC (Comptabilité par activités)",
    description: "Découvrez comment mettre en place une analyse par activités et inducteurs.",
    difficulty: "intermediate",
    estimatedTime: 12,
    tags: ["abc", "activities", "intermediate"],
    pageRoute: "/app/[companyId]/settings/activities",
    icon: "🎯",
    prerequisites: ["settings-rules-intro"],
    steps: [
      {
        id: "step-1",
        title: "Définir vos activités",
        description:
          "Les activités sont les processus intermédiaires qui consomment des ressources. Nommez-les d'après vos vrais métiers.",
        targetElement: "[data-tutorial='activity-list']",
        action: "Observez la liste proposée, renommez si nécessaire.",
        hint: "Exemples : 'Maintenance machine', 'Conditionnement', 'Gestion de commandes'.",
        position: "top",
      },
      {
        id: "step-2",
        title: "Affecter un inducteur à chaque activité",
        description:
          "L'inducteur mesure ce qui déclenche l'activité. Il doit être proportionnel à sa consommation.",
        targetElement: "[data-tutorial='activity-driver']",
        action: "Sélectionnez un inducteur pour chaque activité.",
        hint: "Si vous n'avez pas d'inducteur saisi, utilisez une mesure calculée (chiffre d'affaires, coût direct, quantité).",
        position: "right",
      },
      {
        id: "step-3",
        title: "Valider et générer",
        description:
          "Une fois configurée, l'ABC est appliquée immédiatement. Comparez les marges classiques vs ABC.",
        targetElement: "[data-tutorial='abc-validate']",
        action: "Cliquez 'Appliquer' pour activer votre paramétrage ABC.",
        hint: "Les changements d'inducteurs sont instantanés — vous verrez tout de suite l'impact.",
        position: "bottom",
      },
    ],
  },

  "cockpit-first-look": {
    id: "cockpit-first-look",
    type: "tutorial",
    title: "Découvrir votre cockpit",
    description: "Tour guidé des 5 zones clés du tableau de bord et ce qu'elles révèlent.",
    difficulty: "beginner",
    estimatedTime: 10,
    tags: ["dashboard", "cockpit", "beginner"],
    pageRoute: "/app/[companyId]",
    icon: "📊",
    steps: [
      {
        id: "step-1",
        title: "Qualité des données",
        description:
          "Un badge indique la confiance dans vos données (haute, moyenne, basse). Plus les sources sont complètes, meilleure est la qualité.",
        targetElement: "[data-tutorial='quality-badge']",
        action: "Regardez votre score actuel.",
        hint: "Si la qualité est basse, vérifiez vos importations de données.",
        position: "right",
      },
      {
        id: "step-2",
        title: "Indicateurs clés (KPI)",
        description:
          "Chaque indicateur mesure un aspect de votre modèle : rentabilité, structure, risques. Cliquez pour le détail.",
        targetElement: "[data-tutorial='kpi-row']",
        action: "Explorez un KPI en cliquant dessus.",
        hint: "Les couleurs (vert/orange/rouge) indiquent la santé selon vos seuils.",
        position: "bottom",
      },
      {
        id: "step-3",
        title: "Périodes et comparaisons",
        description: "Changez la période pour voir l'évolution de votre modèle dans le temps.",
        targetElement: "[data-tutorial='period-selector']",
        action: "Naviguez entre les périodes disponibles.",
        hint: "Comparez les évolutions pour détecter les tendances.",
        position: "left",
      },
    ],
  },
};

// ============ SCENARIOS ============

export const SCENARIOS: Record<string, Scenario> = {
  "case-fabric-mill": {
    id: "case-fabric-mill",
    type: "scenario",
    title: "Filature textile — comparaison clé unique vs ABC",
    description:
      "Cas réel d'une usine textile produisant 3 tisus. Découvrez comment l'ABC révèle un subventionnement croisé caché.",
    difficulty: "beginner",
    estimatedTime: 45,
    tags: ["abc", "manufacturing", "real-case"],
    icon: "🏭",
    caseStudy: `# Filature Textile — Cas d'étude

## Contexte
**TissuPro** est une filature de taille moyenne qui produit trois tissus différents :
- **Lin Léger** : produit haut de gamme, faible volume
- **Coton Standard** : produit de volume, qualité courante
- **Synthétique Industriel** : produit bas de gamme, très élevé volume

## Situation actuelle
L'usine répartit ses frais généraux (1M€/an) au **prorata du chiffre d'affaires** :
- Lin Léger : 400 k€ CA → 400 k€ coûts indirects
- Coton Standard : 300 k€ CA → 300 k€ coûts indirects
- Synthétique : 300 k€ CA → 300 k€ coûts indirects

**Résultat affiché** :
- Lin Léger : CA 400 − Direct 250 − Indirect 400 = **Marge -250** ❌
- Coton Standard : CA 300 − Direct 100 − Indirect 300 = **Marge -100** ❌
- Synthétique : CA 300 − Direct 50 − Indirect 300 = **Marge -50** ❌

*Tout semble déficitaire !* Quelque chose ne colle pas...

## Réalité opérationnelle
En réalité :
- **Lin Léger** : produit en petits lots, haute qualité. Beaucoup de tests, peu de rebuts.
- **Coton Standard** : produit massivement, peu d'ajustements.
- **Synthétique** : produit en très gros volumes, mais sujet à des défauts. Beaucoup de contrôle, rebuts élevés.

Les vrais coûts indirects :
- Contrôle qualité : 400 k€ (proportionnel au nombre de pièces inspectées)
- Rebut & reparation : 300 k€ (proportionnel à la quantité de rebuts)
- Gestion & logistique : 300 k€ (proportionnel à la complexité)

## Votre mission
1. **Importer les données** du fichier CSV fourni (quantités, rebuts, coûts)
2. **Créer trois activités** : Contrôle, Gestion rebuts, Logistique
3. **Assigner des inducteurs** : pièces inspectées, nombre de rebuts, nombre de références
4. **Comparer** : clé unique vs ABC
5. **Répondre** : Quel produit est réellement rentable ?
`,
    objectives: [
      "Créer une structure ABC à 3 activités et 3 inducteurs",
      "Importer et configurer les données du cas",
      "Interpréter la différence clé unique vs ABC",
      "Identifier le subventionnement croisé",
    ],
    datasets: [
      {
        name: "Données TissuPro",
        description: "Volumes, coûts directs, rebuts, par tissu",
        downloadUrl: "/training/datasets/tissupro.csv",
        format: "csv",
      },
    ],
    questions: [
      {
        id: "q1",
        question: "En ABC, quel tissu est réellement rentable ?",
        type: "text",
        expectedAnswer: "Lin Léger",
      },
      {
        id: "q2",
        question: "Quel est le coût unitaire du Synthétique en ABC (€) ?",
        type: "numeric",
      },
      {
        id: "q3",
        question:
          "Combien le Synthétique susubventionne-t-il le Lin Léger via la clé unique (k€) ?",
        type: "numeric",
      },
    ],
  },

  "case-hotel-segments": {
    id: "case-hotel-segments",
    type: "scenario",
    title: "Hôtel 4-étoiles — rentabilité par segment client",
    description:
      "Analysez la rentabilité réelle de différents segments (groupes, individuels, OTA) avec l'ABC.",
    difficulty: "intermediate",
    estimatedTime: 50,
    tags: ["abc", "services", "segments"],
    icon: "🏨",
    caseStudy: `# Hôtel 4-étoiles — Analyse par segment

## Contexte
**Élégance Palace** gère 150 chambres et 3 segments clients :
- **Groupes** : 40% du volume, prix faible mais stable
- **Individuels** : 35% du volume, prix moyen
- **OTA** (Booking, Expedia) : 25% du volume, prix bas (commissions élevées)

## Structure de coûts
- **Coûts directs** : nettoyage, linges, petits-déjeuners (proportionnels aux nuitées)
- **Frais fixes** : personnel réception/housekeeping, gestion, marketing
- **Services spéciaux** : conciergerie, restaurant, spa

## Situation actuelle
Les frais généraux (200 k€/mois) sont répartis **au prorata du chiffre d'affaires**.

Apparence : tous les segments sont rentables (margin 25-30%).

Réalité : **Groupes** génèrent peu de services additionnels, **Individuels** consomment beaucoup de conciergerie, **OTA** demandent un support client intensif.

## Votre mission
Paramétrez l'ABC pour les 3 segments et découvrez la rentabilité réelle.
`,
    objectives: [
      "Configurer un modèle ABC par segment client",
      "Identifier les inducteurs de coûts pertinents",
      "Calculer la rentabilité réelle de chaque segment",
      "Recommander une stratégie de tarification",
    ],
    datasets: [
      {
        name: "Données Élégance Palace",
        description: "Nuitées, services, coûts par segment",
        downloadUrl: "/training/datasets/elegance-palace.csv",
        format: "csv",
      },
    ],
  },
};

// ============ RESOURCES ============

export const RESOURCES: Record<string, Resource> = {
  "guide-abc-steps": {
    id: "guide-abc-steps",
    type: "resource",
    category: "guide",
    title: "Guide complet : 7 étapes pour mettre en place l'ABC",
    description: "Procédure détaillée pour implémenter l'ABC dans votre organisation.",
    difficulty: "intermediate",
    estimatedTime: 30,
    tags: ["abc", "implementation", "guide"],
    contentUrl: "/training/guides/abc-7-steps.html",
    contentType: "html",
    authors: ["Olivier Lemaire"],
    publishedDate: "2025-01-15",
  },

  "cheatsheet-drivers": {
    id: "cheatsheet-drivers",
    type: "resource",
    category: "cheatsheet",
    title: "Aide-mémoire : 30 inducteurs par secteur",
    description: "Les inducteurs les plus utilisés en ABC par industrie : tissus, hôtels, restau, fab.",
    difficulty: "beginner",
    estimatedTime: 5,
    tags: ["drivers", "reference"],
    contentUrl: "/training/resources/drivers-cheatsheet.pdf",
    contentType: "pdf",
  },

  "video-abc-basics": {
    id: "video-abc-basics",
    type: "resource",
    category: "video",
    title: "Vidéo : Comprendre l'ABC en 8 minutes",
    description: "Introduction visuelle aux activités, inducteurs et comparaison clé unique.",
    difficulty: "beginner",
    estimatedTime: 8,
    tags: ["abc", "video", "beginner"],
    contentUrl: "https://example.com/videos/abc-basics",
    contentType: "video",
  },

  "article-subsidy": {
    id: "article-subsidy",
    type: "resource",
    category: "article",
    title: "Article : Détecter et corriger le subventionnement croisé",
    description:
      "Comment l'ABC révèle les clients/produits non rentables que vos tarifs cachent.",
    difficulty: "intermediate",
    estimatedTime: 20,
    tags: ["insight", "pricing"],
    contentUrl: "/training/articles/cross-subsidy.html",
    contentType: "html",
  },
};

// ============ TRAINING PATHS ============

export const TRAINING_PATHS: Record<string, TrainingPath> = {
  "beginner-abc": {
    id: "beginner-abc",
    name: "Débutant : Maîtriser l'ABC",
    description:
      "Parcours de 3h pour comprendre les fondamentaux et paramétrer votre premier modèle ABC.",
    targetAudience: "beginner",
    estimatedDuration: 180,
    modules: [
      // Tutorials
      "settings-rules-intro",
      "cockpit-first-look",
      // Resources
      "guide-abc-steps",
      "video-abc-basics",
      "cheatsheet-drivers",
      // Scenario
      "case-fabric-mill",
    ],
  },

  "intermediate-analysis": {
    id: "intermediate-analysis",
    name: "Intermédiaire : ABC avancée & rentabilité",
    description: "Parcours de 5h pour analyser la rentabilité réelle et optimiser la tarification.",
    targetAudience: "intermediate",
    estimatedDuration: 300,
    modules: [
      "settings-activities-abc",
      "case-fabric-mill",
      "case-hotel-segments",
      "article-subsidy",
      "guide-abc-steps",
    ],
  },
};
