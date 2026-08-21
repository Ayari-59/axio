/**
 * Bibliothèque d'activités — DONNÉE, pas code (docs/07 §5).
 *
 * Une activité ne se déduit pas d'un export comptable : c'est un choix de modélisation issu de
 * l'analyse des processus. Le moteur ne peut donc pas l'inventer. Ce qu'il peut faire — et ce que
 * fait ce fichier — c'est proposer le point de départ que tout contrôleur de gestion écrirait pour
 * ce type d'activité, avec l'inducteur qui va avec, à charge pour l'utilisateur de l'ajuster.
 *
 * Chaque activité porte :
 *   - l'inducteur naturel : ce qui *cause* la consommation de l'activité, pas ce qui est facile à
 *     mesurer (c'est toute la différence entre l'ABC et une clé de répartition déguisée) ;
 *   - une part indicative des ressources indirectes, à corriger après entretien avec les équipes.
 */

export type ActivityPreset = {
  code: string;
  label: string;
  /** Code d'inducteur (voir DRIVER_CODES) : l'unité qui déclenche la consommation. */
  driverKey: string;
  driverLabel: string;
  /** Part indicative des charges indirectes consommée par l'activité (%). */
  defaultShare: number;
  /** Ce que l'inducteur mesure, et pourquoi il est le bon. */
  rationale: string;
};

/** Activités communes à toute entreprise, quel que soit le modèle économique. */
const SUPPORT: ActivityPreset[] = [
  {
    code: "ADMINISTRER",
    label: "Administrer et facturer",
    driverKey: "INVOICES",
    driverLabel: "nombre de factures",
    defaultShare: 15,
    rationale:
      "Le travail administratif suit le nombre de pièces traitées, pas le chiffre d'affaires : dix petites factures coûtent plus qu'une grosse.",
  },
];

