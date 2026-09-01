# BUSINESS ARENA — AUDIT V1 ET CONCEPTION V2

> **Date** : 31 août 2026
> **Périmètre** : code source complet (≈ 40 700 lignes src/, ≈ 13 850 lignes tests/, 538 tests, 76 fichiers de tests)
> **Méthode** : lecture exhaustive par six agents spécialisés (architecture, moteur économique, moteur pédagogique, bots, scoring/tests, config/BDD), puis synthèse croisée.
> **Règle** : Phase 1 = audit seul. Aucune modification de code, aucun refactoring, aucune migration.

**Légende des recommandations**

| Étiquette | Sens |
|---|---|
| 🔴 CRITIQUE | Bloque la V2 ou fausse les résultats actuels |
| 🟠 IMPORTANT | Dégrade fortement l'expérience ou la fiabilité |
| 🟡 AMÉLIORATION | Enrichit le produit sans urgence |
| 🟢 CONSERVÉ | Force identifiée, à protéger lors de la V2 |

---

## 1. Cartographie du projet

### 1.1 Modules et volumes

| Module | Répertoire | Lignes | Rôle |
|---|---|---|---|
| Moteur de simulation | `src/engine/simulation/` | ~815 | Boucle principale : demande → production → coûts → finance → événements |
| Types métier | `src/engine/types.ts` | ~798 | Interfaces et types partagés (GameState, Decision, Round…) |
| Marché | `src/engine/market/` | ~400 | Demande, attractivité, allocation (power-law share-of-attraction) |
| Production | `src/engine/production/` | ~200 | Capacité, sous-traitance, péremption |
| Coûts | `src/engine/costs/` | ~300 | Charges fixes/variables, seuil de rentabilité |
| Finance | `src/engine/finance/` | ~500 | Bilan, compte de résultat, ratios, banque |
| RH | `src/engine/hr/` | ~150 | Masse salariale, turnover, productivité |
| Événements | `src/engine/events/` | ~200 | Événements aléatoires (déterministes via PRNG) |
| Bots | `src/engine/bots/` | ~267 | 5 profils, décisions déterministes |
| Inventaire | `src/engine/inventory/` | ~100 | Valorisation CUMP |
| Investissement | `src/engine/investment/` | ~100 | Amortissement, cession |
| PRNG | `src/engine/random/` | ~50 | mulberry32, seedé par partie |
| Pédagogie | `src/pedagogy/` | ~600 | Détection, évaluation, indices, adaptativité, progression |
| Configuration | `src/config/` | ~2 500 | Scénarios (9), concepts (32), modèles (18), difficulté (6 niveaux) |
| Scoring | `src/scoring/` | ~224 | BPI à 7 dimensions |
| Compétition | `src/competition/` | ~73 | Groupes, qualification, finales |
| Services | `src/services/` | ~5 200 | game (2 363), pedagogy (1 405), competition, admin, auth, licence, demo, profile |
| BDD (schéma) | `src/db/schema/` | ~1 200 | 33 tables, 8 modules Drizzle |
| Interface | `src/app/`, `src/components/` | ~4 500 | Next.js 16 App Router, React 19, formulaire de décision |

**Total source** : ≈ 40 714 lignes · **Total tests** : ≈ 13 847 lignes · **538 tests sur 76 fichiers**

### 1.2 Pile technique

