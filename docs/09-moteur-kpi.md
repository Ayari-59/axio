# 09 — Moteur KPI

## 1. Un KPI est une donnée, pas du code

```ts
{
  code: "UTILIZATION",
  name: "Taux d'occupation",
  category: "productivity",
  formula: "billableHours / availableHours * 100",
  unit: "PCT",
  frequency: "MONTH",
  direction: "UP",
  target: 75, warningThreshold: 70, criticalThreshold: 60,
  dimensionCode: "EMPLOYEE",
  requires: ["timesheets"],
  definition: "Part des heures travaillées effectivement facturables au client.",
  interpretation: "Sous 70 %, la structure ne couvre plus ses coûts fixes...",
  limits: "Ne dit rien du prix de vente : un taux élevé à TJM bas détruit de la marge."
}
```

Ajouter un indicateur = ajouter un enregistrement. Aucun déploiement.

## 2. Évaluateur de formules

`core/kpi/formula.ts` implémente un **analyseur maison** (tokenizer → shunting-yard → RPN),
sans `eval` ni `Function` :

- opérateurs : `+ - * / ( ) %`, unaire `-`, comparaison pour les formules conditionnelles ;
- fonctions : `min`, `max`, `abs`, `round`, `avg`, `safe(x, defaut)`, `prev(mesure)`, `ytd(mesure)` ;
- identifiants : les **mesures** du namespace (doc 03 §4) et les constantes numériques ;
- division par zéro → `null` (indicateur « non calculable »), jamais `Infinity` ni `NaN` ;
- toute mesure inconnue → erreur de validation **à l'enregistrement du KPI**, pas à l'exécution.

Le namespace est fourni par le moteur de calcul :

```ts
type MeasureContext = {
  get(measure: string): number | null      // pour la période/dimension courante
  prev(measure: string): number | null     // période précédente
  ytd(measure: string): number | null      // cumul exercice
  budget(measure: string): number | null   // valeur budgétée
}
```

Un KPI peut donc s'écrire `(revenue - prev(revenue)) / prev(revenue) * 100` (croissance) ou
`(revenue - budget(revenue)) / budget(revenue) * 100` (écart budgétaire) sans code dédié.

## 3. Sélection automatique

```
KPI proposé  ⟺  (règle du moteur l'a suggéré)
             ET (toutes les mesures de sa formule sont disponibles)
             ET (toutes ses capacités requises sont actives)
```

Trois états possibles à l'écran :

| État | Signification | Rendu |
|---|---|---|
| `computed` | calculé | valeur + tendance + statut |
| `missing_data` | KPI pertinent mais donnée absente | carte grisée + « importer les heures » |
| `not_applicable` | non pertinent pour ce profil | masqué |

L'état `missing_data` est stratégique : c'est lui qui transforme le produit en guide
(« voici ce qui vous manque pour piloter comme votre secteur »).

## 4. Statut et seuils

```
direction = UP    → OK si valeur ≥ target ; WARNING si ≥ warning ; CRITICAL sinon
direction = DOWN  → OK si valeur ≤ target ; WARNING si ≤ warning ; CRITICAL sinon
```

Sans cible définie, le KPI est affiché avec sa seule tendance (pas de statut coloré arbitraire).
Les cibles peuvent être : saisies, dérivées du budget, ou proposées par le template sectoriel
(médianes indicatives, présentées comme telles).

## 5. Catalogue livré au MVP (extrait)

| Catégorie | Codes |
|---|---|
| Croissance | `REVENUE`, `REVENUE_GROWTH`, `REVENUE_YTD`, `BACKLOG` |
| Rentabilité | `CONTRIBUTION_MARGIN`, `MARGIN_RATE`, `OPERATING_MARGIN`, `MARGIN_BY_OBJECT`, `BREAK_EVEN`, `SAFETY_MARGIN`, `OPERATING_LEVERAGE` |
| Coûts | `TOTAL_COST`, `COST_RATIO`, `FIXED_COST_SHARE`, `PAYROLL_RATIO`, `PURCHASE_RATIO`, `SUBCONTRACTING_RATIO`, `UNIT_COST` |
| Productivité | `REVENUE_PER_FTE`, `MARGIN_PER_FTE`, `UTILIZATION`, `AVG_DAILY_RATE`, `HOURLY_COST`, `OUTPUT_PER_HOUR` |
| Activité | `VOLUME`, `UNITS_PRODUCED`, `SCRAP_RATE`, `PROGRESS_RATE`, `EAC_DRIFT` |
| Commercial | `CLIENT_CONCENTRATION`, `MARGIN_BY_CLIENT`, `AVG_TICKET`, `WIN_RATE` |
| Budget | `BUDGET_VARIANCE_PCT`, `BUDGET_CONSUMPTION`, `FORECAST_ACCURACY` |
| Trésorerie | `CASH_POSITION`, `DSO`, `WORKING_CAPITAL`, `CASH_RUNWAY` |

Chaque définition embarque `definition`, `interpretation` et `limits` : c'est le socle du
**mode pédagogique** exigé au §25 du cahier des charges.

## 6. Calcul et historisation

```
computeKpis(definitions, measures, periods, dimensions) → KpiValue[]
```

- calcul par période, et par membre si `dimensionCode` est renseigné ;
- valeurs persistées (`KpiValue`) pour l'historique, les tendances et la détection d'anomalies ;
- recalcul déclenché par le même mécanisme d'empreinte que les coûts (doc 04 §6).

## 7. Cockpit : sélection et disposition

Le moteur de règles compose une `DashboardSpec` :

```ts
{ sections: [
   { id: "pulse",   title: "Pouls",        blocks: [{ type: "kpi", code: "REVENUE" }, …] },
   { id: "margin",  title: "Marges",       blocks: [{ type: "cascade" }, { type: "ranking", dimension: "PROJECT" }] },
   { id: "budget",  title: "Budget",       blocks: [{ type: "variance-bridge" }] },
   { id: "risks",   title: "Points d'attention", blocks: [{ type: "alerts" }] }
 ] }
```

Types de blocs disponibles : `kpi`, `sparkline`, `cascade`, `ranking`, `variance-bridge`,
`waterfall`, `breakeven`, `progress-table`, `alerts`, `insight`, `missing-data`.

Deux entreprises différentes obtiennent des sections différentes **avec le même code de rendu**.
