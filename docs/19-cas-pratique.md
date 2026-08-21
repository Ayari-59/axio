# 19 — Cas pratique : Atelier Lumen

Parcours guidé pour apprendre l'application **en vérifiant chaque chiffre à la main**.

Les trois autres entreprises de démonstration imitent le désordre du réel : leurs montants sont
plausibles mais impossibles à refaire de tête. **Atelier Lumen est construite pour l'inverse.**
Tous ses chiffres tombent juste. À chaque étape, vous calculez d'abord, vous regardez ensuite.
C'est la seule façon de savoir si vous avez compris l'outil — ou seulement cru le comprendre.

> Ouvrez **Atelier Lumen**, période **mars 2026**. Ce mois est le mois de référence : tous les
> volumes y valent exactement leur valeur nominale. Les autres mois varient, pour que les
> tendances et les prévisions aient du sens.

## L'entreprise en dix lignes

Atelier Lumen fabrique deux luminaires vendus à deux clients :

| | Lampe Nova (série) | Lustre Opus (sur mesure) |
|---|---:|---:|
| Quantités (mars) | 1 000 u | 100 u |
| Prix de vente | 120 € | 500 € |
| Matière | 40 €/u | 160 €/u |
| Main-d'œuvre directe | 20 €/u | 80 €/u |
| Heures machine | 0,5 h/u → **500 h** | 1 h/u → **100 h** |
| Réglages de série | **4** | **20** |
| Commandes administrées | **20** | **30** |

Charges indirectes du mois : atelier 40 000 € (dont énergie semi-variable) + administration
20 000 € = **60 000 €**.

Tout le cas tient dans une question : **le lustre est-il rentable ?** Selon la méthode employée,
la réponse s'inverse.

---

## Étape 1 — Le cockpit : ce que l'entreprise gagne

**Cockpit**, mars 2026. Calculez avant de lire l'écran :

```
Chiffre d'affaires   1 000 × 120  +  100 × 500              = 170 000 €
Matières             1 000 × 40   +  100 × 160              =  56 000 €
Main-d'œuvre directe 1 000 × 20   +  100 × 80               =  28 000 €
Charges indirectes                                           =  60 000 €
Résultat d'exploitation                                      =  26 000 €
```

L'écran affiche **170 000 €**, **144 000 €** de coûts et **26 000 €** de résultat, soit 15,3 %.

*Ce que vous apprenez :* le cockpit n'est pas choisi, il est **composé** par le moteur de règles à
partir du modèle économique déclaré. Atelier Lumen vend des unités produites : elle reçoit le coût
unitaire, la production par heure machine et le taux de rebut — pas le taux d'occupation d'un
cabinet de conseil.

## Étape 2 — La cascade de marge : trois marges, trois questions

**Marges**. La cascade distingue trois niveaux, et ce n'est pas de la coquetterie :

| Niveau | Montant | La question à laquelle il répond |
|---|---:|---|
| Marge sur coûts variables | 83 600 € | Chaque vente supplémentaire rapporte-t-elle ? |
| Marge contributive | idem ici | Faut-il continuer cette activité ? |
| Marge opérationnelle | 26 000 € | La structure est-elle couverte ? |

La marge sur coûts variables (83 600 €) dépasse 170 000 − 56 000 − 28 000 = 86 000 € **moins**
2 400 € : la part variable de l'énergie, que le moteur a extraite des charges semi-variables
(étape 6). C'est précisément le genre de détail qu'un tableur oublie.

*Ce que vous apprenez :* arrêter un produit ne supprime que ses coûts **variables et fixes
directs**. La marge opérationnelle sert à savoir si la structure est payée, jamais à décider d'un
arrêt.

## Étape 3 — Rentabilité par produit : le verdict du coût complet

Toujours dans **Marges**, tableau par produit. Le moteur applique la règle générée pour l'industrie
— répartition des charges indirectes **aux heures machine** :

```
Taux de répartition   60 000 € / 600 h = 100 €/h
Lampe Nova            500 h × 100 = 50 000 €
Lustre Opus           100 h × 100 = 10 000 €
```

D'où :

| | Lampe Nova | Lustre Opus |
|---|---:|---:|
| Marge sur coûts variables | 60 000 € | 26 000 € |
| − indirects (heures machine) | 50 000 € | 10 000 € |
| **Marge opérationnelle** | **+10 000 €** | **+16 000 €** |
| Coût de revient unitaire | 110 € | 340 € |

**Conclusion apparente : le lustre est le produit le plus rentable.** Vendu 500 € pour un coût de
revient de 340 €, il dégage 160 € l'unité. On serait tenté d'en vendre davantage.

