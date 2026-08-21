# 18 — Alimenter la base

Guide pratique : par où entrent les données, dans quel ordre, et ce qu'il faut fournir en plus
d'un export comptable pour que tous les moteurs fonctionnent.

## 1. Les cinq sources d'alimentation

| Source | Ce qu'elle alimente | Où |
|---|---|---|
| Assistant de configuration | référentiels (axes, natures, centres, plan de comptes) | `/onboarding` |
| Import CSV | écritures (produits et charges), membres, périodes | `/data` |
| Saisie d'inducteurs | heures, effectifs, unités produites, surfaces | `/data` |
| Construction budgétaire | budget d'un exercice depuis le réel du précédent | `/budgets` |
| Jeu de démonstration | tout, pour trois entreprises | `npm run db:seed` |

Ordre recommandé pour une entreprise réelle :

```
1. créer l'entreprise et répondre aux 5 étapes  →  axes, natures, centres, plan de comptes
2. importer 12 à 24 mois d'écritures            →  coûts, marges, tendances, saisonnalité
3. saisir les inducteurs attendus               →  clés de répartition et ratios de productivité
4. renseigner les attributs des objets de coûts →  avancement, budget, prix contractuel
5. construire le budget de l'exercice en cours  →  écarts et décomposition prix/volume/mix
```

## 2. Import CSV — le chemin principal

Trois temps, **rien n'est écrit avant la validation** : dépôt du fichier → mapping proposé →
essai à blanc → import. Un lot importé reste annulable depuis `/data` (il supprime exactement
les écritures qu'il a créées).

### Colonnes reconnues automatiquement

| Cible | Intitulés reconnus | Obligatoire |
|---|---|---|
| Date | `date`, `date facture`, `date pièce`, `jour`, `période` | **oui** |
| Montant | `montant`, `montant HT`, `débit`, `solde`, `valeur`, `total` | **oui** |
| Compte | `compte`, `n° compte`, `compte général` | recommandé |
| Libellé | `libellé`, `description`, `intitulé`, `objet` | non |
| Quantité | `quantité`, `qté`, `nombre`, `volume`, `unités` | pour les écarts prix/volume/mix |
| Prix unitaire | `prix unitaire`, `PU`, `prix`, `tarif` | idem |
| Sens | `sens`, `type`, `flux` | non (déduit du compte) |
| Comportement | `comportement`, `fixe/variable`, `variabilité` | non (déduit du compte) |
| Traçabilité | `traçabilité`, `direct/indirect`, `imputation` | non (déduit du compte) |
| Axes d'analyse | l'intitulé de vos axes et leurs synonymes : `client`, `chantier`, `affaire`, `mission`, `produit`, `atelier`, `magasin`, `collaborateur`… | oui pour la rentabilité par objet |

Toute colonne non reconnue peut être mappée manuellement dans l'écran d'import ; le score de
confiance de chaque proposition est affiché.

### Formats acceptés

- séparateurs `;` `,` tabulation `|` — détectés automatiquement ;
- montants `1 234,56`, `1.234,56`, `1234.56`, `1 234,56 €`, `(1 234,56)` pour un négatif ;
- dates `31/03/2026`, `2026-03-31`, `31.03.2026`, `31-03-26` ;
- valeurs de sens : `Produit`, `Vente`, `Crédit` / `Charge`, `Achat`, `Débit` ;
- comportement : `Fixe`, `Variable`, `Semi-variable`, `Mixte` ;
- traçabilité : `Direct`, `Indirect`.

Une valeur non reconnue dans ces trois dernières colonnes n'est **jamais** écrite telle quelle :
le classement retombe sur le plan de comptes, puis sur le repli documenté (docs/07 §2).

### Rapprochement avec l'existant

Une valeur de colonne est rapprochée d'un membre existant **par son code ou par son libellé** :
un export contenant « Résidence Alba » retrouve le chantier dont le code est `ALBA` au lieu d'en
créer un doublon. Les membres réellement nouveaux sont annoncés dans l'essai à blanc avant écriture.

Un exemple prêt à l'emploi : [`exemples/balance-exemple.csv`](../exemples/balance-exemple.csv).

## 3. Ce qu'un export comptable ne contient pas

C'est le point qui décide de la richesse du pilotage. Trois familles de données à ajouter :

### 3.1 Inducteurs (données statistiques)

Heures travaillées et facturables, effectifs, ETP, heures machine, unités produites et rebutées,
surfaces, commandes, visites. Ils servent de **clés de répartition** et de **dénominateurs** aux
ratios de productivité.

Saisie : `/data` → « Saisir un inducteur » (inducteur, période, axe et membre facultatifs, valeur).
L'écran affiche en tête les inducteurs que votre configuration attend et qui manquent encore.

Sans eux, les indicateurs concernés s'affichent en « donnée manquante » — jamais avec une valeur
approchée.

### 3.2 Attributs des objets de coûts

Pour le suivi à l'avancement, chaque affaire doit porter `contractValue` (prix contractuel),
`budgetTotal` (budget de coûts) et, si vous le suivez, `progress` (avancement physique, 0 à 1).
Pour un réseau de points de vente : `m2`. Pour un collaborateur : `dailyRate`, `hourlyCost`.

⚠️ **Limite du MVP** : ces attributs se saisissent aujourd'hui par script
(`prisma.dimensionMember.update`) ou via le jeu de démonstration ; l'écran de saisie est prévu
en V1. Sans eux, l'avancement bascule automatiquement sur la méthode cost-to-cost et les
indicateurs de terminaison restent en « donnée manquante ».

### 3.3 Budget

`/budgets` → construction depuis l'historique : le réel de l'exercice source est projeté mois par
mois avec un coefficient distinct pour le chiffre d'affaires et pour les charges, **saisonnalité
et ventilation dimensionnelle conservées** (c'est cette ventilation qui rend possible la
décomposition prix / volume / composition).

## 4. Alimentation par script

Pour un chargement massif ou récurrent, les services sont réutilisables tels quels :

```ts
// scripts/charger.ts — npx tsx --env-file=.env scripts/charger.ts
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/db";
import { analyzeImport, dryRun, commitImport } from "@/services/import.service";

const companyId = "…";
const contenu = readFileSync("balance-2026.csv", "utf8");

const analyse = await analyzeImport(companyId, "balance-2026.csv", contenu);
const mapping = {
  columns: analyse.suggestions.map((s) => ({
    column: s.column,
    index: s.index,
    target: s.confidence >= 70 ? s.target : ("ignore" as const),
  })),
  defaults: {},
  createMissingMembers: true,
};

console.log(await dryRun(companyId, analyse.batchId, mapping)); // contrôle avant écriture
await commitImport(companyId, analyse.batchId, mapping, null);
```

Les inducteurs et les attributs se chargent directement avec Prisma
(`prisma.driverValue.createMany`, `prisma.dimensionMember.update`).

## 5. Remise à zéro et vérification

```bash
npm run db:reset          # supprime dev.db, recrée le schéma, recharge la démonstration
npx prisma studio         # inspection et correction manuelle des tables
npm run inspect 2026-03   # sorties chiffrées : coûts, marges, KPI, alertes, qualité
```

Après chaque import, l'écran `/data` affiche le **score de qualité** et la liste des défauts avec
l'action corrective : charges directes sans objet de coût, doublons, membres inconnus, périodes
sans écriture, inducteurs attendus manquants. Ce score conditionne l'indice de confiance affiché
sur les analyses et les réponses du copilote.
