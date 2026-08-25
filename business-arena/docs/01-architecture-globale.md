# 01 — Architecture globale, dossiers, déploiement

Couvre les points 1, 2 et 16 de la mission n°37.

---

## 1. Vue d'ensemble

BUSINESS ARENA est une application Next.js (App Router) déployée sur Vercel, adossée à
Neon PostgreSQL via Drizzle. Le cœur du produit n'est **pas** l'application web : ce sont
quatre moteurs TypeScript purs, sans dépendance au framework, que l'application orchestre.

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT (React 19)                          │
│   Dashboard joueur · Console enseignant · Écrans de décision        │
│   shadcn/ui + Tailwind — AUCUNE logique métier, AUCUN calcul éco    │
└───────────────▲─────────────────────────────────────┬───────────────┘
                │ RSC / Server Actions / Route handlers│ (zod aux bords)
┌───────────────┴─────────────────────────────────────▼───────────────┐
│                     COUCHE SERVICES (src/services)                  │
│  Use-cases : soumettre décisions, clore un tour, débloquer indice…  │
│  Auth, autorisations, transactions, journalisation                  │
└───────┬───────────────┬───────────────┬───────────────┬─────────────┘
        │               │               │               │
┌───────▼──────┐ ┌──────▼───────┐ ┌─────▼────────┐ ┌────▼────────────┐
│  ENGINE      │ │  PEDAGOGY    │ │  SCORING     │ │  COMPETITION    │
│  moteur éco  │ │  situations, │ │  BPI,        │ │  phases, grou-  │
│  déterministe│ │  indices,    │ │  compétences │ │  pes, classe-   │
│  (doc 02)    │ │  concepts    │ │  (doc 08)    │ │  ments (doc 04) │
└───────┬──────┘ │  (doc 03)    │ └─────┬────────┘ └────┬────────────┘
        │        └──────┬───────┘       │               │
        │   packages TS purs — testables sans DB ni framework         
┌───────▼───────────────▼───────────────▼───────────────▼─────────────┐
│                 PERSISTANCE (src/db) — Drizzle ORM                  │
│        Neon PostgreSQL (pooler en runtime, direct en migration)     │
└─────────────────────────────────────────────────────────────────────┘
                │                                        │
        ┌───────▼────────┐                       ┌───────▼────────┐
        │ Vercel Cron    │                       │  Adaptateur    │
        │ (échéances de  │                       │  LLM (étape 12)│
        │  tours)        │                       │  coach/débrief │
        └────────────────┘                       └────────────────┘
