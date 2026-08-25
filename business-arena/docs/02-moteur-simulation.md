# 02 — Architecture du moteur de simulation économique

Couvre le point 3 de la mission n°37 et les exigences §8 à §19 du cahier des charges.

Le moteur est un package TypeScript **pur, déterministe, configuré par le scénario,
indépendant de React, de Next et de la base de données**. Toutes les formules ci-dessous
font foi : toute valeur utilisée par le moteur provient du scénario ou de l'état, jamais
d'une constante cachée (§9 : « ne pas utiliser de valeurs arbitraires sans les documenter »).

---

## 1. Contrat du moteur

```ts
// src/engine/simulation/index.ts
export const ENGINE_VERSION = "0.1.0";

export function simulateRound(input: SimulationInput): SimulationOutput;

interface SimulationInput {
  scenario: ScenarioConfig;          // instantané figé à la création de la partie (ADR-10)
  roundIndex: number;                // 1..N
  companies: CompanyState[];         // état de TOUTES les entreprises de la partie
  decisions: Record<CompanyId, RoundDecisions>; // décisions validées (ou reconduites, ADR-04)
  activeEvents: EventInstance[];     // événements en cours (durée > 1 tour)
  rng: SeededRng;                    // PRNG seedé — SEULE source d'aléa (ADR-05)
}

interface SimulationOutput {
  companies: CompanyState[];         // nouvel état complet
  results: Record<CompanyId, RoundResult>;   // P&L, bilan, KPIs, détail des calculs
  market: MarketRoundResult;         // demande par segment, parts de marché, prix moyens
  events: EventInstance[];           // événements tirés ce tour + événements poursuivis
  trace: EngineTrace;                // journal de calcul (pédagogie + débogage)
}
```

Propriétés garanties (testées, doc 09) :

- **Pureté** : aucune E/S, aucune date système, aucun `Math.random`.
- **Déterminisme** : même input ⇒ même output (sérialisé), base du rejeu et de l'anti-triche.
- **Symétrie** : le moteur ne sait pas quelles entreprises sont humaines ou bots.
- **Traçabilité** : `EngineTrace` enregistre les grandeurs intermédiaires (demande avant/après
  chaque effet, coût unitaire décomposé…). C'est la matière première du débriefing pédagogique
  et des indices de niveau 1 (« examinez ce qui a évolué »). Jamais montrée brute au joueur.

## 2. Pipeline de résolution d'un tour

Ordre fixe, documenté, sans boucle de convergence (budget perf : O(C×S×P), < 1 s) :

```
 1. events/     tirage des nouveaux événements (PRNG) + application des modificateurs
                actifs sur une copie des paramètres du scénario (« paramètres effectifs »)
 2. hr/         effectifs disponibles, heures, productivité effective (grève, climat)
 3. production/ production réalisée = min(demande planifiée par le joueur, capacités)
 4. costs/      coûts de production du tour, coût unitaire (CUMP entrant)
 5. inventory/  stock disponible à la vente = stock initial + production
 6. market/     demande par segment → allocation concurrentielle → ventes contraintes
                par le stock (ruptures) → report/perte de demande
 7. inventory/  stock final, valorisation, coût de possession
 8. finance/    compte de résultat, plan de financement du tour, budget de trésorerie,
                bilan, FRNG/BFR/TN, ratios ; découvert automatique si trésorerie < 0
 9. investment/ mise en service des investissements arrivés à terme (capacité, qualité)
10. kpis/       calcul de tous les indicateurs (le déblocage à l'affichage est ailleurs)
```

Chaque étape est un module avec sa fonction pure et ses tests (`market/demand.ts` exporte
`computeSegmentDemand`, etc. — mêmes noms que doc 06).

---

## 3. Marché et demande (§9, §10, §11, §12)

### 3.1 Demande potentielle par segment

Pour chaque segment `s` et produit `p`, la demande potentielle **du marché** au tour `t` :

