# 10 — Système de configuration dynamique

## 1. Ce qui est configurable sans code

| Objet | Où il vit | Modifiable par |
|---|---|---|
| Capacités actives | `ConfigurationVersion.payload.capabilities` | moteur de règles + admin |
| Dimensions et libellés | table `Dimension` | moteur + utilisateur |
| Membres et attributs | table `DimensionMember` | import + utilisateur |
| Plan de comptes et classements par défaut | table `Account` | import + utilisateur |
| Règles d'affectation | table `AllocationRule` | moteur (suggestion) + utilisateur |
| KPI, formules, cibles, seuils | table `KpiDefinition` | catalogue + utilisateur |
| Composition du cockpit | `payload.dashboard` | moteur + utilisateur (réordonnancement) |
| Règles d'alerte | rule packs + surcharges en base | moteur + utilisateur |
| Templates sectoriels | `core/templates` (V2 : en base) | éditeur de packs |
| Libellés d'interface métier | `Dimension.label`, `PilotObject.label` | utilisateur |

## 2. Cycle de vie de la configuration

```
        ┌──────────────┐  profil modifié / données enrichies
        │  Profil      │───────────────┐
        └──────────────┘               ▼
                              ┌──────────────────┐
                              │  RuleEngine      │
                              └────────┬─────────┘
                                       ▼
                              ┌──────────────────┐
                              │ ConfigurationPlan│  (proposition)
                              └────────┬─────────┘
                                       ▼
              diff vs configuration courante  →  écran de revue
                                       ▼
                          application transactionnelle
                                       ▼
                         ConfigurationVersion n+1 (immuable)
```

Trois garanties :

1. **Rien n'est appliqué sans revue** dès qu'une configuration existe déjà.
2. **Rien n'est supprimé** : on désactive (`active = false`), jamais `DELETE`.
3. **Tout est explicable** : `ruleTrace` relie chaque élément de configuration à sa règle et à la
   réponse du profil qui l'a déclenchée.

## 3. Résolution des conflits

Ordre de précédence croissant (le dernier gagne) :

```
pack base  <  pack sectoriel  <  règles additionnelles  <  surcharge utilisateur  <  verrou admin
```

Une valeur modifiée par l'utilisateur est marquée `source = "user"` et n'est **jamais** écrasée
par une réexécution des règles ; le diff signale alors « proposition ignorée (surcharge
utilisateur) », que l'utilisateur peut lever explicitement.

## 4. Maturité progressive

Le produit ne doit pas noyer une PME de 8 personnes sous l'ABC. Le niveau de maturité pilote
la **profondeur** de configuration :

| Niveau | Ce qui est activé |
|---|---|
| `starter` | 2 axes max (CLIENT ou PROJECT + NATURE), coût variable, 6 KPI, cockpit 2 sections |
| `intermediate` | + centres de responsabilité, affectation par clés, budget, écarts, 12 KPI |
| `advanced` | + ABC, coûts standards, écarts à 3 niveaux, what-if multi-leviers, rolling forecast |

Le passage d'un niveau au suivant est proposé automatiquement quand les données le permettent
(« vous avez importé 12 mois d'heures : activer le taux d'occupation et la marge par consultant ? »).

## 5. Personnalisation du vocabulaire

Tout libellé métier est une donnée. Le moteur affiche `Dimension.label`, jamais un mot codé :

| `code` | Conseil | BTP | Industrie | Commerce |
|---|---|---|---|---|
| `PROJECT` | Mission | Chantier | Ordre de fabrication | — |
| `CENTER` | Pôle | Centre | Atelier | Rayon |
| `EMPLOYEE` | Consultant | Compagnon | Opérateur | Vendeur |
| `SITE` | Bureau | Dépôt | Usine | Magasin |

Un test automatisé vérifie qu'aucun de ces mots n'apparaît dans `src/core` hors `templates/`.

## 6. Import : mapping comme configuration

Le mapping d'un fichier est lui aussi une configuration réutilisable :

```ts
ImportMapping {
  name, sourceSignature,          // empreinte des en-têtes → reconnaissance automatique
  columns: { source, target, transform? }[],
  defaults: { behavior?, traceability?, kind? },
  dimensionRules: { column, dimensionCode, createMissingMembers }[]
}
```

Au deuxième import du même export comptable, le mapping est reconnu et proposé tel quel :
l'utilisateur ne remappe jamais deux fois.

## 7. Extension par l'utilisateur avancé

| Besoin | Geste |
|---|---|
| Nouvel axe d'analyse | Créer une dimension, importer une colonne |
| Nouvelle clé de répartition | Importer un inducteur (`DriverValue`) et créer une règle `DRIVER` |
| Nouveau KPI | Écrire une formule sur les mesures existantes |
| Nouvelle alerte | Écrire une condition sur les mêmes mesures |
| Nouveau template | Exporter sa configuration en pack JSON réutilisable (V2) |

Chacun de ces gestes se fait **dans l'interface**, sans intervention technique : c'est la
définition opérationnelle de « configuration > hardcoding ».