```

### Règle de dépendance (stricte, vérifiée par test — doc 09 §6)

```
app/ (UI)  →  services/  →  { engine/, pedagogy/, scoring/, competition/ }  →  (rien)
services/  →  db/
engine/, pedagogy/, scoring/, competition/  →  ✗ db, ✗ next, ✗ react, ✗ services
pedagogy/ et scoring/  →  peuvent importer les TYPES de engine/ (résultats de simulation)
```

Interdits explicites (§33) : logique métier dans React, valeurs économiques codées en dur,
fonctions économiques non testées, composants géants, accès DB hors `db/`+`services/`.

### Flux nominal d'un tour

1. **Ouverture** : le service `openRound` matérialise le tour (situation, événements annoncés,
   données visibles selon la difficulté) et notifie les équipes.
2. **Décisions** : chaque équipe soumet ses décisions ; validation zod + bornes du scénario ;
   verrouillage à la validation (mode compétition) ; brouillon libre (mode apprentissage).
3. **Clôture** : déclenchée par le joueur (solo), l'enseignant, ou le cron d'échéance.
4. **Résolution** : `services/resolveRound` charge l'état des N entreprises, appelle
   `engine.simulateRound(state, decisions, scenarioConfig, rng)` — **pur, en mémoire** —
   puis persiste états, résultats, KPIs, écritures dans **une transaction**.
5. **Analyse** : `pedagogy.buildDebrief` produit le débriefing (écarts, causes candidates,
   concepts mobilisés, modèle pertinent) ; `scoring.updateScores` met à jour BPI et profil.
6. Le tour suivant s'ouvre (ou la partie se termine → classement final).

---

## 2. Architecture des dossiers

Racine du futur dépôt dédié (aujourd'hui : `business-arena/` dans axio).

```
business-arena/
├── docs/                        # ce dossier d'architecture, tenu à jour
├── drizzle/                     # migrations SQL générées (drizzle-kit), commitées
├── public/
├── scripts/                     # CLI : seed, calibrage scénario, rejeu de partie
│   ├── seed.ts
│   ├── calibrate.ts             # joue un scénario avec des bots, vérifie les invariants
│   └── replay.ts                # rejoue une partie depuis les décisions archivées
├── src/
│   ├── app/                     # Next.js App Router — UNIQUEMENT présentation + routage
│   │   ├── (auth)/              #   login, register, join (code classe)
│   │   ├── (player)/            #   arena/[gameId]/ dashboard, décisions, analyse, profil
│   │   ├── (teacher)/           #   classes, parties, suivi pédagogique
│   │   ├── (admin)/             #   scénarios, référentiels, organisations
│   │   └── api/                 #   route handlers (cron, webhooks, LLM proxy)
│   ├── components/              # UI partagée (shadcn/ui) : kpi-card, charts, hint-panel…
│   ├── engine/                  # ★ MOTEUR ÉCONOMIQUE — pur, déterministe (doc 02)
│   │   ├── market/              #   demande, segments, élasticité, prix psychologique,
│   │   │                        #   allocation concurrentielle, saisonnalité
│   │   ├── production/          #   capacité, main-d'œuvre, qualité, sous-traitance
│   │   ├── inventory/           #   stocks, valorisation CUMP, ruptures
│   │   ├── costs/               #   fixes/variables/directs/indirects, coût unitaire
│   │   ├── finance/             #   compte de résultat, bilan, FRNG/BFR/TN, ratios,
│   │   │                        #   emprunts, budget de trésorerie, VAN/TRI
│   │   ├── hr/                  #   effectifs, productivité, climat social (minimal au MVP)
│   │   ├── investment/          #   projets, flux, capacité additionnelle
│   │   ├── events/              #   tirage et application des événements
│   │   ├── simulation/          #   simulateRound : pipeline d'orchestration + version
│   │   ├── random/              #   PRNG seedé (mulberry32) — seule source d'aléa
│   │   └── types.ts             #   CompanyState, Decisions, RoundResult… (doc 06)
│   ├── pedagogy/                # ★ MOTEUR PÉDAGOGIQUE (doc 03)
│   │   ├── situations/          #   détection/instanciation des situations d'un tour
│   │   ├── hints/               #   machine à 5 niveaux d'indices + coûts
│   │   ├── models/              #   évaluation du choix de modèle (matrice de pertinence)
│   │   ├── debrief/             #   analyse post-tour (écarts, causes, concepts)
│   │   └── progress/            #   maîtrise des concepts, profil de compétences
│   ├── scoring/                 # ★ BPI + agrégations (doc 08)
│   ├── competition/             # ★ phases, groupes, qualification (doc 04)
│   ├── config/                  # scénarios embarqués (NOVA) : objets TS validés par zod
│   │   └── scenarios/nova/
│   ├── db/
│   │   ├── schema/              #   schéma Drizzle par domaine (doc 05)
│   │   ├── index.ts             #   client (pooler) 
│   │   └── seed/                #   référentiels : concepts, modèles, événements
│   ├── services/                # use-cases transactionnels (seule couche qui écrit en DB)
│   │   ├── game.service.ts      #   créer partie, ouvrir/clore tour, resolveRound
│   │   ├── decision.service.ts  #   soumettre/verrouiller décisions
│   │   ├── hint.service.ts      #   débloquer un indice (trace + malus)
│   │   ├── teacher.service.ts   #   classes, vues pédagogiques
│   │   └── auth/                #   Auth.js, gardes de rôles
│   ├── lib/                     # utilitaires transverses (dates, format €, zod helpers)
│   └── i18n/                    # dictionnaires UI (fr au MVP)
├── tests/
│   ├── unit/                    # miroir de src/engine, src/pedagogy, src/scoring
│   ├── integration/             # partie complète 6 tours, services + DB (Neon branch)
│   ├── golden/                  # instantanés chiffrés de référence par scénario
│   └── architecture/            # tests de règles d'imports
├── drizzle.config.ts
├── next.config.ts
├── package.json
├── tsconfig.json                # strict: true, noUncheckedIndexedAccess: true
└── vitest.config.ts
```

Choix structurants :

- **Pas de monorepo à packages** au MVP : la séparation est assurée par les dossiers + les
  tests d'architecture. Si le moteur doit être publié séparément (championnat, mobile), il
  sera extrait en package sans refactoring car il n'a aucune dépendance entrante.
- **Scénarios en code (`src/config`) ET en base** : le scénario est édité/versionné comme un
  objet TypeScript validé par zod (revue de code possible), puis **publié en base** (table
  `scenarios`, JSONB) ; chaque partie fige son instantané (ADR-10). L'éditeur visuel de
  scénarios est une évolution.

---

## 3. Découpage des écrans (référence pour les étapes 6–7)

| Espace | Écrans MVP |
|---|---|
| Joueur | Accueil arène · Tableau de bord (KPI débloqués, graphiques, alertes) · Situation & diagnostic (choix du modèle, indices) · Décisions du tour · Résultats & analyse du tour · Classement · Profil de compétences · Fiches concepts |
| Enseignant | Mes classes · Créer une partie (scénario, niveau, durée, équipes) · Pilotage de partie (état des décisions, clôture de tour) · Résultats & classement · Vue pédagogique (maîtrise des concepts, modèles mal utilisés, indices consommés) |
| Admin | Référentiels (concepts, modèles, événements) · Scénarios publiés · Organisations |

---

## 4. API et validation

- **Server Actions** pour les mutations liées à l'UI (soumettre décisions, débloquer indice) ;
  **Route handlers** pour ce qui doit être appelable hors UI : cron d'échéance
  (`/api/cron/close-rounds`, protégé par `CRON_SECRET`), proxy LLM (étape 12), export enseignant.
- **zod à toutes les frontières** : entrées d'actions, config de scénario, payloads JSONB relus
  depuis la base (parse au chargement, jamais de `as`).
- Autorisations centralisées dans `services/auth` : chaque use-case vérifie
  (rôle, organisation, appartenance à l'équipe/partie) avant tout accès.

---

## 5. Stratégie de déploiement Vercel (point 16)

- **Environnements** : Production (branche `main`) · Preview (chaque PR) · Développement local.
- **Base de données** : Neon.
  - Runtime : `DATABASE_URL` sur l'endpoint **pooler** (compatible serverless).
  - Migrations : `DIRECT_URL` sur l'endpoint direct ; `drizzle-kit migrate` exécuté en CI
    (GitHub Actions) **avant** la promotion du déploiement, jamais au build Vercel.
  - **Neon branching pour les previews** : la CI crée une branche Neon par PR (copie de prod
    anonymisée ou seed), l'URL est injectée dans l'environnement preview → chaque PR est
    testable de bout en bout sans toucher aux données réelles.
- **Runtime** : route handlers et server actions en **Node runtime** (le moteur utilise des
  calculs intensifs et Drizzle/pg). Pas d'edge pour la résolution de tours.
- **Cron Vercel** : `*/5 * * * *` sur `/api/cron/close-rounds` — clôt les tours arrivés à
  échéance (parties de classe et compétitions). Idempotent (verrou en base sur `rounds.status`).
- **Variables d'environnement** : `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `CRON_SECRET`,
  `LLM_API_KEY` (étape 12) — documentées dans `.env.example`, jamais commitées.
