# 12 — Parcours utilisateur

## 1. Parcours principal : de zéro au premier insight

```
1. Inscription (2 champs)              → 30 s
2. Création de l'entreprise            → 1 min
3. Assistant de configuration (5 étapes)→ 6 min
4. Revue du plan proposé               → 2 min
5. Import d'un fichier comptable       → 4 min (mapping assisté)
6. Contrôle qualité + corrections      → 3 min
7. Cockpit généré                      → immédiat
8. Première question au copilote       → 30 s
                                        ─────────
                                         ~17 min
```

Objectif produit : **time-to-first-insight < 30 minutes**, mesuré en télémétrie.

## 2. Étape par étape

### P1 — Inscription et organisation
Email + mot de passe. L'organisation est créée automatiquement au nom de l'utilisateur
(renommable). Un cabinet peut ensuite créer plusieurs entreprises dans la même organisation.

### P2 — Assistant de configuration

**Étape 1 — Identité** : nom, secteur, activité, pays, devise, début d'exercice, tranche de CA,
effectif, nombre de sites et d'établissements.
→ *Le secteur ne verrouille rien* : il choisit un pack de règles, que les étapes suivantes affinent.

**Étape 2 — Modèle économique** : ce que l'entreprise vend, à qui, comment elle facture
(9 unités de facturation), d'où vient sa marge, ses grandes masses de coûts (curseurs :
achats / masse salariale / sous-traitance / structure), ses facteurs de rentabilité.
→ *Écran le plus important* : c'est lui qui pilote le moteur de coûts.

**Étape 3 — Organisation** : services, départements, agences, sites, équipes, centres de
responsabilité — saisis en liste rapide, avec possibilité d'import ultérieur.

**Étape 4 — Objets de pilotage** : proposition dynamique selon les étapes 1–3
(clients, produits, projets, contrats, collaborateurs, sites, activités) ; l'utilisateur coche
et **renomme** (« projet » → « chantier »).

**Étape 5 — Objectifs** : jusqu'à 3 priorités parmi les 9. Elles pondèrent le cockpit
(un objectif « rentabilité client » remonte la section marge par client en tête).

### P3 — Revue du plan

Écran en deux colonnes : « ce qui va être créé » / « pourquoi » (la règle et la réponse qui l'ont
déclenchée). L'utilisateur peut décocher, renommer, reporter. Application transactionnelle.

### P4 — Import

```
Dépôt du fichier → aperçu 20 lignes → détection du séparateur, de l'encodage, du format de date
→ mapping proposé (score de confiance par colonne) → validation → contrôle qualité à blanc
→ import → recalcul → « 4 812 écritures importées, qualité 91 % »
```

Le mapping propose la création automatique des membres manquants (clients, projets inconnus),
avec un compteur explicite (« 37 nouveaux membres seront créés sur l'axe Chantier »).

### P5 — Cockpit

Généré, pas choisi. Sections ordonnées par les objectifs déclarés. Chaque carte propose
trois gestes : *ouvrir* (drill-down), *expliquer* (mode pédagogique), *demander au copilote*.

### P6 — Cycle mensuel

```
J+1 clôture → import du mois → contrôle qualité → recalcul
→ écarts → alertes → commentaire généré → rapport → diffusion
```

Le produit propose une **liste de tâches de clôture** générée depuis la configuration
(« importer la balance », « saisir les heures », « valider les avancements »).

## 3. Parcours secondaires

| Parcours | Points clés |
|---|---|
| Construire un budget | Choix du mode (historique / inducteurs / saisie), répartition, soumission, approbation |
| Analyser un écart | Cockpit → écart → décomposition → contributeurs → écritures → export |
| Simuler | Sélection des leviers → aperçu instantané (calcul côté client) → sauvegarde du scénario |
| Piloter un projet | Liste des objets → fiche projet (budget, encouru, avancement, EAC, marge à terminaison) |
| Ajouter un axe | Paramètres → dimensions → créer → importer la colonne → recalcul |
| Inviter un opérationnel | Invitation + rôle + périmètre → il ne voit que ses centres |

## 4. Principes d'interface

1. **Un écran, une question.** Chaque page répond à une question de gestion formulée en titre.
2. **Le chiffre d'abord, la méthode à un clic.** Le mode pédagogique est un panneau latéral,
   jamais un préambule.
3. **Rien d'inutile.** Une fonction dont la capacité est inactive n'est ni grisée ni affichée :
   elle n'existe pas dans la navigation.
4. **Toujours navigable vers la source.** Aucun chiffre n'est un cul-de-sac.
5. **Aucune modale bloquante** pour les calculs longs : état de recalcul en bandeau.
6. **Le vocabulaire est celui de l'entreprise**, jamais celui du logiciel.

## 5. Navigation

```
ACCUEIL           synthèse et tâches du moment
COCKPIT           tableau de bord dynamique
ACTIVITÉ          CA, volumes, carnet
COÛTS             par nature / centre / objet + règles d'affectation
MARGES            cascade et rentabilité par objet
BUDGETS           versions, saisie, approbation
ÉCARTS            analyse et drill-down
PRÉVISIONS        forecast et atterrissage
SCÉNARIOS         what-if
ALERTES           file d'attention
RAPPORTS          génération et historique
COPILOTE          conversation
PARAMÈTRES        profil, dimensions, KPI, données, utilisateurs
```

Les entrées `ACTIVITÉ`, `PRÉVISIONS`, `SCÉNARIOS` n'apparaissent que si les capacités
correspondantes sont actives.
