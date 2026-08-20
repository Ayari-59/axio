# 02 — Architecture technique

## 1. Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────┐
│ FRONTEND — Next.js App Router (React Server Components)      │
│  Cockpit dynamique · Assistant · Explorateur · Copilote      │
└───────────────┬──────────────────────────────────────────────┘
                │ Server Actions (mutations) + RSC (lectures)
┌───────────────▼──────────────────────────────────────────────┐
│ APPLICATION — services/                                       │
│  Orchestration, autorisation, transactions, audit             │
└───────────────┬──────────────────────────────────────────────┘
                │ appels purs
┌───────────────▼──────────────────────────────────────────────┐
│ CORE (pur, sans I/O) — core/                                  │
│  rules · costing · budget · kpi · analytics · quality · copilot│
└───────────────┬──────────────────────────────────────────────┘
                │ interfaces de dépôt (ports)
┌───────────────▼──────────────────────────────────────────────┐
│ PERSISTANCE — lib/repositories + Prisma                       │
│  SQLite (dev) → PostgreSQL / Neon (prod), même schéma logique │
└──────────────────────────────────────────────────────────────┘
                ▲
┌───────────────┴──────────────────────────────────────────────┐
│ COUCHE IA — lib/ai (provider substituable)                    │
│  local (déterministe, par défaut) | anthropic                 │
└──────────────────────────────────────────────────────────────┘
```

## 2. Stack retenue

| Couche | Choix | Justification |
|---|---|---|
| Framework | Next.js 16 (App Router) | RSC = agrégats calculés côté serveur, pas de sur-transport JSON |
| Langage | TypeScript strict | Le domaine est riche : les types sont la première ligne de défense |
| UI | React 19 + Tailwind 4 | Cohérent avec les autres produits de l'utilisateur |
| Graphiques | SVG maison (`components/charts`) | Zéro dépendance, thème light/dark maîtrisé, pas de risque React 19 |
| Validation | Zod 4 | Frontière entrée/sortie, parsing des blobs JSON de configuration |
| ORM | Prisma 7 | Convention maison ; adaptateurs de driver |
| Base dev | SQLite via `@prisma/adapter-better-sqlite3` | MVP exécutable hors ligne, sans Docker ni serveur |
| Base prod | PostgreSQL / Neon via `@prisma/adapter-pg` | Convention maison (cf. Dirigeant Optimizer, BTP Pilote) |
| Auth | Session maison (JWT `jose` + cookie httpOnly, `bcryptjs`) | Évite les pièges NextAuth listés sur les projets précédents |
| Tests | Vitest | Le cœur est pur, donc testable sans base |
| IA | `AI_PROVIDER=local|anthropic` | L'application est **complète sans clé d'API** |

### 2.1 Portabilité SQLite → PostgreSQL

Le schéma est écrit de façon portable :

- pas d'`enum` Prisma (SQLite ne les supporte pas) : `String` + unions TypeScript + Zod ;
- pas de `Json` Prisma : colonnes `String` contenant du JSON, lues via `parseJson(schema, value)` ;
- pas de tableaux natifs ;
- décimaux : `Float` en dev, `Decimal(18,4)` en production (arrondi bancaire centralisé dans
  `core/model/money.ts` — toute somme monétaire passe par `round2`).

Migration prod : changer `provider`, changer l'adaptateur, passer `String` → `Jsonb` sur les
6 colonnes de configuration. Aucune ligne de `core/**` n'est touchée.

## 3. Principes structurants

### P1 — Le cœur est pur
`core/**` n'importe ni Prisma, ni Next, ni `fetch`, ni `Date.now()`. Toute fonction reçoit
ses données en entrée et retourne un résultat. Conséquences : testabilité totale, exécution
possible dans le navigateur (aperçu what-if instantané), aucune dérive « logique métier dans
la page ».

### P2 — La configuration est une donnée versionnée
Un `ConfigurationVersion` est un instantané immuable (capacités, dimensions, méthodes, KPI,
cockpit). On peut donc rejouer un calcul « tel qu'il était en mars ».

### P3 — Tout calcul est traçable
Chaque montant produit par le moteur d'affectation conserve sa `trace` (règle appliquée, base de
répartition, quantité d'inducteur, montant source). Le drill-down n'est pas une requête ad hoc :
c'est la lecture de la trace.

### P4 — Isolation multi-tenant côté serveur
`getSessionContext()` retourne `{ userId, organizationId, companyId, role, scope }` issus du JWT.
Aucune requête ne prend un `companyId` venant du client sans vérification d'appartenance
(`assertCompanyAccess`).

### P5 — Aucun secteur dans le code
Un `grep -riE "btp|chantier|consultant|fonderie" src/core --include=*.ts` ne doit rien retourner
en dehors de `core/templates/**` (données) et des tests. Un test automatisé vérifie cette règle.

## 4. Arborescence

```
axio/
├── docs/                       livrables de conception (ce dossier)
├── prisma/
│   ├── schema.prisma           schéma portable
│   └── seed.ts                 3 entreprises de démonstration
├── src/
│   ├── core/                   MOTEUR PUR — aucune I/O
│   │   ├── model/              types du domaine, money, périodes, filtres
│   │   ├── rules/              moteur de règles + évaluation des conditions
│   │   ├── costing/            classement, affectation multi-étages, ABC, marges
│   │   ├── budget/             comparaisons, écarts, décompositions DCG
│   │   ├── kpi/                évaluateur de formules + catalogue
│   │   ├── analytics/          forecast, what-if, seuil, attribution, anomalies
│   │   ├── quality/            contrôles et score
│   │   ├── templates/          rule packs sectoriels (données)
│   │   ├── copilot/            intentions, outils, réponses
│   │   └── import/             parseur CSV, profilage, auto-mapping
│   ├── lib/                    db, auth, session, repositories, ai, format
│   ├── services/               orchestration applicative (transactions)
│   ├── components/             UI (charts, primitives, blocs de cockpit)
│   └── app/                    routes Next.js
└── tests/                      Vitest (unitaires + 3 profils + garde-fous)
```

## 5. Modèle d'exécution des calculs

```
Entries (faits) ─┐
Drivers          ├─▶ CostingEngine ─▶ CostResult {byNature, byCenter, byObject, traces}
AllocationRules ─┘                            │
                                              ▼
                              MarginEngine ─▶ MarginResult (cascade par objet)
                                              │
Budgets ─────────────────────────────────────▶ VarianceEngine ─▶ Variances décomposées
                                              │
                                              ▼
                                        KpiEngine ─▶ KpiValue[]
                                              │
                             ┌────────────────┼───────────────┐
                             ▼                ▼               ▼
                       AlertEngine      Attribution      Forecast / What-if
```

Le recalcul est **idempotent** et déclenché par : import, changement de règle, changement de
budget, clôture de période. Résultats mis en cache dans `CalculationRun` (+ empreinte des entrées)
pour éviter tout recalcul inutile.

## 6. Sécurité

- Mots de passe : `bcryptjs`, coût 10.
- Session : JWT HS256 (`jose`), cookie `httpOnly`, `sameSite=lax`, 7 jours, secret `AUTH_SECRET`.
- Autorisation : matrice `lib/permissions.ts` (`can(role, action)`) + `scope` dimensionnel.
- Audit trail : table `AuditLog` (acteur, action, entité, diff, horodatage) sur toute mutation
  de configuration, de budget et d'import.
- Aucun secret côté client ; la clé Anthropic n'est lue que dans un contexte serveur.

## 7. Performance

| Risque | Parade |
|---|---|
| Volume d'écritures analytiques | Table de faits unique + index `(companyId, periodId, kind)` |
| Agrégations lourdes | Pré-agrégation par période dans `CalculationRun`, invalidée par empreinte |
| Drill-down profond | Traces stockées et indexées, pas de recalcul à la volée |
| Import volumineux | Traitement par lots de 500, transaction unique, dry-run préalable |

Cible MVP : 200 000 écritures par entreprise, recalcul complet < 3 s.

## 8. Extensibilité

| Extension | Geste requis | Redéploiement |
|---|---|---|
| Nouveau secteur | Ajouter un rule pack dans `core/templates` | Non (chargeable en base) |
| Nouveau KPI | Ajouter une définition (formule texte) | Non |
| Nouvelle clé de répartition | Ajouter un `driver` et ses valeurs | Non |
| Nouvelle méthode de coût | Implémenter `AllocationMethod` | Oui |
| Nouveau connecteur | Implémenter `SourceAdapter` | Oui |

## 9. Variables d'environnement

| Variable | Rôle | Défaut |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` (SQLite) ou URL Postgres | `file:./prisma/dev.db` |
| `AUTH_SECRET` | Signature des sessions | requis (généré à l'install) |
| `AI_PROVIDER` | `local` ou `anthropic` | `local` |
| `ANTHROPIC_API_KEY` | Clé du fournisseur IA | vide |
| `AI_MODEL` | Modèle utilisé | `claude-sonnet-5` |
