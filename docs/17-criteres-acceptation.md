# 17 — Critères d'acceptation

Format Gherkin allégé. Un critère est accepté s'il est vérifiable sans interprétation.

## CA-1 — Compte et isolation

```
Étant donné un visiteur
Quand il crée un compte avec email + mot de passe
Alors une organisation et une session sont créées
Et il accède uniquement à ses propres entreprises

Étant donné deux organisations A et B
Quand un membre de A demande une entreprise de B par son identifiant
Alors la requête est refusée (404), sans révéler l'existence de l'entreprise
```

## CA-2 — Assistant de configuration

```
Étant donné une entreprise nouvellement créée
Quand l'utilisateur complète les 5 étapes
Alors un BusinessModelProfile est enregistré
Et un plan de configuration est proposé, non appliqué

Quand l'utilisateur consulte le plan
Alors chaque élément proposé affiche la règle et la réponse qui l'ont déclenché

Quand l'utilisateur applique le plan
Alors une ConfigurationVersion 1 est créée
Et les dimensions, KPI et règles d'affectation existent en base
Et l'application du même plan une seconde fois ne crée aucun doublon
```

## CA-3 — Adaptation sectorielle (critère central)

```
Étant donné trois entreprises : conseil (temps), industrie (produits), BTP (chantiers)
Quand chacune complète l'assistant
Alors :
  - le conseil obtient : axe Mission + Consultant, capacités timesheets + utilization_rate,
    KPI TJM et taux d'occupation
  - l'industrie obtient : axe Produit + Atelier, capacité production_costing,
    KPI coût unitaire et taux de rebut
  - le BTP obtient : axe Chantier, capacités project_costing + progress_tracking
    + subcontractor_tracking, KPI marge à terminaison et reste à engager
Et aucune des trois ne reçoit les capacités des deux autres
Et les trois cockpits sont deux à deux différents
Et aucun code spécifique à un secteur n'a été exécuté (garde-fou automatisé)
```

## CA-4 — Import

```
Étant donné un fichier CSV français (séparateur ";", montants "1 234,56", dates "31/03/2026")
Quand l'utilisateur le dépose
Alors le séparateur, l'encodage et les formats sont détectés
Et un mapping est proposé avec un score de confiance par colonne

Quand l'utilisateur lance un import à blanc
Alors aucune donnée n'est écrite
Et un rapport annonce : lignes valides, lignes rejetées avec motif, membres à créer

Quand l'utilisateur valide
Alors les écritures sont créées dans une transaction unique
Et l'annulation du lot supprime exactement ces écritures
```

## CA-5 — Coûts

```
Étant donné des charges directes et indirectes et des règles d'affectation
Quand le moteur de coûts s'exécute
Alors la somme des montants affectés égale la somme des charges (écart < 0,01 €)
Et chaque affectation porte sa trace (règle, inducteur, base, montant)
Et le drill-down depuis un objet de coût atteint les écritures sources

Étant donné une charge indirecte de 30 000 € et un inducteur "heures"
  réparti 600 h / 300 h / 100 h
Quand la règle DRIVER s'applique
Alors les montants affectés sont 18 000 € / 9 000 € / 3 000 €
```

## CA-6 — Marges et seuil

```
Étant donné un objet de coût avec CA 100 000 €, coûts variables 60 000 €,
  coûts fixes directs 15 000 €, indirects affectés 12 000 €
Alors MCV = 40 000 € (40 %), marge contributive = 25 000 €, marge opérationnelle = 13 000 €

Étant donné des coûts fixes de 300 000 € et un taux de MCV de 40 %
Alors le seuil de rentabilité vaut 750 000 €
Et le point mort est exprimé en jours d'activité
Et le levier opérationnel vaut MCV / résultat
```

## CA-7 — Écarts

