# BUSINESS ARENA — PLAN D'ARCHITECTURE V2

> **Date** : 31 août 2026
> **Phase** : 0 (reconnaissance, aucune modification de code)
> **Méthode** : lecture exhaustive du code source par cinq agents spécialisés, exécution des 538 tests, synthèse croisée.
> **Périmètre** : `/home/user/business-arena` — 19 modules moteur (2 981 lignes), 33 tables, 35 concepts, 18 modèles, 9 scénarios, 76 fichiers de tests.

---

## 1. Architecture actuelle

### 1.1 Diagramme réel

```
UI (Next.js 16 App Router, React 19)
  │  useActionState + Server Actions
  ▼
Server Actions  (7 fichiers actions.ts, 29 fonctions)
  │  Zod validation (decision-schema.ts)
  ▼
Services
  ├── game.service.ts         2 364 lignes  ← God Service #1
  ├── pedagogy.service.ts     1 405 lignes  ← God Service #2
  ├── competition.service.ts    ~200 lignes
  ├── admin.service.ts          ~150 lignes
  ├── auth.service.ts           ~100 lignes
  ├── licence.service.ts        ~100 lignes
  ├── demo.service.ts            ~80 lignes
  └── profile.service.ts         ~60 lignes
  │
  ▼
Engine (pur fonctionnel, 0 dépendance externe)
  ├── simulation/index.ts  simulateRound()  815 lignes
  ├── simulation/runGame.ts                   75 lignes
  ├── types.ts                               798 lignes
  ├── market/   (demand, attraction, allocation)
  ├── production/
  ├── costs/    (index, breakeven)
  ├── finance/  (statements, functional, ratios, bank)
  ├── hr/
  ├── events/
  ├── bots/     (5 profils)
  ├── inventory/ (CUMP)
  ├── investment/ (VAN, TRI, payback)
  └── random/   (mulberry32, seedé)
  │
  ▼
Persistence  (Drizzle ORM)
  │  Dual driver : Neon HTTP (prod) / node-postgres (local/CI)
  ▼
Neon PostgreSQL  (33 tables, 8 modules de schéma)
```

### 1.2 Flux de données principal

```
FormData (decision-form.tsx)
  → playRoundAction (Zod parse)
  → resolveCurrentRound / submitTeamDecisions (game.service)
  → resolveGameRound (266 lignes, orchestrateur central)
      → botDecisions + neutralDecisions (fallback absents)
      → simulateRound(input: SimulationInput): SimulationOutput
      → persist: round_results, kpis, company_states, transactions, event_occurrences
      → debriefRound (pedagogy.service)
      → persistRoundScores + updateRankings (scoring)
      → openSituationsForRound (pedagogy.service)
  → revalidatePath → re-render UI
```

### 1.3 Modules et volumes

| Couche | Fichiers | Lignes | Rôle |
|---|---|---|---|
| Engine | 19 | 2 981 | Simulation pure, déterministe |
| Pedagogy (pur) | 6 | 456 | Détection, évaluation, indices, progression, adaptativité, briefing |
| Config | ~30 | ~3 500 | Scénarios, concepts, modèles, difficulté, leviers |
| Services | 8 | ~4 500 | Orchestration, persistance, vues |
| DB Schema | 8 | ~1 200 | 33 tables Drizzle |
| Scoring | 1 | 224 | BPI 7 dimensions |
| Competition | 1 | 73 | Groupes, qualification, finales |
| UI (app + components) | ~50 | ~5 800 | Routes, actions, composants |
| Tests | 76 | ~13 850 | 538 tests Vitest |
| **Total** | | **~32 600** | |

---

## 2. Architecture cible

### 2.1 Vision

```
                         UI (Next.js)
                            │
                     Server Actions
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
    Game API          Pedagogy API       Competition API
    ┌────────┐        ┌──────────┐       ┌────────────┐
    │Creation│        │Situation │       │competition │
    │Member  │        │Diagnosis │       │.service.ts │
    │Decision│        │Hints     │       └────────────┘
    │Round   │        │Debrief   │
    │View    │        │Reporting │
    │Teacher │        │Seed      │
    └────┬───┘        └────┬─────┘
         │                 │
         └────────┬────────┘
                  ▼
           Decision Engine (NEW, V2)
           ┌─────────────────────┐
           │ Observation         │
           │ Diagnosis           │
           │ Model Selection     │
           │ Analysis            │
           │ Justification Eval  │
           │ Anticipation        │
           └─────────┬───────────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
    Economic    Knowledge    Scoring
    Engine      Graph        Engine
    (V1, pur)   (NEW)        (V1+V2)
         │
         ▼
    Persistence (Drizzle + Neon)
```

### 2.2 Principe directeur

Le moteur économique est une **boîte noire stable** :

```
SimulationInput {scenario, roundIndex, companies, decisions, activeEvents, seed}
    ↓
simulateRound()   — pur, déterministe, 0 dépendance
    ↓
SimulationOutput {companies, results, market, events, newEvents}
```

La V2 se construit **autour** du moteur, jamais **à l'intérieur**.

---

## 3. Cartographie Game Service

### 3.1 Inventaire complet

**16 fonctions exportées + 11 internes :**

| # | Fonction | Lignes | Catégorie |
|---|---|---|---|
| 1 | `getOrCreateNovaScenarioIdPublic` | 3 | ORCHESTRATION |
| 2 | `teamDisplayName` | 3 | UTILITAIRE |
| 3 | `createGameCore` | 116 | ORCHESTRATION |
| 4 | `createSoloGame` | 40 | ORCHESTRATION |
| 5 | `createClassGame` | 39 | ORCHESTRATION |
| 6 | `joinGameByCode` | 34 | ORCHESTRATION |
| 7 | `nommerEquipe` | 27 | ORCHESTRATION |
| 8 | `submitTeamDecisions` | 57 | DÉCISION |
| 9 | `getGameKind` | 5 | ORCHESTRATION |
| 10 | `resolveCurrentRound` | 14 | ORCHESTRATION |
| 11 | `drawEventCardForNextRound` | 75 | ORCHESTRATION |
| 12 | `closeCurrentRound` | 10 | ORCHESTRATION |
| 13 | **`getGameView`** | **737** | PERSISTENCE (lecture) |
| 14 | `getTeacherGames` | 26 | PERSISTENCE (lecture) |
| 15 | `setQuizMode` | 15 | ORCHESTRATION |
| 16 | `getTeacherGameView` | 88 | PERSISTENCE (lecture) |