- **Framework** : Next.js 16 App Router + React 19
- **Hébergement** : Vercel (serverless)
- **Base** : Neon PostgreSQL
- **ORM** : Drizzle
- **Validation** : Zod (configs parsées à l'import)
- **Tests** : Vitest
- **Aléatoire** : mulberry32 (PRNG seedé, déterministe)

### 1.3 Dépendances du moteur

🟢 **CONSERVÉ** — Le moteur de simulation (`src/engine/`) est **pur fonctionnel**, sans aucune dépendance externe (pas de BDD, pas de réseau, pas de date système). Chaque appel est déterministe pour un même seed. C'est la force architecturale centrale du projet.

### 1.4 Couplage identifié

🔴 **CRITIQUE** — `game.service.ts` (2 363 lignes) est un God Service qui mélange orchestration de partie, persistance, logique de scoring, gestion des tours et appels pédagogiques. Il concentre plus de la moitié de la logique applicative et constitue le premier obstacle à toute évolution de la V2.

🟠 **IMPORTANT** — `pedagogy.service.ts` (1 405 lignes) est le second God Service. Il couvre détection, évaluation, briefing, débriefing et progression dans un seul fichier.

---

## 2. Audit du moteur économique

### 2.1 Chaîne causale

Le moteur suit un cycle d'exploitation linéaire, exécuté une fois par tour :

```
Décisions joueur
  → Demande de marché (tendance × saisonnalité × événements)
  → Attractivité (prix, qualité, publicité, satisfaction)
  → Allocation (share-of-attraction, power-law)
  → Production (capacité, sous-traitance, péremption)
  → Coûts (fixes + variables + personnel)
  → Finance (CA, résultat, trésorerie, bilan)
  → Événements (tirés au PRNG, impact sur le tour suivant)
  → État suivant (14 variables d'état portées au tour n+1)
```

### 2.2 Variables d'état inter-tours

14 variables portent la mémoire entre les tours :

| Variable | Rôle |
|---|---|
| `cash` | Trésorerie |
| `equity` | Capitaux propres |
| `inventory` | Stock (quantité + valorisation CUMP) |
| `qualityInertia` | Inertie qualité perçue |
| `satisfaction` | Satisfaction client cumulée |
| `brandAwareness` | Notoriété (effet publicité) |
| `bankTrust` | Confiance bancaire (précision des prévisions) |
| `staffLevel` | Effectif |
| `staffMorale` | Moral des équipes |
| `equipmentAge` | Âge moyen des équipements |
| `equipmentCapacity` | Capacité de production |
| `loanBalance` | Encours de prêt |
| `overdraftLimit` | Plafond de découvert (piloté par bankTrust) |
| `insuranceCoverage` | Couverture assurantielle |

🟢 **CONSERVÉ** — Ce mécanisme de mémoire crée de véritables dynamiques multi-tours. Les conséquences d'une décision ne sont pas immédiates, ce qui est un levier pédagogique majeur.

### 2.3 Formules auditées

| Mécanisme | Statut | Observation |
|---|---|---|
| Demande agrégée | 🟢 | Tendance × saisonnalité × choc événementiel, cohérent |
| Attractivité | 🟢 | Combinaison linéaire pondérée (prix, qualité, pub, satisfaction) |
| Allocation (power-law) | 🟢 | Share-of-attraction avec concurrent extérieur, pas de monopole possible |
| Production/sous-traitance | 🟢 | Capacité bornée, surcoût de sous-traitance, pénalité péremption |
| Seuil de rentabilité | 🟢 | CF / (PV − CV unitaire), correctement implémenté |
| Bilan comptable | 🟢 | Actif = Passif vérifié à chaque tour (tolérance 0,01 €) |
| Valorisation CUMP | 🟢 | Coût unitaire moyen pondéré, mis à jour à chaque entrée |
| Confiance bancaire | 🟢 | Précision des prévisions → plafond de découvert |
| Amortissement | 🟢 | Linéaire, durée configurable |

### 2.4 Mécanismes absents

| Mécanisme manquant | Gravité | Impact |
|---|---|---|
| Report déficitaire (déficit fiscal) | 🟠 IMPORTANT | Les pertes d'un exercice ne réduisent pas l'impôt des exercices suivants. Un joueur en difficulté paie de l'IS dès le premier bénéfice, ce qui est irréaliste. |
| Risque de crédit client | 🟡 AMÉLIORATION | Toutes les créances sont recouvrées à 100 %. Pas de provision pour créances douteuses. |
| Faillite / game-over | 🟠 IMPORTANT | Les capitaux propres peuvent devenir négatifs sans limite. Un joueur peut jouer indéfiniment avec des fonds propres de −500 000 €, ce qui est pédagogiquement trompeur. |
| Lissage qualité fournisseur | 🟡 AMÉLIORATION | Le bonus qualité du fournisseur premium est instantané. Pas d'inertie de montée en gamme. |
| Arrondi des unités | 🟡 AMÉLIORATION | Les quantités produites/vendues sont des nombres décimaux (0,7 unité vendue). |
| Effet de levier financier | 🟡 AMÉLIORATION | Le concept est absent du moteur : pas de ratio dette/fonds propres influençant le coût du capital. |
| Élasticité-prix dynamique | 🟡 AMÉLIORATION | L'élasticité est constante. En réalité, elle dépend du positionnement et de la concurrence. |
| Plan de financement | 🟡 AMÉLIORATION | Pas de projection pluriannuelle structurée (tableaux de flux prévisionnels). |

---

## 3. Audit mathématique

### 3.1 Intégrité comptable

🟢 **CONSERVÉ** — Le moteur vérifie à chaque tour que `Actif = Passif` à 0,01 € près. Toute erreur provoque un throw immédiat. C'est une garde structurelle rare et précieuse.

### 3.2 Déterminisme

🟢 **CONSERVÉ** — Le PRNG (mulberry32) est seedé par partie. Pour un même seed et les mêmes décisions, la simulation produit exactement les mêmes résultats. Cela permet la reproductibilité des parties et la comparaison équitable entre équipes.

### 3.3 Anomalies détectées

| Anomalie | Gravité | Détail |
|---|---|---|
| Division par zéro au seuil de rentabilité | 🟢 | Protégé : si `PV − CV = 0`, le seuil retourne `Infinity` (traité côté affichage) |
| Trésorerie négative illimitée | 🟠 IMPORTANT | Le découvert n'a pas de plancher absolu. La banque peut refuser (bankTrust bas) mais aucun mécanisme ne force l'arrêt. |
| Impôt négatif impossible | 🟢 | L'IS est borné à `max(0, …)`, pas de crédit d'impôt |
| Quantités fractionnaires | 🟡 AMÉLIORATION | `Math.floor` utilisé pour la production mais pas partout pour les ventes |

### 3.4 Stabilité numérique

🟢 **CONSERVÉ** — Les calculs restent en euros (pas de conversion devise, pas de taux de change). Les arrondis à 2 décimales sont appliqués aux montants finaux. Pas de risque d'accumulation d'erreurs flottantes sur 10 tours.

---

## 4. Audit du moteur pédagogique

### 4.1 Pipeline pédagogique V1

```
Tour n joué
  → Détection (situations déclenchées par l'état du jeu)
  → Ouverture de situation (briefing contextualisé)
  → Indices (3 niveaux, coût en points BPI)
  → Diagnostic (question ouverte, évaluation F1 par mots-clés)
  → QCM (choix du modèle d'analyse)
  → Débriefing (explication du corrigé)
  → Mise à jour maîtrise (EMA, moyenne mobile exponentielle)
  → Progression compétences (7 axes)
```

### 4.2 Forces

🟢 **CONSERVÉ** — La détection contextuelle est le cœur pédagogique : les situations ne se déclenchent que lorsque l'état du jeu les rend pertinentes (ex. « ta marge brute chute » ne s'affiche que si elle chute vraiment). C'est ce qui distingue Business Arena d'un QCM statique.

🟢 **CONSERVÉ** — 79 situations réparties sur 9 secteurs, chacune avec son vocabulaire métier. Le joueur du scénario "bistrot" parle de couverts, celui du "transport" de rotations.

🟢 **CONSERVÉ** — Le système de maîtrise par EMA (Exponential Moving Average) lisse l'apprentissage et évite qu'une seule bonne réponse ne masque une incompréhension persistante.