Gardez ce verdict en tête : l'étape 5 va le renverser.

> L'écran peut afficher 10 000,01 € pour le lustre : les charges descendent bassin par bassin
> (atelier, puis administration) et chaque division par 600 laisse un résidu d'arrondi, que le
> moteur loge dans le dernier bénéficiaire pour que la masse reste à 60 000 €. C'est un
> comportement voulu, documenté au §3.3 du moteur de coûts — pas une imprécision.

## Étape 4 — Le seuil de rentabilité

Toujours dans **Marges**, encadré de droite.

```
Taux de marge sur coûts variables   83 600 / 170 000  = 49,2 %
Charges fixes                                          = 57 600 €
Seuil de rentabilité                57 600 / 0,492     ≈ 117 100 €
Marge de sécurité                   (170 000 − 117 100) / 170 000 ≈ 31 %
Levier opérationnel                 83 600 / 26 000    ≈ 3,2
```

*Ce que vous apprenez :* un levier de 3,2 signifie qu'une baisse de 10 % du chiffre d'affaires
ampute le résultat de 32 %. C'est la mesure de la fragilité, et elle ne se lit sur aucun compte de
résultat.

## Étape 5 — La comptabilité par activités : le renversement

**Paramètres → Activités (ABC)**. Trois activités ont été paramétrées, chacune avec l'inducteur qui
**cause** sa consommation :

| Activité | Part des 60 000 € | Inducteur | Coût de l'inducteur |
|---|---:|---|---|
| Usiner | 50 % → 30 000 € | heures machine (600) | 50 €/h |
| Régler les séries | 25 % → 15 000 € | réglages (24) | 625 €/réglage |
| Administrer les commandes | 25 % → 15 000 € | commandes (50) | 300 €/commande |

Calculez la répartition :

```
Lampe Nova    500 h × 50  +  4 réglages × 625  + 20 cdes × 300 = 25 000 + 2 500 + 6 000 = 33 500 €
Lustre Opus   100 h × 50  + 20 réglages × 625  + 30 cdes × 300 =  5 000 + 12 500 + 9 000 = 26 500 €
                                                                          Total = 60 000 €
```

Le tableau de comparaison affiche exactement ces montants :

| | Clé unique | ABC | Écart |
|---|---:|---:|---:|
| Lampe Nova | 50 000 € | 33 500 € | **−16 500 €** |
| Lustre Opus | 10 000 € | 26 500 € | **+16 500 €** |

Et les verdicts s'inversent :

| | Marge — clé unique | Marge — ABC | Coût unitaire ABC |
|---|---:|---:|---:|
| Lampe Nova | +10 000 € | **+26 500 €** | 93,50 € |
| Lustre Opus | +16 000 € | **−500 €** | **505 €** |

**Le lustre vendu 500 € coûte 505 € à produire.** Il était vendu à perte, et la clé unique le
masquait : avec 17 % des heures machine mais 83 % des réglages et 60 % des commandes, le sur-mesure
consomme l'atelier bien au-delà de son temps de passage. La série le finançait.

*Ce que vous apprenez :* l'ABC ne change pas le résultat global — 26 000 € dans les deux cas — il
change **qui le porte**. Et c'est de cette répartition que dépendent les décisions de prix, de mix
et d'arrêt.

> Essayez : ramenez « Régler les séries » à 5 % et « Usiner » à 70 %, appliquez. Le lustre
> redevient rentable. Un modèle ABC vaut ce que valent ses inducteurs — l'outil ne vous dispense
> pas de l'analyse des processus, il la rend calculable.

## Étape 6 — Les charges semi-variables

**Coûts**. L'énergie de l'atelier n'est ni fixe ni variable : elle vaut 3 000 € par mois plus 4 €
par heure machine. En mars : 3 000 + 4 × 600 = **5 400 €**.

Le moteur ne le sait pas : il le **retrouve** à partir de l'historique, par la méthode des points
extrêmes — ou par régression dès que six périodes sont disponibles. Il isole une part fixe de
3 000 € au centime près.

*Ce que vous apprenez :* sans cette décomposition, ces 5 400 € seraient classés en bloc, faussant
le taux de marge sur coûts variables et donc le seuil de rentabilité.

## Étape 7 — L'analyse des écarts

**Écarts**. Le budget 2026 prévoyait 900 lampes à 120 € et 100 lustres à 520 €.

