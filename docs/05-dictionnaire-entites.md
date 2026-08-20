# 05 — Dictionnaire des entités

Convention : `?` = optionnel, `[]` = liste, `json` = colonne texte contenant du JSON validé par Zod.

## Tenancy

### Organization
| Champ | Type | Règle |
|---|---|---|
| `id` | cuid | |
| `name` | string | 2–120 |
| `slug` | string | unique, kebab-case |
| `plan` | string | `free` \| `pro` \| `firm` |

### User
| Champ | Type | Règle |
|---|---|---|
| `email` | string | unique, minuscules |
| `passwordHash` | string | bcrypt coût 10 |
| `name` | string | |
| `locale` | string | `fr-FR` par défaut |

### Membership
| Champ | Type | Règle |
|---|---|---|
| `userId`, `organizationId` | fk | |
| `companyId?` | fk | null = accès à toutes les entreprises de l'organisation |
| `role` | string | `ADMIN`\|`EXECUTIVE`\|`CONTROLLER`\|`CFO`\|`OPERATIONS`\|`MANAGER`\|`VIEWER` |
| `scope` | json? | `{ dimensionCode, memberCodes[] }` — restriction de périmètre |

### Company
| Champ | Type | Règle |
|---|---|---|
| `name`, `slug` | string | slug unique dans l'organisation |
| `industry` | string | code secteur (`consulting`, `construction`, `manufacturing`, …) |
| `country`, `currency` | string | ISO |
| `fiscalYearStartMonth` | int | 1–12 |
| `configuredAt?` | date | null tant que l'onboarding n'est pas appliqué |
| `archivedAt?` | date | suppression logique |

## Profil et configuration

### BusinessModelProfile (`payload`)
```ts
{
  identity:   { revenueBand, headcount, siteCount, establishmentCount, activity },
  revenue:    { models: RevenueModel[], billingUnits: BillingUnit[],
                recurringSharePct, seasonality: "none"|"moderate"|"strong",
                topClientSharePct },
  costs:      { mainCategories: CostCategory[], subcontractingSharePct,
                payrollSharePct, purchasesSharePct, indirectSharePct,
                marginDrivers: string[] },
  organization:{ units: { type: OrgUnitType, label, count }[] },
  pilotObjects: PilotObject[],      // CLIENT, PRODUCT, PROJECT, SITE, EMPLOYEE, CONTRACT, ACTIVITY
  objectives:  Objective[],
  maturity:    "starter"|"intermediate"|"advanced",
  dataSources: DataSource[]
}
```
Valeurs : `RevenueModel = time|unit|subscription|commission|project|progress|resale|mixed` ;
`BillingUnit = hour|day|fixed_price|quantity|subscription|commission|percentage|progress|contract` ;
`Objective = reduce_cost|improve_margin|control_budget|client_profitability|project_control|
productivity|resource_optimization|cash_forecast|pricing`.

### ConfigurationVersion (`payload`)
```ts
{
  capabilities: string[],
  costMethods: ("full"|"variable"|"direct"|"abc"|"standard"|"marginal")[],
  dimensions: { code, label, kind, isCostObject, isMandatory, hierarchical }[],
  kpiCodes: string[],
  dashboard: { sections: { id, title, blocks: DashboardBlock[] }[] },
  ruleTrace: { ruleId, ruleName, effect, target }[]
}
```

## Référentiels

### Dimension
`code`, `label`, `kind` (`RESPONSIBILITY|COST_OBJECT|ANALYSIS|RESOURCE`), `isCostObject`,
`isMandatory`, `hierarchical`, `sortOrder`, `source` (`system|template|rule|user|import`).

### DimensionMember
`dimensionId`, `code`, `label`, `parentId?`, `attributes` (json), `active`.
Attributs reconnus par le moteur : `m2`, `capacity`, `headcount`, `startDate`, `endDate`,
`budgetTotal`, `contractValue`, `client`, `status`, `hourlyCost`, `dailyRate`.

