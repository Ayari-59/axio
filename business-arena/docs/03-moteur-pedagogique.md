# 03 — Moteur pédagogique : situations, concepts, modèles de décision, indices

Couvre les points 4, 10, 11 et 12 de la mission n°37 (§3–§7, §23–§24, §27–§28 du cahier
des charges).

Principe fondamental (§3) : le joueur rencontre **d'abord une situation d'entreprise**,
jamais un exercice académique. Le moteur pédagogique transforme les sorties chiffrées du
moteur économique en parcours de raisonnement : situation → problème → diagnostic → choix
du modèle → décision → analyse → apprentissage.

---

## 1. Architecture du moteur pédagogique (`src/pedagogy`)

```
pedagogy/
├── situations/   instanciation des situations d'un tour (scriptées ou détectées)
├── models/       évaluation du choix de modèle (matrice de pertinence)
├── hints/        machine à indices 5 niveaux, coûts, traçabilité
├── debrief/      analyse post-tour : écarts, causes candidates, concepts mobilisés
└── progress/     maîtrise des concepts, profil de compétences joueur
```

Dépendances : types du moteur économique (lecture des `RoundResult` et `EngineTrace`)
et référentiels (concepts, modèles, situations) fournis en entrée. Aucune dépendance DB/UI.

### 1.1 Situations

Une **situation** est la mise en scène d'un problème de gestion. Deux origines :

- **Scriptée** par le scénario : « au tour 3 de NOVA, la croissance tend la trésorerie »
  (garantie par la calibration du scénario, doc 07).
- **Détectée** : des règles de détection (`SituationTrigger`, même langage de conditions que
  les événements) observent les résultats : `TN < 0 && résultat > 0` ⇒ situation
  « rentable mais illiquide » ; `LostSales > 10% × ventes` ⇒ situation « rupture ».

Contenu d'une situation (données, en base) :

```
situation = {
  code, titleKey, narrativeKey,        // "Votre CA progresse de 25 % mais votre trésorerie…"
  problemStatementKey,                 // question OUVERTE ("identifiez les causes possibles"),
                                       // jamais "calculez le BFR" (§3)
  diagnosticOptions[],                 // causes candidates proposées au joueur (QCM raisonné,
                                       // avec des leurres plausibles), + champ libre
  relevantModels[],                    // matrice modèle → pertinence (voir §3)
  concepts[],                          // concepts mobilisés (→ progression)
  hints[5],                            // les 5 niveaux d'indices (voir §4)
  difficulty, weight                   // pondération dans le score de diagnostic
}
```

### 1.2 Déroulé d'une situation côté joueur

1. **Observation** : la situation s'affiche avec les données débloquées à son niveau.
2. **Diagnostic** : le joueur qualifie le problème (options + justification libre).
3. **Choix du modèle** : il choisit le ou les modèles d'analyse à mobiliser (liste ouverte
   sur tout le référentiel, pas seulement les « bons » — sinon la réponse est donnée).
4. **Atelier d'analyse** : l'UI ouvre l'outil du modèle choisi (ex. calculateur FRNG/BFR
   pré-rempli des données disponibles) — le joueur manipule, le moteur pédagogique observe.
5. **Décision** : il saisit ses décisions du tour, avec une justification courte.
6. **Après simulation** : débriefing (voir §5).

---

## 2. Référentiel des concepts — les 20 du MVP (point 10)

Le référentiel complet (§5 du cahier des charges, ~90 notions) est chargé en base dès le
MVP (table `concepts`, seed) : c'est de la donnée, pas du code. Les **20 concepts activés
dans NOVA** (fiches rédigées, situations et indices reliés, suivis dans la progression) :

| # | Concept | Domaine | # | Concept | Domaine |
|---|---|---|---|---|---|
| 1 | Demande et part de marché | Marché | 11 | Seuil de rentabilité | Seuils |
| 2 | Élasticité-prix | Marché | 12 | Point mort | Seuils |
| 3 | Prix psychologique | Marché | 13 | Marge de sécurité | Seuils |
| 4 | Saisonnalité | Marché | 14 | Capacité et taux d'utilisation | Production |
| 5 | Chiffre d'affaires (prix × volume) | Commercial | 15 | Stocks et rupture | Production |
| 6 | Panier segment / segmentation | Commercial | 16 | Productivité | Production |
| 7 | Coûts fixes | Coûts | 17 | FRNG | Finance |
| 8 | Coûts variables | Coûts | 18 | BFR | Finance |
| 9 | Marge sur coût variable | Marges | 19 | Trésorerie nette | Finance |
| 10 | Taux de marge / taux de marque | Marges | 20 | Profitabilité vs rentabilité | Rentabilité |

Chaque concept (table `concepts`) : code, nom, domaine, définition, explication progressive
(3 profondeurs : intuition / méthode / formalisation), formules, erreurs fréquentes,
concepts préalables (graphe de prérequis), niveau de difficulté d'introduction.

## 3. Référentiel des modèles de décision (point 11, §6–§7)

Entité `decision_models` — les 18 du MVP :

1. Analyse de l'élasticité · 2. Prix psychologique · 3. Analyse coût-volume-profit ·
4. Seuil de rentabilité · 5. Analyse marginale · 6. Analyse des coûts pertinents ·
7. Analyse FRNG/BFR · 8. Budget de trésorerie · 9. Analyse des écarts ·
10. Matrice multicritère · 11. Analyse de sensibilité · 12. Scénarios · 13. VAN · 14. TRI ·
15. Arbre de décision · 16. Analyse de rentabilité · 17. Analyse de productivité ·
18. Analyse de capacité.

