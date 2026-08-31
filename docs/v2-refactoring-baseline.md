# V2 Refactoring Baseline — Phase 1A Safety Net

> Généré le 2026-08-31 après exécution complète de la suite de tests.

## 1. Comptage des tests

| Métrique | Avant Phase 1A | Après Phase 1A | Delta |
|---|---|---|---|
| Fichiers de tests | 76 | 82 | +6 |
| Tests unitaires + intégration | 538 | 636 | +98 |

### Nouveaux fichiers (tests/golden/)

| Fichier | Tests | Objet |
|---|---|---|
| `nova-simulation.test.ts` | 26 | Golden mono-tour + multi-round (3 tours), déterminisme, valeurs économiques verrouillées |
| `bots.test.ts` | 24 | Déterminisme par profil, comportements distinctifs, production adaptative, décisions enrichies |
| `carried-over-decisions.test.ts` | 19 | Reconduction champ par champ (récurrents vs ponctuels), documentation exhaustive |
| `resolve-game-round.test.ts` | 5 | Double résolution concurrente, libération du verrou, ordre pedagogy→scoring, invariant TN |
| `error-paths.test.ts` | 10 | Partie introuvable, mauvais utilisateur, partie terminée, tirage de carte, nommage d'équipe |
| `game-view.test.ts` | 14 | Structure GameView tour initial, GameView après résolution, valeurs financières, historique |

## 2. Couverture (v8)

| Fichier / Dossier | Stmts | Branch | Funcs | Lines |
|---|---|---|---|---|
| **Total** | **85.57%** | **73.14%** | **89.41%** | **89.18%** |
| `engine/bots/index.ts` | 60.9% | 43.3% | 81.8% | 62.4% |
| `engine/costs/` | 100% | 77.8% | 100% | 100% |
| `engine/events/` | 98.1% | 88.5% | 100% | 100% |
| `engine/finance/` | 100% | 95.2% | 100% | 100% |
| `engine/inventory/` | 100% | 75% | 100% | 100% |
| `engine/investment/` | 90.6% | 80% | 100% | 96% |
| `engine/market/` | 87.9% | 75% | 90.9% | 100% |
| `engine/production/` | 100% | 75% | 100% | 100% |
| `engine/simulation/` | 97.1% | 90.9% | 96.6% | 98.9% |
| `services/game.service.ts` | 84.8% | 71.2% | 87.6% | 89.1% |
| `services/pedagogy.service.ts` | 81.6% | 63.8% | 87.1% | 86% |

## 3. Golden tests (valeurs verrouillées NOVA, seed 42)

### Tour 1 mono-tour

| Indicateur | Valeur attendue |
|---|---|
| Revenue joueur | 283 200 |
| Variable production cost | 182 400 |
| Operating income | -8 200 |
| Net income | -9 200 |
| Cash | 42 613 |
| FRNG | 16 800 |
| BFR | -25 813 |
| Equity | 140 800 |
| Breakeven units | 5 190 |
| Debt (after 3 rounds) | 68 000 |

### Invariants vérifiés à chaque tour

- TN = FRNG - BFR (précision 4 décimales)
- TN = cash - overdraft (précision 6 décimales)
- Bilan équilibré : actif = passif (précision 2 décimales)
- Déterminisme bit-exact (JSON.stringify)
- Parts de marché ∈ ]0, 1]

## 4. Chemins critiques protégés

| Chemin | Protection |
|---|---|
| Double résolution concurrente | Vérifie qu'aucun tour n'est résolu deux fois (clés roundId:teamId uniques) |
| Verrou optimiste libéré après échec | Tour suivant bien "open" après résolution |
| Ordre pedagogy → scoring | 14 scores BPI (7 dimensions × 2 équipes) présents et normalisés [0, 100] |
| Reconduction des décisions | 7 champs récurrents préservés, 8 champs ponctuels effacés |
| Partie introuvable | submitTeamDecisions, resolveCurrentRound → "Partie introuvable" |
| Mauvais utilisateur | Opérations refusées, getGameView → null |
| Partie terminée | Soumission refusée avec "terminée" |
| Tirage carte enseignant | Seul le créateur, partie non terminée |
| GameView structure | Tous les champs attendus présents au tour 1 et après résolution |
| Bots déterministes | Même context → même décision, 5 profils × 2 exécutions |
| Profils bots distinctifs | Prix, budgets, production conformes aux spécifications par profil |

## 5. Points encore insuffisamment protégés

| Zone | Risque | Priorité |
|---|---|---|
| Branches bots non couvertes (43% branch) | enrichDecisions, adaptation fine des plans de production | Moyenne |
| pedagogy.service.ts branches (64%) | Chemins de débriefing conditionnels, situations pédagogiques spécifiques | Haute |
| game.service.ts mode classe | createClassGame, rejoindre une partie, fermer un tour enseignant | Haute |
| Scénarios hors NOVA | Comportement économique des autres secteurs (hôtel, e-commerce, etc.) | Moyenne |
| Événements économiques | Cartes événements, impact sur la simulation, assurance | Moyenne |
| Études de marché | Achat et consultation des études (market, price, finance, project) | Basse |
| Commandes spéciales | Acceptation/refus, impact sur le CA et la production | Basse |

## 6. État du moteur (engine/**)

```
$ git diff --name-only -- src/engine/
(aucun fichier modifié)
```

**Confirmation : `src/engine/**` n'a subi aucune modification.**

## 7. Fichiers modifiés (Phase 1A)

### Modifiés
- `package.json` — ajout `@vitest/coverage-v8`, script `test:coverage`
- `package-lock.json` — lockfile mis à jour
- `vitest.config.ts` — configuration coverage v8

### Créés
- `tests/golden/nova-simulation.test.ts`
- `tests/golden/bots.test.ts`
- `tests/golden/carried-over-decisions.test.ts`
- `tests/golden/resolve-game-round.test.ts`
- `tests/golden/error-paths.test.ts`
- `tests/golden/game-view.test.ts`

## 8. Proposition de première extraction (Phase 2)

**Extraction recommandée : `decision.service.ts`**

La logique de reconduction des décisions (carried-over) dans `resolveGameRound` (lignes ~700-750 de game.service.ts) est un candidat idéal :

1. **Isolée** : transformation pure de `RoundDecisions` → `RoundDecisions`, sans effet de bord DB
2. **Bien testée** : 19 tests couvrent le comportement champ par champ
3. **Frontière nette** : entrée = décisions du tour précédent, sortie = décisions reconduites
4. **Impact minimal** : un seul point d'appel dans resolveGameRound

Cette extraction ne touche ni le moteur, ni les formules économiques, ni le schéma. Elle réduit resolveGameRound d'environ 50 lignes et crée un module testable indépendamment.

> **Ne pas commencer cette extraction.** Attendre la validation du baseline.