### Account
`number` (compte général), `label`, `type` (`REVENUE|EXPENSE|ASSET|LIABILITY`),
`defaultNatureCode?`, `defaultBehavior` (`FIXED|VARIABLE|SEMI_VARIABLE`),
`defaultTraceability` (`DIRECT|INDIRECT`).
Le plan de comptes sert de **source de classement par défaut** lors de l'import.

### Period
`code` (`2026-03`), `start`, `end`, `type` (`MONTH|QUARTER|YEAR`), `status` (`OPEN|CLOSED`),
`fiscalYear`.

## Faits

### Entry
`periodId`, `date`, `kind` (`REVENUE|COST|QUANTITY|CASH_IN|CASH_OUT`), `amount` (positif,
le sens est porté par `kind`), `quantity?`, `unitPrice?`, `unit?`, `accountId?`,
`behavior`, `traceability`, `label`, `sourceRef?`, `importBatchId?`.

### EntryDimension
`entryId`, `dimensionId`, `memberId`. Unicité `(entryId, dimensionId)`.

### DriverValue
`periodId`, `driverCode`, `dimensionId?`, `memberId?`, `value`, `unit`.
Codes standards : `HOURS`, `BILLABLE_HOURS`, `HEADCOUNT`, `FTE`, `MACHINE_HOURS`, `M2`,
`ORDERS`, `LINES`, `DELIVERIES`, `UNITS_PRODUCED`, `UNITS_SOLD`, `REVENUE`, `SETUPS`, `VISITS`.

## Pilotage

### AllocationRule (`definition`)
```ts
{
  source: { kinds?, behaviors?, traceabilities?, accountPrefixes?, natureCodes?,
            dimensionFilters?: { dimensionCode, memberCodes }[] },
  method: "DIRECT"|"DRIVER"|"PERCENT"|"EQUAL"|"ABC",
  targetDimensionCode: string,
  driver?: { type: "driver"|"attribute"|"measure", key: string },
  weights?: { memberCode: string, weight: number }[],
  activity?: { code, label, driverKey }      // méthode ABC
}
```
`stage` : 1 = charges → centres, 2 = centres → centres, 3 = centres → objets de coûts.

### Budget / BudgetLine
Cf. document 03 §3.6. `BudgetLine.dimensions` est un objet `{ dimensionCode: memberCode }`.
Invariant : si `quantity` et `unitPrice` sont fournis, `amount = quantity × unitPrice` (±0,01).

### KpiDefinition
Cf. document 03 §3.7. `formula` est une expression évaluée par `core/kpi/formula.ts`
(analyseur maison, **pas d'`eval`**) sur le namespace des mesures.

### CalculationRun / CostAllocation
`CalculationRun` : `periodIds`, `fingerprint`, `configVersion`, `durationMs`, `status`.
`CostAllocation` : `runId`, `stage`, `ruleId?`, `sourceKind` (`entry|center|activity`),
`sourceRef`, `targetDimensionId`, `targetMemberId`, `amount`, `driverKey?`, `driverValue?`,
`driverTotal?`. C'est la **piste d'audit du calcul** : chaque euro affecté est justifié.

### Scenario (`definition`)
```ts
{
  base: { periodIds: string[] },
  levers: {
    id, label,
    target: "price"|"volume"|"unitCost"|"variableCost"|"fixedCost"|"headcount"
          |"payroll"|"subcontracting"|"productivity"|"fxRate"|"investment",
    scope?: { dimensionCode, memberCodes },
    change: { type: "pct"|"abs"|"set", value: number }
  }[]
}
```

### Alert
`code`, `severity` (`INFO|WARNING|CRITICAL`), `title`, `message`, `periodId`,
`dimensionCode?`, `memberCode?`, `value`, `threshold`, `status` (`OPEN|ACK|CLOSED`),
`payload` (json : contributeurs, série, lien de drill-down).

### ImportBatch
`filename`, `rowCount`, `status` (`DRAFT|VALIDATED|COMMITTED|CANCELLED`), `mapping` (json),
`qualityScore`, `issues` (json), `committedAt?`. Annulable : supprime les `Entry` du lot.

### AuditLog
`actorId`, `action`, `entity`, `entityId`, `diff` (json), `createdAt`, `ip?`.
