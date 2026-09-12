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

  "tiime-interface-intro": {
    id: "tiime-interface-intro",
    type: "tutorial",
    title: "Découvrir l'interface Tiime",
    description: "Tour guidé des écrans essentiels du PGI Tiime pour la comptabilité.",
    difficulty: "beginner",
    estimatedTime: 12,
    tags: ["tiime", "accounting", "erp", "beginner"],
    pageRoute: "/app/[companyId]/training/tiime",
    icon: "📖",
    steps: [
      {
        id: "step-1",
        title: "Menu principal et navigation",
        description:
          "Tiime s'organise par modules : Comptabilité, Ventes, Achats, Paie, Immobilisations. Chaque module regroupe ses fonctionnalités.",
        targetElement: "[data-tutorial='tiime-menu']",
        action: "Familiarisez-vous avec la navigation latérale.",
        hint: "Vous utiliserez principalement : Comptabilité > Journaux et Comptabilité > Grand Livre.",
        position: "right",
      },
      {
        id: "step-2",
        title: "Journaux comptables et écrans de saisie",
        description:
          "Les journaux (Ventes, Achats, Banque, Général) regroupent les pièces par type. Chaque journal a son écran de saisie dedicated.",
        targetElement: "[data-tutorial='tiime-journals']",
        action: "Ouvrez le journal de Ventes pour voir sa structure.",
        hint: "Chaque ligne saisie = une pièce comptable. Respectez le principe de double-entrée (débit = crédit).",
        position: "right",
      },
      {
        id: "step-3",
        title: "Consultation du grand livre et balance",
        description:
          "Une fois saisies, les pièces s'agrègent par compte. Le grand livre affiche le solde de chaque compte.",
        targetElement: "[data-tutorial='tiime-ledger']",
        action: "Consultez le grand livre pour vérifier les soldes.",
        hint: "La balance doit toujours équilibrer (somme débits = somme crédits).",
        position: "bottom",
      },
    ],
  },

  "tiime-double-entry": {
    id: "tiime-double-entry",
    type: "tutorial",
    title: "Saisir une pièce comptable en double-entrée",
    description: "Guide pas-à-pas pour enregistrer une opération comptable dans Tiime.",
    difficulty: "beginner",
    estimatedTime: 8,
    tags: ["tiime", "accounting", "double-entry", "beginner"],
    pageRoute: "/app/[companyId]/training/tiime-entry",
    icon: "✍️",
    steps: [
      {
        id: "step-1",
        title: "Sélectionner le journal",
        description:
          "Chaque opération doit être saisie dans le bon journal : Ventes, Achats, Banque ou Général.",
        targetElement: "[data-tutorial='tiime-journal-select']",
        action: "Sélectionnez le journal approprié à votre opération.",
        hint: "Une facture client → Journal Ventes. Un achat fournisseur → Journal Achats.",
        position: "right",
      },
      {
        id: "step-2",
        title: "Renseigner la date et la pièce",
        description:
          "La date enregistre l'opération dans la période comptable correcte. Le numéro de pièce est une référence unique.",
        targetElement: "[data-tutorial='tiime-date-ref']",
        action: "Entrez la date et une référence (facture, bon de commande, etc.).",
        hint: "Utilisez les dates réelles pour un contrôle auditif facile.",
        position: "right",
      },
      {
        id: "step-3",
        title: "Saisir les comptes et montants",
        description:
          "Chaque ligne = une partie de l'opération. Débit d'un côté, crédit de l'autre. Les montants doivent être équilibrés.",
        targetElement: "[data-tutorial='tiime-debit-credit']",
        action: "Saisissez le compte débité et le compte crédité avec leurs montants.",
        hint: "Débit à gauche, Crédit à droite. Total débits = Total crédits.",
        position: "bottom",
      },
      {
        id: "step-4",
        title: "Valider et enregistrer",
        description:
          "Une fois saisie, la pièce est verrouillée et intégrée aux balances. Vous ne pouvez plus la modifier (seule une contre-pièce peut l'annuler).",
        targetElement: "[data-tutorial='tiime-validate']",
        action: "Cliquez 'Valider' pour enregistrer.",
        hint: "En cas d'erreur, créez une pièce inverse plutôt que de modifier.",
        position: "bottom",
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

  "case-tiime-cafe": {
    id: "case-tiime-cafe",
    type: "scenario",
    title: "Café & Pâtisserie — Maîtriser la saisie comptable dans Tiime",
    description:
      "Cas pratique : saisissez les opérations d'une petite entreprise dans Tiime et validez votre balance.",
    difficulty: "beginner",
    estimatedTime: 40,
    tags: ["tiime", "accounting", "double-entry", "practical"],
    icon: "☕",
    caseStudy: `# Café & Pâtisserie « Le Bon Coin » — Cas d'initiation Tiime

## Contexte
**Le Bon Coin** est un petit café-pâtisserie (TPE). Vous prenez en charge la comptabilité pour le mois de janvier 2025.

## Plan de comptes simplifié
\`\`\`
1010 · Caisse
1020 · Compte bancaire
2010 · Fournisseurs
2110 · Bâtiment (immeuble)
3010 · Matières premières (café, farines)
4010 · Clients
4457 · TVA collectée
4566 · TVA déductible
6010 · Achats matières
6020 · Salaires
6030 · Loyer
7010 · Ventes comptoir
7020 · Ventes catering
\`\`\`

## Opérations à saisir

### Semaine 1
1. **2025-01-02** : Achat café chez fournisseur « Caféa » : 500 € HT + 100 € TVA 20%, payé par chèque
   → Journal Achats
2. **2025-01-03** : Ventes comptoir (espèces) : 600 € TTC (500 € HT + 100 € TVA)
   → Journal Ventes
3. **2025-01-06** : Salaires janvier : 1 500 € nets, retenue cotisations : 300 €
   → Journal Banque (versement)

### Semaine 2
4. **2025-01-08** : Achat pâtes & farine « Moulin Blanc » : 300 € HT + 60 € TVA, facture pour fin de mois
   → Journal Achats
5. **2025-01-10** : Ventes catering (facture client restaurant) : 800 € HT + 160 € TVA 20%, facture #001
   → Journal Ventes

### Semaine 3
6. **2025-01-15** : Loyer de janvier : 800 € payé en espèces à propriétaire
   → Journal Banque

### Semaine 4
7. **2025-01-27** : Paiement facture « Moulin Blanc » (du 08/01) : 360 € par virement
   → Journal Banque
8. **2025-01-31** : Ventes comptoir (espèces) : 950 € TTC
   → Journal Ventes

## Votre mission
1. **Connectez-vous** à Tiime avec l'entreprise « Le Bon Coin »
2. **Saisissez les 8 opérations** dans les journaux appropriés (Achats, Ventes, Banque)
3. **Respectez la double-entrée** : chaque opération doit équilibrer débit = crédit
4. **Consultez la balance** : total débits doit égaler total crédits
5. **Répondez aux questions** ci-dessous

## Remarques importantes
- **Ventes au comptoir** : Les espèces rentrent immédiatement en caisse
- **TVA** : Collectée sur les ventes, déductible sur les achats
- **Factures non payées** : Elles créent un compte fournisseur/client jusqu'au règlement
- **Salaires** : Distinction net (banque) vs charges sociales (passif)
`,
    objectives: [
      "Pratiquer la saisie de pièces comptables en double-entrée",
      "Maîtriser les journaux d'achat, vente et banque",
      "Comprendre le flux TVA (collectée vs déductible)",
      "Valider qu'une balance comptable équilibre",
      "Interpréter un grand livre d'entreprise",
    ],
    datasets: [
      {
        name: "Tiime - Données Le Bon Coin",
        description: "Base pré-remplie : plan de comptes et historique novembre-décembre",
        downloadUrl: "/training/datasets/tiime-le-bon-coin.xlsx",
        format: "excel",
      },
    ],
    questions: [
      {
        id: "q1",
        question: "Quel est le solde total de TVA collectée fin janvier (€) ?",
        type: "numeric",
      },
      {
        id: "q2",
        question: "Quel est le solde du compte Fournisseurs fin janvier (€) ?",
        type: "numeric",
      },
      {
        id: "q3",
        question: "Quel est le solde caisse + banque combiné (€) ?",
        type: "numeric",
      },
      {
        id: "q4",
        question: "La balance équilibre-t-elle ? (Oui/Non)",
        type: "text",
        expectedAnswer: "Oui",
      },
    ],
  },

  "case-tiime-vat": {
    id: "case-tiime-vat",
    type: "scenario",
    title: "Gestion TVA dans Tiime — TVA collectée vs déductible",
    description:
      "Cas intermédiaire : maîtrisez le flux TVA avec les comptes français standards (4457, 4566, 4562).",
    difficulty: "intermediate",
    estimatedTime: 60,
    tags: ["tiime", "accounting", "vat", "intermediate"],
    icon: "📋",
    caseStudy: `# Gestion TVA dans Tiime — Comptes français

## Contexte
**Esprits Artisanaux** est une SARL qui fabrique et vend des produits cosmétiques. TVA 20%.

## Comptes de TVA français utilisés
- **4457** : TVA collectée sur les ventes
- **4566** : TVA déductible sur les achats de matières
- **4562** : TVA déductible sur les immobilisations (équipement)

## Opérations du trimestre Q1 2025

### Janvier
- Achat matières (coffrets cosmétiques) : 5 000 € HT → TVA 20% = 1 000 € → Total 6 000 €
- Ventes (clients directs) : 8 000 € HT → TVA 20% = 1 600 € → Total 9 600 €

### Février
- Achat matières : 3 000 € HT + 600 € TVA
- Achat équipement (mixer cosmétique) : 2 000 € HT + 400 € TVA (immobilisation)
- Ventes : 10 000 € HT + 2 000 € TVA

### Mars
- Achat matières : 4 000 € HT + 800 € TVA
- Ventes : 9 500 € HT + 1 900 € TVA

## Votre mission
1. Saisissez les 9 opérations dans Tiime
2. Consultez chaque compte TVA
3. Calculez la TVA à décaisser (collectée - déductible) pour Q1
4. Enregistrez la déclaration TVA (compte 4472 si TVA à décaisser > 0)
5. Répondez aux questions

## Points clés
- TVA collectée : augmente la dette envers l'État
- TVA déductible : réduit la dette envers l'État
- TVA décaisser = max(0, TVA collectée - TVA déductible) chaque mois ou trimestre
`,
    objectives: [
      "Maîtriser les 3 comptes TVA français (4457, 4566, 4562)",
      "Saisir correctement la TVA sur les achats vs les ventes",
      "Calculer la TVA nette à décaisser",
      "Enregistrer la déclaration de TVA",
      "Interpréter l'impact TVA sur la trésorerie",
    ],
    datasets: [
      {
        name: "Tiime - Esprits Artisanaux Q1",
        description: "Plan de comptes complet avec comptes TVA français",
        downloadUrl: "/training/datasets/tiime-esprits-q1.xlsx",
        format: "excel",
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

  "tiime-quickstart": {
    id: "tiime-quickstart",
    type: "resource",
    category: "guide",
    title: "Guide rapide Tiime : vos 10 premiers jours",
    description:
      "Démarrage complet : connexion, création d'entreprise, paramétrage du plan de comptes, première saisie.",
    difficulty: "beginner",
    estimatedTime: 25,
    tags: ["tiime", "setup", "getting-started"],
    contentUrl: "/training/guides/tiime-quickstart.html",
    contentType: "html",
  },

  "tiime-chart-accounts": {
    id: "tiime-chart-accounts",
    type: "resource",
    category: "guide",
    title: "Référence Tiime : plan de comptes français standard",
    description:
      "Plan de comptes complet pour PME/TPE : classes 1-7, numérotation PCG, dénominations légales.",
    difficulty: "intermediate",
    estimatedTime: 15,
    tags: ["tiime", "accounting", "reference", "pcg"],
    contentUrl: "/training/references/tiime-pcg.pdf",
    contentType: "pdf",
  },

  "tiime-journals-mastery": {
    id: "tiime-journals-mastery",
    type: "resource",
    category: "guide",
    title: "Maîtriser les journaux : Ventes, Achats, Banque, Général",
    description:
      "Guide détaillé sur chaque journal : quand l'utiliser, comment saisir, cas pratiques, erreurs courantes.",
    difficulty: "intermediate",
    estimatedTime: 30,
    tags: ["tiime", "journals", "accounting"],
    contentUrl: "/training/guides/tiime-journals.html",
    contentType: "html",
  },

  "tiime-reconciliation": {
    id: "tiime-reconciliation",
    type: "resource",
    category: "guide",
    title: "Rapprocher banque et comptabilité dans Tiime",
    description:
      "Procédure d'apurement banque, démarche vs pièces, résolution des écarts, traces d'audit.",
    difficulty: "intermediate",
    estimatedTime: 20,
    tags: ["tiime", "accounting", "bank-reconciliation"],
    contentUrl: "/training/guides/tiime-reconciliation.html",
    contentType: "html",
  },

  "tiime-shortcuts": {
    id: "tiime-shortcuts",
    type: "resource",
    category: "cheatsheet",
    title: "Aide-mémoire Tiime : raccourcis clavier & astuces",
    description:
      "Raccourcis pour saisir plus vite, astuces de navigation, fonctionnalités cachées, bonne pratique quotidienne.",
    difficulty: "beginner",
    estimatedTime: 5,
    tags: ["tiime", "shortcuts", "productivity"],
    contentUrl: "/training/resources/tiime-shortcuts.pdf",
    contentType: "pdf",
  },

  "accounting-basics": {
    id: "accounting-basics",
    type: "resource",
    category: "guide",
    title: "Fondamentaux : double-entrée et balance comptable",
    description:
      "Concepts clés de la comptabilité générale pour comprendre Tiime : débits/crédits, balance, flux comptables, audit trail.",
    difficulty: "beginner",
    estimatedTime: 20,
    tags: ["accounting", "fundamentals", "double-entry"],
    contentUrl: "/training/guides/accounting-basics.html",
    contentType: "html",
  },

  "tiime-video-entry": {
    id: "tiime-video-entry",
    type: "resource",
    category: "video",
    title: "Vidéo : Saisir votre première pièce dans Tiime",
    description:
      "Démonstration vidéo (5 min) : connexion, saisie d'une facture client complète, validation, archivage.",
    difficulty: "beginner",
    estimatedTime: 5,
    tags: ["tiime", "video", "tutorial"],
    contentUrl: "https://example.com/videos/tiime-first-entry",
    contentType: "video",
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

  "tiime-beginner": {
    id: "tiime-beginner",
    name: "Initiation : Comptabilité avec Tiime",
    description:
      "Parcours complet de 4h pour débuter la comptabilité en saisissant des pièces réalistes dans le PGI Tiime.",
    targetAudience: "beginner",
    estimatedDuration: 240,
    modules: [
      // Fondamentaux
      "accounting-basics",
      // Interface Tiime
      "tiime-interface-intro",
      "tiime-quickstart",
      "tiime-shortcuts",
      // Double-entrée
      "tiime-double-entry",
      "tiime-video-entry",
      // Cas pratiques
      "case-tiime-cafe",
      // Ressources de référence
      "tiime-chart-accounts",
    ],
  },

  "tiime-intermediate": {
    id: "tiime-intermediate",
    name: "Intermédiaire : Tiime avancée & TVA",
    description:
      "Parcours de 5h pour maîtriser les journaux, la TVA française et les contrôles comptables avancés.",
    targetAudience: "intermediate",
    estimatedDuration: 300,
    modules: [
      // Prérequis
      "tiime-beginner",
      // Journaux avancés
      "tiime-journals-mastery",
      // TVA française
      "case-tiime-vat",
      // Réconciliation
      "tiime-reconciliation",
      // Référence
      "tiime-chart-accounts",
    ],
  },

  "tiime-practitioner": {
    id: "tiime-practitioner",
    name: "Praticien : Comptable Tiime en 6h",
    description:
      "Parcours complet pour un comptable ou prestataire : conception plan de comptes, saisie complète, clôture, déclaration TVA.",
    targetAudience: "advanced",
    estimatedDuration: 360,
    modules: [
      // Cheminement complet
      "tiime-beginner",
      "tiime-intermediate",
      // Cas professionnels
      "case-tiime-cafe",
      "case-tiime-vat",
      // Guides avancés
      "tiime-journals-mastery",
      "tiime-reconciliation",
      "tiime-chart-accounts",
      "tiime-quickstart",
    ],
  },
};
