# 06 — Types TypeScript principaux

Couvre le point 8 de la mission n°37. Extraits de référence — la source de vérité sera
`src/engine/types.ts` et les schémas zod associés (`src/config/scenarios/schema.ts`).
TypeScript strict (`strict`, `noUncheckedIndexedAccess`) ; les payloads JSONB sont
**toujours** re-parsés par zod au chargement (`ScenarioConfigSchema.parse(...)`).

Identifiants nominaux pour éviter les mélanges d'UUID :

```ts
type Brand<T, B extends string> = T & { readonly __brand: B };
export type GameId = Brand<string, "GameId">;
export type CompanyId = Brand<string, "CompanyId">;   // = teams.id
export type SegmentCode = Brand<string, "SegmentCode">;
export type ProductCode = Brand<string, "ProductCode">;
export type ConceptCode = Brand<string, "ConceptCode">;
export type ModelCode = Brand<string, "ModelCode">;
```

## 1. Configuration de scénario (consommée par le moteur, §31)

```ts
export interface ScenarioConfig {
  code: string; version: string; title: string;
  roundsCount: number;
  roundMeaning: { unit: "month" | "quarter" | "year"; startLabel: string };
  companies: { min: number; max: number; initialState: InitialCompanyState; bots: BotProfile[] };
  market: MarketConfig;
  products: ProductConfig[];
  production: ProductionConfig;
  costs: CostLineConfig[];
  hr: HrConfig;
  finance: FinanceConfig;              // capital initial, taux emprunt/découvert, IS, plafonds
  investments: InvestmentProjectConfig[];
  events: string[];                    // codes d'event_definitions activés + scripts locaux
  scriptedEvents: { round: number; eventCode: string; companyIndex?: number }[];
  pedagogy: {                          // couplage pédagogique du scénario
    situations: string[];              // codes des situations scriptées/détectables
    conceptCodes: ConceptCode[];       // concepts activés (les 20 de NOVA)
    modelCodes: ModelCode[];
  };
  difficulty: DifficultyProfile;       // profil par défaut (surchargé par la partie)
  scoring: ScoringConfig;              // pondérations BPI (doc 08)
}

export interface MarketConfig {
  segments: SegmentConfig[];
  seasonality: number[];               // un coefficient par tour, moyenne = 1
  outsideCompetitor?: { attraction: number };  // « reste du marché » (doc 02 §3.3)
  competitionIntensity: number;        // γ par défaut (surchargé par segment)
}

export interface SegmentConfig {
  code: SegmentCode; name: string;
  size: number; growth: number;        // demande de base, croissance par tour
  purchaseFrequency: number; avgBasket: number;
  priceElasticity: number;             // < 0
  refPrice: number; minAcceptablePrice: number;
  psychThresholds: { threshold: number; penalty: number }[];   // doc 02 §3.2
  marketingSensitivity: number; marketingScale: number;
  qualitySensitivity: number; loyalty: number;
  competitionIntensity?: number;       // γ(s)
  paymentDelayDays: number;            // → BFR
  backlogRate: number;                 // part des ruptures reportée
}

export interface CostLineConfig {
  code: string; label: string;
  behavior: { kind: "fixed" } | { kind: "variable"; driver: "unit_produced" | "unit_sold" | "revenue"; rate: number };
  traceability: "direct" | "indirect"; productCode?: ProductCode;
  horizon: "operating" | "capacity";
  amount?: number;                     // fixes : € / tour
}

export interface DifficultyProfile {   // §20 — paramétrique (doc 08 §3)
  level: 1 | 2 | 3 | 4 | 5 | 6;
  decisionsUnlocked: string[];         // codes de decision_options actifs
  visibleKpis: KpiCode[];              // déblocage progressif (ADR-15)
  infoQuality: number;                 // 0..1 : bruit sur les études de marché fournies
  hintMaxLevel: 0 | 1 | 2 | 3 | 4 | 5;
  competitorsCount: number;
  eventIntensity: number;              // multiplicateur des probabilités d'événements
  consequenceLag: number;              // inertie (λ qualité, fidélité…)
  timePressure: { roundDuration?: string };
  constraintsTightness: number;        // marges de capacité/trésorerie initiales
}
```

## 2. État d'une entreprise et décisions