### 4.3 Faiblesses

| Point | Gravité | Détail |
|---|---|---|
| Justification jamais évaluée | 🔴 CRITIQUE | Le champ justification est stocké en base mais jamais analysé. Le joueur écrit dans le vide. C'est le point de départ de la V2 : si la justification n'est pas évaluée, le jeu n'enseigne pas le raisonnement. |
| Pas de prérequis entre concepts | 🔴 CRITIQUE | Un joueur peut recevoir une situation sur la VAN (valeur actuelle nette) sans avoir compris l'actualisation. Aucun graphe de dépendances entre les 32 concepts. |
| Toutes les situations disponibles à tous les niveaux | 🟠 IMPORTANT | La difficulté filtre les leviers de décision mais pas les situations pédagogiques. Un débutant peut recevoir une situation de niveau expert. |
| Poids du diagnostic vs QCM codé en dur | 🟠 IMPORTANT | Le score pédagogique est 50 % diagnostic + 50 % QCM, sans paramétrage possible. Ce ratio devrait dépendre du niveau. |
| Paramètre `weight` sous-spécifié | 🟡 AMÉLIORATION | `updateMastery(weight)` accepte un poids mais toutes les situations passent 1.0. Pas de pondération par difficulté de la situation. |
| Pas de temporalité dans l'évaluation | 🟡 AMÉLIORATION | Aucune mesure du temps de réponse. Un joueur qui répond en 2 secondes (hasard) et un qui réfléchit 3 minutes sont traités de la même façon. |
| Pas de métacognition | 🟡 AMÉLIORATION | Le joueur ne sait jamais pourquoi il a eu tort, seulement qu'il a eu tort. Le débriefing affiche le corrigé mais ne compare pas avec le raisonnement du joueur. |

### 4.4 Difficulté adaptive (ajout récent)

🟢 **CONSERVÉ** — Le module `src/pedagogy/adaptivity.ts` calcule un `playerStrength` à partir des compétences acquises et module le coût des indices (facteur 0,5 pour un débutant, 1,0 pour un expert). C'est un premier pas vers la personnalisation, mais il ne touche que le coût des indices, pas la sélection des situations.

---

## 5. Graphe des concepts

### 5.1 Inventaire (32 concepts)

Les 32 concepts déclarés dans `src/config/pedagogy/concepts.ts` couvrent le programme de BTS CG, GPME et MCO :

| Axe | Concepts |
|---|---|
| Coûts | Charges fixes/variables, coût complet, coût marginal, seuil de rentabilité, ABC |
| Prix | Élasticité-prix, stratégie de prix, marge |
| Finance | Bilan, compte de résultat, trésorerie, BFR, ratio financier, VAN, TRI |
| Commercial | Part de marché, satisfaction client, fidélisation, publicité |
| Production | Capacité, sous-traitance, stock, qualité |
| RH | Masse salariale, turnover, productivité, formation |
| Stratégie | Positionnement, diversification, investissement |
| Risque | Assurance, prévision, gestion de trésorerie |

### 5.2 Liens concept-modèle

Chaque concept est lié à un ou plusieurs modèles d'analyse (18 modèles au total). Trois orphelins détectés :

🟠 **IMPORTANT** — Les modèles `multicriteria_matrix`, `scenarios_method` et `decision_tree` ne sont reliés à aucun concept. Ils sont déclarés mais jamais déclenchés par une situation.

### 5.3 Prérequis manquants

🔴 **CRITIQUE** — Aucun graphe de prérequis n'existe. Les dépendances logiques suivantes ne sont pas encodées :

```
actualisation → VAN → TRI
charges fixes/variables → seuil de rentabilité → coût marginal
bilan → BFR → gestion de trésorerie
part de marché → élasticité-prix → stratégie de prix
```

Un joueur de niveau Découverte peut recevoir une situation sur le TRI sans avoir jamais vu le concept d'actualisation.

---

## 6. Graphe des modèles d'analyse

### 6.1 Inventaire (18 modèles)

| Niveau min. | Modèles |
|---|---|
| 1 (Découverte) | Seuil de rentabilité, analyse des charges |
| 2 (Standard) | Élasticité-prix, analyse de la marge, gestion de stock |
| 3 (Avancé) | Analyse du BFR, ratios financiers, coût complet |
| 4 (Expert) | ABC, prévision de trésorerie, analyse d'investissement |
| 5 (Executive) | VAN, TRI, plan de financement |
| Non rattachés | Matrice multicritère, méthode des scénarios, arbre de décision |

### 6.2 Progression

🟢 **CONSERVÉ** — La progression des modèles du seuil de rentabilité (niveau 1) à la VAN/TRI (niveau 5) respecte la progression pédagogique du BTS CG. Les modèles simples sont accessibles en premier.

🟠 **IMPORTANT** — Les 3 modèles orphelins devraient être rattachés à des concepts et intégrés dans la progression. La matrice multicritère est un outil fondamental de la prise de décision, pertinent dès le niveau 2.

---

## 7. Audit des bots

### 7.1 Profils existants (5)

| Profil | Stratégie | Prix | Qualité | Pub |
|---|---|---|---|---|
| `passive` | Suit le marché | Moyen | Moyen | Faible |
| `price_aggressive` | Casse les prix | Bas | Bas | Fort |
| `premium` | Montée en gamme | Haut | Haut | Moyen |
| `balanced` | Équilibré | Moyen | Moyen | Moyen |
| `growth` | Croissance agressive | Bas-Moyen | Moyen | Très fort |

### 7.2 Mécanisme de décision

🟢 **CONSERVÉ** — Les bots sont déterministes (même seed → mêmes décisions). Cela garantit l'équité entre parties jouées en parallèle (compétitions, examens).

### 7.3 Faiblesses