export const ACTIVITY_LIBRARIES: Record<string, ActivityPreset[]> = {
  // ------------------------------------------------------------- industrie
  manufacturing: [
    {
      code: "ORDONNANCER",
      label: "Ordonnancer et lancer",
      driverKey: "ORDERS",
      driverLabel: "nombre d'ordres de fabrication",
      defaultShare: 12,
      rationale:
        "Lancer un ordre coûte le même travail de planification quelle que soit la taille de la série : c'est l'ordre qui cause le coût, pas la quantité.",
    },
    {
      code: "REGLER",
      label: "Régler les machines",
      driverKey: "SETUPS",
      driverLabel: "nombre de réglages",
      defaultShare: 18,
      rationale:
        "Le réglage est l'inducteur qui révèle le vrai coût des petites séries — celui que l'heure machine masque entièrement.",
    },
    {
      code: "USINER",
      label: "Usiner et assembler",
      driverKey: "MACHINE_HOURS",
      driverLabel: "heures machine",
      defaultShare: 40,
      rationale: "Seule activité réellement proportionnelle au temps de passage sur les machines.",
    },
    {
      code: "CONTROLER",
      label: "Contrôler la qualité",
      driverKey: "CONTROLS",
      driverLabel: "nombre de contrôles",
      defaultShare: 10,
      rationale:
        "Le contrôle suit le nombre de lots et d'exigences client, pas le volume produit : un produit sensible mobilise le laboratoire bien plus qu'un produit courant.",
    },
    {
      code: "EXPEDIER",
      label: "Préparer et expédier",
      driverKey: "DELIVERIES",
      driverLabel: "nombre d'expéditions",
      defaultShare: 5,
      rationale: "La logistique se déclenche à chaque expédition, indépendamment des quantités.",
    },
    ...SUPPORT,
  ],

  // ------------------------------------------------- services facturés au temps
  consulting: [
    {
      code: "AVANT_VENTE",
      label: "Répondre et chiffrer",
      driverKey: "PROPOSALS",
      driverLabel: "nombre de propositions",
      defaultShare: 20,
      rationale:
        "L'avant-vente est le coût invisible des cabinets : il se déclenche à chaque proposition, gagnée ou perdue, et n'apparaît sur aucune mission.",
    },
    {
      code: "PRODUIRE",
      label: "Produire la mission",
      driverKey: "BILLABLE_HOURS",
      driverLabel: "heures facturables",
      defaultShare: 45,
      rationale: "Seule part réellement proportionnelle au temps vendu.",
    },
    {
      code: "PILOTER",
      label: "Piloter les missions",
      driverKey: "PROJECTS",
      driverLabel: "nombre de missions actives",
      defaultShare: 20,
      rationale:
        "L'encadrement, les comités et le suivi coûtent par mission ouverte : dix petites missions mobilisent plus qu'une grande.",
    },
    ...SUPPORT,
  ],

  // ------------------------------------------------- affaires à l'avancement
  construction: [
    {
      code: "ETUDIER",
      label: "Étudier et chiffrer",
      driverKey: "PROPOSALS",
      driverLabel: "nombre d'appels d'offres traités",
      defaultShare: 15,
      rationale:
        "Le bureau d'études travaille sur toutes les affaires étudiées, y compris celles qui ne se signent pas : les affaires gagnées en portent le coût.",
    },
    {
      code: "PREPARER",
      label: "Préparer le chantier",
      driverKey: "PROJECTS",
      driverLabel: "nombre de chantiers ouverts",
      defaultShare: 15,
      rationale:
        "Installation, plan d'hygiène et de sécurité, ouverture de compte : un coût fixe par chantier, sans rapport avec son montant.",
    },
    {
      code: "ENCADRER",
      label: "Encadrer les travaux",
      driverKey: "HOURS",
      driverLabel: "heures de production",
      defaultShare: 40,
      rationale: "La conduite de travaux suit la présence des équipes sur site.",
    },
    {
      code: "LOGISTIQUE",
      label: "Approvisionner et livrer le matériel",
      driverKey: "DELIVERIES",
      driverLabel: "nombre de livraisons",
      defaultShare: 15,
      rationale: "Le dépôt et les rotations d'engins se déclenchent à la livraison.",
    },
    ...SUPPORT,
  ],

  // --------------------------------------------------------- achat-revente
  retail: [
    {
      code: "APPROVISIONNER",
      label: "Approvisionner et réceptionner",
      driverKey: "LINES",
      driverLabel: "nombre de lignes de commande",
      defaultShare: 20,
      rationale:
        "La réception et le contrôle coûtent à la ligne de commande : une référence à faible rotation mobilise autant qu'une best-seller.",
    },
    {
      code: "TENIR_RAYON",
      label: "Tenir le rayon",
      driverKey: "M2",
      driverLabel: "surface occupée",
      defaultShare: 40,
      rationale: "L'occupation d'espace est le coût que la marge commerciale seule ne voit jamais.",
    },
    {
      code: "VENDRE",
      label: "Vendre et encaisser",
      driverKey: "VISITS",
      driverLabel: "nombre de passages en caisse",
      defaultShare: 25,
      rationale: "Le temps de vente suit les transactions, pas le montant du panier.",
    },
    ...SUPPORT,
  ],

  // ------------------------------------------------------- revenu récurrent
  saas: [
    {
      code: "HEBERGER",
      label: "Héberger et exploiter",
      driverKey: "UNITS_SOLD",
      driverLabel: "nombre d'abonnements actifs",
      defaultShare: 35,
      rationale: "Le coût d'infrastructure suit la base installée, pas le chiffre d'affaires.",
    },
    {
      code: "SUPPORTER",
      label: "Assister les clients",
      driverKey: "TICKETS",
      driverLabel: "nombre de tickets",
      defaultShare: 30,
      rationale:
        "Le support révèle les contrats coûteux : deux clients au même prix peuvent avoir des coûts de service opposés.",
    },
    {
      code: "ONBOARDER",
      label: "Déployer et former",
      driverKey: "PROJECTS",
      driverLabel: "nombre de déploiements",
      defaultShare: 20,
      rationale: "Le déploiement est un coût par contrat, concentré sur les premiers mois.",
    },
    ...SUPPORT,
  ],
};

/** Jeu générique, quand aucun pack sectoriel ne s'applique. */
export const GENERIC_ACTIVITIES: ActivityPreset[] = [
  {
    code: "PRODUIRE",
    label: "Produire",
    driverKey: "HOURS",
    driverLabel: "heures de production",
    defaultShare: 50,
    rationale: "Part directement liée au temps consacré à la réalisation.",
  },
  {
    code: "VENDRE",
    label: "Vendre",
    driverKey: "ORDERS",
    driverLabel: "nombre de commandes",
    defaultShare: 25,
    rationale: "L'effort commercial se déclenche à la commande.",
  },
  ...SUPPORT,
];

export function activitiesForPacks(packCodes: string[]): ActivityPreset[] {
  for (const code of packCodes) {
    const library = ACTIVITY_LIBRARIES[code];
    if (library) return library;
  }
  return GENERIC_ACTIVITIES;
}
