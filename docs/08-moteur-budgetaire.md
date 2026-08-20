# 08 — Moteur budgétaire et analyse des écarts

## 1. Objets budgétaires

| Type (`kind`) | Rôle |
|---|---|
| `BUDGET` | budget initial approuvé, figé |
| `REVISED` | budget révisé (nouvelle version, l'initial reste consultable) |
| `FORECAST` | atterrissage : réel écoulé + prévision du reste de l'année |
| `ROLLING` | prévision glissante sur 12 mois, recalée chaque mois |
| `STANDARD` | coûts et prix préétablis unitaires (base des écarts de la méthode DCG) |

Chaque budget porte un `scenario` (`BASE`, `OPTIMISTIC`, `PESSIMISTIC`) et une `version`.
Un budget `APPROVED` est immuable : toute modification crée la version n+1 (audit trail).

## 2. Budget flexible

Le budget flexible ramène le budget au **niveau d'activité réellement constaté** :

```
Budget flexible(AR) = Coûts fixes budgétés + (coût variable unitaire budgété × Activité réelle)
```

Il est calculé à la volée pour toute comparaison, dès lors que les lignes budgétaires portent
un comportement (`FIXED`/`VARIABLE`) et une quantité. C'est la condition pour distinguer
un écart de **dépense** d'un écart de **volume**.

## 3. Comparaisons

Le moteur produit, pour toute maille (période × dimension × membre × nature) :

```
Réel · Budget · Budget flexible · Forecast · N-1
écart valeur · écart % · sens (favorable / défavorable) · contribution à l'écart total
```

Le **sens** dépend du type de flux : un réel supérieur au budget est favorable pour un produit,
défavorable pour une charge. Le moteur ne se trompe jamais de signe car il utilise `kind`.

## 4. Décomposition des écarts

### 4.1 Écart sur chiffre d'affaires / marge (multi-produits)

Pour un ensemble de produits `i`, quantités `Q`, prix `P`, indices `r` = réel, `b` = budget :

```
Écart total        = Σ Qr_i·Pr_i − Σ Qb_i·Pb_i

Écart sur PRIX     = Σ Qr_i · (Pr_i − Pb_i)

Écart sur VOLUME   = (Qr_total − Qb_total) · P̄b
                     avec P̄b = Σ Qb_i·Pb_i / Qb_total   (prix moyen budgété)

Écart sur MIX      = Σ Qr_total · (mixr_i − mixb_i) · (Pb_i − P̄b)
                     avec mix_i = Q_i / Q_total
```

Propriété vérifiée par test : `Prix + Volume + Mix = Écart total` (à l'arrondi près).
Le même calcul appliqué à la **marge unitaire** au lieu du prix donne la décomposition de
l'écart de marge, qui est la vue affichée par défaut.

### 4.2 Écart sur charges directes

```
Écart total      = Qr·Pr − Qp·Pp            (p = préétabli pour la production réelle)
Écart sur PRIX   = Qr · (Pr − Pp)
Écart sur QUANTITÉ = (Qr − Qp) · Pp
```

### 4.3 Écart sur charges indirectes — méthode des trois écarts

Soit un centre d'analyse : `AN` activité normale, `AR` activité réelle, `AP` activité préétablie
de la production réelle, `f` coûts fixes budgétés, `v` coût variable unitaire budgété,
`CR` coût réel constaté.

```
Budget flexible de l'activité réelle   BF(AR) = f + v·AR
Coût préétabli de l'activité réelle    CP(AR) = (f/AN + v) · AR
Coût préétabli de la production réelle CP(AP) = (f/AN + v) · AP

Écart total          = CR − CP(AP)
  Écart sur BUDGET   = CR − BF(AR)                 (dépense)
  Écart sur ACTIVITÉ = BF(AR) − CP(AR)             (imputation des fixes / chômage)
  Écart sur RENDEMENT= CP(AR) − CP(AP)             (productivité)
```

Propriété vérifiée par test : `Budget + Activité + Rendement = Écart total`.

### 4.4 Écart sur structure (organisation multi-centres)

Quand plusieurs centres contribuent, l'écart global est décomposé en
`Σ écarts par centre` + un **écart de structure** dû au déplacement du poids relatif des centres,
calculé sur le même schéma que l'écart de mix.

## 5. Attribution : du chiffre à la cause

L'analyse des écarts ne s'arrête pas à la décomposition mathématique. Le moteur d'attribution
classe les **contributeurs** :

```
attribution(mesure, période, dimension) →
  [ { membre, écart, contribution %, cumul %, tendance } ] trié par |écart| décroissant
```

Il produit alors une phrase de synthèse déterministe :

> « 3 contributeurs expliquent 82 % de la dégradation : Chantier Alba (−41 k€),
>   Chantier Bréa (−18 k€), Sous-traitance gros œuvre (−12 k€). »

Le seuil « 80 % » et le nombre de contributeurs sont des paramètres, pas des constantes codées.

## 6. Drill-down multidimensionnel

Chaque composante d'écart est **navigable** :

```
Écart de marge −4,2 %
 └─ Mix −1,8 pt
     └─ par PRODUIT
         └─ Gamme B −1,1 pt
             └─ par CLIENT
                 └─ Client Delta −0,7 pt
                     └─ écritures sources (liste, export)
```

Techniquement : à chaque niveau, le moteur relance la même fonction de décomposition en
ajoutant un filtre dimensionnel. Il n'existe donc **qu'une** implémentation, pas une par écran.
L'ordre des axes de descente est proposé par le moteur (axe le plus discriminant d'abord,
mesuré par la dispersion des écarts) mais reste modifiable par l'utilisateur.

## 7. Construction d'un budget

Trois modes, cumulables :

1. **Depuis l'historique** — réel N-1 × coefficient, avec saisonnalité conservée.
2. **Depuis les inducteurs** — quantités prévues × prix/coûts standards (budget « base zéro » léger).
3. **Saisie directe** — grille période × ligne, avec répartition automatique
   (linéaire, saisonnière, ou selon un profil de référence).

Le budget est saisissable **par périmètre** : un responsable opérationnel ne voit et ne remplit
que ses centres, puis soumet (`SUBMITTED`) ; le contrôleur consolide et approuve (`APPROVED`).

## 8. Rolling forecast

À la clôture de la période `m`, le moteur produit automatiquement un budget `ROLLING` :

```
Forecast(m+1..m+12) = réel(m−11..m) ajusté par la méthode de prévision retenue
                      + carnet de commandes connu (si dimension CONTRACT alimentée)
```

L'utilisateur peut figer, ajuster ligne à ligne, ou remplacer par des hypothèses.
Chaque ajustement manuel est conservé et tracé (qui, quand, pourquoi).

## 9. Alerte budgétaire

Trois déclencheurs, tous exprimés en règles (doc 06) :

| Type | Condition par défaut |
|---|---|
| Dépassement constaté | `réel > budget × 1,10` sur une période close |
| Dépassement projeté | `EAC > budget` (objets à l'avancement) |
| Épuisement | `budget consommé % > avancement % + 15 pts` |
