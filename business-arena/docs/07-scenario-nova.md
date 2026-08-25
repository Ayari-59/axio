# 07 — Architecture du premier scénario : NOVA

Couvre le point 9 de la mission n°37 (étapes 4–5 du plan §35 : scénario + simulation de
6 tours). NOVA est le scénario d'entrée : niveaux DÉCOUVERTE → GESTION, un produit, deux
segments, 6 tours trimestriels. Il doit faire vivre naturellement les 20 concepts du MVP
(doc 03 §2), notamment le pilier « rentable mais illiquide » (§16).

---

## 1. Univers

**NOVA** est une jeune entreprise qui fabrique et vend une enceinte audio portable, la
**NOVA One**. Le joueur reprend l'entreprise au 1er janvier : un atelier, 6 salariés,
un produit, un marché en croissance, deux concurrents (bots) : **SoundBox** (agressif
prix) et **Auris** (premium suiveur).

- **Produit** : NOVA One — coût variable unitaire initial ≈ 38 € (matières 22 €, MOD 11 €,
  énergie/divers 5 €), prix de lancement conseillé 59 €, qualité perçue initiale 1,0.
- **Segments** :
  | | Étudiants (sensibles au prix) | Passionnés (sensibles à la qualité) |
  |---|---|---|
  | Taille (demande de base/tour) | 9 000 | 4 000 |
  | Croissance/tour | +6 % | +3 % |
  | Élasticité-prix | −2,2 | −0,7 |
  | Prix de référence | 55 € | 75 € |
  | Seuils psychologiques | 50 € (×0,90), 60 € (×0,93) | 100 € (×0,90) |
  | Prix plancher d'acceptabilité | 35 € | 55 € |
  | Sensibilité marketing / qualité | forte / faible | moyenne / forte |
  | Délai de paiement | comptant | comptant |
  | Fidélité | faible | forte |
- **Saisonnalité** : [0,9 · 0,95 · 1,0 · 1,35 · 0,9 · 1,0] (pic T4 = fêtes, situé au tour 4).
- **Capacité** : atelier 5 500 u/tour à 100 % de disponibilité ; 4 opérateurs de production
  (plafond main-d'œuvre ≈ 6 000 u) ; sous-traitance possible dès le tour 3 (max 2 000 u,
  +9 €/u, qualité −10 %).
- **Coûts fixes** : 96 000 €/tour (loyer, salaires structure, amortissements) →
  seuil de rentabilité initial ≈ 96 000 / (59 − 38) ≈ **4 571 u/tour** : atteignable mais
  pas donné — c'est voulu.
- **Finance initiale** : capital 150 000 €, emprunt 80 000 € (5 %/an), trésorerie 45 000 €,
  découvert autorisé 30 000 € (taux 12 %/an). Fournisseur matières : délai de livraison
  1 tour à partir du tour 3 (grosses commandes), **paiement à 30 j** ; un compte-clé
  « chaîne de magasins CampusTech » apparaît au tour 3 et paie à **60 j**.

Décisions débloquées (profil DÉCOUVERTE puis GESTION) : prix, plan de production,
budget marketing, approvisionnements ; à partir du tour 3 : budget qualité, sous-traitance,
délais de paiement négociés ; tour 5 : un choix d'investissement.

## 2. Dramaturgie des 6 tours (situations scriptées)

Chaque tour = une situation principale + les situations détectées le cas échéant.
Les événements scriptés garantissent la rencontre des concepts ; la calibration (§4)
garantit que la dramaturgie résiste aux stratégies raisonnables.