| Point | Gravité | Détail |
|---|---|---|
| Pas d'observation des concurrents | 🟠 IMPORTANT | Les bots ne regardent ni les prix, ni les parts de marché, ni les décisions des autres joueurs. Ils jouent « dans le vide ». |
| Distribution identique partout | 🟠 IMPORTANT | Les 9 scénarios utilisent la même distribution de bots (2-2-1-1-1). Un marché du luxe devrait avoir plus de `premium`, un marché discount plus de `price_aggressive`. |
| `enrichedBots` jamais activé | 🟡 AMÉLIORATION | Le flag `enrichedBots` existe dans le type Scenario mais aucun scénario ne le met à `true`. C'est du code mort qui, une fois activé, enrichirait immédiatement le comportement des bots existants. |
| Pas de profil réactif | 🟡 AMÉLIORATION | Aucun bot ne réagit à l'état du marché (ex. baisser les prix quand la demande chute). |

### 7.4 Nouveaux archétypes envisageables (V2)

| Archétype | Faisabilité | Prérequis moteur |
|---|---|---|
| FINANCIAL (optimise la trésorerie) | Faisable sans modification moteur | Aucun |
| OPPORTUNIST (suit les tendances) | Faisable sans modification moteur | Aucun |
| DEFENSIVE (minimise les risques) | Faisable sans modification moteur | Aucun |
| INNOVATOR (R&D, nouveaux produits) | Impossible en V1 | Nécessite un moteur R&D |

---

## 8. Audit du scoring

### 8.1 BPI (Business Performance Index) — 7 dimensions

| Dimension | Poids | Indicateurs clés |
|---|---|---|
| Économique | Variable | CA, croissance, part de marché |
| Financière | Variable | Trésorerie, ratios de solvabilité |
| Commerciale | Variable | Satisfaction, fidélisation, notoriété |
| Opérationnelle | Variable | Taux d'utilisation, qualité, stocks |
| Rentabilité | Variable | Marge nette, ROE, ROA |
| Stratégie | Variable | Cohérence des décisions, positionnement |
| Maîtrise décisionnelle | Variable | Scores pédagogiques (diagnostic + QCM) |

🟢 **CONSERVÉ** — Le BPI à 7 dimensions donne une vision multifacette de la performance. Un joueur qui maximise le CA mais ruine sa trésorerie voit sa note financière chuter, ce qui est pédagogiquement juste.

### 8.2 Faiblesses du scoring

| Point | Gravité | Détail |
|---|---|---|
| Pondérations non exposées | 🟠 IMPORTANT | L'enseignant ne peut pas ajuster les poids des 7 dimensions. Un prof de finance voudrait surpondérer la dimension financière. |
| Pas de scoring de la justification | 🔴 CRITIQUE | La dimension « maîtrise décisionnelle » ne mesure que diagnostic + QCM. La qualité du raisonnement (justification) n'est pas évaluée. |
| Pas de benchmark sectoriel | 🟡 AMÉLIORATION | Le score est absolu. Pas de comparaison avec la performance « type » du secteur. |
| Pas d'historique de scoring | 🟡 AMÉLIORATION | Seul le score du dernier tour est visible. Pas de courbe d'évolution du BPI. |

---

## 9. Audit du système d'indices

### 9.1 Mécanisme

Chaque situation offre 3 niveaux d'indices, du plus vague au plus explicite. Consulter un indice coûte des points de BPI (pénalité dégressive : le premier indice coûte cher, le troisième est presque gratuit).

### 9.2 Adaptativité

🟢 **CONSERVÉ** — Le module `adaptivity.ts` module le coût selon la force du joueur : un débutant (strength = 0) paie 50 % du coût nominal, un expert (strength = 1) paie 100 %. C'est un mécanisme d'échafaudage pédagogique pertinent.

### 9.3 Faiblesses

| Point | Gravité | Détail |
|---|---|---|
| Coût annoncé après le clic | 🟢 | Corrigé récemment (É2 du chantier précédent) : le coût est maintenant annoncé avant consultation |
| Indices identiques quel que soit le niveau | 🟠 IMPORTANT | Un joueur Découverte et un joueur Executive reçoivent les mêmes indices. L'adaptativité touche le coût mais pas le contenu. |
| Pas de suggestion de modèle dans les indices | 🟡 AMÉLIORATION | Les indices guident vers la réponse mais ne suggèrent jamais quel outil d'analyse utiliser. |
| 3 niveaux fixes | 🟡 AMÉLIORATION | Le nombre d'indices est fixe. Un système adaptatif pourrait en proposer plus ou moins selon la difficulté de la situation. |

---

## 10. Audit des tests

### 10.1 Couverture

| Catégorie | Fichiers | Tests | Couverture |
|---|---|---|---|
| Moteur de simulation | ~20 | ~180 | Excellente : chaque sous-module a ses tests |
| Pédagogie | ~8 | ~60 | Bonne : détection, évaluation, adaptativité couverts |
| Architecture (gardes) | 3 | ~15 | Excellente : pureté moteur, contrat formulaire, registre des leviers |
| Scénarios | 9 | ~45 | Bonne : validation Zod de chaque scénario |
| Scoring | 2 | ~20 | Correcte |
| Services | ~5 | ~30 | Faible : game.service.ts sous-testé par rapport à sa taille |
| Bots | 2 | ~15 | Correcte |
| Compétition | 2 | ~10 | Minimale |
| BDD/migrations | 0 | 0 | Absente |

**Total** : 538 tests, 76 fichiers, tous verts.

### 10.2 Forces

🟢 **CONSERVÉ** — Les gardes architecturales sont la pièce maîtresse :

