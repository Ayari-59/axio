# BUSINESS ARENA — Dossier d'architecture (Mission n°37)

> **Simulation + Apprentissage + Aide à la décision + Compétition.**
> Plateforme SaaS de simulation d'entreprise dans laquelle un joueur ou une équipe dirige une
> entreprise virtuelle, apprend à choisir le bon modèle de gestion, et progresse du niveau
> DÉCOUVERTE au niveau EXECUTIVE.

Ce dossier est le **livrable de la mission n°37** : l'architecture complète du produit,
produite **avant toute ligne de code applicatif**, conformément à la méthode imposée
(§35 étape 1 : analyser, identifier les ambiguïtés, proposer l'architecture, ne pas coder).

## Statut du dépôt

Le cahier des charges demande un **repo à part entière**. Cette session de développement est
techniquement limitée au dépôt `Ayari-59/axio` (branche `claude/business-arena-saas-b96vxn`) :
le dossier `business-arena/` est donc **entièrement autonome** — aucune référence au code
d'Axio — et conçu pour être extrait tel quel vers un dépôt dédié `Ayari-59/business-arena` :

```bash
# depuis un clone d'axio, extraire l'historique du sous-dossier :
git subtree split --prefix=business-arena -b business-arena-standalone
# puis pousser cette branche comme racine du nouveau dépôt.
```

## Sommaire du dossier

| Fichier | Contenu (points du cahier des charges §37) |
|---|---|
| [`docs/00-decisions-et-ambiguites.md`](docs/00-decisions-et-ambiguites.md) | Analyse du cahier des charges, ambiguïtés identifiées, décisions d'architecture (ADR) |
| [`docs/01-architecture-globale.md`](docs/01-architecture-globale.md) | 1. Architecture globale · 2. Architecture des dossiers · 16. Stratégie de déploiement Vercel |
| [`docs/02-moteur-simulation.md`](docs/02-moteur-simulation.md) | 3. Architecture du moteur de simulation (demande, élasticité, prix psychologique, production, coûts, finance FRNG/BFR, événements) |
| [`docs/03-moteur-pedagogique.md`](docs/03-moteur-pedagogique.md) | 4. Moteur pédagogique · 10. Les 20 concepts du MVP · 11. Modèles de décision · 12. Règles du système d'indices |
| [`docs/04-moteur-competition.md`](docs/04-moteur-competition.md) | 5. Architecture du moteur de compétition (modes apprentissage / compétition / concours) |
| [`docs/05-schema-base-de-donnees.md`](docs/05-schema-base-de-donnees.md) | 6. Schéma complet Neon PostgreSQL · 7. Relations entre tables |
| [`docs/06-types-typescript.md`](docs/06-types-typescript.md) | 8. Types TypeScript principaux |
| [`docs/07-scenario-nova.md`](docs/07-scenario-nova.md) | 9. Architecture du premier scénario NOVA (6 tours) |
| [`docs/08-scoring-et-difficulte.md`](docs/08-scoring-et-difficulte.md) | 13. Règles de scoring (Business Performance Index) · 14. Architecture des niveaux de difficulté |
| [`docs/09-strategie-tests.md`](docs/09-strategie-tests.md) | 15. Stratégie de tests |
| [`docs/10-strategie-evolution.md`](docs/10-strategie-evolution.md) | 17. Stratégie d'évolution future (championnat, IA, internationalisation…) |

## Stack (imposée, confirmée)

Next.js (App Router) · React · TypeScript strict · Vercel · Neon PostgreSQL · **Drizzle ORM** ·
Tailwind CSS · shadcn/ui · Git/GitHub · architecture compatible API LLM.

> Note : le dépôt hôte `axio` utilise Prisma ; BUSINESS ARENA étant un produit indépendant,
> il applique la stack imposée par son propre cahier des charges, donc **Drizzle**.

## La boucle produit

```
SITUATION → PROBLÈME → DIAGNOSTIC → MODÈLE D'ANALYSE → DÉCISION
    ↑                                                      ↓
APPRENTISSAGE ← ANALYSE ← RÉSULTAT ← SIMULATION ←──────────┘
```

Chaque brique de l'architecture sert un maillon de cette boucle :

- **SITUATION / PROBLÈME** → moteur de scénarios + moteur d'événements (`docs/02`, `docs/07`)
- **DIAGNOSTIC / MODÈLE** → moteur pédagogique, référentiels de concepts et de modèles (`docs/03`)
- **DÉCISION / SIMULATION / RÉSULTAT** → moteur économique déterministe (`docs/02`)
- **ANALYSE / APPRENTISSAGE** → débriefing, indices, profil de compétences, scoring (`docs/03`, `docs/08`)
- **COMPÉTITION** → moteur de compétition (`docs/04`)

## Prochaines étapes (méthode §35)

1. ✅ **Étape 1 — ce dossier** : architecture validée avant développement.
2. Étape 2 — modèle de données : schéma Drizzle + migrations Neon (`docs/05` fait foi).
3. Étape 3 — moteur économique minimal + tests (`docs/02`, `docs/09`).
4. Étape 4 — scénario NOVA (`docs/07`).
5. Étape 5 — simulation de 6 tours.
6. Étapes 6→13 — interfaces, moteur pédagogique, indices, scoring, profil, IA, compétition.

**Aucune modification du moteur économique ne sera acceptée sans tests** (§32).
