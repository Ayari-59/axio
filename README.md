# Axio — l'Operating System du contrôle de gestion

Plateforme SaaS générique de contrôle de gestion : elle analyse le **modèle économique** d'une
entreprise et construit automatiquement son système de pilotage — axes d'analyse, modèle de coûts,
budgets, indicateurs, cockpit, alertes et copilote.

> Le produit ne s'adapte pas à un secteur : il s'adapte à un **modèle économique**.
> Un cabinet de conseil, une PME industrielle et une entreprise de BTP utilisent le **même moteur**
> et obtiennent trois systèmes de pilotage sans rien de commun.

## Démarrage

```bash
npm install
cp .env.example .env    # puis renseignez DATABASE_URL, DIRECT_URL et AUTH_SECRET
npx prisma db push      # crée le schéma dans PostgreSQL
npm run db:seed         # 3 entreprises de démonstration, 18 mois de données
npm run dev             # http://localhost:3020
```

La base est **PostgreSQL** (Neon). `DATABASE_URL` pointe sur l'endpoint `-pooler` (utilisé par
l'application), `DIRECT_URL` sur l'endpoint direct (utilisé par la CLI Prisma : le pooler ne
supporte pas les opérations de schéma).

Compte de démonstration : **demo@axio.fr** / **Pilotage2026!**

| Entreprise | Modèle économique | Ce que le moteur active |
|---|---|---|
| Delta Conseil | services facturés au temps | missions, feuilles de temps, taux d'occupation, TJM |
| Nordmeca | production d'unités | produits, ateliers, heures machine, coût unitaire, rebut |
| Bâtir Atlantique | affaires à l'avancement | chantiers, avancement, reste à engager, marge à terminaison |

## Vérifier que ça marche

```bash
npm test                # 144 tests : moteurs, cas d'école DCG, garde-fous d'architecture
npm run inspect 2026-03 # sorties chiffrées des trois entreprises, en ligne de commande
npm run smoke           # les 64 routes de l'application répondent (dev server requis)
npm run build           # build de production
```

Le test le plus important est `tests/three-profiles.test.ts` : il fait passer trois modèles
économiques dans le même code et vérifie que les sorties diffèrent. `tests/architecture.test.ts`
interdit tout nom de secteur dans les moteurs, tout `eval`, et tout accès à la base depuis `core/`.

## Architecture en une image

```
Profil déclaré + données observées
            ↓
     MOTEUR DE RÈGLES (données, pas code)
            ↓
Capacités · Axes · Objets de coûts · Méthodes · Règles d'affectation · KPI · Cockpit
            ↓
MOTEURS DE CALCUL (purs, testables, sans I/O)
  coûts → marges → budgets/écarts → KPI → prévision → simulation
            ↓
        ANALYSE → IA (qui commente, jamais qui calcule)
```

