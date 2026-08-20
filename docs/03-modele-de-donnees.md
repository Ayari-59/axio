# 03 — Modèle de données

## 1. Le choix fondateur : une étoile générique

Un logiciel de contrôle de gestion classique crée une table par objet métier : `Chantier`,
`Mission`, `Magasin`, `Machine`. C'est exactement ce qui le rend non générique : chaque nouveau
secteur exige une migration de schéma, un nouvel écran, un nouveau calcul.

Axio ne connaît que **quatre** notions :

| Notion | Rôle | Exemple BTP | Exemple conseil | Exemple industrie |
|---|---|---|---|---|
| `Dimension` | un axe d'analyse | CHANTIER | MISSION | PRODUIT |
| `DimensionMember` | une valeur de l'axe | « Résidence Alba » | « Refonte SI Delta » | « Vanne DN80 » |
| `Entry` | un fait économique daté et chiffré | facture ST 12 400 € | 7 h de consultant | 1 200 kg d'acier |
| `Period` | la maille temporelle | 2026-03 | 2026-03 | 2026-03 |

Tout le reste (marges par chantier, TJM, coût unitaire) est **calculé**, jamais stocké en dur.
Le mot « chantier » n'existe nulle part dans le code : c'est le `label` d'une `Dimension` dont le
`code` est `PROJECT`.

## 2. Vue d'ensemble

```
Organization
 └── Company ───────────────────────────────────────────────┐
      ├── BusinessModelProfile (1)                          │
      ├── ConfigurationVersion (n, historisées)             │
      │     └── capabilities / dashboard / costMethods      │
      ├── Dimension (n) ── DimensionMember (n, hiérarchique)│
      ├── Account (plan de comptes) ── CostNature           │
      ├── Period (n)                                        │
      ├── Entry (faits) ── EntryDimension (n:n)             │
      ├── DriverValue (unités d'œuvre / inducteurs)         │
      ├── AllocationRule (n, ordonnées, multi-étages)       │
      ├── Budget (n versions) ── BudgetLine (n)             │
      ├── KpiDefinition (n) ── KpiValue (n)                 │
      ├── CalculationRun ── CostAllocation (traces)         │
      ├── Scenario (what-if) / ForecastSet                  │
      ├── Alert / Insight / Report                          │
      ├── ImportBatch ── ImportMapping                      │
      └── Membership (utilisateurs + rôle + périmètre)      │
                                                            │
User ───────────────────────────────────────────────────────┘
AuditLog (transversal)
```

## 3. Les entités du socle

### 3.1 `Dimension`

```ts
Dimension {
  id, companyId
  code: string          // CENTER, PROJECT, CLIENT, PRODUCT, SITE, ACTIVITY, EMPLOYEE, NATURE…
  label: string         // "Chantier", "Mission", "Magasin" — libellé sectoriel
  kind: DimensionKind   // RESPONSIBILITY | COST_OBJECT | ANALYSIS | RESOURCE | TIME
  isCostObject: boolean // peut porter un coût complet et une marge
  isMandatory: boolean  // toute écriture doit être ventilée sur cet axe
  hierarchical: boolean
  sortOrder: number
  source: "template" | "rule" | "user" | "import"
}
```

Les dimensions **système** toujours présentes : `NATURE` (nature de charge/produit),
`CENTER` (centre de responsabilité), `TIME` (implicite via `Period`).
Toutes les autres sont créées par le moteur de règles ou par l'utilisateur.

### 3.2 `DimensionMember`

```ts
DimensionMember {
  id, companyId, dimensionId
  code, label
  parentId?            // hiérarchie : Agence > Équipe > Consultant
  attributes: json     // { client: "ALBA", startDate, budgetTotal, m2, statut… }
  active: boolean
}
```