**Internes :**

| Fonction | Lignes | Catégorie |
|---|---|---|
| `getOrCreatePublicOrgId` | 19 | ORCHESTRATION |
| `getOrCreateScenarioId` | 26 | ORCHESTRATION |
| `readPendingEvents` | 8 | UTILITAIRE |
| `makeJoinCode` | 6 | UTILITAIRE |
| `toMoney` | 1 | UTILITAIRE |
| `sumSold` | 3 | UTILITAIRE |
| `fallbackDecisions` | 10 | DÉCISION |
| `findUserTeam` | 13 | PERSISTENCE |
| **`resolveGameRound`** | **266** | ORCHESTRATION+SIMULATION+SCORING+PÉDAGOGIE |
| `persistRoundScores` | 47 | SCORING |
| `updateRankings` | 78 | SCORING |

Les deux **fonctions géantes** : `getGameView` (737 lignes, 29 % du fichier) et `resolveGameRound` (266 lignes).

### 3.2 Classification par catégorie

| Catégorie | Fonctions | % du fichier |
|---|---|---|
| ORCHESTRATION | createGameCore, createSoloGame, createClassGame, joinGameByCode, nommerEquipe, resolveCurrentRound, closeCurrentRound, drawEventCardForNextRound, setQuizMode, getGameKind, resolveGameRound | ~30 % |
| PERSISTENCE (vues) | getGameView, getTeacherGames, getTeacherGameView, findUserTeam | ~40 % |
| SIMULATION | Pas de fonction dédiée, noyée dans resolveGameRound | ~5 % |
| DÉCISION | submitTeamDecisions, fallbackDecisions | ~3 % |
| SCORING | persistRoundScores, updateRankings | ~5 % |
| PÉDAGOGIE | Aucune (délègue à pedagogy.service) | 0 % |
| UTILITAIRES | teamDisplayName, toMoney, sumSold, readPendingEvents, makeJoinCode | ~1 % |
| VALIDATION | Inline dans chaque fonction (8 copies distinctes) | ~5 % |

### 3.3 Dépendances (26 groupes d'imports)

Le fichier importe depuis : db/schema (14 tables), 6 modules config (difficulty, periodicity, market-scale, rounds, variability, schema, registry, sector-kpis, events/cards, nom-equipe, decisions), 3 autres services (pedagogy, admin, licence), 6 modules engine (simulation, bots, finance/ratios, finance/bank, investment, types), scoring/bpi, pedagogy/round-briefing.

### 3.4 Nœuds de couplage identifiés

1. **`resolveGameRound` soude 6 responsabilités** sous un seul try/catch (verrou optimiste). Pas de transaction DB (Neon HTTP n'en supporte pas). Le catch est le seul filet de sécurité : il rouvre le tour si n'importe quelle étape échoue. Toute extraction doit préserver la propagation synchrone des exceptions.

2. **`persistRoundScores` dépend implicitement de `debriefRound`** : elle lit `situationInstances.diagnosis.score` qui n'est peuplé que par `debriefRound`. L'ordre d'appel dans `resolveGameRound` est le seul garant de cette dépendance. Rien au niveau des types ne l'impose.

3. **Gardes dupliquées 8 fois** : les vérifications « partie introuvable / terminée / mauvais propriétaire » sont copiées indépendamment dans 8 fonctions, chacune refaisant sa propre requête `games`.

4. **`difficultyProfile` (jsonb) modifié sans synchronisation** depuis 4 endroits : `createGameCore`, `drawEventCardForNextRound`, `resolveGameRound`, `setQuizMode`. Seul `resolveGameRound` est protégé par le verrou de tour. Les autres peuvent écraser une modification concurrente.

5. **`getGameView` recalcule des données moteur** (`computeRatios`, `conditionsBancaires`, `npv`, `irr`, `paybackPeriod`, `orderOfferForRound`) au moment de la lecture au lieu de lire ce qui a été persisté à la résolution. Le moteur est consommé depuis deux couches différentes avec deux formes d'appel distinctes.

6. **Politique de mode compétition divergente** : `submitTeamDecisions` vérifie `game.mode === "competition"`, `drawEventCardForNextRound` vérifie `game.mode !== "learning"`. Deux implémentations indépendantes qui ne couvrent pas exactement les mêmes cas.

7. **`findUserTeam` et `teamDisplayName` sont transversaux** : utilisés par presque toutes les autres fonctions. Toute extraction doit les placer dans un module feuille sans dépendance sur les nouveaux services.

### 3.5 Architecture cible proposée

**Étape préalable : modules partagés**

| Module | Contenu | Lignes |
|---|---|---|
| `game-guards.ts` | `assertGameFound`, `assertGameRunning`, `assertTeacherOwnsGame`, `assertRoundOpen` — retournent la ligne chargée | ~40 |
| `game-utils.ts` | `teamDisplayName`, `toMoney`, `sumSold`, `readPendingEvents`, `makeJoinCode` | ~25 |
| `game-mode-policy.ts` | `isCompetitionMode(game)`, `isManualCardDrawAllowed(game)` | ~10 |

**Services extraits :**

| Service | Responsabilité | Fonctions | Lignes est. | Risque |
|---|---|---|---|---|
| `game-creation.service.ts` | Création de partie (solo, classe, compétition) | `getOrCreatePublicOrgId`, `getOrCreateScenarioId`, `getOrCreateNovaScenarioIdPublic`, `createGameCore`, `createSoloGame`, `createClassGame` | ~300 | Moyen (pipeline de snapshot séquentiel) |
| `membership.service.ts` | Rejoindre, nommer, trouver équipe | `joinGameByCode`, `findUserTeam`, `nommerEquipe` | ~110 | Faible |
| `decision.service.ts` | Soumission et reconstitution des décisions | `submitTeamDecisions`, `fallbackDecisions` | ~90 | Faible |
| `round-resolution.service.ts` | Résolution d'un tour (orchestrateur central) | `resolveGameRound`, `resolveCurrentRound`, `closeCurrentRound`, `drawEventCardForNextRound`, `getGameKind` | ~370 | **Élevé** (verrou optimiste, ordre d'appel critique) |
| `scoring.service.ts` | Calcul et persistance des scores | `persistRoundScores`, `updateRankings` | ~125 | Moyen (dépendance implicite pédagogie) |
| `game-view.service.ts` | Vue joueur (lecture seule) | `getGameView` | ~740 | Moyen (shotgun surgery, 12 champs dérivés) |
| `teacher-view.service.ts` | Vues enseignant (lecture seule) | `getTeacherGames`, `setQuizMode`, `getTeacherGameView` | ~130 | Faible |

