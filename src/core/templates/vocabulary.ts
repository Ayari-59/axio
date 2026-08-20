import type {
  BillingUnit,
  MarginDriver,
  Objective,
  OrgUnitType,
  PilotObject,
  RevenueModel,
} from "../model/profile";

/**
 * Vocabulaire sectoriel — DONNÉE, pas code.
 *
 * C'est le seul endroit du cœur où des mots métier (« chantier », « magasin », « mission »)
 * ont le droit d'apparaître, avec `templates/index.ts` et les packs de règles.
 * Deux consommateurs : la reconnaissance des colonnes à l'import et la détection d'intention
 * du copilote. Ajouter un synonyme ne demande donc aucune modification des moteurs.
 */

export const DIMENSION_SYNONYMS: Record<string, string[]> = {
  CLIENT: ["client", "clients", "customer", "donneur ordre", "compte client", "financeur"],
  PROJECT: [
    "projet",
    "projets",
    "chantier",
    "chantiers",
    "mission",
    "missions",
    "affaire",
    "affaires",
    "operation",
    "operations",
    "ordre fabrication",
    "of",
    "tournee",
    "programme",
  ],
  PRODUCT: ["produit", "produits", "article", "articles", "reference", "famille", "gamme", "offre", "carte"],
  CENTER: [
    "centre",
    "centres",
    "service",
    "services",
    "departement",
    "departements",
    "atelier",
    "ateliers",
    "pole",
    "section",
    "rayon",
  ],
  SITE: ["site", "sites", "agence", "agences", "magasin", "magasins", "etablissement", "depot", "usine", "immeuble"],
  EMPLOYEE: [
    "collaborateur",
    "collaborateurs",
    "consultant",
    "consultants",
    "salarie",
    "employe",
    "operateur",
    "compagnon",
    "vendeur",
  ],
  NATURE: ["nature", "categorie", "type de charge", "rubrique"],
  ACTIVITY: ["activite", "processus", "tache"],
  CONTRACT: ["contrat", "contrats", "abonnement", "souscription"],
};

/** Formes plurielles / familières utilisées par le copilote pour repérer un axe cité. */
export function synonymsOf(dimensionCode: string): string[] {
  return DIMENSION_SYNONYMS[dimensionCode] ?? [];
}


// --------------------------------------------------------------------------
// Libellés du questionnaire de configuration : tout ce qui s'affiche à l'écran
// vit ici, et non dans les moteurs.
// --------------------------------------------------------------------------

export const REVENUE_MODEL_LABELS: Record<RevenueModel, string> = {
  time: "Vente de temps (heures, jours)",
  unit: "Vente d'unités produites",
  subscription: "Abonnement récurrent",
  commission: "Commission / pourcentage",
  project: "Projets au forfait",
  progress: "Contrats facturés à l'avancement",
  resale: "Achat-revente",
  mixed: "Modèle mixte",
};


export const BILLING_UNIT_LABELS: Record<BillingUnit, string> = {
  hour: "À l'heure",
  day: "À la journée",
  fixed_price: "Au forfait",
  quantity: "À la quantité",
  subscription: "Par abonnement",
  commission: "À la commission",
  percentage: "En pourcentage",
  progress: "À l'avancement",
  contract: "Par contrat",
  other: "Autre",
};


export const PILOT_OBJECT_LABELS: Record<PilotObject, string> = {
  CLIENT: "Clients",
  PRODUCT: "Produits",
  SERVICE: "Services",
  PROJECT: "Projets / chantiers / missions",
  CONTRACT: "Contrats",
  EMPLOYEE: "Collaborateurs",
  SITE: "Sites / agences / magasins",
  ACTIVITY: "Activités",
};


export const OBJECTIVE_LABELS: Record<Objective, string> = {
  reduce_cost: "Réduire les coûts",
  improve_margin: "Améliorer la marge",
  control_budget: "Contrôler les budgets",
  client_profitability: "Connaître la rentabilité des clients",
  project_control: "Piloter les projets",
  productivity: "Améliorer la productivité",
  resource_optimization: "Optimiser les ressources",
  cash_forecast: "Prévoir la trésorerie",
  pricing: "Améliorer le pricing",
};


export const ORG_UNIT_LABELS: Record<OrgUnitType, string> = {
  department: "Départements",
  service: "Services",
  agency: "Agences",
  store: "Magasins",
  site: "Sites",
  workshop: "Ateliers",
  team: "Équipes",
  project: "Projets",
};


export const MARGIN_DRIVER_LABELS: Record<MarginDriver, string> = {
  price: "Prix de vente",
  volume: "Volume vendu",
  utilization: "Taux d'occupation",
  material_cost: "Coût matière",
  labour_cost: "Coût de main-d'œuvre",
  subcontracting: "Sous-traitance",
  productivity: "Productivité",
  mix: "Mix de ventes",
  scrap: "Rebut / non-qualité",
  footfall: "Fréquentation",
};