Les `attributes` portent les propriétés sectorielles (surface d'un magasin, date de fin d'un
chantier, capacité d'une machine) **sans colonne dédiée**. Elles sont utilisables comme clé de
répartition (`driver: { type: "attribute", key: "m2" }`) et comme filtre.

### 3.3 `Entry` — la table de faits

```ts
Entry {
  id, companyId, periodId
  date: Date
  kind: "REVENUE" | "COST" | "QUANTITY" | "CASH_IN" | "CASH_OUT"
  amount: number            // signé : produits > 0, charges > 0 (le signe est porté par kind)
  quantity?: number         // volume vendu / consommé
  unitPrice?: number        // prix unitaire, requis pour les écarts prix/volume/mix
  unit?: string             // h, kg, u, m2, jour
  accountId?                // rattachement au plan de comptes
  behavior: "FIXED" | "VARIABLE" | "SEMI_VARIABLE"
  traceability: "DIRECT" | "INDIRECT"
  label, sourceRef
  importBatchId?
}

EntryDimension { entryId, dimensionId, memberId }   // ventilation n:n
```

Une écriture de 12 400 € de sous-traitance sur le chantier Alba, centre Gros œuvre, client Foncia
est **une** ligne `Entry` + 3 lignes `EntryDimension`. Ajouter un axe d'analyse ne change pas le
schéma.

Invariant : une écriture `COST` marquée `DIRECT` **doit** porter un membre sur au moins une
dimension `isCostObject`. Le contrôle qualité en fait un test (`unallocated_direct_cost`).

### 3.4 `DriverValue` — les inducteurs

```ts
DriverValue {
  companyId, periodId, driverCode      // HOURS, HEADCOUNT, M2, MACHINE_H, ORDERS, REVENUE…
  dimensionId, memberId                // le porteur de l'unité d'œuvre
  value: number
}
```

Sert de base aux clés de répartition et aux inducteurs ABC, et de dénominateur aux KPI de
productivité. C'est ici qu'atterrissent les feuilles de temps, les relevés machine, les effectifs.

**Règle d'agrégation (importante).** Un même inducteur peut être saisi sur plusieurs axes : les
heures facturables peuvent être ventilées par mission *et* par collaborateur. Sommer toutes les
lignes doublerait le total. Le moteur agrège donc par `(inducteur, axe)` puis retient **une seule**
ventilation — priorité à la valeur d'entreprise (sans axe), sinon premier axe par ordre
alphabétique. Conséquence : le total d'un inducteur ne dépend jamais de l'axe utilisé pour le
décomposer ; en contrepartie, deux ventilations incohérentes du même inducteur doivent être
corrigées à la source (le contrôle qualité les signale).

### 3.5 `AllocationRule` — le moteur d'affectation

```ts
AllocationRule {
  id, companyId, name, stage: number, sortOrder: number, active
  source: EntryFilter          // quelles charges (nature, compte, comportement, dimension…)
  method: "DIRECT" | "DRIVER" | "PERCENT" | "EQUAL" | "ABC"
  targetDimensionCode          // vers quel axe on répartit
  driver?: { type: "driver" | "attribute" | "measure", key: string }
  weights?: { memberCode: number }[]   // pour PERCENT
  keepTrace: boolean
}
```

Le **stage** permet le cheminement classique :
`stage 1` charges → centres, `stage 2` centres auxiliaires → centres principaux
(y compris prestations réciproques), `stage 3` centres → objets de coûts.

### 3.6 `Budget` / `BudgetLine`

```ts
Budget {
  id, companyId, name, fiscalYear
  kind: "BUDGET" | "REVISED" | "FORECAST" | "ROLLING" | "STANDARD"
  scenario: "BASE" | "OPTIMISTIC" | "PESSIMISTIC"
  version, status: "DRAFT" | "SUBMITTED" | "APPROVED" | "ARCHIVED"
}

BudgetLine {
  budgetId, periodId
  kind: "REVENUE" | "COST"
  accountId?, behavior
  dimensions: { dimensionCode: memberCode }   // ventilation
  quantity?, unitPrice?, amount
  // amount = quantity × unitPrice quand les deux sont fournis (invariant vérifié)
}
```

La présence de `quantity` **et** `unitPrice` au niveau ligne est ce qui rend possible la
décomposition prix / volume / mix. Sans elle, un « écart de marge » reste non explicable.

### 3.7 `KpiDefinition` / `KpiValue`

```ts
KpiDefinition {
  id, companyId, code, name, category
  definition: string          // texte pédagogique
  formula: string             // expression sur des mesures : "margin / revenue * 100"
  unit: "EUR" | "PCT" | "RATIO" | "QTY" | "DAYS"
  frequency: "MONTH" | "QUARTER" | "YEAR"
  direction: "UP" | "DOWN"    // sens favorable
  target?, warningThreshold?, criticalThreshold?
  dimensionCode?              // KPI calculable par membre de cet axe
  requires: string[]          // capacités/mesures nécessaires
  ownerRole?
  interpretation, limits      // mode pédagogique
}
```

`KpiValue { kpiId, periodId, dimensionId?, memberId?, value, status }`.

### 3.8 Configuration versionnée

```ts
ConfigurationVersion {
  id, companyId, version, createdAt, createdBy, note
  payload: {
    capabilities: string[]
    costMethods: string[]
    dimensions: DimensionSpec[]
    kpiCodes: string[]
    dashboard: DashboardSpec
    ruleTrace: { ruleId, effect }[]     // pourquoi chaque élément a été activé
  }
}
```

`ruleTrace` est essentiel : l'utilisateur peut demander « pourquoi ai-je un onglet Avancement ? »
et obtenir « règle BTP-02 : facturation à l'avancement déclarée à l'étape 2 ».

## 4. Mesures canoniques

Le moteur KPI et le copilote ne parlent pas de tables mais de **mesures**, calculées par le noyau :

| Mesure | Définition |
|---|---|
| `revenue` | somme des `Entry.kind = REVENUE` |
| `variableCost` | coûts `behavior = VARIABLE` |
| `fixedCost` | coûts `behavior = FIXED` (semi-variables éclatés) |
| `directCost` | coûts `traceability = DIRECT` |
| `indirectCost` | coûts `traceability = INDIRECT` (avant/après affectation) |
| `totalCost` | `directCost + indirectCost` |
| `contributionMargin` | `revenue − variableCost` |
| `grossMargin` | `revenue − directCost` |
| `operatingMargin` | `revenue − totalCost` |
| `quantity`, `hours`, `headcount`, `billableHours` | agrégats de `DriverValue` |
| `breakEven` | `fixedCost / contributionMarginRate` |

Toute formule de KPI s'écrit avec ces noms. Ajouter une mesure = l'ajouter au namespace, pas au
schéma.

## 5. Invariants du modèle

1. Toute `Entry` appartient à une `Period` fermée ou ouverte de la `Company`.
2. `sum(EntryDimension par dimension) = 1 entrée max` : une écriture ne peut porter deux membres
   de la même dimension (une ventilation multiple crée plusieurs `Entry`).
3. Une `AllocationRule` de stage n ne peut cibler que des dimensions de stage ≥ n.
4. Un `Budget` approuvé est immuable ; toute modification crée une version.
5. Une `ConfigurationVersion` n'est jamais modifiée ; on en crée une nouvelle.
6. `CostAllocation.amount` sommé par source = montant source (conservation de la masse,
   vérifiée par test).