| Dossier | Rôle |
|---|---|
| `docs/` | les 18 livrables de conception (vision → critères d'acceptation) |
| `src/core/` | moteurs **purs** : aucune dépendance à Prisma, Next, au réseau ou à l'horloge |
| `src/core/templates/` | packs de règles sectoriels, catalogue de vocabulaire, plan de comptes — **de la donnée** |
| `src/lib/`, `src/services/` | persistance, session, orchestration, fournisseur IA |
| `src/app/` | interface (App Router, RSC + Server Actions) |
| `tests/` | 144 tests dont les cas d'école du contrôle de gestion |
| `scripts/` | inspection, test de fumée |
| `exemples/` | export comptable d'exemple à importer |

## Principes non négociables

1. **Configuration > code.** Aucun `if (secteur === …)` dans les moteurs — un test le vérifie.
2. **Moteur > module.** Il n'y a pas de module BTP : il y a un moteur de coûts paramétré.
3. **Dimensions > tables spécialisées.** Pas de table `Chantier` : des `Dimension` et des `Member`.
4. **L'IA ne calcule jamais.** Elle reçoit des résultats déjà calculés ; ses réponses sont
   contrôlées nombre par nombre. Sans clé d'API, l'application est complète.
5. **Tout chiffre est traçable.** Chaque euro affecté conserve sa règle, son inducteur et sa base.

## Méthodes de contrôle de gestion implémentées

- classement direct/indirect, fixe/variable, décomposition des semi-variables (points extrêmes) ;
- affectation directe, clés de répartition, pourcentages, répartition égale, cheminement en
  trois étapes, prestations réciproques (résolution itérative) ;
- **comptabilité par activités (ABC)** : bibliothèque d'activités par secteur, un inducteur propre
  à chaque activité, et comparaison chiffrée avec la clé unique qui révèle le subventionnement
  croisé entre objets de coûts ;
- coût variable, coût complet, marge sur coûts variables, marge contributive, marge opérationnelle ;
- seuil de rentabilité, point mort, marge de sécurité, levier opérationnel ;
- écarts sur chiffre d'affaires : **prix / volume / composition** (identité vérifiée par test) ;
- écarts sur charges directes : **prix / quantité** ;
- écarts sur charges indirectes : **budget / activité / rendement** (méthode des trois écarts) ;
- attribution des contributeurs (cumul à 80 %), drill-down jusqu'à l'écriture ;
- avancement, coût et marge à terminaison, reste à engager, dérive ;
- prévision (6 méthodes, sélection par backtest MAPE) et simulation what-if multi-leviers.

## Stack

Next.js 16 · React 19 · TypeScript strict · Tailwind 4 · Prisma 7 · PostgreSQL (Neon) · Zod 4 ·
Vitest · graphiques SVG maison · session JWT maison (`jose` + `bcryptjs`).

Le schéma reste volontairement portable : pas d'`enum` ni de `Json` Prisma, les six colonnes de
configuration sont du texte JSON validé par Zod. Les passer en `Jsonb` et les montants en
`Decimal(18,4)` est une optimisation ultérieure, sans impact sur `src/core/`.

## Variables d'environnement

| Variable | Rôle | Défaut |
|---|---|---|
| `DATABASE_URL` | base de données | `file:./prisma/dev.db` |
| `AUTH_SECRET` | signature des sessions | requis |
| `AI_PROVIDER` | `local` (déterministe) ou `anthropic` | `local` |
| `ANTHROPIC_API_KEY` | clé du fournisseur de rédaction | vide |
| `AI_MODEL` | modèle utilisé | `claude-sonnet-5` |

## Déploiement

Hébergement **Vercel**, base **Neon** (PostgreSQL, région Frankfurt).

| Élément | Valeur |
|---|---|
| Dépôt lié | `Ayari-59/axio`, branche de production `main` |
| Framework preset | Next.js · Root Directory `./` · commandes par défaut |
| Base | projet Neon `axio` — l'intégration Vercel injecte `DATABASE_URL` (pooler) et `DATABASE_URL_UNPOOLED` |
| Variables à ajouter à la main | `DIRECT_URL` (endpoint direct) et `AUTH_SECRET` |
| Protection | Vercel Authentication sur les **previews** seulement ; l'URL de production est ouverte, l'application exigeant sa propre connexion |
| Région d'exécution | `fra1` (`vercel.json`) — **à co-localiser avec la base**, voir ci-dessous |

Points qui ont coûté du temps et qu'il ne faut pas refaire :

1. **Le schéma doit exister avant la première visite.** `npx prisma db push` puis `npm run db:seed`,
   exécutés en local contre Neon — le déploiement ne crée aucune table.
2. **Deux URL, pas une.** Le pooler ne supporte pas les opérations de schéma : `prisma db push`
   passe par `DIRECT_URL`, l'application par `DATABASE_URL`. Les deux ne diffèrent que par
   `-pooler` dans le nom d'hôte ; `npm run setup:env` déduit l'une de l'autre.
3. **Ne pas cocher « Sensitive »** sur les variables : elles deviennent illisibles ensuite, y
   compris en CLI, et il faut les supprimer pour les corriger.
4. **Une modification de variable ne redéploie pas.** Il faut relancer un build.
5. **Co-localiser les fonctions et la base.** Par défaut, Vercel exécute à Washington : avec une
   base à Francfort, chaque page enchaînait une dizaine d'allers-retours transatlantiques et
   répondait en 4 s. `"regions": ["fra1"]` dans `vercel.json` ramène le temps de réponse à
   ~550 ms, soit sept fois mieux, pour une ligne de configuration.
6. **Vercel Authentication est active par défaut** et renvoie un 302 vers le portail Vercel sur
   toutes les URL — un symptôme qui ressemble à une panne applicative alors que l'application
   n'a jamais été atteinte.

## Documentation

| Document | Contenu |
|---|---|
| [00 — Vision produit](docs/00-vision-produit.md) | problème, positionnement, avantage concurrentiel |
| [01 — Architecture fonctionnelle](docs/01-architecture-fonctionnelle.md) | domaines, capacités, rôles, flux |
| [02 — Architecture technique](docs/02-architecture-technique.md) | stack, principes, portabilité, sécurité |
| [03 — Modèle de données](docs/03-modele-de-donnees.md) | étoile générique, entités, invariants |
| [04 — Schéma de base](docs/04-schema-base-de-donnees.md) | ERD, index, volumétrie, empreinte de calcul |
| [05 — Dictionnaire des entités](docs/05-dictionnaire-entites.md) | champs, règles, valeurs autorisées |
| [06 — Moteur de règles](docs/06-moteur-de-regles.md) | conditions, effets, packs, application |
| [07 — Moteur de coûts](docs/07-moteur-de-couts.md) | classement, affectation, marges, avancement |
| [08 — Moteur budgétaire](docs/08-moteur-budgetaire.md) | budgets, écarts, décompositions, attribution |
| [09 — Moteur KPI](docs/09-moteur-kpi.md) | formules, sélection, états, cockpit |
| [10 — Configuration dynamique](docs/10-configuration-dynamique.md) | ce qui se règle sans code |
| [11 — Architecture IA](docs/11-architecture-ia.md) | détection, explication, copilote, garde-fous |
| [12 — Parcours utilisateur](docs/12-parcours-utilisateur.md) | de zéro au premier insight |
| [13 — Wireframes](docs/13-wireframes.md) | écrans principaux |
| [14 — Backlog](docs/14-backlog.md) | 12 epics, statut réel de chaque story |
| [15 — Roadmap](docs/15-roadmap.md) | MVP → V1 → V2 → V3, risques |
| [16 — Stratégie de tests](docs/16-strategie-de-tests.md) | niveaux, invariants, couverture |
| [17 — Critères d'acceptation](docs/17-criteres-acceptation.md) | 14 critères vérifiables |
| [18 — Alimenter la base](docs/18-alimenter-la-base.md) | format CSV attendu, inducteurs, attributs, scripts |

## Limites connues du MVP

- Multi-utilisateur : rôles et périmètres sont modélisés et appliqués côté serveur, mais l'écran
  d'invitation est prévu en V1.
- Budget : construction depuis l'historique uniquement (grille de saisie en V1).
- Écarts sur charges indirectes (3 écarts) : moteur livré et testé, écran dédié en V1.
- Import : CSV uniquement (Excel natif en V1) ; le mapping n'est pas encore mémorisé.
- Les montants sont des `Float` arrondis explicitement par `core/model/money.ts` (conservation
  de la masse vérifiée par test). Le passage en `Decimal(18,4)` est prévu avant la mise en
  production réelle.