| Tour | Situation vécue (jamais énoncée académiquement) | Concepts découverts | Modèles pertinents |
|---|---|---|---|
| **1 — Prise en main** | « Fixez votre prix et votre production pour votre premier trimestre. » Prévisions demandées ; marché décrit qualitativement. | CA = prix × volume ; segmentation ; stock | CVP (léger) |
| **2 — Le prix fait la demande** | Résultats du T1 : SoundBox baisse son prix (événement scripté). « Vos ventes étudiantes décrochent. Que s'est-il passé, que faites-vous ? » Expérimentation 49,90/50/59 €. | élasticité-prix, prix psychologique, part de marché | analyse de l'élasticité, prix psychologique |
| **3 — Produire n'est pas vendre** | La demande dépasse la capacité (croissance + marketing). Rupture au T2 pour la plupart des joueurs. Arrivée de CampusTech : commande importante, **paiement à 60 j**, remise exigée. | capacité, taux d'utilisation, rupture, coûts pertinents | analyse de capacité, coûts pertinents / analyse marginale |
| **4 — Le paradoxe du succès** | Pic saisonnier : CA record, résultat positif… **trésorerie négative** (stocks constitués + créances CampusTech). La banque s'inquiète. C'est LA situation §16. | BFR, FRNG, trésorerie nette, délais de paiement | **analyse FRNG/BFR**, budget de trésorerie |
| **5 — Gagner de l'argent, ou être rentable ?** | Contrecoup saisonnier + hausse matières (événement). Proposition d'investissement : machine (+2 500 u de capacité, 90 000 €) financée cash ou par emprunt. Comparaison avec Auris : résultat plus faible mais capitaux moindres. | coûts fixes/variables, seuil de rentabilité, point mort, profitabilité vs rentabilité | seuil de rentabilité, analyse de rentabilité, (VAN simplifiée en option guidée) |
| **6 — Le grand oral** | Dernier tour libre, arbitrages assumés, puis **débriefing de partie** : trajectoire, classement BPI, profil de compétences, ce qu'il faudrait faire au T7. | synthèse des 20 | matrice multicritère (choix final guidé) |

Situations détectables actives en plus (doc 03 §1.1) : « rentable mais illiquide »,
« rupture de stock », « sous le seuil de rentabilité », « surproduction/stock dormant ».

## 3. Structure de la configuration (`src/config/scenarios/nova/`)

```
nova/
├── index.ts          # assemble et exporte ScenarioConfig (validé par zod à l'import)
├── market.ts         # segments, saisonnalité, concurrent extérieur
├── companies.ts      # état initial joueur + bots SoundBox / Auris (profils de stratégie)
├── costs.ts          # lignes de coûts étiquetées (doc 02 §5)
├── finance.ts        # capital, emprunt, découvert, IS, délais
├── events.ts         # événements scriptés (baisse prix T2, hausse matières T5) + aléatoires activés
├── situations.ts     # les 6 situations principales + détectables, indices 5 niveaux rédigés
├── pedagogy.ts       # 20 concepts activés, modèles offerts, matrice de pertinence
├── difficulty.ts     # profils DÉCOUVERTE (tours 1–2) → GESTION (tours 3–6) : montée en charge
└── scoring.ts        # pondérations BPI adaptées au niveau (stratégie sous-pondérée)
```

Le scénario est publié en base (`scenarios`, JSONB) par le seed ; chaque partie fige son
instantané (ADR-10). Aucune valeur de NOVA n'existe dans le code du moteur.

## 4. Calibration (obligatoire avant publication)

`scripts/calibrate.ts` joue NOVA en batch avec des stratégies-bots types (prix bas,
premium, équilibré, passif) et vérifie des **invariants de conception** :

1. La stratégie passive (reconduction) finit sous le seuil de rentabilité au plus tard au
   tour 3 (le jeu punit l'inaction, sans faillite avant le tour 4).
2. Au tour 4, ≥ 80 % des stratégies en croissance passent en trésorerie négative **tout en
   restant bénéficiaires** (la situation-pivot §16 est quasi certaine).
3. Aucune stratégie testée ne dépasse le plafond de découvert avant le tour 4 (pas de
   défaite précoce en DÉCOUVERTE).
4. Une stratégie équilibrée raisonnable termine avec un BPI de 55–75 (marge de progression).
5. Écart de BPI entre la meilleure et la pire stratégie ≥ 20 points (les décisions comptent).

Ces invariants sont des **tests automatisés** (doc 09 §5) : impossible de dérégler NOVA
sans casser la CI.
