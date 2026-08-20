# 06 — Moteur de règles

## 1. Pourquoi un moteur de règles

C'est la pièce qui remplace le code sectoriel. Sans lui, on écrirait :

```ts
if (industry === "construction") { enableProjectBudget(); enableProgress(); }   // interdit
```

Avec lui, on écrit une **donnée** :

```ts
{
  id: "CONSTRUCTION-01",
  when: { all: [ { fact: "profile.industry", op: "eq", value: "construction" } ] },
  then: [
    { type: "enable_capability", value: "project_costing" },
    { type: "enable_capability", value: "progress_tracking" },
    { type: "create_dimension", value: { code: "PROJECT", label: "Chantier",
        kind: "COST_OBJECT", isCostObject: true } }
  ]
}
```

Le même moteur sert **trois usages** :
1. **Configuration** — dériver le système de pilotage depuis le profil.
2. **Alertes** — déclencher des signaux depuis les mesures calculées.
3. **Recommandations** — proposer des actions depuis un diagnostic.

Une seule implémentation, trois jeux de faits.

## 2. Structure d'une règle

```ts
type Rule = {
  id: string
  name: string
  scope: "configuration" | "alert" | "recommendation"
  salience: number          // ordre décroissant ; à égalité, ordre de déclaration
  when: Condition
  then: Effect[]
  because?: string          // explication affichée à l'utilisateur
  stopOnMatch?: boolean
}
```

### 2.1 Conditions

```ts
type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { fact: string; op: Operator; value?: unknown }

type Operator =
  | "eq" | "neq" | "gt" | "gte" | "lt" | "lte"
  | "in" | "nin" | "includes" | "excludes"
  | "exists" | "empty" | "between"
```

`fact` est un chemin pointé résolu dans l'objet de faits (`profile.costs.subcontractingSharePct`,
`data.hasTimesheets`, `metrics.marginRatePct`, `metrics.varianceVsBudgetPct`).
La résolution ne fait **aucune** exécution de code : c'est un accès de propriété sécurisé.

### 2.2 Effets

| Type | Charge utile | Effet |
|---|---|---|
| `enable_capability` | code | active une capacité (UI + moteurs) |
| `create_dimension` | `DimensionSpec` | crée un axe (idempotent sur `code`) |
| `set_cost_method` | `full\|variable\|abc\|standard\|marginal` | ajoute une méthode de coût |
| `suggest_allocation_rule` | `AllocationRuleSpec` | propose une règle d'affectation |
| `suggest_kpi` | code KPI + cible | ajoute un KPI au cockpit |
| `add_dashboard_block` | `DashboardBlock` | compose le cockpit |
| `require_driver` | code inducteur | demande une donnée statistique |
| `raise_alert` | `AlertSpec` | ouvre une alerte |
| `recommend` | `RecommendationSpec` | propose une action |

## 3. Faits disponibles

```ts
type Facts = {
  profile: BusinessModelProfile & { industry, country, currency, headcount, revenueBand }
  data: {                        // ce que l'on observe réellement dans les données
    hasEntries, entryCount, periodCount,
    hasTimesheets, hasQuantities, hasUnitPrices, hasBankData, hasBudget,
    dimensionsPresent: string[], indirectSharePct, topClientSharePct
  }
  metrics?: {                    // uniquement pour scope = alert | recommendation
    revenue, margin, marginRatePct, marginRateDeltaPts,
    varianceVsBudgetPct, costGrowthPct, dso, utilizationPct, ...
  }
  config?: { capabilities: string[] }
}
```

Point important : les règles de configuration croisent **le déclaratif** (`profile`) et
**l'observé** (`data`). Une entreprise qui déclare facturer au temps mais n'importe jamais de
feuilles de temps ne verra pas le taux d'occupation : la capacité est activée, mais le KPI reste
en état « donnée manquante » — cf. `06 §6`.

## 4. Exécution

```
evaluate(rules, facts) →
  { effects: Effect[], trace: { ruleId, ruleName, matched, effects }[] }
```

1. Filtrage par `scope`.
2. Tri par `salience` décroissante.
3. Évaluation des conditions (pure, sans effet de bord).
4. Accumulation des effets ; **déduplication** par (type, cible) : le dernier gagne pour les
   valeurs scalaires, l'union pour les listes.
5. Retour d'une trace complète — c'est elle qui alimente « pourquoi ce cockpit ? ».