**Graphe de dépendances entre services :**

```
game-creation ──→ pedagogy(ext), admin(ext), licence(ext)
membership ──→ (feuille)
decision ──→ membership
round-resolution ──→ decision, scoring, pedagogy(ext)
scoring ──→ (feuille, reçoit les inputs pedagogy en paramètre)
game-view ──→ membership
teacher-view ──→ (feuille)
```

Aucune dépendance circulaire. `game-view` et `teacher-view` sont des consommateurs purs, extractibles en dernier et en parallèle.

---

## 4. Cartographie Pedagogy Service

### 4.1 Inventaire complet

**11 fonctions exportées + 8 privées + 5 interfaces :**

| Fonction | Lignes | Catégorie |
|---|---|---|
| `seedPedagogyReferentials` | 86 | SEED |
| `openSituationsForRound` | 72 | SITUATION |
| `unlockHint` | 38 | INDICES |
| `submitDiagnosis` | 18 | DIAGNOSTIC |
| `submitQuiz` | 30 | QUIZ/FEEDBACK |
| `debriefRound` | 117 | MAÎTRISE |
| `getTeamSituations` | 58 | REPORTING |
| `getTeacherPedagogyView` | 74 | REPORTING |
| `getTeacherUsageView` | 169 | REPORTING |
| `getGameGradeSheet` | 145 | REPORTING |
| `getStudentProgressView` | 127 | REPORTING |

**Constats :**

- **44 % du fichier (623 lignes)** est constitué de vues lecture seule (reporting enseignant/élève). Zéro écriture, pure agrégation.
- La formule de scoring du débriefing est **dupliquée** : `debriefRound` (lignes 413-439) et `getGameGradeSheet` (lignes 1191-1210) calculent indépendamment le score d'une situation instance. Toute modification de l'un sans l'autre crée une incohérence silencieuse.
- La table `modelChoices` est un **vestige mort** : seule lue en fallback dans `debriefRound` (lignes 425-432) pour les anciennes parties. Plus rien n'y écrit.
- `round-briefing.ts` (249 lignes, pur) est consommé par `game.service.ts`, pas par `pedagogy.service.ts`, alors qu'il est conceptuellement pédagogique.

### 4.2 Modules purs existants (prêts pour la V2)

| Module | Lignes | Exports | Prêt V2 ? |
|---|---|---|---|
| `detection.ts` | 49 | `detectSituations` | Oui |
| `evaluation.ts` | 51 | `answerCredit`, `evaluateQuiz`, `evaluateDiagnosis` | Oui |
| `hints.ts` | 29 | `nextUnlockableLevel`, `hintScoreMultiplier` | Oui |
| `progress.ts` | 31 | `updateMastery`, `aggregateAxis`, `AXES` | Oui |
| `adaptivity.ts` | 47 | `playerStrength`, `hintCostDiscount`, `adaptiveHintMultiplier` | Oui |
| `round-briefing.ts` | 249 | `roundBriefing` | Oui (orphelin de pedagogy.service) |

Ces 6 modules sont déjà parfaitement factorisés : purs, sans dépendance DB ni framework. Ils se branchent directement sous les nouveaux services sans modification.

### 4.3 Architecture cible proposée

| Service | Responsabilité | Fonctions | Lignes est. | Risque |
|---|---|---|---|---|
| `situation-instance.service.ts` | Cycle de vie des situations | `openSituationsForRound`, `loadInstanceForUser`, `unlockedLevels` | ~140 | Faible |
| `hints.service.ts` | Déblocage et coût des indices | `unlockHint`, `hintCapOf` | ~70 | Faible |
| `diagnosis.service.ts` | Diagnostic + évaluation justification (V2) | `submitDiagnosis` + nouveau code V2 | ~40 + ~150 (V2) | Moyen |
| `debrief.service.ts` | Quiz + débriefing + maîtrise | `submitQuiz`, `debriefRound`, `recomputeSkills`, `askedQuestions`, `modelInsight`, `toView` | ~350 | Moyen (fonction critique) |
| `pedagogy-reporting.service.ts` | Vues lecture enseignant/élève | `getTeamSituations`, `getTeacherPedagogyView`, `getTeacherUsageView`, `getGameGradeSheet`, `getStudentProgressView` | ~600 | Faible (opportunité de dédupliquer la formule de scoring) |
| `pedagogy-seed.service.ts` | Seeding idempotent des référentiels | `seedPedagogyReferentials` | ~90 | Faible |

**Services V2 (nouveau code) :**