- **CI (GitHub Actions)** : lint → typecheck → tests unitaires → tests d'architecture →
  tests d'intégration (Neon branch éphémère) → migrations → build. Un échec bloque le merge.
- **Observabilité** : logs structurés dans les services (use-case, gameId, durée de
  résolution) ; suivi du budget < 1 s / résolution de tour.

---

## 6. Sécurité (synthèse, détaillée par domaine dans chaque doc)

- Résolution des tours et calculs **exclusivement serveur** ; le client ne reçoit que les
  données débloquées à son niveau (le filtrage se fait dans les services, pas dans l'UI).
- Décisions verrouillées après validation en mode compétition ; horodatage serveur ; journal
  append-only (ADR-13).
- Graine de partie et paramètres cachés du scénario (élasticités réelles, probabilités
  d'événements) **jamais envoyés au client**.
- Hachage bcrypt des mots de passe, JWT signés (`AUTH_SECRET`), rate-limiting sur l'auth.

---

## 7. Emplacement réservé à l'IA (étape 12 — contrat d'architecture)

L'IA est **secondaire au moteur** (§29). L'architecture réserve dès maintenant :

- `src/services/coach.service.ts` + `/api/coach` : proxy vers l'API LLM (Claude), côté serveur.
- **Entrées** : contexte structuré produit par `pedagogy/debrief` (chiffres calculés par le
  moteur, concepts en jeu, justification du joueur) — l'IA ne voit jamais les paramètres cachés.
- **Sorties** : questionnement socratique, reformulation, analyse de justification. Jamais de
  chiffres inventés : toute valeur citée doit provenir du contexte fourni (contrainte de prompt
  + post-validation qui rejette les nombres absents du contexte).
- **Interdits garantis par construction** : l'IA n'a aucun accès en écriture à l'état du jeu ;
  elle ne peut ni modifier des résultats ni remplacer la simulation.