Structure (imposée §6) : nom, description, objectif, situations pertinentes, concepts
associés, **données nécessaires** (liste de clés de données du jeu — sert à pré-remplir
l'atelier d'analyse), formule éventuelle, niveau de difficulté, erreurs fréquentes,
indices spécifiques, exemples.

### 3.1 Évaluer la compétence « choisir le bon modèle » (§7)

Matrice de pertinence portée par chaque situation (`situation_models`) :

| relevance | Sens | Exemple (commande exceptionnelle sous le prix habituel) |
|---|---|---|
| `optimal` (1.0) | Le bon outil | Coûts pertinents / analyse marginale |
| `acceptable` (0.6) | Éclaire partiellement | Marge sur coût variable, seuil de rentabilité |
| `misleading` (0.2) | Conduit au contresens classique | **Coût complet** (fait refuser une commande contributive) |
| `irrelevant` (0.0) | Hors sujet | Budget de trésorerie |

Score de la phase modèle (détail doc 08) : pertinence du modèle choisi × qualité de la
justification (auto-évaluée par mots-clés au MVP, par LLM à l'étape 12) × cohérence entre
l'analyse produite dans l'atelier et la décision prise. **Une décision juste obtenue avec
un modèle `misleading` rapporte moins qu'une décision raisonnée** (§7) : la composante
« maîtrise des modèles » du BPI est indépendante du résultat économique.

---

## 4. Système d'indices — règles (point 12, §4)

Machine à états par (équipe × situation), 5 niveaux **strictement séquentiels** :

| Niveau | Nature | Exemple (trésorerie) | Coût (× poids situation) |
|---|---|---|---|
| 1 | Observation | « Examinez les éléments qui ont évolué depuis le dernier tour » | 5 % |
| 2 | Question | « Quel élément du cycle d'exploitation a fortement augmenté ? » | 10 % |
| 3 | Concept | « Réfléchissez au financement du cycle d'exploitation » | 20 % |
| 4 | Modèle | « Une analyse FRNG/BFR pourrait être pertinente » | 35 % |
| 5 | Méthode | « Calculez le FRNG, puis le BFR, déduisez la trésorerie nette » | 55 % |

Règles :

1. Déblocage un par un, dans l'ordre, sur demande explicite du joueur ; chaque déblocage est
   **tracé** (`hint_usages` : qui, quand, quel niveau) et **irréversible**.
2. Le coût s'applique au **score pédagogique de la situation**, jamais aux résultats
   économiques : utiliser un indice n'appauvrit pas l'entreprise virtuelle. Les coûts sont
   les pourcentages de malus cumulés ci-dessus (un joueur allé jusqu'au niveau 5 conserve
   45 % du score de la situation — apprendre avec de l'aide vaut mieux que ne pas apprendre).
3. La **disponibilité** des niveaux dépend du profil de difficulté (doc 08) : niveaux 1–5 en
   DÉCOUVERTE/GESTION, 1–3 en PILOTAGE/ARBITRAGE, 1–2 limité en STRATÉGIE, aucun en EXECUTIVE.
   Le mode compétition peut imposer un **quota global** d'indices par partie.
4. Les textes d'indices sont des données de la situation (ou par défaut du modèle de
   décision associé), avec interpolation de valeurs **déjà visibles** du joueur — un indice
   ne révèle jamais une donnée masquée par le niveau de difficulté.
5. Le niveau 4 (modèle) marque la situation : si le joueur choisit ensuite ce modèle, la
   composante « choix du modèle » est plafonnée (le choix a été soufflé).

## 5. Débriefing post-tour (§23) et mode apprentissage (§24)

`pedagogy/debrief` produit, à partir de `RoundResult` + `EngineTrace` + prévisions du joueur :

1. Résultats du tour ; 2. écarts vs prévisions du joueur (saisies à la décision) ;
3. comparaison anonymisée aux concurrents ; 4. décomposition des écarts (volume / prix /
coût — analyse des écarts standard) ; 5. causes candidates issues de la trace (« la demande
du segment étudiant a chuté après votre passage au-dessus de 20 € ») ; 6. concepts mobilisés
avec lien vers les fiches ; 7. modèle pertinent (révélé après coup, avec la matrice) ;
8. feedback qualitatif ; 9. recommandation d'attention pour le tour suivant (jamais la
décision elle-même).

Mode apprentissage (§24) : indices disponibles, fiches concepts consultables en jeu,
**tour rejouable** (re-simulation locale de la même graine avec d'autres décisions,
marquée « bac à sable », non scorée), débriefing complet.
Mode compétition : voir doc 04.

## 6. Progression et profil joueur (§28)

- **Maîtrise par concept** (`learning_progress`) : score 0–100 par (joueur, concept), mis à
  jour par événements pondérés : situation réussie sans indice (+fort), avec indices
  (+faible), diagnostic erroné (−), modèle `misleading` choisi (−), fiche consultée (trace).
  Décroissance lente dans le temps (révision espacée, paramétrable).
- **Profil de compétences** (`player_skills`) : agrégation des concepts par axe —
  Finance, Marketing, Production, Analyse, Stratégie, Décision, Risque — sur 100.
  L'axe « Décision » agrège la compétence de choix de modèle ; « Analyse » la qualité des
  diagnostics ; « Risque » le comportement face à l'incertitude (couverture, sensibilité).
- Le profil alimente la **vue enseignant** (§27) : « ma classe maîtrise-t-elle le BFR ? » =
  distribution de `learning_progress` sur le concept BFR ; « quels modèles sont mal
  utilisés ? » = taux de choix `misleading`/`irrelevant` par modèle.