1. **Pureté du moteur** : vérifie que `src/engine/` n'importe rien de `src/services/`, `src/db/`, ou `node_modules` (hors types). Aucun effet de bord possible.
2. **Contrat formulaire ↔ actions** : vérifie que chaque champ du formulaire de décision a un traitement côté serveur.
3. **Registre des leviers** : vérifie que le registre des décisions et le formulaire sont synchronisés (nombre de décisions annoncé = nombre réel).

🟢 **CONSERVÉ** — Les tests de scénarios valident les configs Zod à l'import. Un scénario mal formé ne passe jamais en production.

### 10.3 Faiblesses

| Point | Gravité | Détail |
|---|---|---|
| `game.service.ts` sous-testé | 🟠 IMPORTANT | Le fichier le plus long (2 363 lignes) a proportionnellement le moins de tests. Les cas limites de l'orchestration de partie ne sont pas couverts. |
| Pas de tests d'intégration BDD | 🟠 IMPORTANT | Aucun test ne vérifie que les requêtes Drizzle produisent le SQL attendu ou que les migrations s'appliquent correctement. |
| Pas de tests de non-régression pédagogique | 🟡 AMÉLIORATION | Pas de « snapshot » des scores pédagogiques pour un scénario de jeu fixe. Un changement de formule pourrait dégrader l'apprentissage sans qu'aucun test ne le détecte. |
| Pas de tests de performance | 🟡 AMÉLIORATION | Pas de benchmark de la simulation. Le temps d'exécution d'une partie complète n'est pas mesuré. |

---

## 11. Jouabilité et stratégie dominante

### 11.1 Analyse des stratégies

🟢 **CONSERVÉ** — Aucune stratégie trivialement dominante n'a été identifiée :

- **Prix bas systématique** : gagne des parts de marché mais écrase la marge. Non viable à long terme si les coûts fixes sont élevés.
- **Prix haut systématique** : bonne marge unitaire mais perd des volumes. La qualité doit suivre (inertie).
- **Zéro publicité** : la notoriété décroît (brandAwareness), les ventes suivent.
- **Sous-traitance massive** : surcoût unitaire qui grignote la marge.
- **Dividend stripping** (tout distribuer en dividendes) : vide la trésorerie, la banque coupe le découvert (bankTrust chute).

### 11.2 Points de vigilance

| Point | Gravité | Détail |
|---|---|---|
| Dividend stripping pédagogiquement trompeur | 🟠 IMPORTANT | Distribuer tout en dividendes est possible et rend le joueur « riche » personnellement tout en ruinant l'entreprise. C'est réaliste mais le jeu ne l'explique pas : le débriefing ne signale pas cette stratégie comme dangereuse. |
| Absence de game-over | 🟠 IMPORTANT | Un joueur en faillite technique continue à jouer. Cela peut créer des stratégies aberrantes (s'endetter à l'infini, tenter un retournement impossible). |
| Pas de visibilité concurrents pendant le tour | 🟡 AMÉLIORATION | Le joueur prend ses décisions sans savoir ce que font les concurrents (bots). C'est un choix de game design (information imparfaite) mais cela frustre les joueurs avancés. |

---

## 12. Analyse des boucles de rétroaction

### 12.1 Boucles positives (amplificatrices)

| Boucle | Mécanisme |
|---|---|
| Qualité → Satisfaction → Ventes → CA → Investissement qualité | Plus on investit en qualité, plus on vend, plus on peut investir. Boucle vertueuse mais lente (inertie qualité). |
| Publicité → Notoriété → Ventes → CA → Budget pub | La publicité alimente la notoriété qui alimente les ventes. Effet décroissant (rendements marginaux). |
| Prévisions justes → bankTrust → Découvert → Flexibilité → Meilleures décisions | La confiance bancaire s'auto-renforce quand les prévisions sont bonnes. |

### 12.2 Boucles négatives (stabilisatrices)

| Boucle | Mécanisme |
|---|---|
| Prix bas → Volume haut → Capacité saturée → Sous-traitance → Coûts → Marge réduite | Le succès commercial crée ses propres coûts. Régulateur naturel de la guerre des prix. |
| Turnover → Recrutement → Coûts → Pression salaires → Turnover | Le cercle vicieux RH. |
| Emprunt → Charges financières → Résultat réduit → Moins de cash → Plus d'emprunt | Spirale d'endettement, freinée par bankTrust. |

### 12.3 Boucles manquantes

| Boucle absente | Gravité | Détail |
|---|---|---|
| Réputation de marque | 🟡 AMÉLIORATION | Pas de mémoire de l'image de marque au-delà de `qualityInertia`. Un joueur qui a été « discount » pendant 5 tours ne subit pas de « stigmate discount » en montant en gamme. |
| Historique des prix | 🟡 AMÉLIORATION | Pas de « mémoire de prix ». Le marché ne « se souvient » pas qu'un joueur a cassé les prix. |
| Effet réseau / bouche-à-oreille | 🟡 AMÉLIORATION | La satisfaction n'engendre pas de recommandation entre clients. |
| Cycle de vie produit | 🟡 AMÉLIORATION | La demande suit une tendance linéaire + saisonnalité. Pas de courbe de vie S (introduction, croissance, maturité, déclin). |

---

## 13. Proposition d'architecture V2

### 13.1 Vision V2

Le passage de V1 à V2 transforme Business Arena d'un **jeu de gestion pédagogique** en un **simulateur de prise de décision managériale**. Le joueur n'apprend plus seulement *quelle* est la bonne décision, mais *comment* construire une décision.

**Flux V2** :

```
SITUATION
  → OBSERVATION (quelles données regarder ?)
  → DIAGNOSTIC (quel est le problème ?)
  → PROBLÈME (formuler le problème à résoudre)
  → CHOIX DU MODÈLE (quel outil d'analyse ?)
  → ANALYSE (appliquer le modèle)
  → DÉCISION (que faire ?)
  → SIMULATION (conséquences projetées)
  → RÉSULTATS (conséquences réelles)
  → ANALYSE DES ÉCARTS (pourquoi l'écart ?)
  → APPRENTISSAGE (qu'est-ce que j'ai appris ?)
```