| Service | Responsabilité | Code existant réutilisable | Risque |
|---|---|---|---|
| `model-selection.service.ts` | Choix de modèle comme étape explicite | `modelInsight()`, table `situationModels`, matrice de pertinence | Moyen-élevé (changement de comportement) |
| `analysis.service.ts` | Application du modèle aux données | Aucun code existant | Élevé (portée indéfinie, spec nécessaire) |

---

## 5. Frontières Economic Engine

### 5.1 Surface d'appel exacte

Le moteur n'est appelé que depuis `game.service.ts`. Voici la surface complète :

| Fonction moteur | Appelée par | Contexte |
|---|---|---|
| `simulateRound(input)` | `resolveGameRound` (ligne 717) | Résolution d'un tour |
| `botDecisions(profile, ctx)` | `resolveGameRound` (ligne 665) | Génération des décisions bots |
| `neutralDecisions(ctx)` | `resolveGameRound` (lignes 472, 1917) | Fallback décisions absentes |
| `orderOfferForRound(scenario, round, seed)` | `getGameView` (lignes 1731, 2147) | Affichage offre exceptionnelle |
| `computeRatios(is, bs, taxRate)` | `getGameView` (ligne 1673) | Étude financière |
| `conditionsBancaires(trust, terms, bank)` | `getGameView` (lignes 2076-2123) | Dossier bancaire |
| `confianceInitiale(state)` | `getGameView` (lignes 2076-2123) | Dossier bancaire |
| `npv(flows, rate)` | `getGameView` (ligne 1726) | Étude projet |
| `irr(flows)` | `getGameView` (ligne 1727) | Étude projet |
| `paybackPeriod(flows)` | `getGameView` (ligne 1728) | Étude projet |

### 5.2 Interface à préserver

```typescript
// ENTRÉE
interface SimulationInput {
  scenario: EngineScenarioConfig;
  roundIndex: number;
  companies: Record<CompanyId, CompanyState>;
  decisions: Record<CompanyId, RoundDecisions>;
  activeEvents: EventInstance[];
  seed: number;
}

// SORTIE
interface SimulationOutput {
  companies: Record<CompanyId, CompanyState>;
  results: Record<CompanyId, CompanyRoundResult>;
  market: { potentialBySegment: Record<string, number>; totalSold: number };
  events: EventInstance[];
  newEvents: EventInstance[];
}
```

### 5.3 Pureté vérifiée

Grep exhaustif des imports dans `src/engine/**` : **aucun** import depuis `@/`, `../services`, `../db`, `../lib`, `../config`, React, Next, ou un package npm. Le moteur est une pure fonction mathématique. C'est la force architecturale centrale du projet.

### 5.4 Règle V2

Le moteur économique ne doit **jamais** :
- Importer depuis un service, la base de données, ou le framework
- Utiliser `Math.random`, `Date.now`, ou `new Date()`
- Avoir de dépendance externe npm

Le garde `tests/architecture/engine-purity.test.ts` vérifie ces contraintes. Il doit rester vert à chaque commit.

---

## 6. Contrats

### 6.1 Contrats fondamentaux actuels

| Contrat | Fichier | Utilisation | Stabilité | Risque de modification |
|---|---|---|---|---|
| `EngineScenarioConfig` | `engine/types.ts` | 9 scénarios, registry, schema, difficulté, bots, finance, simulation, game.service | **Très stable** | Faible (extension uniquement) |
| `CompanyState` | `engine/types.ts` | 9 scénarios (état initial), simulation, bots, game.service, company_states (jsonb) | **Très stable** | Faible |
| `RoundDecisions` | `engine/types.ts` | decision-form, bots, simulation, game.service, decisions (jsonb) | **Stable** | Moyen (ajout de champs V2) |
| `CompanyRoundResult` | `engine/types.ts` | simulation, scoring, pedagogy (detection, briefing), game.service, round_results (jsonb) | **Stable** | Faible (ajout de blocs optionnels) |
| `SimulationInput` | `engine/types.ts` | simulation/index.ts uniquement | **Stable** | Faible |
| `SimulationOutput` | `engine/types.ts` | simulation/index.ts, runGame.ts | **Stable** | Faible |
| `SituationDef` | `config/scenarios/situation-kit.ts` | 9 scénarios × situations, registry, pedagogy.service | **Stable** | Moyen (extension V2 : étapes) |
| `GameView` | `game.service.ts` (ligne 1107) | arena page, 3 composants UI | **Instable** | Élevé (interface de facto, non formalisée) |
| `BpiDimension` | `scoring/bpi.ts` | scores table, game-view, teacher-view | **Stable** | Faible |

### 6.2 Contrats V2 proposés (à ne pas implémenter maintenant)

| Contrat | Rôle | Relation |
|---|---|---|
| `ObservationStep` | Données observées par le joueur | CompanyRoundResult → sélection |
| `DiagnosisStep` | Formulation du problème | ObservationStep → diagnostic |
| `ModelSelectionStep` | Choix du modèle d'analyse | SituationDef.modelRelevance → scoring |
| `AnalysisStep` | Application du modèle | ModelSelectionStep × ObservationStep → calcul |
| `JustificationStep` | Raisonnement structuré | AnalysisStep → texte + structure |
| `AnticipationStep` | Prévision des conséquences | SimulationInput → prédiction joueur |
| `DecisionAttempt` | Trace complète d'un cycle de décision | Regroupe les 6 étapes ci-dessus |
| `ConceptPrerequisite` | Lien de dépendance entre concepts | Concept → Concept (DAG) |

---

## 7. Tests

### 7.1 Résultats

| Métrique | Valeur |
|---|---|
| Tests exécutés | **538** |
| Passants | 538 (100 %) |
| Échouants | 0 |
| Ignorés | 0 |
| Durée totale | 58,11 s |
| Fichiers de test | 76 |
| Fichiers e2e (hors suite par défaut) | 5 |
| Couverture instrumentée | **Non disponible** (`@vitest/coverage-v8` absent) |

### 7.2 Couverture par catégorie

