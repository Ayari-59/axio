import { GlossaryEntry } from "./types";

export const GLOSSARY: Record<string, GlossaryEntry> = {
  abc: {
    id: "abc",
    type: "glossary",
    term: "Comptabilité par activités (ABC)",
    definition:
      "Méthode de calcul de coûts qui répartit les charges indirectes aux objets de coûts via des activités et leurs inducteurs spécifiques, plutôt qu'une clé unique globale.",
    example:
      "Dans une usine textile : au lieu de répartir les frais généraux au prorata du chiffre d'affaires, on les affecte via les activités réelles (maintenance machine, inspection qualité, logistique) et leurs inducteurs (heures machine, nombre d'inspections, km transportés).",
    category: "costing",
    relatedTerms: ["activity", "driver", "cost-pool", "allocation-key"],
  },

  activity: {
    id: "activity",
    type: "glossary",
    term: "Activité",
    definition:
      "Un processus ou une tâche intermédiaire qui consomme des ressources et déclenche des charges indirectes. Elle relie les centres de coûts aux objets finaux via un inducteur.",
    example:
      'En ABC : "Maintenance machine", "Conditionnement", "Gestion des commandes" sont des activités. Chacune a son inducteur (heures machine, nombre de colis, nombre de commandes).',
    category: "costing",
    relatedTerms: ["driver", "cost-pool", "abc"],
  },

  driver: {
    id: "driver",
    type: "glossary",
    term: "Inducteur de coût (driver)",
    definition:
      "La variable qui mesure le déclenchement d'une activité et justifie la répartition de ses coûts. Elle doit être proportionnelle à la consommation réelle d'activité.",
    example:
      "Pour l'activité 'Contrôle qualité' : l'inducteur peut être le nombre de pièces inspectées ou le nombre d'inspections réalisées.",
    category: "costing",
    relatedTerms: ["activity", "allocation-key", "cost-object"],
  },

  "cost-pool": {
    id: "cost-pool",
    type: "glossary",
    term: "Bassin de coûts (cost pool)",
    definition:
      "Un regroupement de charges homogènes (directes ou indirectes) affectées ensemble selon la même clé ou le même inducteur.",
    example:
      "Le bassin 'Frais de maintenance' regroupe tous les coûts liés à la maintenance machine et est réparti via l'inducteur 'heures machine'.",
    category: "costing",
    relatedTerms: ["activity", "driver", "allocation-key"],
  },

  "cost-object": {
    id: "cost-object",
    type: "glossary",
    term: "Objet de coût",
    definition:
      "L'entité finale pour laquelle on souhaite calculer un coût complet : un produit, une commande, un client, un projet, un segment de marché.",
    example:
      "Dans un hôtel : la chambre, la nuit, le client, le type de séjour sont des objets de coûts possibles.",
    category: "costing",
    relatedTerms: ["cost-pool", "activity", "allocation-key"],
  },

  "allocation-key": {
    id: "allocation-key",
    type: "glossary",
    term: "Clé de répartition",
    definition:
      "La règle (ratio, pourcentage, inducteur) qui détermine comment les charges d'un bassin sont distribuées entre les objets de coûts.",
    example:
      "Clé simple : répartir les frais généraux au prorata du chiffre d'affaires. Clé ABC : répartir via l'inducteur 'nombre de commandes'.",
    category: "costing",
    relatedTerms: ["driver", "cost-pool", "abc"],
  },

  margin: {
    id: "margin",
    type: "glossary",
    term: "Marge",
    definition:
      "La différence entre le chiffre d'affaires et le coût complet. Elle mesure la profitabilité réelle de chaque objet de coût après implication de tous les frais.",
    example:
      "Produit A : CA 1 000 € − Coût complet 700 € = Marge 300 € (marge brute 30%). En ABC, ce coût peut révéler que A est moins rentable qu'en clé unique.",
    category: "finance",
    relatedTerms: ["cost-object", "revenue", "profitability"],
  },

  "cross-subsidy": {
    id: "cross-subsidy",
    type: "glossary",
    term: "Subventionnement croisé",
    definition:
      "Situation où certains objets de coûts sont financés (cargaison marge négative) par d'autres (marge positive). Elle révèle une distorsion de tarification.",
    example:
      "En clé unique, le produit A semble rentable et B déficitaire. L'ABC montre que A absorbe en réalité trop peu de frais fixes : B subventionne A.",
    category: "insight",
    relatedTerms: ["margin", "abc", "profitability"],
  },

  revenue: {
    id: "revenue",
    type: "glossary",
    term: "Chiffre d'affaires (CA)",
    definition: "Le total des ventes réalisées auprès des clients. C'est le numérateur de la marge.",
    example: "Si vous vendez 1 000 unités à 100 € chacune, votre CA est 100 000 €.",
    category: "finance",
    relatedTerms: ["margin", "profitability", "cost-object"],
  },

  "direct-cost": {
    id: "direct-cost",
    type: "glossary",
    term: "Coût direct",
    definition:
      "Charge affectable sans ambiguïté à un seul objet de coût : matière première, main-d'œuvre directe, sous-traitance ciblée.",
    example: "La farine pour un pain, la main-d'œuvre de fabrication, le transport client.",
    category: "costing",
    relatedTerms: ["indirect-cost", "cost-object"],
  },

  "indirect-cost": {
    id: "indirect-cost",
    type: "glossary",
    term: "Coût indirect (frais généraux)",
    definition:
      "Charge commune à plusieurs objets de coûts et non directement affectable. Elle doit être répartie via une clé ou un inducteur.",
    example:
      "Loyer usine, salaire du directeur, assurance, maintenance machine — concernent plusieurs produits/clients à la fois.",
    category: "costing",
    relatedTerms: ["direct-cost", "cost-pool", "allocation-key"],
  },

  "unit-cost": {
    id: "unit-cost",
    type: "glossary",
    term: "Coût unitaire",
    definition: "Le coût complet divisé par la quantité produite ou vendue de l'objet de coût.",
    example:
      "Si le coût total d'une gamme est 5 000 € pour 200 unités, le coût unitaire est 25 € par unité.",
    category: "costing",
    relatedTerms: ["cost-object", "total-cost"],
  },

  "total-cost": {
    id: "total-cost",
    type: "glossary",
    term: "Coût total",
    definition: "La somme des coûts directs et indirects alloués à un objet de coût.",
    example: "Coût direct matière (100 €) + Coût direct MO (50 €) + Coût indirect alloué (30 €) = Coût total (180 €).",
    category: "costing",
    relatedTerms: ["direct-cost", "indirect-cost", "unit-cost"],
  },

  "profitability-analysis": {
    id: "profitability-analysis",
    type: "glossary",
    term: "Analyse de rentabilité",
    definition:
      "L'étude comparée des marges de différents objets de coûts pour identifier les segments rentables et non rentables.",
    example:
      "Classer les clients par marge pour voir lesquels sont vraiment profitables après ABC — révèle souvent des surprises.",
    category: "insight",
    relatedTerms: ["margin", "abc", "cost-object"],
  },

  "breakeven": {
    id: "breakeven",
    type: "glossary",
    term: "Seuil de rentabilité (point mort)",
    definition:
      "La quantité de ventes ou le chiffre d'affaires minimum pour que les recettes égalent les coûts — au-delà, c'est un bénéfice.",
    example: "Si les coûts fixes sont 10 000 € et la marge unitaire 50 €, le seuil est 10 000 ÷ 50 = 200 unités.",
    category: "finance",
    relatedTerms: ["margin", "cost-object"],
  },

  "price-setting": {
    id: "price-setting",
    type: "glossary",
    term: "Tarification (pricing)",
    definition:
      "La détermination du prix de vente. En ABC, elle s'appuie sur le coût complet réel pour assurer une marge adéquate.",
    example:
      "Coût unitaire ABC 150 € + Marge cible 30 % = Prix 195 €. En clé unique, on aurait peut-être tariffé 180 € à tort.",
    category: "finance",
    relatedTerms: ["margin", "cost-object", "abc"],
  },

  stage: {
    id: "stage",
    type: "glossary",
    term: "Étape d'affectation",
    definition:
      "Dans un système ABC, les étapes successives de répartition : (1) charges → centres, (2) centres → activités, (3) activités/charges → objets.",
    example:
      "Étape 1 : loyer → Centre Maintenance. Étape 2 : Centre Maintenance → Activité Maintenance machine. Étape 3 : Activité → Produits.",
    category: "costing",
    relatedTerms: ["abc", "activity", "cost-pool"],
  },

  "rule-engine": {
    id: "rule-engine",
    type: "glossary",
    term: "Moteur de règles",
    definition:
      "Le système automatisé qui applique les clés et inducteurs pour calculer l'allocation des coûts selon votre configuration.",
    example: "Vous paramétrez les règles une fois, le moteur les exécute à chaque calcul sans intervention.",
    category: "tool",
    relatedTerms: ["allocation-key", "driver", "stage"],
  },

  "cost-traceability": {
    id: "cost-traceability",
    type: "glossary",
    term: "Traçabilité des coûts",
    definition:
      "La capacité à suivre le chemin d'une charge depuis sa source jusqu'à l'objet de coût final — essentiel en ABC pour la confiance.",
    example:
      "Tracer un € de frais généraux : loyer → Centre Administration → Activité Facturation → Produit X → Client Y.",
    category: "insight",
    relatedTerms: ["abc", "stage", "rule-engine"],
  },
};

export function getGlossaryEntry(id: string): GlossaryEntry | undefined {
  return GLOSSARY[id];
}

export function getGlossaryByCategory(category: string): GlossaryEntry[] {
  return Object.values(GLOSSARY).filter((entry) => entry.category === category);
}

export function searchGlossary(query: string): GlossaryEntry[] {
  const lowerQuery = query.toLowerCase();
  return Object.values(GLOSSARY).filter(
    (entry) =>
      entry.term.toLowerCase().includes(lowerQuery) ||
      entry.definition.toLowerCase().includes(lowerQuery) ||
      entry.example?.toLowerCase().includes(lowerQuery)
  );
}
