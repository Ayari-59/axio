# 16 — Stratégie de tests

## 1. Pourquoi les tests portent d'abord sur le cœur

Dans un produit de contrôle de gestion, un bug d'interface coûte une gêne ; un bug de calcul coûte
la confiance, définitivement. La pyramide est donc volontairement déséquilibrée vers le bas :

```
        ▲  E2E / parcours          (peu nombreux, sur les 3 profils)
       ███  Intégration services   (transactions, isolation, import)
     ██████ Unitaires du cœur      (la majorité : math, règles, moteurs)
```

`core/**` étant pur, ces tests ne nécessitent **ni base de données ni serveur**.

## 2. Niveaux

### N1 — Tests unitaires du cœur (Vitest)

| Cible | Ce qui est vérifié |
|---|---|
| `money` | arrondis, conservation de la masse, répartition du résidu |
| `rules` | déterminisme, opérateurs, priorités, trace, cas positifs **et** négatifs par règle |
| `costing` | classement, méthodes d'affectation, multi-étages, ABC, semi-variables |
| `budget` | prix + volume + mix = écart total ; budget + activité + rendement = écart total ; sens favorable/défavorable |
| `kpi` | analyseur de formules (précédence, parenthèses, fonctions), division par zéro, mesures inconnues |
| `analytics` | forecast (cas exacts sur séries construites), MAPE, seuil de rentabilité, levier, what-if |
| `quality` | chaque contrôle détecte son défaut et ne produit pas de faux positif sur un jeu propre |
| `copilot` | reconnaissance d'intention sur 40 formulations françaises, sélection des outils |
| `import` | séparateurs, encodages, formats de date et de montant français, auto-mapping |

### N2 — Tests d'invariants (property-based léger)

Générateurs de jeux d'écritures aléatoires vérifiant des propriétés qui doivent tenir **toujours** :

1. `Σ affectations = Σ charges` (conservation de la masse) ;
2. `Σ marges par objet + non affecté = marge globale` ;
3. décomposition d'écart = écart total (à 0,01 près) ;
4. le résultat d'un calcul est indépendant de l'ordre des écritures ;
5. deux exécutions du même calcul donnent le même résultat (déterminisme) ;
6. aucune valeur `NaN` ni `Infinity` en sortie.

### N3 — Tests des trois profils (test d'architecture)

`tests/three-profiles.test.ts` — le test le plus important du dépôt :

```
Pour chaque profil ∈ { services, industrie, BTP } :
  1. construire le profil métier
  2. exécuter le moteur de règles
  3. appliquer la configuration
  4. injecter le jeu de données du profil
  5. calculer coûts, marges, écarts, KPI
Vérifier :
  a. les capacités attendues sont actives (et les autres non)
  b. les objets de coûts attendus existent avec les bons libellés
  c. les KPI caractéristiques sont calculés (TJM / coût unitaire / marge à terminaison)
  d. les cockpits générés sont deux à deux différents
  e. le code exécuté est identique (même chemin de fonctions)
```

### N4 — Garde-fous d'architecture

| Test | Règle vérifiée |
|---|---|
| `no-sector-in-core` | aucun nom de secteur dans `src/core/**` hors `templates/` |
| `core-is-pure` | aucun import de `prisma`, `next`, `fs`, `node:*` dans `src/core/**` |
| `no-eval` | ni `eval(` ni `new Function(` dans tout `src/` |
| `enums-consistency` | toute valeur écrite en base appartient à l'union TypeScript |

### N5 — Tests d'intégration (services + base)

Base SQLite éphémère par test. Couvre : inscription, isolation multi-tenant (une entreprise ne
voit jamais les données d'une autre), application de configuration transactionnelle, import et
annulation d'import, versionnement budgétaire, empreinte de calcul.

### N6 — Parcours (manuels scriptés au MVP, automatisés en V1)

`docs/17-criteres-acceptation.md` sert de script. Chaque parcours est rejoué sur les trois
entreprises de démonstration avant chaque livraison.

## 3. Jeux de données de référence

| Jeu | Contenu | Sert à |
|---|---|---|
| `fixtures/consulting` | 12 mois, 8 consultants, 14 missions, 9 clients, heures | profil services |
| `fixtures/manufacturing` | 12 mois, 3 ateliers, 6 produits, heures machine, rebuts | profil industriel |
| `fixtures/construction` | 12 mois, 5 chantiers, sous-traitance, avancements | profil BTP |
| `fixtures/dirty` | jeu volontairement sale (doublons, trous, non affectés) | contrôle qualité |
| `fixtures/textbook` | cas d'école à résultat connu à la main | validation des écarts |

Le jeu `textbook` est essentiel : les écarts prix/volume/mix et budget/activité/rendement y sont
calculés à la main dans le fichier de test, avec le détail du calcul en commentaire. Toute
évolution du moteur qui casserait la méthode est immédiatement détectée.

## 4. Couverture visée

| Zone | Couverture ligne | Justification |
|---|---|---|
| `core/costing`, `core/budget`, `core/kpi` | ≥ 90 % | cœur du risque |
| `core/**` global | ≥ 80 % | |
| `services/**` | ≥ 60 % | orchestration |
| `app/**` | non mesurée | rendu |

## 5. Non-régression numérique

Chaque livraison exécute les trois jeux de démonstration et compare les agrégats clés à un
**instantané de référence** (`tests/__snapshots__/aggregates.json`). Toute variation supérieure à
0,01 € doit être explicitement acceptée par un développeur : c'est le filet de sécurité contre les
régressions silencieuses de méthode.

## 6. Ce qui n'est pas testé automatiquement au MVP

- Rendu visuel (revue manuelle).
- Performance à 10⁶ écritures (test de charge en V1).
- Mode LLM (nécessite une clé) : seul le contrôle post-génération est testé, avec des réponses
  simulées.
