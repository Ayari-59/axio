# 13 — Wireframes des écrans principaux

Wireframes en ASCII : ils décrivent la **structure d'information**, pas le style.

## W1 — Assistant, étape 2 (modèle économique)

```
┌────────────────────────────────────────────────────────────────────────┐
│ Configuration de Delta Conseil                       Étape 2 / 5  ●●○○○ │
├────────────────────────────────────────────────────────────────────────┤
│ Comment gagnez-vous de l'argent ?                                       │
│                                                                         │
│ Ce que vous vendez         [ Prestations ▾]                             │
│ Comment vous facturez      [x] Heure  [x] Journée  [ ] Forfait          │
│                            [ ] Abonnement  [ ] Commission  [ ] Avancement│
│ Part de récurrent          [────●──────] 25 %                           │
│ Saisonnalité               ( ) faible  (●) modérée  ( ) forte           │
│                                                                         │
│ Structure de coûts (total 100 %)                                        │
│   Masse salariale          [──────────●──] 62 %                         │
│   Achats / matières        [──●──────────]  8 %                         │
│   Sous-traitance           [───●─────────] 12 %                         │
│   Structure                [────●────────] 18 %                         │
│                                                                         │
│ Vos facteurs de marge      [x] Taux d'occupation [x] Prix de vente      │
│                            [ ] Coût matière      [ ] Productivité       │
│                                                                         │
│         [ Retour ]                              [ Continuer → ]         │
└────────────────────────────────────────────────────────────────────────┘
```

## W2 — Revue du plan de configuration

```
┌────────────────────────────────────────────────────────────────────────┐
│ Voici le système de pilotage proposé                                    │
├──────────────────────────────┬─────────────────────────────────────────┤
│ CE QUI VA ÊTRE CRÉÉ          │ POURQUOI                                │
│ ─────────────────────────────│─────────────────────────────────────────│
│ [x] Axe « Mission »          │ Vous facturez à la journée (étape 2)    │
│ [x] Axe « Client »           │ Objet de pilotage coché (étape 4)       │
│ [x] Axe « Consultant »       │ Marge par personne (objectif n°2)       │
│ [x] Feuilles de temps        │ Facturation au temps → heures requises  │
│ [x] 11 indicateurs           │ dont TJM, taux d'occupation, marge/mission│
│ [x] 6 règles d'affectation   │ Structure 18 % → répartie aux heures    │
│ [ ] ABC                      │ Indirects 18 % < 30 % → non proposé     │
├──────────────────────────────┴─────────────────────────────────────────┤
│ 3 données seront nécessaires : heures par consultant, heures facturables,│
│ effectif par centre.               [ Ajuster ]      [ Appliquer ]       │
└────────────────────────────────────────────────────────────────────────┘
```

## W3 — Import et mapping

```
┌────────────────────────────────────────────────────────────────────────┐
│ Import — balance_2026_03.csv        4 812 lignes · UTF-8 · séparateur ; │
├────────────────────────────────────────────────────────────────────────┤
│ Colonne source     Détection            Correspondance                  │
│ ────────────────────────────────────────────────────────────────────────│
│ Date facture       date (JJ/MM/AAAA)    [ Date            ▾]  ●●● 98 %  │
│ Compte             compte général       [ Compte          ▾]  ●●● 95 %  │
│ Libellé            texte                [ Libellé         ▾]  ●●○ 80 %  │
│ Montant HT         montant (fr)         [ Montant         ▾]  ●●● 99 %  │
│ Client             texte, 34 valeurs    [ Axe : Client    ▾]  ●●○ 86 %  │
│ Affaire            texte, 12 valeurs    [ Axe : Mission   ▾]  ●●○ 82 %  │
│ Nature             texte, 9 valeurs     [ Nature de coût  ▾]  ●●● 91 %  │
│                                                                         │
│ ⚠ 37 membres seront créés sur l'axe Client, 12 sur l'axe Mission.      │
│ ⚠ 41 lignes sans axe Mission → seront traitées en charges indirectes.  │
│                            [ Tester à blanc ]      [ Importer ]         │
└────────────────────────────────────────────────────────────────────────┘
```