```
Étant donné le cas d'école de tests/variance.test.ts
  produit A : budget 1 000 u × 10 € = 10 000 ; réel 1 200 u × 9,50 € = 11 400
  produit B : budget 1 000 u × 20 € = 20 000 ; réel   700 u × 21,00 € = 14 700
Alors écart total = 26 100 − 30 000 = −3 900 €
Et écart sur prix   = 1 200 × (9,50 − 10) + 700 × (21 − 20) = +100 €
Et prix moyen budgété = 30 000 / 2 000 = 15 €
Et écart sur volume = (1 900 − 2 000) × 15 = −1 500 €
Et écart sur mix    = (1 200×10 + 700×20) − 1 900 × 15 = −2 500 €
Et écart prix + écart volume + écart mix = écart total (à 0,01 € près)

Étant donné un centre : AN 10 000 h, f = 40 000 €, v = 3 €/h,
  AR = 9 000 h, AP = 8 500 h, CR = 70 000 €
Alors écart sur budget = 70 000 − (40 000 + 27 000) = +3 000 € (défavorable)
Et écart sur activité = 67 000 − 63 000 = +4 000 € (défavorable)
Et écart sur rendement = 63 000 − 59 500 = +3 500 € (défavorable)
Et la somme égale l'écart total (70 000 − 59 500 = 10 500 €)

Quand l'utilisateur ouvre une composante d'écart
Alors il obtient les contributeurs classés, leur part et le cumul jusqu'à 80 %
Et il peut descendre sur un autre axe puis jusqu'aux écritures
```

## CA-8 — KPI

```
Étant donné un KPI dont la formule référence une mesure inconnue
Alors son enregistrement est refusé avec le nom de la mesure fautive

Étant donné un KPI dont le dénominateur vaut 0
Alors la valeur est "non calculable", jamais NaN ni Infinity

Étant donné une entreprise sans feuilles de temps
Alors le KPI taux d'occupation est affiché en état "donnée manquante"
Avec l'action précise à réaliser pour l'obtenir
```

## CA-9 — Prévision et simulation

```
Étant donné 12 périodes d'historique
Quand l'utilisateur demande un forecast
Alors 6 méthodes sont évaluées par backtest
Et la méthode retenue affiche son MAPE
Et l'utilisateur peut en imposer une autre

Étant donné un scénario "prix +5 %, volume −3 %"
Quand l'utilisateur l'exécute
Alors l'impact est affiché sur CA, marge, résultat, seuil de rentabilité et trésorerie
Et le calcul est identique côté client (aperçu) et côté serveur (enregistrement)
```

## CA-10 — Copilote

```
Étant donné la question "pourquoi ma marge baisse ?"
Alors la réponse contient : la variation chiffrée, sa décomposition,
  les contributeurs principaux, un lien vers le calcul
Et tous les nombres de la réponse proviennent du moteur

Étant donné une question portant sur une mesure indisponible
Alors le copilote répond explicitement qu'il ne dispose pas de la donnée
Et propose l'action permettant de l'obtenir

Étant donné AI_PROVIDER=local et aucune clé d'API
Alors toutes les fonctions du copilote restent opérationnelles
```

## CA-11 — Qualité des données

```
Étant donné un jeu contenant doublons, périodes manquantes, coûts directs non affectés
Alors chaque défaut est détecté, compté, et lié aux lignes concernées
Et un score global sur 100 est affiché
Et les analyses produites affichent un indice de confiance dégradé
```

## CA-12 — Mode pédagogique

```
Étant donné n'importe quel indicateur affiché
Quand l'utilisateur demande l'explication
Alors il obtient : définition, formule, données utilisées, interprétation, limites
Et les données utilisées sont celles réellement employées pour ce chiffre
```

## CA-13 — Performance

```
Étant donné 200 000 écritures sur 24 périodes
Alors un recalcul complet s'exécute en moins de 3 secondes
Et un affichage de cockpit en moins de 500 ms grâce au cache d'empreinte
```

## CA-14 — Traçabilité

```
Étant donné toute mutation de configuration, de budget ou d'import
Alors un enregistrement d'audit conserve l'acteur, l'action, l'entité et le diff
Et aucune configuration antérieure n'est perdue
```