```
PotentialDemand(s, p, t) =
    BaseDemand(s, p)                        // taille du segment × fréquence d'achat (scénario)
  × (1 + growth(s))^(t-1)                   // croissance du segment
  × Seasonality(s, t)                       // coefficient saisonnier du scénario (Σ normalisée)
  × MacroEffect(t)                          // événements de marché (crise, mode, réglementation)
```

### 3.2 Attractivité d'une offre pour un segment

Chaque entreprise `c` propose (prix, marketing, qualité perçue). Son **score d'attraction** :

```
Attraction(c, s) =
    PriceEffect(c, s) × MarketingEffect(c, s) × QualityEffect(c, s) × LoyaltyEffect(c, s)
```

- **PriceEffect** — élasticité par segment (§11), autour d'un prix de référence du segment :
  `PriceEffect = (price / refPrice(s)) ^ elasticity(s)` avec `elasticity(s) < 0`
  (ex. segment « sensibles au prix » : −2,5 ; « premium » : −0,6). Borné par
  `[minEffect, maxEffect]` du scénario pour éviter les explosions numériques — bornes
  **documentées dans le scénario**, pas dans le code.
- **Prix psychologique (§12)** — deux mécanismes non linéaires, activables par segment :
  1. *Seuils de rupture* : liste de seuils (ex. 20 €, 25 €) avec pénalité multiplicative
     au franchissement (ex. ×0,92 au-dessus de 20 €) → 19,90 € ≠ 20,10 €.
  2. *Zone d'acceptabilité* : en dessous de `minAcceptablePrice(s)`, effet qualité-prix
     inversé (prix trop bas = méfiance) : l'attraction **baisse** quand le prix descend
     sous ce plancher. La demande n'est donc jamais purement linéaire au prix.
- **MarketingEffect** — rendements décroissants :
  `1 + mktSensitivity(s) × log(1 + mktSpend / mktScale(s))` ; un budget nul donne 1,
  le sur-investissement plafonne naturellement.
- **QualityEffect** — `(perceivedQuality(c) / refQuality) ^ qualitySensitivity(s)` ;
  la qualité perçue évolue avec inertie (voir §5.4).
- **LoyaltyEffect** — `1 + loyalty(s) × marketShare(c, s, t-1)` : la part de marché
  acquise sur le segment protège partiellement (fidélité paramétrée par segment).

### 3.3 Allocation concurrentielle (parts de marché)

Modèle de part d'attraction (logit simplifié, standard des business games) :

```
Share(c, s) = Attraction(c, s)^γ(s) / Σ_k Attraction(k, s)^γ(s)
Sales*(c, s, p) = PotentialDemand(s, p) × Share(c, s)
```

`γ(s) ≥ 1` règle l'intensité concurrentielle du segment (γ élevé = le meilleur rafle tout).
Un « concurrent extérieur » optionnel (attraction constante) représente le reste du marché
et empêche que la demande totale soit toujours servie par les joueurs.

### 3.4 Contrainte de stock et ruptures

```
Sales(c, s, p)  = min(Sales*(c, s, p), stock alloué)     // allocation au prorata des segments
LostSales(c, s) = Sales* − Sales
```

Une part `backlogRate(s)` des ventes perdues est reportée au tour suivant, le reste est
perdu et dégrade la fidélité (`LoyaltyEffect` du tour suivant). La rupture est un
**événement pédagogique de premier ordre** (capacité, prévision — doc 03).

### 3.5 Observabilité pédagogique de l'élasticité (§11)

La `trace` conserve, par segment : demande avant effet prix, après effet prix, après
marketing, etc. Le débriefing peut ainsi montrer « votre baisse de prix de 8 % a augmenté
vos ventes de 19 % sur le segment étudiant » sans jamais révéler le paramètre d'élasticité
lui-même — le joueur le **découvre** en expérimentant.

---

## 4. Production (§13)

La production réalisée n'est jamais la production demandée par décret (§13) :