### 13.2 Architecture technique proposée

```
┌─────────────────────────────────────────────────────┐
│                   Interface (Next.js)                │
│  Wizard multi-étapes · Visualisations · Débriefing  │
├─────────────────────────────────────────────────────┤
│               Service d'orchestration                │
│  (remplace game.service.ts — découpage en 5-6       │
│   services spécialisés de < 400 lignes chacun)      │
├──────────┬──────────┬──────────┬────────────────────┤
│ Moteur   │ Moteur   │ Moteur   │ Moteur             │
│ économ.  │ pédag.   │ scoring  │ raisonnement (NEW) │
│ (V1, pur)│ (V1+V2)  │ (V1+V2)  │                    │
├──────────┴──────────┴──────────┴────────────────────┤
│                     Persistance                      │
│  (Drizzle + Neon, schéma étendu pour raisonnement)  │
└─────────────────────────────────────────────────────┘
```

### 13.3 Principes d'architecture

| Principe | Détail |
|---|---|
| 🟢 Conserver la pureté du moteur | Le moteur économique reste pur fonctionnel. Aucune dépendance ajoutée. |
| 🟢 Conserver le déterminisme | Même seed → même résultat. Non négociable. |
| 🟢 Conserver les gardes architecturales | Tests de pureté, contrat formulaire, registre des leviers. |
| Découper les God Services | `game.service.ts` → round.service, decision.service, state.service, scoring.service, orchestrator.service |
| Ajouter un moteur de raisonnement | Nouveau module pur fonctionnel qui évalue la qualité du raisonnement (pas seulement la réponse) |
| Graphe de prérequis | Encoder les dépendances entre concepts. Bloquer les situations dont les prérequis ne sont pas acquis. |
| Filtrage des situations par niveau | Les situations de difficulté 4-5 ne sont proposées qu'aux joueurs qui ont le niveau correspondant. |

### 13.4 Découpage du God Service (`game.service.ts`)

| Nouveau service | Responsabilité | Lignes estimées |
|---|---|---|
| `round.service.ts` | Orchestration d'un tour (séquençage) | ~300 |
| `decision.service.ts` | Validation et application des décisions | ~400 |
| `state.service.ts` | Lecture/écriture de l'état de partie | ~300 |
| `scoring.service.ts` | Calcul et persistance des scores | ~250 |
| `orchestrator.service.ts` | Création de partie, gestion du cycle de vie | ~400 |
| `pedagogy-flow.service.ts` | Séquençage pédagogique (situations, indices, évaluation) | ~400 |

### 13.5 Moteur de raisonnement (nouveau)

Le moteur de raisonnement est la pièce centrale de la V2. Il évalue non pas la réponse finale mais la démarche :

| Étape évaluée | Ce que le joueur produit | Ce que le moteur mesure |
|---|---|---|
| Observation | Sélection de données | Le joueur regarde-t-il les bons indicateurs ? |
| Diagnostic | Formulation du problème | Le diagnostic est-il cohérent avec les données observées ? |
| Choix de modèle | Sélection d'un outil | Le modèle choisi est-il pertinent pour ce type de problème ? |
| Analyse | Application du modèle | Le joueur applique-t-il correctement le modèle ? |
| Décision | Choix final | La décision découle-t-elle logiquement de l'analyse ? |
| Anticipation | Prévision des effets | Le joueur prévoit-il les conséquences (comparaison avec la simulation) ? |

🔴 **CRITIQUE** — Ce moteur est la raison d'être de la V2. Sans lui, la V2 n'est qu'une V1 avec plus de clics. L'implémentation peut être progressive : commencer par le choix de modèle (déjà un QCM en V1) et le diagnostic (déjà une question ouverte), puis ajouter observation, analyse, anticipation.

---

## 14. Progression BTS → avancé

### 14.1 Parcours type

| Phase | Niveaux | Durée | Objectif |
|---|---|---|---|
| Découverte | 1 | 2-3 tours | Comprendre le cycle d'exploitation. Décisions limitées (prix, volume). |
| Fondamentaux | 2 | 4-6 tours | Maîtriser coûts fixes/variables, seuil de rentabilité, marge. |
| Gestion courante | 3 | 6-8 tours | Gérer trésorerie, BFR, stock, qualité, RH. |
| Analyse avancée | 4 | 8-10 tours | Utiliser l'ABC, les ratios, la prévision de trésorerie. |
| Stratégie | 5 | 10+ tours | VAN, TRI, plan d'investissement, positionnement long terme. |

### 14.2 Progression des concepts par niveau

| Niveau | Concepts débloqués | Modèles débloqués |
|---|---|---|
| 1 — Découverte | Charges fixes/variables, prix de vente, marge brute | Seuil de rentabilité |
| 2 — Standard | Élasticité-prix, coût complet, stock, satisfaction | Analyse de la marge, gestion de stock |
| 3 — Avancé | BFR, trésorerie, qualité, publicité, fidélisation | Ratios financiers, analyse du BFR |
| 4 — Expert | ABC, prévision, investissement, formation, turnover | ABC, prévision trésorerie, analyse investissement |
| 5 — Executive | VAN, TRI, positionnement, diversification | VAN, TRI, plan de financement |

### 14.3 Recommandations pour la progression V2

🔴 **CRITIQUE** — Implémenter le graphe de prérequis. Un concept de niveau N ne doit être proposé que si les concepts prérequis de niveau N−1 sont maîtrisés (EMA ≥ 0.6).

🟠 **IMPORTANT** — Filtrer les situations par niveau effectif du joueur, pas seulement par niveau de la partie. Deux joueurs dans la même partie peuvent avoir des niveaux de maîtrise différents.