```ts
export interface CompanyState {
  id: CompanyId; name: string; controller: "human" | "bot"; botProfile?: string;
  products: { code: ProductCode; price: number; perceivedQuality: number }[];
  production: { units: ProductionUnitState[]; maintenanceLevel: number };
  hr: { category: "production" | "sales" | "support"; headcount: number; productivity: number }[];
  inventory: { rawMaterials: InventoryLot[]; finishedGoods: InventoryLot[] };  // lots CUMP
  finance: BalanceSheet;               // comptes du plan simplifié (doc 05 §5)
  history: { marketShareBySegment: Record<SegmentCode, number>; backlog: Record<SegmentCode, number> };
  activeInvestments: InvestmentInProgress[];
}

export interface RoundDecisions {      // payload de `decisions.payload`, validé par zod
  prices: Record<ProductCode, number>;
  productionPlan: Record<ProductCode, number>;
  marketingBudget: number;
  qualityBudget: number;
  maintenanceBudget: number;
  procurement: { supplierCode: string; quantity: number }[];
  hr?: { hire: number; fire: number; category: string }[];
  finance?: { newLoan?: number; loanRepayment?: number; capitalIncrease?: number;
              clientDiscountForCash?: boolean; supplierDelayNegotiated?: boolean };
  investments?: { projectCode: string; financing: "cash" | "loan" | "lease" }[];
  outsourcing?: Record<ProductCode, number>;
  forecast?: { expectedRevenue?: number; expectedNetIncome?: number; expectedCash?: number };
}
```

## 3. Résultats

```ts
export interface RoundResult {
  companyId: CompanyId;
  incomeStatement: IncomeStatement;    // CA → résultat net (doc 02 §6.1)
  balanceSheet: BalanceSheet;
  cashFlowStatement: CashFlow;         // budget de trésorerie réalisé
  functionalBalance: { frng: number; bfr: number; netTreasury: number };  // TN = FRNG − BFR (testé)
  ratios: Ratios;                      // profitabilité, Re, Rf, levier, rotation, endettement…
  market: { bySegment: Record<SegmentCode, SegmentSalesDetail> };  // demande, ventes, ruptures, part
  production: { produced: number; utilizationRate: number; outsourced: number; qualityProduced: number };
  kpis: Record<KpiCode, number>;
}

export type KpiCode =
  | "revenue" | "revenue_growth" | "net_income" | "gross_margin" | "cvp_margin_rate"
  | "cash" | "frng" | "bfr" | "net_treasury" | "inventory_value" | "receivables" | "payables"
  | "debt_ratio" | "market_share" | "customer_satisfaction" | "productivity"
  | "utilization_rate" | "break_even_units" | "safety_margin" | "roe" | "roce";

export interface EngineTrace {         // matière du débriefing (doc 02 §1)
  demandWaterfall: Record<SegmentCode, { base: number; afterSeason: number; afterPrice: number;
    afterMarketing: number; afterQuality: number; allocated: number; lost: number }>;
  costBreakdown: Record<ProductCode, { variable: number; fixedShare: number; full: number }>;
  cashBridge: { opening: number; items: { label: string; amount: number }[]; closing: number };
  eventsApplied: { code: string; effect: string }[];
}
```

## 4. Pédagogie et scoring

```ts
export interface SituationTrigger { round?: number; conditions?: ConditionExpr[] }
export type ConditionExpr = { path: string; op: "lt" | "gt" | "lte" | "gte" | "eq"; value: number };

export interface HintState {           // machine à indices (doc 03 §4)
  situationInstanceId: string;
  unlockedLevels: (1 | 2 | 3 | 4 | 5)[];   // préfixe strict de [1..5]
  totalCostRatio: number;
}

export interface ModelEvaluation {     // §7 — compétence "choisir le bon modèle"
  chosen: ModelCode;
  relevance: "optimal" | "acceptable" | "misleading" | "irrelevant";
  justificationScore: number;          // 0..1 (mots-clés au MVP, LLM à l'étape 12)
  analysisDecisionCoherence: number;   // 0..1
  hinted: boolean;                     // modèle soufflé par l'indice niveau 4
  finalScore: number;
}

export interface ScoringConfig {       // pondérations BPI, par scénario (doc 08)
  weights: { economic: number; financial: number; commercial: number; operational: number;
             profitability: number; strategy: number; decisionMastery: number }; // Σ = 1
  benchmarks: Record<string, { min: number; target: number }>;
}

export interface BpiBreakdown {
  dimensions: Record<keyof ScoringConfig["weights"], number>;  // 0..100
  hintPenalty: number;
  bpi: number;                          // 0..100
}
```

## 5. Contrats de service (frontière app ↔ moteurs)

```ts
// services/game.service.ts — signatures cibles (implémentation étape 5)
createGame(input: CreateGameInput): Promise<GameId>;
openRound(gameId: GameId, index: number): Promise<void>;
submitDecisions(teamId, roundId, payload: RoundDecisions, opts: { validate: boolean }): Promise<void>;
resolveRound(gameId: GameId, index: number): Promise<void>;   // transactionnel, idempotent
// services/hint.service.ts
unlockNextHint(situationInstanceId, userId): Promise<{ level: number; text: string }>;
```
