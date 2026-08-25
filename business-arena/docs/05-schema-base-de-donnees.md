# 05 — Schéma de base de données Neon PostgreSQL (Drizzle)

Couvre les points 6 et 7 de la mission n°37 (§30). Le schéma Drizzle (étape 2) sera la
traduction littérale de ce document ; toute divergence devra être reportée ici.

Conventions : clés primaires `uuid` (`gen_random_uuid()`), horodatage `created_at` /
`updated_at` (timestamptz) partout, `snake_case`, montants en `numeric(14,2)` (euros),
quantités en `numeric(14,3)`, taux en `numeric(8,5)`. Les structures profondément
imbriquées, figées et non requêtées ligne à ligne (instantané de scénario, payload de
décisions, états financiers détaillés) sont en **JSONB validé par zod au chargement** ;
tout ce qui est filtré/agrégé (KPIs, scores, progression) est **normalisé en colonnes**.

---

## 1. Vue d'ensemble des domaines

```
IDENTITÉ        users, organizations, organization_members, classes, class_members
CATALOGUE       scenarios, concepts, decision_models, decision_model_concepts,
(référentiels)  situations, situation_models, situation_concepts, hints,
                event_definitions, decision_options
PARTIE          games, teams, players, rounds, decisions
ÉTAT SIMULÉ     markets, market_segments, products, production_units, employees,
                suppliers, customers, inventory, financial_accounts, transactions
RÉSULTATS       round_results, kpis, event_occurrences
PÉDAGOGIE       situation_instances, model_choices, hint_usages,
                learning_progress, player_skills
SCORING         scores, game_rankings
COMPÉTITION     competitions, competition_stages, competition_entries
```

Correspondance avec la liste imposée (§30) : `events` → `event_definitions` (catalogue) +
`event_occurrences` (instances tirées) ; `competition_rounds` → `competition_stages`
(phases) ; `players` → appartenance user↔team. Tables ajoutées par nécessité d'intégrité :
`organization_members`, `class_members`, `situation_instances`, `model_choices`,
`hint_usages`, `game_rankings`, tables de jointure des référentiels.

## 2. Identité et multi-tenant

| Table | Colonnes principales | Contraintes |
|---|---|---|
| `users` | id, email **unique**, password_hash (nullable si magic link), display_name, avatar, locale, is_platform_admin bool | email citext |
| `organizations` | id, name, slug **unique**, kind enum(`school`,`company`,`public`) | — |
| `organization_members` | user_id FK, organization_id FK, role enum(`student`,`teacher`,`org_admin`) | PK (user_id, organization_id) |
| `classes` | id, organization_id FK, teacher_id FK→users, name, join_code **unique**, school_year | index (organization_id) |
| `class_members` | class_id FK, user_id FK | PK (class_id, user_id) |

## 3. Catalogue (référentiels — données, pas code)

| Table | Colonnes principales |
|---|---|
| `scenarios` | id, code **unique** + version (unique ensemble), title, summary, min/max_companies, rounds_count, base_difficulty, config **jsonb** (`ScenarioConfig`, doc 06), status enum(`draft`,`published`,`archived`), author_id |
| `concepts` | id, code **unique**, name, domain enum (marché, commercial, coûts, marges, seuils, production, finance, rentabilité, budget, investissement, décision, stratégie), definition, layers jsonb (intuition/méthode/formalisation), formulas jsonb, common_mistakes jsonb, intro_difficulty int, prerequisite_ids uuid[] |
| `decision_models` | id, code **unique**, name, description, objective, relevant_situations text, required_data jsonb (clés de données), formula, difficulty int, common_mistakes jsonb, examples jsonb, default_hints jsonb |
| `decision_model_concepts` | decision_model_id FK, concept_id FK — PK composite |
| `situations` | id, code **unique**, scenario_id FK **nullable** (null = générique, détectable partout), title_key, narrative_key, problem_key, diagnostic_options jsonb, trigger jsonb (`SituationTrigger` ou script {round}), difficulty int, weight numeric |
| `situation_models` | situation_id FK, decision_model_id FK, relevance enum(`optimal`,`acceptable`,`misleading`,`irrelevant`) — PK composite |
| `situation_concepts` | situation_id FK, concept_id FK — PK composite |
| `hints` | id, situation_id FK, level int **1..5**, text_key, cost_ratio numeric — **unique (situation_id, level)** |
| `event_definitions` | id, code **unique**, name, scope enum(`market`,`company`), trigger jsonb, duration int, modifiers jsonb, announcement jsonb, difficulty int, concept_ids uuid[] |
| `decision_options` | id, scenario_id FK, code (ex. `price`, `production_plan`, `marketing_budget`), label_key, unit, min/max/step numeric, unlocked_from_difficulty int — **unique (scenario_id, code)**. Définit les leviers de décision offerts et leurs bornes ; la validation zod des `decisions.payload` s'appuie dessus. |