## W4 — Cockpit dynamique (profil conseil)

```
┌────────────────────────────────────────────────────────────────────────┐
│ Delta Conseil · Mars 2026            [Mois ▾] [Cumul ▾]  Qualité 91 % ● │
├────────────────────────────────────────────────────────────────────────┤
│ POULS                                                                   │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ │ CA       │ │ Marge    │ │ Occupation│ │ TJM      │ │ CA / ETP │       │
│ │ 412 k€   │ │ 24,1 %   │ │ 71 %  ▼  │ │ 842 €    │ │ 18,7 k€  │       │
│ │ ▲ +6,2 % │ │ ▼ −2,4pt │ │ cible 75 │ │ ▲ +1,1 % │ │ ▲ +3 %   │       │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├────────────────────────────────────────────────────────────────────────┤
│ POURQUOI LA MARGE BAISSE                          [ Voir le détail → ]  │
│  Prix        −0,3 pt  ▬                                                 │
│  Volume      +0,4 pt  ▬▬                                                │
│  Mix         −1,1 pt  ▬▬▬▬▬                                             │
│  Occupation  −1,4 pt  ▬▬▬▬▬▬▬                                           │
│  → 2 missions expliquent 61 % de l'écart.                               │
├────────────────────────────────────────────────────────────────────────┤
│ RENTABILITÉ PAR MISSION                RENTABILITÉ PAR CLIENT           │
│  Refonte SI Delta   +38 k€  22 %        Foncia      +51 k€   26 %       │
│  Audit Orion        +12 k€  18 %        Orion       +12 k€   18 %       │
│  Cadrage Vega        −4 k€  −9 %  ⚠     Vega         −4 k€   −9 %  ⚠    │
├────────────────────────────────────────────────────────────────────────┤
│ POINTS D'ATTENTION (3)                                                  │
│  ● Sous-occupation 71 % < 75 %          ● Mission Vega en perte         │
│  ● Concentration : Foncia = 34 % du CA                                  │
└────────────────────────────────────────────────────────────────────────┘
```

Le même écran, profil BTP, affiche : CA chantier, marge à terminaison, avancement, budget
consommé, reste à engager — **sans une ligne de code différente**.

## W5 — Analyse d'écart avec drill-down

```
┌────────────────────────────────────────────────────────────────────────┐
│ Écarts · Marge · Mars 2026        Réel 99 k€  Budget 116 k€  −17 k€     │
├────────────────────────────────────────────────────────────────────────┤
│  Budget 116 ┤████████████████████                                       │
│      Prix   ┤        ▼ −3                                               │
│      Volume ┤          ▲ +5                                             │
│      Mix    ┤             ▼ −8                                          │
│      Coûts  ┤                 ▼ −11                                     │
│  Réel   99  ┤███████████████                                            │
├────────────────────────────────────────────────────────────────────────┤
│ Décomposer « Mix » par :  [ Mission ▾ ] [ Client ] [ Consultant ]       │
│                                                                         │
│  Mission              Écart mix    Contribution   Cumul                 │
│  Cadrage Vega          −4 900 €        61 %        61 %   [ ouvrir ]    │
│  Support Orion         −1 700 €        21 %        82 %   [ ouvrir ]    │
│  Autres (7)            −1 400 €        18 %       100 %                 │
│                                                                         │
│  [ Voir les écritures ]  [ Expliquer le calcul ]  [ Demander au copilote ]│
└────────────────────────────────────────────────────────────────────────┘
```

## W6 — Simulateur what-if