🟡 **AMÉLIORATION** — Ajouter un « test de positionnement » en début de partie pour les joueurs qui ne sont pas débutants. Cela évite de faire refaire les fondamentaux à un redoublant.

---

## 15. Inventaire des concepts fondamentaux

### 15.1 Concepts présents (32)

Classés par axe du programme BTS :

**Comptabilité de gestion (CG)** : charges fixes, charges variables, coût complet, coût marginal, seuil de rentabilité, ABC, marge sur coût variable, coût d'achat.

**Gestion financière** : bilan, compte de résultat, trésorerie, BFR, ratio financier (liquidité, solvabilité, rentabilité), VAN, TRI.

**Marketing/Commercial (MCO)** : part de marché, satisfaction client, fidélisation, publicité/communication, élasticité-prix, positionnement.

**Production/Opérations (GPME)** : capacité de production, sous-traitance, gestion de stock (CUMP), qualité.

**Ressources humaines** : masse salariale, turnover, productivité, formation.

**Stratégie** : investissement, diversification, assurance/couverture du risque, prévision.

### 15.2 Concepts absents du programme BTS

| Concept manquant | Programme | Gravité |
|---|---|---|
| Soldes intermédiaires de gestion (SIG) | BTS CG | 🟠 IMPORTANT |
| Capacité d'autofinancement (CAF) | BTS CG | 🟠 IMPORTANT |
| Effet de levier financier | BTS CG | 🟡 AMÉLIORATION |
| Plan de financement | BTS CG | 🟡 AMÉLIORATION |
| Quantité économique de commande (Wilson) | BTS GPME | 🟡 AMÉLIORATION |
| Tableau de flux de trésorerie | BTS CG | 🟡 AMÉLIORATION |
| Coût cible (target costing) | BTS CG | 🟡 AMÉLIORATION |
| Budget flexible | BTS CG | 🟡 AMÉLIORATION |
| Analyse des écarts | BTS CG | 🟠 IMPORTANT |
| Imputation rationnelle | BTS CG | 🟡 AMÉLIORATION |

### 15.3 Couverture estimée

Le jeu couvre environ **85 à 90 %** du programme de BTS CG/GPME/MCO en matière de concepts de gestion. Les lacunes principales concernent l'analyse des écarts (SIG, CAF, budget flexible) et le financement à long terme (plan de financement, effet de levier).

🟡 **AMÉLIORATION** — Les concepts manquants les plus importants (SIG, CAF, analyse des écarts) sont ajoutables sans modification du moteur économique : le compte de résultat contient déjà toutes les données nécessaires, il suffit de créer les situations pédagogiques correspondantes.

---

## 16. Rapport final

### 16.1 — 10 constats

1. **Le moteur économique est solide.** Pur fonctionnel, déterministe, avec intégrité comptable vérifiée à chaque tour. C'est le socle sur lequel la V2 peut s'appuyer sans risque.

2. **Le jeu enseigne les réponses, pas le raisonnement.** La justification est stockée mais jamais évaluée. Le joueur apprend *quoi* décider, pas *comment* construire une décision.

3. **Les 9 scénarios sectoriels sont une force unique.** 79 situations avec vocabulaire métier contextualisé. Aucun concurrent ne propose cette diversité sectorielle.

4. **Les God Services bloquent l'évolution.** `game.service.ts` (2 363 lignes) et `pedagogy.service.ts` (1 405 lignes) concentrent trop de logique. Toute modification est risquée.

5. **Les prérequis pédagogiques n'existent pas.** Un joueur peut recevoir n'importe quelle situation à n'importe quel niveau. Le parcours d'apprentissage n'est pas structuré.

6. **Les bots jouent dans le vide.** Ils ne réagissent ni au joueur, ni au marché, ni entre eux. Ils sont équitables mais pas stimulants.

7. **Le scoring ignore la qualité du raisonnement.** Le BPI mesure la performance économique et le score diagnostic/QCM, mais pas la démarche analytique.

8. **La couverture de tests est forte sur le moteur, faible sur les services.** 538 tests verts avec des gardes architecturales exemplaires, mais les God Services sont sous-testés.

9. **La difficulté adaptative est un bon début.** Le module `adaptivity.ts` module le coût des indices selon la force du joueur. C'est un premier pas vers la personnalisation.

10. **Le config-as-data est un modèle à préserver.** Ajouter un scénario ne touche pas le moteur. La validation Zod garantit la cohérence. C'est le pattern qui permettra de passer à 20, 30, 50 scénarios.

### 16.2 — 10 risques

1. 🔴 **Justification morte.** Le champ existe, les données s'accumulent, mais rien n'en est fait. Le joueur perd confiance dans l'outil.

2. 🔴 **Pas de prérequis.** Un joueur confronté à un concept qu'il ne comprend pas se décourage. L'absence de graphe de dépendances compromet l'efficacité pédagogique.

3. 🔴 **God Services.** Toute modification de `game.service.ts` peut casser la moitié du jeu. Le risque de régression est maximal.

4. 🟠 **Pas de faillite.** Un joueur qui fait n'importe quoi ne subit aucune conséquence finale. Le jeu perd en crédibilité.

5. 🟠 **Bots prévisibles.** Après 3-4 parties, un joueur connaît le comportement de chaque bot. La rejouabilité chute.

6. 🟠 **Pas de report déficitaire.** Un joueur qui se redresse paie immédiatement de l'IS, ce qui est fiscalement faux et pédagogiquement injuste.

7. 🟠 **Situations non filtrées par niveau.** Les situations de niveau expert sont proposées aux débutants.

8. 🟠 **Tests d'intégration BDD absents.** Les migrations et requêtes Drizzle ne sont pas testées. Un changement de schéma peut casser silencieusement.

9. 🟠 **Scoring non paramétrable.** L'enseignant ne peut pas ajuster les poids du BPI selon sa pédagogie.