```
MachineCapacity   = Σ unités de production actives × capacité unitaire × availability
                    (availability dégradée par maintenance insuffisante et pannes-événements)
LaborCapacity     = effectif productif × heures/tour × productivité effective
MaxOutsourcing    = plafond de sous-traitance du scénario (coût unitaire majoré, qualité ↘)
Production(c, p)  = min(plan du joueur, MachineCapacity, LaborCapacity, matières disponibles)
                    + sous-traitance décidée (≤ MaxOutsourcing)
UtilizationRate   = Production interne / MachineCapacity
```

- **Maintenance** : budget de maintenance < seuil recommandé ⇒ `availability` décroît de
  tour en tour et la probabilité de l'événement « panne » augmente (couplage documenté).
- **Qualité produite** : fonction du budget qualité, du taux d'utilisation (surchauffe
  > 95 % ⇒ défauts), et de la part sous-traitée. Alimente la qualité perçue avec inertie :
  `perceivedQuality(t) = λ × perceivedQuality(t-1) + (1-λ) × producedQuality(t)`.
- **Approvisionnements** : les matières commandées au tour `t` sont disponibles selon le
  délai fournisseur du scénario ; le paiement suit le délai de règlement fournisseur
  (→ BFR, §6).

## 5. Coûts (§14)

Typologie native du moteur — chaque ligne de coût du scénario est étiquetée :

| Axe | Valeurs | Usage pédagogique |
|---|---|---|
| Comportement | `fixed` / `variable` (inducteur : unité produite, unité vendue, € de CA) | seuil de rentabilité, CVP |
| Traçabilité | `direct(product)` / `indirect` | coûts complets vs partiels |
| Horizon | `capacity` (paliers : une ligne de production ajoutée = +X de fixes) / `operating` | coûts de structure, décisions LT |
| Financier | intérêts, agios de découvert | effet de levier, risque financier |

Calculs exposés par `costs/` :

```
UnitVariableCost(p)      = Σ coûts variables directs / unité (matières, MOD, énergie, sous-traitance)
ContributionMargin(p)    = Price − UnitVariableCost           // marge sur coût variable unitaire
FixedCosts               = Σ fixes opérationnels + fixes de capacité + amortissements
FullUnitCost(p)          = (variables + quote-part des fixes imputés) / unités   // coût complet
RelevantCost(décision)   = coûts/recettes différentiels d'une option (commande exceptionnelle…)
BreakEvenUnits           = FixedCosts / ContributionMargin(unitaire)
BreakEvenRevenue         = FixedCosts / tauxMCV
SafetyMargin             = CA − BreakEvenRevenue ; SafetyIndex = SafetyMargin / CA
DeadPoint                = date du tour où le CA cumulé atteint le seuil (point mort)
```

Les stocks sont valorisés au **CUMP** (coût unitaire moyen pondéré), documenté et testé.

---

## 6. Finance : le pilier FRNG / BFR / Trésorerie (§16, §17)

`finance/` produit à chaque tour des **états financiers complets et cohérents**
(le bilan équilibre au centime — invariant testé) :

### 6.1 Compte de résultat du tour
CA, production stockée, coûts variables, coûts fixes, EBE, dotations aux amortissements,
résultat d'exploitation, charges financières (emprunts + agios de découvert), impôt
(taux du scénario), **résultat net**.

### 6.2 Bilan et équilibre fonctionnel

```
FRNG = Ressources stables (capitaux propres + dettes financières LT)
     − Emplois stables (immobilisations nettes)
BFR  = Stocks + Créances clients − Dettes fournisseurs (+ dettes fiscales et sociales)
TN   = FRNG − BFR      // invariant : TN = disponibilités − concours bancaires courants
```

- **Créances clients** = CA × délai clients / durée du tour (délais paramétrés par segment :
  les professionnels paient à 60 j, les particuliers comptant).