## 4. Partie

| Table | Colonnes principales | Contraintes |
|---|---|---|
| `games` | id, organization_id FK, class_id FK null, competition_stage_id FK null, scenario_id FK, scenario_snapshot **jsonb** (ADR-10), engine_version text, seed bigint, mode enum(`learning`,`competition`,`contest`), difficulty_profile jsonb, status enum(`draft`,`open`,`running`,`finished`,`archived`), current_round int, round_duration interval null, created_by FK→users | index (class_id), (status) |
| `teams` | id, game_id FK, name, controller enum(`human`,`bot`), bot_profile text null, join_code unique null | **unique (game_id, name)** ; check bot ⇒ bot_profile not null |
| `players` | team_id FK, user_id FK, role enum(`captain`,`member`) | PK (team_id, user_id) ; **unique (user_id, game_id)** via contrainte (un joueur, une équipe par partie — vue matérialisée d'appui ou trigger) |
| `rounds` | id, game_id FK, index int, status enum(`pending`,`open`,`resolving`,`resolved`), opens_at, deadline, resolved_at | **unique (game_id, index)** ; le verrou de résolution = update conditionnel sur status (cron idempotent) |
| `decisions` | id, round_id FK, team_id FK, payload **jsonb** (validé contre `decision_options`), forecast jsonb (prévisions du joueur → analyse d'écarts), justification text, status enum(`draft`,`validated`,`locked`,`carried_over`), validated_at, validated_by FK→users | **unique (round_id, team_id)** ; append-only logique : jamais de UPDATE après `locked` (trigger de garde) |

## 5. État simulé (par partie/équipe)

Instancié depuis l'instantané de scénario à la création de la partie, mis à jour par la
résolution de chaque tour (transaction unique).

| Table | Colonnes principales |
|---|---|
| `markets` | id, game_id FK **unique**, params jsonb (paramètres effectifs courants, macro) |
| `market_segments` | id, market_id FK, code, name, size numeric, growth, price_elasticity, ref_price, psych_thresholds jsonb, mkt_sensitivity, quality_sensitivity, loyalty, payment_delay_days int — **unique (market_id, code)**. Les sensibilités sont les valeurs **cachées** ; jamais exposées à l'API joueur. |
| `products` | id, game_id FK, team_id FK, code, name, perceived_quality numeric, current_price numeric — **unique (team_id, code)** |
| `production_units` | id, team_id FK, kind, unit_capacity numeric, availability numeric, fixed_cost_per_round, acquired_round int, retired_round int null |
| `employees` | id, team_id FK, category enum(`production`,`sales`,`support`), headcount int, hours_per_round, unit_cost, productivity numeric (lignes agrégées par catégorie, pas de RH individuelle au MVP) |
| `suppliers` | id, game_id FK, code, material, unit_price, lead_time_rounds int, payment_delay_days int |
| `customers` | id, game_id FK, segment_id FK, kind enum(`mass`,`key_account`), name, share_of_segment numeric — sert aux événements « perte d'un client » et aux délais clients différenciés |
| `inventory` | team_id FK, round_index int, item enum(`raw_material`,`finished_good`), product_id FK null, quantity numeric, unit_cost numeric (CUMP) — PK (team_id, round_index, item, product_id) |
| `financial_accounts` | team_id FK, round_index int, account code text (plan de comptes simplifié : immobilisations, capitaux propres, emprunts, clients, fournisseurs, disponibilités, découvert…), balance numeric — PK (team_id, round_index, account) — c'est le **bilan requêtable** ; l'invariant Σdébit=Σcrédit est testé |
| `transactions` | id, team_id FK, round_index, kind enum (vente, achat, salaire, investissement, emprunt, remboursement, intérêt, impôt…), amount, quantity null, label_key — journal des flux du tour, base du budget de trésorerie affiché |

## 6. Résultats

| Table | Colonnes principales |
|---|---|
| `round_results` | id, round_id FK, team_id FK, income_statement jsonb, balance_sheet jsonb, cash_flow jsonb, market_detail jsonb (ventes/parts par segment), engine_trace jsonb (trace pédagogique, non exposée brute), **colonnes dénormalisées requêtables** : revenue, net_income, cash, frng, bfr, net_treasury, market_share — **unique (round_id, team_id)** |
| `kpis` | round_id FK, team_id FK, kpi_code text (référentiel de codes doc 06), value numeric — PK (round_id, team_id, kpi_code) ; alimente graphiques et vues enseignant sans parser de JSONB |
| `event_occurrences` | id, game_id FK, event_definition_id FK, round_started int, rounds_left int, team_id FK null (scope company), params jsonb, announced bool |

## 7. Pédagogie

| Table | Colonnes principales |
|---|---|
| `situation_instances` | id, round_id FK, team_id FK, situation_id FK, origin enum(`scripted`,`detected`), status enum(`open`,`diagnosed`,`answered`,`debriefed`), diagnosis jsonb (options cochées + texte libre), opened_at, answered_at — **unique (round_id, team_id, situation_id)** |
| `model_choices` | id, situation_instance_id FK, decision_model_id FK, justification text, relevance enum (copié de la matrice au moment du choix — historisation), model_score numeric, hinted bool (le modèle avait été soufflé par un indice niveau 4) |
| `hint_usages` | id, situation_instance_id FK, hint_id FK, level int, user_id FK, used_at — **unique (situation_instance_id, level)** (séquentialité garantie par le service + check level croissant) |
| `learning_progress` | user_id FK, concept_id FK, mastery numeric 0..100, evidence_count int, last_event_at — PK (user_id, concept_id) |
| `player_skills` | user_id FK, axis enum(`finance`,`marketing`,`production`,`analysis`,`strategy`,`decision`,`risk`), value numeric 0..100 — PK (user_id, axis) |

## 8. Scoring et compétition

| Table | Colonnes principales |
|---|---|
| `scores` | round_id FK, team_id FK, dimension enum(`economic`,`financial`,`commercial`,`operational`,`profitability`,`strategy`,`decision_mastery`), raw numeric, normalized numeric 0..100 — PK (round_id, team_id, dimension) |
| `game_rankings` | game_id FK, team_id FK, bpi numeric, rank int, detail jsonb — PK (game_id, team_id) ; recalculée à chaque résolution, figée à `finished` |
| `competitions` | id, organization_id FK null (null = nationale), name, status enum(`draft`,`registration`,`running`,`finished`), scenario_id FK, rules jsonb, organizer_id FK |
| `competition_stages` | id, competition_id FK, index int, kind enum(`qualification`,`groups`,`knockout`,`semifinal`,`final`), format jsonb (teamsPerGame, advanceCount, tieBreakers), status — **unique (competition_id, index)** |
| `competition_entries` | competition_id FK, team_label text, member_user_ids uuid[], organization_id FK, seed_rank int, status enum(`registered`,`active`,`eliminated`,`winner`) — PK (competition_id, team_label) |

## 9. Relations — diagramme d'ensemble

```
organizations ─< organization_members >─ users ─< class_members >─ classes >─ organizations
      │                                    │                          │
      └───────< games >────────────────────┼──────────────────────────┘ (class_id)
                │  │ scenario_id           │
scenarios ──────┘  │                       └──< players >── teams >── games
   │               │                                          │
   │               ├──< rounds ──< decisions (1/équipe/tour)  │
   │               ├──< markets ──< market_segments           │
   │               ├──< suppliers, customers                  │
   │               ├──< event_occurrences >── event_definitions
   │               └──< game_rankings                         │
   │                        rounds ──< round_results, kpis, scores (× team)
   │                        rounds ──< situation_instances >── situations
   │                                        │                     │
   │                                        ├──< model_choices >──┼── decision_models
   │                                        └──< hint_usages >────┴──< hints
   │  concepts ──< situation_concepts, decision_model_concepts
   │  users ──< learning_progress >── concepts ;  users ──< player_skills
   └── competitions ──< competition_stages ──< games ;  competitions ──< competition_entries
teams ──< products, production_units, employees, inventory, financial_accounts, transactions
```

## 10. Intégrité, index, migrations

- **FK partout avec `on delete`** réfléchi : `cascade` à l'intérieur d'une partie
  (games → teams → …), `restrict` du jeu vers les catalogues (impossible de supprimer un
  scénario ou un concept référencé), `set null` pour les liens faibles (class_id).
- **Checks** : bornes (mastery 0..100, level 1..5, relevance…), montants de décisions
  validés applicativement contre `decision_options` (zod) car dépendants du scénario.
- **Index** de parcours : (game_id, index) sur rounds ; (team_id, round_index) sur toutes
  les tables d'état ; (kpi_code) partiel pour les vues enseignant ; (user_id) sur la
  progression.
- **Migrations** : `drizzle-kit generate` → SQL commité dans `drizzle/`, appliqué par la CI
  sur `DIRECT_URL` (doc 01 §5). Jamais de `db push` en production. Le seed des référentiels
  (concepts, modèles, événements, NOVA) est idempotent (upsert par `code`).
