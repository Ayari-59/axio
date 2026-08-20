# 00 — Vision produit

## 1. Le problème

Le contrôle de gestion est le seul métier de la finance qui n'a jamais été correctement outillé.

- La comptabilité a des logiciels (règles universelles, plan comptable normalisé).
- La paie a des logiciels (règles universelles, conventions collectives).
- Le contrôle de gestion n'a **pas de règles universelles** : le système de pilotage d'un cabinet
  de conseil, d'une fonderie et d'une entreprise de gros œuvre n'ont presque rien en commun —
  ni les objets de coûts, ni les inducteurs, ni les indicateurs, ni la maille d'analyse.

Conséquence observée sur le marché :

| Solution | Ce qu'elle fait | Pourquoi elle échoue |
|---|---|---|
| Excel | S'adapte à tout | Ne tient pas la charge, pas d'audit trail, pas de collaboration, cassé à chaque départ |
| ERP (SAP CO, Dynamics) | Puissant | 9 à 24 mois de paramétrage, coût prohibitif sous 500 salariés |
| EPM (Anaplan, Pigment) | Modélisation libre | Page blanche : l'outil ne sait rien du contrôle de gestion, tout est à construire |
| BI (Power BI, Tableau) | Visualisation | Aucun moteur de coûts, aucune méthode, aucun écart |
| Compta en ligne | Restitution | Vision fiscale, pas de vision de gestion |

Il manque une catégorie : un produit qui **connaît le métier** (comme un ERP) mais qui
**se configure tout seul** (comme un SaaS) et **s'adapte à l'entreprise** (comme Excel).

## 2. Le positionnement

> **Axio n'est pas un logiciel de comptabilité, ni un ERP, ni « un logiciel de contrôle de gestion ».
> Axio est une plateforme intelligente qui transforme les données d'une entreprise
> en système de pilotage personnalisé.**

Formulation courte : **l'Operating System du contrôle de gestion.**

Un OS ne fait rien tout seul : il expose des primitives (dimensions, coûts, écarts, KPI, règles)
et exécute au-dessus des configurations différentes pour chaque entreprise. Deux entreprises
utilisent le **même moteur**, obtiennent **deux systèmes de pilotage sans rien de commun**.

## 3. L'avantage concurrentiel : le moteur d'adaptation

Le produit ne se différencie ni par ses écrans, ni par ses calculs (le contrôle de gestion est une
discipline publique et enseignée), mais par la **chaîne d'adaptation** :

```
Profil déclaré  +  Données observées
                 ↓
        MOTEUR DE RÈGLES (déclaratif, versionné, sans code)
                 ↓
   Capacités activées · Dimensions · Objets de coûts · Méthodes
   Règles d'affectation · KPI · Budgets · Sections de cockpit
                 ↓
        Un système de pilotage propre à l'entreprise
```

Trois propriétés non négociables :

1. **Configuration > code.** Aucune ligne de code ne contient `if (secteur === "BTP")`.
   Un nouveau secteur = un *rule pack* (données), livrable sans redéploiement applicatif.
2. **Moteur > module.** Il n'y a pas un « module BTP » et un « module conseil » :
   il y a un moteur de coûts, un moteur budgétaire, un moteur KPI, paramétrés différemment.
3. **Dimensions > tables spécialisées.** Il n'y a pas de table `Chantier`, `Mission`, `Magasin` :
   il y a des `Dimension` et des `DimensionMember`. Le mot « chantier » est une **étiquette**.

Test de validation de l'architecture (cf. §29 du cahier des charges) :

> Si le même moteur produit un pilotage correct pour un cabinet de conseil, une PME industrielle
> et une entreprise de BTP **sans duplication de code métier**, l'architecture est bonne.

Ce test est implémenté : `tests/three-profiles.test.ts` fait tourner les trois jeux de données
dans le même moteur et vérifie que les sorties diffèrent alors que le code exécuté est identique.

## 4. Utilisateurs cibles

| Persona | Besoin dominant | Ce qu'Axio lui donne |
|---|---|---|
| Dirigeant de PME (10–250 sal.) | « Est-ce que je gagne de l'argent, et où ? » | Cockpit auto, marge par objet, alertes |
| DAF / RAF | Budget, écarts, reporting mensuel | Budget multi-versions, écarts décomposés, rapport généré |
| Contrôleur de gestion | Modèle de coûts, analyse fine | Moteur ABC/centres, drill-down, what-if |
| Responsable opérationnel | Son périmètre uniquement | Cockpit filtré, budget de son centre |
| Consultant / cabinet | Déployer vite chez un client | Templates sectoriels, import, multi-tenant |
| Enseignant / étudiant | Comprendre la méthode | Mode pédagogique : définition, formule, données, interprétation, limites |

## 5. Promesse produit

**J-0** : je crée mon entreprise, je réponds à 5 écrans, j'importe un export comptable CSV.
**J-0 + 20 minutes** : j'ai un modèle de coûts, une marge par client/projet/produit,
un cockpit qui ne montre que ce qui me concerne, et je peux demander en français
« pourquoi ma marge baisse ? » et obtenir une réponse chiffrée, sourcée et décomposée.

## 6. Ce que le produit ne fera jamais

- Tenir la comptabilité générale (pas de journal légal, pas de liasse fiscale).
- Remplacer un ERP transactionnel (pas de commandes, pas de stock opérationnel temps réel).
- Laisser une IA générative produire un chiffre. **L'IA commente, elle ne calcule pas.**
- Facturer, payer, déclarer.

## 7. Modèle économique (cadre)

SaaS par entreprise pilotée, palier selon le nombre d'objets de coûts et d'utilisateurs.
Le multi-tenant `Organisation → Entreprises` permet le cas « cabinet qui pilote 30 clients ».

## 8. Indicateurs de succès du produit

| Indicateur | Cible |
|---|---|
| Time-to-first-insight (création → premier cockpit chiffré) | < 30 min |
| Part de la configuration produite automatiquement (vs saisie manuelle) | > 80 % |
| Nouveau secteur ajouté sans modification du code métier | 100 % |
| Écart de marge expliqué à > 80 % par la décomposition automatique | > 70 % des cas |