```
Budget   900 × 120 + 100 × 520 = 160 000 €  pour 1 000 unités → prix moyen budgété 160 €
Réel   1 000 × 120 + 100 × 500 = 170 000 €  pour 1 100 unités
Écart total                                                       = +10 000 €
```

Décomposez :

```
Effet prix     1 000 × (120 − 120)  +  100 × (500 − 520)          =  −2 000 €
Effet volume   (1 100 − 1 000) × 160                              = +16 000 €
Effet mix      (1 000×120 + 100×520) − 1 100 × 160                =  −4 000 €
                                                          Somme   = +10 000 €  ✓
```

L'écran affiche ces quatre montants. **La somme des composantes égale toujours l'écart total** —
c'est une identité mathématique, vérifiée par un test à chaque livraison.

*Ce que vous apprenez :* +10 000 € de chiffre d'affaires n'est pas une bonne nouvelle en soi. Ici,
le volume progresse (+16 000 €) mais le sur-mesure a été bradé (−2 000 €) et sa part recule
(−4 000 €). Trois messages différents, trois décisions différentes.

## Étape 8 — La traçabilité

**Coûts → Traces d'affectation**. Chaque euro réparti conserve sa règle, son inducteur, sa base et
son total. Cherchez la ligne « Régler les séries → Lustre Opus » : vous y lirez `SETUPS`, base 20,
total 24, montant 12 500 €.

*Ce que vous apprenez :* un chiffre de contrôle de gestion qu'on ne peut pas justifier ligne à
ligne devant un opérationnel ne sert à rien. C'est ce qui sépare un outil de pilotage d'un tableau
de bord décoratif.

## Étape 9 — Le simulateur

**Scénarios**. Question : le lustre étant vendu à perte de 5 € l'unité, que faut-il faire ?

Testez « Prix de vente +5 % ». Le résultat passe de 26 000 € à 34 500 € — mais le simulateur
raisonne globalement. Pour le seul lustre, le calcul est immédiat : +25 € l'unité contre une perte
de 5 € → la marge devient positive. Une hausse de 1 % suffirait presque.

*Ce que vous apprenez :* le simulateur donne l'ordre de grandeur et l'effet sur le seuil de
rentabilité ; l'arbitrage produit par produit se lit dans le tableau ABC.

## Étape 10 — Le copilote

**Copilote**. Posez, dans cet ordre :

1. « Quelle est ma marge ce mois-ci ? » → 83 600 €, avec la variation.
2. « Quels sont mes produits les moins rentables ? » → le lustre, en tête.
3. « Pourquoi ma marge baisse ? » → décomposition et contributeurs.
4. « Prépare-moi l'analyse mensuelle. » → le commentaire de gestion rédigé.

Ouvrez systématiquement **« Comment ce chiffre est obtenu »** : vous y verrez la formule, les
écritures utilisées et l'indice de confiance.

*Ce que vous apprenez :* le copilote n'a aucune autonomie de calcul. Il reconnaît l'intention,
appelle les mêmes moteurs que les écrans, puis rédige. Sans clé d'API, il fonctionne à l'identique
avec des phrases pré-écrites — et refuse de répondre quand la donnée manque, au lieu d'estimer.

---

## Récapitulatif des chiffres à retenir

| Vérification | Valeur attendue |
|---|---|
| Chiffre d'affaires de mars | 170 000 € |
| Résultat d'exploitation | 26 000 € |
| Indirects — clé unique | Lampe 50 000 € · Lustre 10 000 € |
| Indirects — ABC | Lampe 33 500 € · Lustre 26 500 € |
| Coût unitaire ABC | Lampe 93,50 € · Lustre 505 € |
| Écart de CA | +10 000 € = −2 000 (prix) + 16 000 (volume) − 4 000 (mix) |
| Part fixe de l'énergie | 3 000 €/mois |

Si un chiffre de l'écran s'écarte de plus d'un centime de votre calcul, c'est un défaut du produit :
signalez-le. Les écarts d'un centime, eux, sont normaux — ils viennent de l'arrondi des
répartitions, que le moteur loge dans le dernier bénéficiaire pour conserver la masse totale.

## Pour aller plus loin

- Rejouez le parcours sur **Nordmeca** : mêmes méthodes, données réalistes, résultats moins ronds.
- Comparez les cockpits de **Delta Conseil** (services) et **Bâtir Atlantique** (BTP) : même moteur,
  aucun indicateur commun.
- Modifiez le profil d'Atelier Lumen (Paramètres → Modifier le profil) et regardez le plan de
  configuration proposé : chaque élément indique la règle et la réponse qui l'ont déclenché.