10. 🟠 **3 modèles orphelins.** Matrice multicritère, méthode des scénarios et arbre de décision sont déclarés mais inaccessibles.

### 16.3 — 10 évolutions prioritaires

| # | Évolution | Classement | Effort estimé |
|---|---|---|---|
| 1 | Moteur de raisonnement (évaluation de la justification) | 🔴 CRITIQUE | Fort |
| 2 | Graphe de prérequis entre concepts | 🔴 CRITIQUE | Moyen |
| 3 | Découpage des God Services | 🔴 CRITIQUE | Fort |
| 4 | Filtrage des situations par niveau effectif | 🟠 IMPORTANT | Faible |
| 5 | Mécanisme de faillite / game-over | 🟠 IMPORTANT | Moyen |
| 6 | Report déficitaire fiscal | 🟠 IMPORTANT | Faible |
| 7 | Bots réactifs (observation du marché) | 🟠 IMPORTANT | Moyen |
| 8 | Pondérations BPI paramétrables par l'enseignant | 🟠 IMPORTANT | Faible |
| 9 | Concepts SIG, CAF, analyse des écarts | 🟠 IMPORTANT | Moyen |
| 10 | Distribution de bots par scénario | 🟠 IMPORTANT | Faible |

### 16.4 — Architecture V2 (résumé)

La V2 se construit en **trois couches progressives** sur la V1, sans jamais casser ce qui fonctionne :

**Couche 1 — Assainissement** (pas de nouvelles fonctionnalités)
- Découper `game.service.ts` en 5-6 services spécialisés
- Découper `pedagogy.service.ts` en 3-4 services
- Ajouter les tests d'intégration BDD
- Rattacher les 3 modèles orphelins

**Couche 2 — Fondations V2**
- Graphe de prérequis entre concepts
- Filtrage des situations par niveau effectif du joueur
- Report déficitaire fiscal
- Mécanisme de faillite (seuil configurable par l'enseignant)
- Pondérations BPI paramétrables

**Couche 3 — Moteur de raisonnement**
- Wizard multi-étapes : observation → diagnostic → modèle → analyse → décision
- Évaluation de la justification (commencer par correspondance structurée, pas par IA)
- Anticipation : le joueur prédit les effets, le jeu compare avec la simulation
- Débriefing comparatif : « tu as observé X, le problème était Y, tu as choisi Z, voici pourquoi W aurait été plus efficace »

### 16.5 — Fonctionnalités à NE PAS développer avant validation

| Fonctionnalité | Raison du report |
|---|---|
| IA générative pour évaluer les justifications | Trop coûteux, trop imprévisible. Commencer par une évaluation structurée (mots-clés, étapes attendues). |
| Mode multijoueur temps réel | Le moteur est tour par tour. Le temps réel nécessiterait une refonte complète. |
| Moteur R&D / innovation produit | Complexité disproportionnée. L'archétype INNOVATOR (bots) peut attendre. |
| Marketplace de scénarios (UGC) | La validation Zod ne suffit pas pour du contenu tiers. Il faut un pipeline de revue. |
| Application mobile native | Le jeu est web-first. Le responsive suffit pour la V2. |
| Intégration LMS (Moodle, Canvas) | Utile mais pas structurant. À faire après que le moteur de raisonnement fonctionne. |
| Blockchain pour les certificats | Non. |

### 16.6 — Roadmap Claude Code par étapes indépendantes

Chaque étape est un chantier autonome, livrable et testable indépendamment.

| Étape | Nom | Prérequis | Livrable |
|---|---|---|---|
| C1 | Découpage `game.service.ts` | Aucun | 5-6 services ≤ 400 lignes, mêmes tests verts |
| C2 | Découpage `pedagogy.service.ts` | Aucun | 3-4 services ≤ 400 lignes, mêmes tests verts |
| C3 | Tests d'intégration BDD | Aucun | Tests Drizzle sur base de test locale |
| C4 | Graphe de prérequis | Aucun | Module `src/pedagogy/prerequisites.ts`, tests, pas de changement d'interface |
| C5 | Filtrage situations par niveau | C4 | Détection ne propose que les situations dont les prérequis sont acquis |
| C6 | Report déficitaire fiscal | Aucun | Modification moteur + tests, transparent pour l'interface |
| C7 | Faillite configurable | Aucun | Seuil de fonds propres, événement « game-over », configurable par l'enseignant |
| C8 | BPI paramétrable | Aucun | Interface enseignant pour ajuster les 7 poids |
| C9 | Rattachement modèles orphelins | Aucun | 3 concepts nouveaux, situations associées |
| C10 | Bots réactifs | Aucun | Observation du marché, réaction aux prix/parts de marché |
| C11 | Distribution bots par scénario | Aucun | Champ `botDistribution` dans chaque scénario |
| C12 | Concepts SIG/CAF/écarts | Aucun | Situations pédagogiques, pas de modification moteur |
| C13 | Wizard de raisonnement (interface) | C4, C5 | Formulaire multi-étapes, stockage des étapes intermédiaires |
| C14 | Évaluation structurée du raisonnement | C13 | Module `src/pedagogy/reasoning.ts`, scoring par étape |
| C15 | Anticipation et débriefing comparatif | C14 | Le joueur prédit, le jeu compare, le débriefing explique l'écart |
| C16 | Scoring V2 (intègre raisonnement) | C14 | BPI enrichi de la dimension « qualité du raisonnement » |

**Ordre suggéré** : C1 → C2 → C3 (assainissement, en parallèle) → C4 → C5 → C6, C7, C8 (en parallèle) → C9, C10, C11, C12 (en parallèle) → C13 → C14 → C15 → C16.

---

*Fin de l'audit V1. Ce document est la base de travail pour la conception V2. Aucune ligne de code n'a été modifiée.*