```
┌────────────────────────────────────────────────────────────────────────┐
│ Scénario : « Hausse tarifaire 2027 »                    [ Enregistrer ] │
├──────────────────────────────┬─────────────────────────────────────────┤
│ LEVIERS                      │ IMPACT (annualisé)                      │
│ Prix de vente   [+5 %  ]     │              Actuel      Simulé    Δ    │
│ Volume          [−3 %  ]     │ CA          4 940 k€   5 049 k€  +2,2 % │
│ Masse salariale [+2 %  ]     │ Marge/CV    1 235 k€   1 331 k€  +7,8 % │
│ Sous-traitance  [ 0 %  ]     │ Résultat      312 k€     384 k€ +23,1 % │
│ Coûts fixes     [+15 k€]     │ Seuil       3 692 k€   3 640 k€  −1,4 % │
│ Effectif        [+2 ETP]     │ Trésorerie    +47 k€    +61 k€  +29,8 % │
│                              │ Levier op.       3,96      3,47        │
│ [ + Ajouter un levier ]      │                                         │
├──────────────────────────────┴─────────────────────────────────────────┤
│ Le point mort est atteint 12 jours plus tôt. La hausse de prix compense │
│ la baisse de volume tant que celle-ci reste inférieure à 4,8 %.         │
└────────────────────────────────────────────────────────────────────────┘
```

## W7 — Copilote

```
┌────────────────────────────────────────────────────────────────────────┐
│ Copilote                                              Mars 2026 ▾      │
├────────────────────────────────────────────────────────────────────────┤
│ ▸ Vous : pourquoi ma marge baisse ?                                     │
│                                                                         │
│ ▾ Axio                                                                  │
│   La marge opérationnelle passe de 26,5 % à 24,1 % (−2,4 pt).           │
│   Décomposition : mix −1,1 pt · occupation −1,4 pt · prix −0,3 pt      │
│                   volume +0,4 pt.                                       │
│   Deux missions expliquent 61 % de l'écart : Cadrage Vega (−4,9 k€),   │
│   Support Orion (−1,7 k€).                                              │
│                                                                         │
│   [tableau des contributeurs]      [ Voir le calcul ]  [ Sources : 214 │
│                                     écritures, qualité 91 % ]           │
│                                                                         │
│   Questions suggérées : « Vega est-elle rentable depuis le début ? »    │
│                         « Que se passe-t-il si je remonte le TJM de 5 % ? »│
├────────────────────────────────────────────────────────────────────────┤
│ [ Posez votre question…                                        ] [ ▶ ]  │
└────────────────────────────────────────────────────────────────────────┘
```

## W8 — Fiche objet de coût (projet / chantier / mission)

```
┌────────────────────────────────────────────────────────────────────────┐
│ Chantier « Résidence Alba »            Client Foncia · Livraison 09/26 │
├────────────────────────────────────────────────────────────────────────┤
│ CA contractuel  1 240 k€   Avancement 62 %   Budget 1 010 k€            │
│ Encouru           688 k€   Coût à terminaison 1 110 k€  ⚠ +100 k€      │
│ Reste à engager   422 k€   Marge à terminaison 130 k€ (10,5 %)         │
│                            Marge budgétée     230 k€ (18,5 %)  ▼ −8 pt │
├────────────────────────────────────────────────────────────────────────┤
│ Coûts par nature      Budget    Encouru   % conso   Reste    Dérive    │
│  Matériaux            320 k€     241 k€     75 %    95 k€     +16 k€ ⚠ │
│  Sous-traitance       410 k€     289 k€     70 %   145 k€     +24 k€ ⚠ │
│  Main-d'œuvre         210 k€     118 k€     56 %    92 k€      +0 k€   │
│  Matériel              70 k€      40 k€     57 %    30 k€      +0 k€   │
├────────────────────────────────────────────────────────────────────────┤
│ [ Historique mensuel ]  [ Écritures ]  [ Simuler ]  [ Rapport chantier ]│
└────────────────────────────────────────────────────────────────────────┘
```