| Catégorie | Fichiers | Tests est. | Évaluation |
|---|---|---|---|
| FINANCE | ~6 | ~50 | **Forte** : bilan, FRNG, BFR, TN, TVA, banque, prêts, dividendes, VAN/TRI |
| MARCHÉ | ~4 | ~30 | **Forte** : PRNG, demande, élasticité, allocation, segments |
| PRODUCTION | ~4 | ~25 | **Forte** : capacité, CUMP, coûts, seuil de rentabilité, péremption |
| SIMULATION | ~3 | ~20 | **Forte** : déterminisme bit-à-bit, événements scriptés, chaîne 3 tours |
| PÉDAGOGIE | ~7 | ~50 | **Forte** : indices, QCM, diagnostic, détection, adaptativité, briefing |
| ARCHITECTURE | 11 | ~15 | **Excellente** : pureté moteur, contrat formulaire, registre leviers, schéma |
| SCORING | 1 | ~20 | **Forte** : 7 dimensions BPI, pondération, percentile, trajectoire |
| BOTS | 0 direct | ~15 (indirect) | **Modérée** : couverts comme inputs des tests scénarios, pas de tests unitaires isolés |
| COMPÉTITION | 2 | ~15 | **Forte** : groupes, qualification, finale, tie-break |
| INTÉGRATION | 22 | ~200 | **Forte** : flux complets contre pglite |

### 7.3 Chemins critiques non protégés

1. **Pas d'instrumentation de couverture** — `@vitest/coverage-v8` n'est pas installé. Les lacunes ci-dessous sont inférées par inventaire, pas mesurées.

2. **`game.service.ts` n'a aucun test unitaire direct** — atteint uniquement via 22 fichiers d'intégration. Les chemins d'erreur (licence refusée, mauvais propriétaire, tour fermé) ne sont pas systématiquement testés.

3. **`createGameCore`, `getGameKind`, `getOrCreateNovaScenarioIdPublic`** — jamais référencées par nom dans un test (atteintes transitivement).

4. **Server Actions** — 29 fonctions, 6 seulement couvertes par le test de contrat statique. La couche de parsing FormData / gestion d'erreur n'est pas testée en dehors de la suite e2e (non exécutée par défaut).

5. **UI** (~5 800 lignes .tsx) — zéro test unitaire/composant. Uniquement couvert par les 5 fichiers e2e (infra live requise).

6. **Bots** — aucun test unitaire des formules de décision (`capacity`, `seasonalFactor`, `adaptivePlan`, logique par profil). Une régression subtile ne serait détectée que si elle déplace un invariant agrégé de scénario.

### 7.4 Gardes architecturales (à préserver absolument)

