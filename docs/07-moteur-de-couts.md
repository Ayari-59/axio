# 07 — Moteur de coûts

## 1. Principe

Un seul moteur couvre toutes les méthodes du cahier des charges. Il ne connaît que trois
opérations : **classer**, **affecter**, **agréger**. Les méthodes (coût complet, coût variable,
ABC, coût par projet, coût standard) sont des **combinaisons paramétrées** de ces opérations.

```
Entries ──▶ [1. CLASSEMENT] ──▶ [2. AFFECTATION multi-étages] ──▶ [3. AGRÉGATION]
             direct/indirect        stage 1 : charges → centres         par nature
             fixe/variable          stage 2 : centres → centres         par centre
                                    stage 3 : centres → objets          par objet de coût
                                                                        par dimension libre
```

## 2. Étape 1 — Classement

Chaque écriture reçoit deux axes de classement, dans cet ordre de priorité :

1. valeur explicite portée par l'écriture (colonne du fichier ou saisie) ;
2. valeur par défaut du compte (`Account.defaultBehavior`, `defaultTraceability`, `defaultNatureCode`) ;
3. valeur par défaut de la nature (dimension `NATURE`) ;
4. repli : `VARIABLE` si l'écriture porte une quantité, `FIXED` sinon ; `DIRECT` si un objet de
   coût est renseigné, `INDIRECT` sinon.

**Plan de comptes.** Un plan par défaut (sous-ensemble du PCG français, classes 6 et 7) est créé
avec la configuration : `core/templates/accounts.ts`. Il ne sert qu'au classement — Axio ne tient
aucune comptabilité générale. La correspondance se fait par **préfixe le plus spécifique** :
un export contenant `611000` est rattaché au compte `611` (sous-traitance → variable, direct).
Chaque entreprise peut modifier ce plan sans toucher au moteur.

### Coûts semi-variables

Décomposition par la **méthode des points extrêmes** (Mini-Maxi), avec repli sur une régression
linéaire si au moins 6 périodes sont disponibles :

```
coût variable unitaire b = (Coût_max − Coût_min) / (Activité_max − Activité_min)
part fixe a              = Coût_max − b × Activité_max
```

Le résultat est stocké comme deux composantes (`FIXED` + `VARIABLE`) dans le calcul, sans
modifier l'écriture d'origine. Si l'activité de référence est absente, l'écriture reste
`SEMI_VARIABLE` et est signalée par le contrôle qualité.

## 3. Étape 2 — Affectation

### 3.1 Méthodes

| Méthode | Formule | Usage |
|---|---|---|
| `DIRECT` | montant → membre porté par l'écriture | charges directes |
| `DRIVER` | `montant × (valeur_inducteur_membre / Σ valeurs_inducteur)` | clés de répartition |
| `PERCENT` | `montant × poids_membre` (Σ poids = 1) | répartitions négociées |
| `EQUAL` | `montant / n` | répartition uniforme |
| `ABC` | ressources → activités → inducteurs → objets | ABC |

Inducteurs disponibles : `driver` (valeurs statistiques importées), `attribute` (attribut du
membre : m², capacité, effectif), `measure` (mesure calculée : CA, heures, marge).

### 3.2 Multi-étages et prestations réciproques

Le stage 2 gère les **centres auxiliaires** qui se fournissent mutuellement (entretien ↔ énergie).
Résolution par le **système d'équations linéaires** classique, en pratique par itération de
point fixe (méthode de Jacobi), avec tolérance 0,01 € et 50 itérations maximum :

```
C_i = D_i + Σ_j (p_ji × C_j)
```
`C_i` coût total du centre i, `D_i` charges directes du centre i, `p_ji` part du centre j
consommée par i. Si la convergence échoue (cycle mal paramétré), le moteur retourne une erreur
explicite plutôt qu'un résultat faux.

### 3.3 Traçabilité

Chaque affectation produit une ligne `CostAllocation` :

```
{ stage, ruleId, sourceKind, sourceRef, targetDimension, targetMember,
  amount, driverKey, driverValue, driverTotal }
```

Invariant vérifié par test : `Σ CostAllocation.amount` par source = montant de la source
(conservation de la masse, tolérance 0,01 €). C'est ce qui rend le drill-down exact et auditable.