- **Dettes fournisseurs** = achats × délai fournisseurs / durée du tour.
- Le scénario peut proposer des **décisions sur les délais** (escompte pour paiement
  comptant, négociation fournisseur) → leviers de BFR observables.

### 6.3 Trésorerie et financement

Budget de trésorerie du tour : encaissements (ventes du tour et créances antérieures,
emprunts, apports) − décaissements (achats, salaires, fixes, investissements, échéances,
impôt). Si la trésorerie devient négative : **découvert automatique** au taux du scénario
(agios au tour suivant) ; au-delà du plafond de découvert ⇒ situation de **crise de
trésorerie** (événement bloquant : cession forcée, augmentation de capital imposée, ou
défaite selon la difficulté). C'est ainsi que le jeu crée naturellement la situation
« rentable mais en difficulté de trésorerie » (§16) : la croissance gonfle le BFR plus
vite que le FRNG.

### 6.4 Ratios et rentabilités (§17)

```
Profitabilité            = Résultat net / CA
Rentabilité économique   = Résultat d'exploitation net d'IS / (capitaux propres + dettes financières)
Rentabilité financière   = Résultat net / Capitaux propres
Effet de levier          = Rf − Re, expliqué par (Re − i) × D/CP dans la trace
Rotation des actifs      = CA / Actif ; Endettement = D / CP ; Autonomie = CP / total bilan
Liquidité générale       = Actif circulant / Passif circulant
```

### 6.5 Investissement (§18)

Projets d'investissement définis par le scénario : coût initial, échéancier, valeur
résiduelle, effets (capacité, qualité, coûts). `investment/` fournit les fonctions
d'évaluation **mises à disposition du joueur comme outils** (doc 03) et utilisées par
les tests : `npv(flows, rate)`, `irr(flows)`, `paybackPeriod(flows)`. Le financement choisi
(autofinancement / emprunt / crédit-bail) impacte FRNG, charges financières et levier.

---

## 7. Moteur d'événements (§19)

Un événement est une **donnée**, pas du code :

```ts
interface EventDefinition {
  code: string;                    // "raw_material_spike"
  trigger: { minRound?: number; conditions?: ConditionExpr[]; probability: number };
  scope: "market" | "company";     // frappe tout le marché ou une entreprise tirée
  duration: number;                // en tours
  modifiers: Modifier[];           // { target: "market.rawMaterialPrice", op: "mul", value: 1.25 }
  announcement: { textKey: string; leadTime: 0 | 1 };  // annoncé ou surprise
  difficulty: number;              // niveau minimal d'apparition
  linkedConcepts: string[];        // concepts pédagogiques mobilisés
}
```

- `ConditionExpr` : petit langage de conditions sur l'état (`company.utilization > 0.95`,
  `market.round >= 3`) évalué par le moteur — permet « la panne frappe les usines
  sur-utilisées », « la grève suit deux tours de productivité forcée ».
- Le tirage utilise le PRNG de la partie (déterminisme, ADR-05). Les scénarios peuvent aussi
  **scripter** des événements certains à un tour donné (probability = 1, round fixé) — c'est
  le mécanisme des situations pédagogiques de NOVA (doc 07).
- Les `modifiers` s'appliquent sur les **paramètres effectifs** du tour (copie), jamais sur
  le scénario d'origine.

Catalogue MVP (seed) : hausse matières premières, baisse de prix d'un concurrent (bot),
panne machine, grève, perte d'un client grand compte, nouveau concurrent entrant, hausse
des taux, changement réglementaire (norme qualité), opportunité d'export, campagne
marketing virale.

---

## 8. Ce que le moteur ne fait pas

- Il ne connaît ni les indices, ni les scores, ni les niveaux de déblocage d'information :
  il calcule **tout**, la pédagogie filtre (ADR-15).
- Il ne lit ni n'écrit en base : la couche services l'alimente et persiste ses sorties.
- Il n'appelle jamais d'IA. L'IA commente ses sorties, jamais l'inverse (§29).