| Garde | Fichier | Protège contre |
|---|---|---|
| Pureté moteur | `engine-purity.test.ts` | Import de React/Next/Drizzle/DB/services dans src/engine |
| Contrat formulaire ↔ actions | `form-action-contract.test.ts` | Champs de formulaire sans traitement côté serveur (né d'un incident réel) |
| Registre des leviers | `decisions.test.ts` | Désynchronisation formulaire / config / page d'accueil |
| Schéma DB | `schema.test.ts` | Ajout/suppression de table sans mise à jour de la documentation |
| Allowlist `Math.random` / `Date.now` | `engine-purity.test.ts` | Sources d'aléa non seedées dans le moteur |

### 7.5 Tests à ajouter avant le refactoring

| Priorité | Test | Justification |
|---|---|---|
| 🔴 | Installer `@vitest/coverage-v8` | Mesurer les lacunes réelles, pas les deviner |
| 🔴 | Tests unitaires `resolveGameRound` : verrou, libération sur échec, tour déjà en résolution | Protéger le comportement le plus critique lors de l'extraction |
| 🔴 | Test de régression carried-over decisions (champ par champ) | Règle métier subtile (quels champs sont récurrents vs ponctuels) |
| 🟠 | Tests négatifs : licence dépassée, mauvais propriétaire, round fermé | Chemins d'erreur non testés, premiers à casser lors d'un refactoring |
| 🟠 | Tests unitaires bot par profil | Couverture directe au lieu de couverture indirecte |
| 🟡 | Golden snapshot `getGameView` (NOVA, tour 1 + tour N) | Protéger la forme de l'interface de facto |

---

## 8. Future Decision Engine

### 8.1 Points de branchement dans le code actuel

| Étape V2 | Code existant le plus proche | Point de branchement |
|---|---|---|
| **Observation** | `detectSituations(result, enabled)` dans `detection.ts` | Après `resolveGameRound` → `CompanyRoundResult` disponible. Étendre `detection.ts` pour fournir des « données observables » en plus des situations déclenchées. |
| **Diagnostic** | `submitDiagnosis()` dans `pedagogy.service.ts` | Réutilisable tel quel. Le F1-scorer pur (`evaluateDiagnosis`) s'extrait proprement. |
| **Choix du modèle** | `MODEL_QUESTION_ID` (QCM) + table `situationModels` + `modelInsight()` | Transformer le QCM en étape explicite. La matrice de pertinence (optimal/acceptable/misleading/irrelevant) est déjà la source de scoring. Table `modelChoices` (morte) à réactiver. |
| **Analyse** | Aucun équivalent | **Code entièrement nouveau.** Le joueur applique le modèle choisi aux données. Nécessite une spécification dédiée avant estimation. |
| **Justification** | `freeText` dans `submitDiagnosis` (stocké, jamais évalué) | Le slot de stockage existe en base. L'évaluation est à créer : commencer par correspondance structurée (mots-clés attendus par étape), pas par LLM. |
| **Anticipation** | `forecast` dans `RoundDecisions` (expectedUnits, expectedCash) | Le mécanisme de prévision existe (confiance bancaire). L'étendre à « le joueur prédit les conséquences de sa décision, le jeu compare avec la simulation réelle ». |

### 8.2 Architecture technique proposée

```
SituationInstance (existant)
    │
    ▼
ObservationStep (NEW)
    │  Le joueur sélectionne les indicateurs pertinents
    │  Source : CompanyRoundResult (données réelles du tour)
    │  Scoring : % d'indicateurs pertinents sélectionnés
    ▼
DiagnosisStep (existant, enrichi)
    │  Le joueur formule le problème
    │  Source : evaluateDiagnosis (F1 mots-clés, existant)
    │  + évaluation de la justification (NEW)
    ▼
ModelSelectionStep (NEW, remplace le QCM modèle)
    │  Le joueur choisit un outil d'analyse
    │  Source : situationModels.relevance (existant)
    │  Scoring : optimal=1.0, acceptable=0.7, misleading=0.3, irrelevant=0
    ▼
AnalysisStep (NEW)
    │  Le joueur applique le modèle
    │  Source : à définir (formulaire structuré par modèle)
    │  Scoring : à définir
    ▼
DecisionStep (existant : RoundDecisions)
    │  Le joueur prend sa décision
    ▼
AnticipationStep (enrichi depuis forecast)
    │  Le joueur prédit les conséquences
    │  Comparaison avec SimulationOutput réel
    ▼
simulateRound() → CompanyRoundResult
    ▼
DebriefStep (existant, enrichi)
    │  Comparaison prédiction ↔ résultat
    │  Explication des écarts
```

---

## 9. Future Knowledge Graph

### 9.1 Ce qui existe déjà

| Donnée | Source | Format |
|---|---|---|
| 35 concepts | `config/pedagogy/concepts.ts` | Code + nom + domaine + axe + définition + 3 couches (intuition/méthode/formel) |
| 18 modèles | `config/pedagogy/models.ts` | Code + nom + difficulté + `conceptCodes[]` |
| Liens concept → modèle | `decision_model_concepts` (table) | Junction table |
| Liens situation → modèle | `situation_models` (table) | Avec `relevance` (optimal/acceptable/misleading/irrelevant) |
| Liens situation → concept | `situation_concepts` (table) | Junction table |
| Maîtrise par concept | `learning_progress` (table) | `userId × conceptId → mastery (EMA)` |
| Compétences par axe | `player_skills` (table) | 7 axes |
| `prerequisiteIds` | Colonne dans `concepts` (table) | `uuid[]` — **existe mais jamais peuplée** |

### 9.2 Ce qui manque

| Élément manquant | Impact |
|---|---|
| **Graphe de prérequis peuplé** | La colonne `concepts.prerequisiteIds` existe mais est vide. Aucun concept ne déclare de prérequis. |
| **Filtrage par prérequis** | `openSituationsForRound` ne vérifie pas si le joueur maîtrise les concepts prérequis de la situation. |
| **Difficulté par situation dans la détection** | Les situations sont filtrées par trigger (condition sur l'état du jeu), pas par niveau de maîtrise du joueur. |
| **Liens concept → compétence** | Les 7 axes de compétence (`player_skills`) ne sont pas reliés aux concepts. `aggregateAxis` agrège par domaine de concept, pas par lien explicite. |
| **Taxonomie de Bloom** | Aucune classification des situations par niveau cognitif (connaissance, compréhension, application, analyse, synthèse, évaluation). |

### 9.3 Représentation proposée (sans l'implémenter)

```
Concept ←prerequisite── Concept
    │                       │
    └──── used_by ──→ Model
                        │
                   assessed_by
                        │
                        ▼
                    Situation
                        │
                    develops
                        │
                        ▼
                      Skill (axis)
```

Le graphe est un **DAG** (graphe acyclique dirigé). La colonne `prerequisiteIds` est déjà le bon modèle de données : il suffit de la peupler.

---

## 10. Future Database Model

### 10.1 Tables existantes réutilisables

| Table | Rôle actuel | Modification V2 nécessaire |
|---|---|---|
| `concepts` | 35 concepts avec `prerequisiteIds` | **Peupler** `prerequisiteIds` (actuellement vide) |
| `decision_models` | 18 modèles | Aucune |
| `decision_model_concepts` | Liens modèle → concept | Aucune |
| `situations` | 79 situations | Ajouter un champ `difficultyLevel` pour le filtrage |
| `situation_models` | Pertinence situation → modèle | Aucune |
| `situation_concepts` | Liens situation → concept | Aucune |
| `learning_progress` | Maîtrise EMA par concept | Aucune |
| `player_skills` | 7 axes de compétence | Aucune |
| `model_choices` | Choix de modèle (morte) | **Réactiver** pour le V2 ModelSelectionStep |

### 10.2 Nouvelles tables proposées (V2)

| Table | Rôle | Clés | Relations | Volumétrie estimée |
|---|---|---|---|---|
| `decision_attempts` | Trace complète d'un cycle de décision V2 | `id`, `situationInstanceId`, `userId`, `roundId` | FK → situation_instances, users, rounds | 1 par situation × joueur |
| `observation_steps` | Indicateurs sélectionnés par le joueur | `id`, `attemptId`, `selectedIndicators (jsonb)`, `score` | FK → decision_attempts | 1 par tentative |
| `analysis_steps` | Application du modèle par le joueur | `id`, `attemptId`, `modelId`, `input (jsonb)`, `output (jsonb)`, `score` | FK → decision_attempts, decision_models | 1 par tentative |
| `justification_evaluations` | Évaluation structurée de la justification | `id`, `attemptId`, `expectedKeywords (jsonb)`, `matchedKeywords (jsonb)`, `structureScore`, `relevanceScore` | FK → decision_attempts | 1 par tentative |
| `anticipation_steps` | Prédictions du joueur vs résultat réel | `id`, `attemptId`, `predictions (jsonb)`, `actuals (jsonb)`, `deviationScore` | FK → decision_attempts | 1 par tentative |

**Risque volumétrique** : avec 30 élèves × 10 tours × ~3 situations par tour = ~900 `decision_attempts` par partie. Avec les 5 sous-tables : ~4 500 lignes par partie. Pour 100 parties : ~450 000 lignes. Gérable par Neon sans problème.

### 10.3 Aucune migration créée

Conformément à la règle de la Phase 0, aucune migration n'est créée. Le modèle ci-dessus est une proposition à valider avant implémentation.

---

## 11. Plan de refactoring

### Étape 0 — Outillage

| | |
|---|---|
| **Objectif** | Installer la couverture de code et combler les tests critiques |
| **Fichiers** | `package.json`, `vitest.config.ts`, `tests/` |
| **Risque** | Nul (ajout pur) |
| **Tests** | `@vitest/coverage-v8` installé, rapport de couverture généré |
| **Critère** | Couverture mesurée sur `game.service.ts` et `pedagogy.service.ts` |
| **Rollback** | `git revert` |

### Étape 1 — Modules partagés

| | |
|---|---|
| **Objectif** | Extraire `game-guards.ts`, `game-utils.ts`, `game-mode-policy.ts` |
| **Fichiers** | `src/services/game-guards.ts` (nouveau), `src/services/game-utils.ts` (nouveau), `src/services/game-mode-policy.ts` (nouveau), `src/services/game.service.ts` (imports modifiés) |
| **Risque** | Faible (extraction de fonctions pures, remplacement par imports) |
| **Tests** | 538 tests restent verts + nouveaux tests unitaires pour les gardes |
| **Critère** | Les 8 gardes dupliquées sont remplacées par des appels aux fonctions partagées |
| **Rollback** | `git revert` (un seul commit) |

### Étape 2 — Extraction `membership.service.ts`

| | |
|---|---|
| **Objectif** | Extraire `joinGameByCode`, `findUserTeam`, `nommerEquipe` |
| **Fichiers** | `src/services/membership.service.ts` (nouveau), `game.service.ts` (réexporte temporairement) |
| **Risque** | Faible (fonctions isolées, peu de dépendances) |
| **Tests** | Tests existants + tests unitaires : least-filled-team, duplicate-join, nom collision |
| **Critère** | 538 tests verts, `game.service.ts` n'exporte plus ces 3 fonctions directement |
| **Rollback** | `git revert` |

### Étape 3 — Extraction `decision.service.ts`

| | |
|---|---|
| **Objectif** | Extraire `submitTeamDecisions`, `fallbackDecisions` |
| **Fichiers** | `src/services/decision.service.ts` (nouveau), `game.service.ts` |
| **Risque** | Faible (dépend de membership + game-mode-policy) |
| **Tests** | Tests existants + test competition-lock, round-not-open |
| **Critère** | 538 tests verts |
| **Rollback** | `git revert` |

### Étape 4 — Extraction `scoring.service.ts`

| | |
|---|---|
| **Objectif** | Extraire `persistRoundScores`, `updateRankings` |
| **Fichiers** | `src/services/scoring.service.ts` (nouveau), `game.service.ts` |
| **Risque** | Moyen (dépendance implicite sur l'ordre d'appel avec pedagogy) |
| **Tests** | Tests existants + test : scoring sans pédagogie (inputs null), tie-break |
| **Critère** | `resolveGameRound` appelle `scoring.service` au lieu de fonctions locales. L'ordre d'appel pedagogy → scoring est documenté et testé. |
| **Rollback** | `git revert` |

### Étape 5 — Extraction `game-creation.service.ts`

| | |
|---|---|
| **Objectif** | Extraire `createGameCore`, `createSoloGame`, `createClassGame` + helpers |
| **Fichiers** | `src/services/game-creation.service.ts` (nouveau), `game.service.ts` |
| **Risque** | Moyen (pipeline de snapshot séquentiel, `competition.service.ts` importe `createGameCore`) |
| **Tests** | Tests existants + golden snapshot par étape du pipeline |
| **Critère** | `competition.service.ts` importe depuis `game-creation.service.ts`. 538 tests verts. |
| **Rollback** | `git revert` |

### Étape 6 — Extraction `round-resolution.service.ts`

| | |
|---|---|
| **Objectif** | Extraire `resolveGameRound`, `resolveCurrentRound`, `closeCurrentRound`, `drawEventCardForNextRound` |
| **Fichiers** | `src/services/round-resolution.service.ts` (nouveau), `game.service.ts` |
| **Risque** | **Élevé** (verrou optimiste, orchestration de 6 sous-systèmes) |
| **Tests** | Tests existants + concurrent-resolve race, lock-release-on-failure, carried-over champ par champ |
| **Critère** | Le try/catch du verrou est préservé. Les appels pedagogy et scoring sont explicites. 538 tests verts. |
| **Rollback** | `git revert` |

### Étape 7 — Extraction `teacher-view.service.ts`

| | |
|---|---|
| **Objectif** | Extraire `getTeacherGames`, `setQuizMode`, `getTeacherGameView` |
| **Fichiers** | `src/services/teacher-view.service.ts` (nouveau), `game.service.ts` |
| **Risque** | Faible (lecture seule) |
| **Tests** | Tests existants + ownership guard |
| **Critère** | 538 tests verts |
| **Rollback** | `git revert` |

### Étape 8 — Extraction `game-view.service.ts`

| | |
|---|---|
| **Objectif** | Extraire `getGameView` (737 lignes) |
| **Fichiers** | `src/services/game-view.service.ts` (nouveau), `game.service.ts` |
| **Risque** | Moyen (shotgun surgery, 12 champs dérivés, interface de facto `GameView`) |
| **Tests** | Tests existants + golden snapshot GameView (NOVA tour 1 + tour N) |
| **Critère** | `game.service.ts` passe sous 200 lignes (réexports). 538 tests verts. |
| **Rollback** | `git revert` |

### Étape 9 — Refactoring `pedagogy.service.ts`

| | |
|---|---|
| **Objectif** | Extraire en 6 services (situation-instance, hints, diagnosis, debrief, pedagogy-reporting, pedagogy-seed) |
| **Fichiers** | 6 nouveaux fichiers, `pedagogy.service.ts` |
| **Risque** | Moyen (dédupliquer la formule de scoring entre debrief et grade-sheet) |
| **Tests** | Tests existants + test de non-régression de la formule dédupliquée |
| **Critère** | `pedagogy.service.ts` est supprimé ou réduit à un barrel export. 538 tests verts. |
| **Rollback** | `git revert` |

### Étape 10 — Prérequis concepts

| | |
|---|---|
| **Objectif** | Peupler `concepts.prerequisiteIds`, créer le filtrage dans `openSituationsForRound` |
| **Fichiers** | `src/config/pedagogy/concepts.ts`, `src/pedagogy/detection.ts` ou `situation-instance.service.ts` |
| **Risque** | Faible (ajout de données + filtre) |
| **Tests** | Test : situation bloquée si prérequis non maîtrisé |
| **Critère** | Un joueur ne reçoit jamais une situation VAN sans maîtriser l'actualisation |
| **Rollback** | `git revert` |

---

## 12. Risques

| # | Risque | Étape | Gravité | Mitigation |
|---|---|---|---|---|
| 1 | **Verrou optimiste cassé** lors de l'extraction de `resolveGameRound` | 6 | 🔴 | Test de race concurrente + test de libération sur échec avant l'extraction |
| 2 | **Ordre pedagogy → scoring perdu** lors de la séparation des services | 4, 6 | 🔴 | Passer les outputs pedagogy en paramètre explicite au lieu de relire la table |
| 3 | **`difficultyProfile` jsonb écrasé** par écriture concurrente | 5, 6, 7 | 🟠 | Documenter le risque, le corriger par merge jsonb ciblé ou colonnes séparées |
| 4 | **`GameView` interface cassée** lors de l'extraction de `getGameView` | 8 | 🟠 | Golden snapshot avant extraction |
| 5 | **`competition.service.ts` cassé** si `createGameCore` change de signature | 5 | 🟠 | Vérifier les imports downstream avant chaque extraction |
| 6 | **Formule de scoring divergente** entre `debriefRound` et `getGameGradeSheet` | 9 | 🟠 | Dédupliquer en une seule fonction pure partagée |
| 7 | **Carried-over decisions** : champs récurrents vs ponctuels mal identifiés | 6 | 🟠 | Test champ par champ + commentaire exhaustif |
| 8 | **`setQuizMode` / `drawEventCardForNextRound` race condition** sur jsonb | 7 | 🟡 | Documenter, corriger après extraction |
| 9 | **11 fichiers downstream** dépendent de `game.service.ts` | Toutes | 🟡 | Réexporter temporairement depuis `game.service.ts` pendant la transition |
| 10 | **Pas de couverture instrumentée** | 0 | 🟡 | Installer `@vitest/coverage-v8` en première étape |

---

## 13. Stratégie Git

### 13.1 Branches proposées

```
main
 │
 └── v2/phase-0         ← ce document (pas de code modifié)
       │
       └── v2/phase-1   ← refactoring
             │
             ├── refactor/shared-modules     (Étape 1)
             ├── refactor/membership         (Étape 2)
             ├── refactor/decision           (Étape 3)
             ├── refactor/scoring            (Étape 4)
             ├── refactor/game-creation      (Étape 5)
             ├── refactor/round-resolution   (Étape 6)  ← la plus risquée
             ├── refactor/teacher-view       (Étape 7)
             ├── refactor/game-view          (Étape 8)
             ├── refactor/pedagogy           (Étape 9)
             └── feature/concept-prerequisites (Étape 10)
```

### 13.2 Règles

- Chaque branche `refactor/*` part de `v2/phase-1` et y est mergée après validation.
- Chaque merge passe les 538 tests.
- Aucune branche ne modifie `src/engine/`.
- Le garde `engine-purity.test.ts` reste vert à chaque commit.
- Les imports downstream sont réexportés temporairement pour éviter les cassures.
- Un seul refactoring à la fois. Jamais de big bang.

### 13.3 Convention de commit

```
refactor(game-service): extract membership.service.ts

Extract joinGameByCode, findUserTeam, nommerEquipe into
src/services/membership.service.ts. game.service.ts
re-exports temporarily for downstream compatibility.

538 tests green.
```

---

## 14. Critères de validation

La Phase 0 est réussie lorsque :

| # | Critère | Statut |
|---|---|---|
| 1 | Architecture actuelle complètement comprise | ✅ Cartographiée (5 agents) |
| 2 | Responsabilités de `game.service.ts` identifiées | ✅ 16 exports + 11 internes classifiés |
| 3 | Responsabilités de `pedagogy.service.ts` identifiées | ✅ 11 exports + 8 internes classifiés |
| 4 | Frontières du moteur économique définies | ✅ Surface d'appel exacte, pureté vérifiée |
| 5 | Contrats fondamentaux identifiés | ✅ 9 contrats actuels + 8 contrats V2 proposés |
| 6 | Tests critiques identifiés | ✅ 538 tests, 6 chemins non protégés listés |
| 7 | Architecture V2 définie | ✅ Diagramme + 14 services proposés |
| 8 | Ordre de refactoring établi | ✅ 11 étapes séquencées avec risques |
| 9 | Aucun comportement utilisateur modifié | ✅ Aucun fichier applicatif touché |
| 10 | Knowledge Graph analysé | ✅ Existant/manquant identifié |
| 11 | Modèle de données V2 proposé | ✅ 5 nouvelles tables, volumétrie estimée |
| 12 | Stratégie Git définie | ✅ Branches + règles + convention |
| 13 | Decision Engine positionné | ✅ 6 points de branchement identifiés |
| 14 | Risques documentés | ✅ 10 risques classés et mitigés |

---

*Fin de la Phase 0. Aucune ligne de code applicatif n'a été modifiée. Ce document est la base de travail pour la Phase 1 (refactoring).*
