# 08 — Scoring (Business Performance Index) et niveaux de difficulté

Couvre les points 13 et 14 de la mission n°37 (§20–§21).

---

## 1. Business Performance Index (BPI)

Le score n'est **pas** le résultat financier (§21). Le BPI est un composite 0–100,
recalculé à chaque tour et agrégé en fin de partie, avec les pondérations par défaut
imposées (paramétrables par scénario via `ScoringConfig`, Σ = 1) :

| Dimension | Poids | Mesures agrégées (codes KPI, doc 06) |
|---|---|---|
| Performance économique | 30 % | résultat d'exploitation, EBE, évolution du résultat |
| Performance financière | 20 % | trésorerie nette, FRNG−BFR piloté, endettement, non-recours au découvert |
| Performance commerciale | 15 % | CA, croissance, part de marché, fidélité/satisfaction |
| Performance opérationnelle | 10 % | taux d'utilisation, ruptures évitées, productivité, qualité |
| Rentabilité | 10 % | Re, Rf, profitabilité (distinctes — §17) |
| Qualité stratégique | 10 % | cohérence inter-tours des décisions (voir §1.3), positionnement tenu, réaction aux événements |
| Maîtrise des modèles de décision | 5 % | scores des `model_choices` + qualité des diagnostics |

### 1.1 Normalisation

Chaque mesure est normalisée en 0–100 par **double référence** :

- `benchmark` du scénario (`{min, target}` par KPI) : rend le score signifiant en solo ;
- position relative aux concurrents de la partie (rang percentile) en compétition.

`normalized = 0.5 × versusBenchmark + 0.5 × versusPeers` (pondération dans `ScoringConfig` ;
en solo contre bots, les bots servent de pairs). Fonctions bornées et monotones, testées.

### 1.2 Pénalité d'indices

Les indices ne touchent que les composantes pédagogiques : le **score de chaque situation**
subit le malus cumulé (doc 03 §4), ce qui affecte « maîtrise des modèles » et la partie
diagnostic de « qualité stratégique ». Les 6 dimensions économiques restent le reflet exact
de la performance simulée — on n'appauvrit jamais l'entreprise pour cause d'aide demandée.

### 1.3 Mesures « méta » (§21, fin)

- **Qualité du diagnostic** : justesse des causes cochées dans les situations (vs causes
  effectives lisibles dans `EngineTrace`).
- **Pertinence du modèle** : `ModelEvaluation.finalScore` =
  `relevance × (0.5 + 0.3 × justificationScore + 0.2 × coherence)`, plafonné à
  `acceptable` si `hinted` (indice niveau 4 utilisé). Une décision juste avec un modèle
  `misleading` garde un bon score économique mais un mauvais score de maîtrise (§7).
- **Cohérence des décisions** : détecteurs simples et documentés — ex. positionnement
  premium (prix > réf) avec budget qualité nul deux tours de suite ; marketing massif en
  pleine rupture de capacité ; investissement de capacité à taux d'utilisation < 60 %.
  Chaque incohérence détectée est aussi une **occasion pédagogique** (feedback au débrief).
- **Capacité à expliquer les résultats** : au débrief, le joueur relie les écarts à des
  causes (mini-quiz d'attribution) ; le taux de bonnes attributions entre dans « qualité
  stratégique ».

### 1.4 Agrégation de partie et classement

`BPI(partie) = Σ_t poids(t) × BPI(t)` avec des poids croissants (par défaut linéaires :
le tour 6 pèse plus que le tour 1 — on juge la trajectoire d'apprentissage, pas le départ).
`game_rankings` fige le classement à la fin (tie-breakers : BPI, puis dimension financière,
puis trésorerie finale — doc 04).

---

## 2. Les six niveaux (§20) — des presets d'un système paramétrique

La difficulté n'est **pas** un entier : c'est un `DifficultyProfile` (doc 06 §1) dont les
six niveaux nommés sont des préréglages. Un scénario peut interpoler (NOVA passe de
DÉCOUVERTE à GESTION en cours de partie).

| Paramètre | 1 DÉCOUVERTE | 2 GESTION | 3 PILOTAGE | 4 ARBITRAGE | 5 STRATÉGIE | 6 EXECUTIVE |
|---|---|---|---|---|---|---|
| Décisions actives | prix, production, marketing | + appro, qualité | + délais, financement, budget | + investissement, RH | + multi-produits, export | tout |
| KPI visibles | CA, résultat, trésorerie, stock | + marges, part de marché, seuil | + FRNG, BFR, ratios | + écarts budgétaires | + signaux faibles seulement | brut, non commenté |
| Qualité de l'info (`infoQuality`) | 1,0 (études fiables) | 0,9 | 0,8 | 0,6 (bruit) | 0,4 (incomplet) | 0,25 + délais |
| Indices (`hintMaxLevel`) | 5 | 5 | 3 | 3 | 2 (quota) | 0 |
| Concurrents | 2 bots doux | 2–3 bots | 3 bots actifs | 4 bots réactifs | humains + bots | humains |
| Événements (`eventIntensity`) | scriptés seulement | ×0,5 | ×1 | ×1,25 | ×1,5 | ×2 + crises |
| Délai des conséquences | immédiat | court | inertie qualité/fidélité | + effets retard finance | longs | longs + irréversibles |
| Interdépendance & contraintes | faibles | moyennes | réelles | fortes | fortes | maximales |
| Pression temporelle | aucune | aucune | optionnelle | échéances | échéances courtes | strictes |

Règles d'architecture :

- Le moteur économique ignore la difficulté sauf via des **paramètres effectifs**
  (`eventIntensity`, bruit d'info appliqué aux études fournies — jamais aux résultats réels).
- Le déblocage progressif (décisions, KPI) est appliqué par la couche services/présentation
  (ADR-15) et par `decision_options.unlocked_from_difficulty`.
- La progression du joueur (profil, niveaux réussis) conditionne l'accès recommandé aux
  niveaux supérieurs (non bloquant en mode apprentissage, bloquant en concours).