Le moteur est **déterministe** : mêmes faits + mêmes règles = même plan de configuration.
Aucune récursion (pas de chaînage avant) au MVP : les effets ne modifient pas les faits.
Un chaînage à 2 passes est prévu en V1 (`config` devient un fait de la passe 2).

## 5. Rule packs

Un **rule pack** = un jeu de règles + des libellés + des presets, publiable indépendamment.

```
core/templates/
  base.ts            règles universelles (tous secteurs)
  consulting.ts      services facturés au temps
  construction.ts    BTP / projets à l'avancement
  manufacturing.ts   industrie
  retail.ts          commerce / réseau de points de vente
  saas.ts            abonnement
  index.ts           registre { code, label, rules, defaultDimensions, defaultKpis }
```

Sélection : le pack `base` est **toujours** appliqué ; le pack sectoriel est choisi par
`profile.industry` ; les packs additionnels sont activés par règle (une entreprise industrielle
avec des magasins reçoit aussi `retail`).

Un pack est du **JSON sérialisable** : il pourra être stocké en base et édité par l'utilisateur
(V2, marketplace de modèles) sans redéploiement.

## 6. Règles de base (extrait du pack `base`)

| Règle | Condition | Effets |
|---|---|---|
| `BASE-01` | toujours | dimensions `NATURE`, `CENTER` ; méthode `variable` ; KPI `REVENUE`, `MARGIN_RATE`, `OPEX` |
| `BASE-02` | `pilotObjects` contient `CLIENT` | dimension `CLIENT` (objet de coût), KPI `MARGIN_BY_CLIENT`, `CLIENT_CONCENTRATION` |
| `BASE-03` | `pilotObjects` contient `PRODUCT` | dimension `PRODUCT`, KPI `MARGIN_BY_PRODUCT` |
| `BASE-04` | `indirectSharePct >= 30` ou maturité avancée | capacité `abc_costing`, méthode `abc` |
| `BASE-05` | `siteCount >= 2` | dimension `SITE`, bloc de comparaison inter-sites |
| `BASE-06` | `objectives` contient `cash_forecast` **et** `data.hasBankData` | capacité `cash_forecast` |
| `BASE-07` | `seasonality = strong` | forecast : méthode saisonnière par défaut |
| `BASE-08` | `topClientSharePct >= 30` | alerte de concentration, KPI `CLIENT_CONCENTRATION` |
| `BASE-09` | `subcontractingSharePct >= 10` | capacité `subcontractor_tracking` |
| `BASE-10` | `data.hasBudget` | capacité `budget_control`, blocs d'écarts |

Règles d'alerte (extrait) :

| Règle | Condition | Alerte |
|---|---|---|
| `ALERT-MARGIN-01` | `metrics.marginRateDeltaPts <= -2` | CRITICAL « dégradation du taux de marge » |
| `ALERT-BUDGET-01` | `metrics.varianceVsBudgetPct >= 10` | WARNING « dépassement budgétaire » |
| `ALERT-COST-01` | `metrics.costGrowthPct >= 15` et `revenueGrowthPct < 5` | CRITICAL « dérive des coûts » |
| `ALERT-UTIL-01` | capacité `utilization_rate` et `utilizationPct < 65` | WARNING « sous-occupation » |
| `ALERT-CONC-01` | `topClientSharePct >= 40` | WARNING « dépendance client » |

## 7. Application d'un plan de configuration

Le plan n'est **jamais** appliqué automatiquement en cas de reconfiguration : il produit un diff.

```
ConfigurationPlan × ConfigurationActuelle → Diff
  + dimensions à créer          (jamais de suppression automatique)
  ± capacités activées/désactivées
  + KPI ajoutés / retirés du cockpit
  + règles d'affectation proposées (statut "suggérée", à confirmer)
```

Règle de sécurité : **le moteur ne supprime jamais de données**. Il désactive, propose, marque.
Une dimension qui porte des écritures ne peut être retirée que manuellement.

## 8. Tests associés

- déterminisme (même entrée → même sortie, 100 exécutions) ;
- idempotence (appliquer 2 fois le même plan ne crée rien la 2ᵉ fois) ;
- couverture : chaque règle possède au moins un cas positif et un cas négatif ;
- non-régression sectorielle : les 3 profils de référence produisent les capacités attendues ;
- garde-fou : `core/**` hors `templates/` ne contient aucun nom de secteur.