## 4. Étape 3 — Agrégation et cascade de marge

Pour tout objet de coût `o` et toute période `p` :

```
CA                          revenue(o,p)
− coûts variables directs   variableDirect(o,p)
= MARGE SUR COÛTS VARIABLES contributionMargin
− coûts fixes directs       fixedDirect(o,p)
= MARGE CONTRIBUTIVE        contributiveMargin        ← marge « décisionnelle »
− coûts indirects affectés  allocatedIndirect(o,p)
= MARGE OPÉRATIONNELLE      operatingMargin           ← marge « coût complet »
```

Taux : `marginRate = margin / revenue`. Contribution : `margin(o) / Σ margin(o)`.

La **marge contributive** est mise en avant dans l'interface : c'est celle qui répond à
« que se passe-t-il si j'arrête cet objet ? », alors que la marge opérationnelle répond à
« cet objet couvre-t-il sa quote-part de structure ? ». Le mode pédagogique explique la
différence à l'écran.

## 5. Méthodes de coût couvertes

| Méthode | Paramétrage |
|---|---|
| Coût complet | stages 1→3 activés, tous les indirects répartis |
| Coût variable (direct costing) | seuls les coûts `VARIABLE` sont affectés aux objets |
| Coût spécifique / direct evolué | variables + fixes directs (marge contributive) |
| Coût marginal | coût du dernier lot : `Δcoût total / Δquantité` sur deux périodes ou deux scénarios |
| ABC | règles `ABC` : ressources → activités (stage 2) → objets par inducteur (stage 3) |
| Coût standard / préétabli | budget de type `STANDARD` fournissant `quantité × prix` par unité |
| Imputation rationnelle | coûts fixes imputés × (activité réelle / activité normale) |

L'imputation rationnelle est un simple coefficient appliqué au stage 3 ; la différence
(coût de chômage ou boni de suractivité) est isolée dans une ligne dédiée.

## 6. Coût par objet dans les trois profils de référence

Le **même** pipeline produit :

| | Conseil | Industrie | BTP |
|---|---|---|---|
| Objet de coût principal | `PROJECT` (mission) | `PRODUCT` | `PROJECT` (chantier) |
| Inducteur dominant | `BILLABLE_HOURS` | `MACHINE_HOURS`, `UNITS_PRODUCED` | `HOURS`, coût direct engagé |
| Coûts directs | salaires consultants affectés | matières, main-d'œuvre directe | matériaux, ST, MO chantier |
| Indirects typiques | structure, commercial, IT | atelier, qualité, ordonnancement | matériel, encadrement, dépôt |
| Sortie caractéristique | coût horaire, marge/mission | coût unitaire, marge/produit | coût à date, marge/chantier |

Aucune ligne de code différente : seules changent les règles d'affectation générées par le
moteur de règles et les inducteurs importés.

## 7. Suivi à l'avancement (capacité `progress_tracking`)

Pour les objets de coût dotés d'un `budgetTotal` et d'un avancement :

```
Avancement physique      α = valeur d'avancement déclarée (0–1)
Coût encouru             CE
Coût à terminaison (EAC) = CE / α                     (si α > 0)
Reste à engager (ETC)    = EAC − CE
Marge à terminaison      = CA à terminaison − EAC
Production à l'avancement (CA reconnu) = CA contractuel × α
Résultat à l'avancement  = CA reconnu − CE
Dérive                   = EAC − budgetTotal
```

Une méthode alternative « cost-to-cost » (α = CE / budget) est proposée quand aucun avancement
physique n'est saisi ; l'écran indique explicitement laquelle est utilisée, car les deux
donnent des résultats très différents en cas de dérive.

## 8. Performance et exactitude

- Tous les montants transitent par `round2()` en sortie, jamais en cours de calcul
  (l'arrondi intermédiaire fausse les répartitions).
- Les répartitions gèrent l'**écart d'arrondi** : le dernier bénéficiaire absorbe le résidu
  pour garantir la conservation de la masse.
- Complexité : O(E + A×M) où E = écritures, A = règles, M = membres cibles.
- Le calcul complet est mémorisé dans `CalculationRun` avec empreinte (cf. doc 04 §6).
