# 14 — Backlog produit

Convention : `[MVP]` livré dans cette version, `[V1]`, `[V2]`, `[V3]` ensuite.
Estimation en points (1 pt ≈ 0,5 j).

Lecture des statuts : **✅** = livré et vérifié (test automatisé ou parcours exécuté) ;
**◐** = moteur livré mais interface partielle, le reste est daté ; absence de marque = non commencé.
Cette colonne est tenue à jour avec le code : elle ne décrit pas une intention mais un état.

## EPIC 1 — Socle multi-tenant et sécurité

| # | Story | Pts | Statut |
|---|---|---|---|
| 1.1 | En tant que visiteur, je crée un compte et une organisation | 3 | [MVP] ✅ |
| 1.2 | Je me connecte / me déconnecte, session signée 7 j | 2 | [MVP] ✅ |
| 1.3 | Je crée plusieurs entreprises dans mon organisation | 2 | [MVP] ✅ |
| 1.4 | Chaque requête est isolée par organisation et entreprise | 3 | [MVP] ✅ |
| 1.5 | J'invite un utilisateur avec un rôle | 3 | [V1] |
| 1.6 | Je restreins un utilisateur à un périmètre dimensionnel | 3 | [V1] |
| 1.7 | Toute mutation sensible est journalisée (audit trail) | 2 | [MVP] ✅ |
| 1.8 | SSO / SAML | 8 | [V3] |

## EPIC 2 — Profil et configuration automatique

| # | Story | Pts | Statut |
|---|---|---|---|
| 2.1 | Assistant en 5 étapes avec sauvegarde d'étape | 5 | [MVP] ✅ |
| 2.2 | Le moteur de règles produit un plan de configuration | 5 | [MVP] ✅ |
| 2.3 | Je revois le plan et je comprends *pourquoi* chaque élément | 3 | [MVP] ✅ |
| 2.4 | Application transactionnelle + version de configuration | 3 | [MVP] ✅ |
| 2.5 | Je modifie mon profil et j'obtiens un diff, jamais une écrasement | 3 | [V1] |
| 2.6 | Je renomme les axes avec mon vocabulaire | 2 | [MVP] ✅ |
| 2.7 | Le produit me propose de monter en maturité quand les données arrivent | 3 | [V1] |
| 2.8 | Éditeur visuel de règles | 8 | [V2] |

## EPIC 3 — Données

| # | Story | Pts | Statut |
|---|---|---|---|
| 3.1 | J'importe un CSV, l'outil détecte séparateur/encodage/formats | 3 | [MVP] ✅ |
| 3.2 | Mapping proposé automatiquement avec score de confiance | 5 | [MVP] ✅ |
| 3.3 | Création automatique des membres manquants, annoncée avant import | 3 | [MVP] ✅ |
| 3.4 | Import à blanc avec rapport qualité avant validation | 3 | [MVP] ✅ |
| 3.5 | J'annule un lot d'import | 2 | [MVP] ✅ |
| 3.6 | Le mapping est mémorisé et reconnu au prochain import | 2 | [V1] |
| 3.7 | Import Excel natif (.xlsx) | 3 | [V1] |
| 3.8 | Saisie manuelle d'inducteurs (heures, effectifs, m²) | 3 | [MVP] ✅ |
| 3.9 | Connecteurs comptables (Pennylane, Sage, Cegid, Odoo) | 13 | [V2] |
| 3.10 | Connecteur bancaire (agrégation) | 8 | [V2] |
| 3.11 | API publique d'ingestion | 5 | [V2] |

## EPIC 4 — Qualité des données

| # | Story | Pts | Statut |
|---|---|---|---|
| 4.1 | Score de qualité global et par contrôle | 3 | [MVP] ✅ |
| 4.2 | 10 contrôles : manquants, doublons, aberrants, non affectés, périodes trouées… | 5 | [MVP] ✅ |
| 4.3 | Je corrige en masse depuis l'écran qualité | 5 | [V1] |
| 4.4 | Le score conditionne l'indice de confiance des analyses | 2 | [MVP] ✅ |

## EPIC 5 — Coûts

| # | Story | Pts | Statut |
|---|---|---|---|
| 5.1 | Classement automatique direct/indirect, fixe/variable | 3 | [MVP] ✅ |
| 5.2 | Affectation directe aux objets de coûts | 3 | [MVP] ✅ |
| 5.3 | Centres d'analyse et répartition par clés | 5 | [MVP] ✅ |
| 5.4 | Répartition en pourcentages personnalisés | 2 | [MVP] ✅ |
| 5.5 | Cheminement multi-étages (charges → centres → objets) | 5 | [MVP] ✅ |
| 5.6 | Prestations réciproques entre centres auxiliaires | 5 | [MVP] ◐ moteur (résolution itérative) livré ; éditeur d'étape 2 [V1] |
| 5.7 | ABC : ressources → activités → inducteurs → objets | 5 | [MVP] ✅ bibliothèque par secteur, génération des deux étages, écran de paramétrage, comparaison chiffrée avec la clé unique |
| 5.8 | Décomposition des coûts semi-variables (points extrêmes) | 3 | [MVP] ✅ |
| 5.9 | Coûts standards et préétablis | 3 | [V1] |
| 5.10 | Imputation rationnelle des charges fixes | 3 | [V1] |
| 5.11 | Éditeur de règles d'affectation avec simulation d'impact | 5 | [MVP] ◐ activation, changement d'inducteur et montant affecté par règle ; création de règle depuis l'écran [V1] |
| 5.12 | Trace complète de chaque affectation (drill-down) | 3 | [MVP] ✅ |

## EPIC 6 — Marges et rentabilité

| # | Story | Pts | Statut |
|---|---|---|---|
| 6.1 | Cascade CA → MCV → marge contributive → marge opérationnelle | 3 | [MVP] ✅ |
| 6.2 | Rentabilité par objet, tri, seuils, alerte sur objets en perte | 3 | [MVP] ✅ |
| 6.3 | Hiérarchie de drill-down configurable | 5 | [MVP] ◐ descente axe par axe puis jusqu'aux écritures ; ordre d'axes suggéré automatiquement [V1] |
| 6.4 | Concentration et contribution (Pareto) | 2 | [MVP] ✅ |
| 6.5 | Seuil de rentabilité, point mort, levier opérationnel | 3 | [MVP] ✅ |
| 6.6 | Fiche objet de coût (projet/chantier/mission) avec EAC | 5 | [MVP] ✅ |

## EPIC 7 — Budget et écarts

| # | Story | Pts | Statut |
|---|---|---|---|
| 7.1 | Créer un budget depuis l'historique | 3 | [MVP] ✅ |
| 7.2 | Saisie en grille période × ligne | 5 | [V1] — au MVP, le budget se construit depuis l'historique (coefficients CA / charges) |
| 7.3 | Versions, scénarios, statuts (brouillon → approuvé) | 3 | [MVP] ✅ |
| 7.4 | Comparaison Réel / Budget / Forecast / N-1 | 3 | [MVP] ◐ réel / budget / N-1 livrés ; colonne forecast avec le rolling forecast [V1] |
| 7.5 | Écarts prix / volume / mix | 5 | [MVP] ✅ |
| 7.6 | Écarts budget / activité / rendement (3 écarts) | 5 | [MVP] ◐ moteur livré et testé (cas d'école) ; écran dédié [V1] |
| 7.7 | Budget flexible | 3 | [MVP] ✅ |
| 7.8 | Attribution des contributeurs (cumul 80 %) | 3 | [MVP] ✅ |
| 7.9 | Drill-down multidimensionnel sur chaque composante | 5 | [MVP] ✅ |
| 7.10 | Workflow de saisie décentralisée et d'approbation | 8 | [V1] |
| 7.11 | Rolling forecast automatique | 5 | [V1] |

## EPIC 8 — KPI et cockpit

| # | Story | Pts | Statut |
|---|---|---|---|
| 8.1 | Catalogue de KPI défini en données | 3 | [MVP] ✅ |
| 8.2 | Évaluateur de formules sans `eval` | 5 | [MVP] ✅ |
| 8.3 | Sélection automatique selon profil et données disponibles | 3 | [MVP] ✅ |
| 8.4 | États `computed` / `missing_data` / `not_applicable` | 2 | [MVP] ✅ |
| 8.5 | Cockpit généré par les règles | 5 | [MVP] ✅ |
| 8.6 | Mode pédagogique (définition, formule, données, interprétation, limites) | 3 | [MVP] ✅ |
| 8.7 | Cibles et seuils modifiables | 2 | [MVP] ✅ |
| 8.8 | Création de KPI personnalisés par l'utilisateur | 3 | [V1] |
| 8.9 | Cockpit réorganisable par glisser-déposer | 5 | [V1] |

## EPIC 9 — Prévision et simulation

| # | Story | Pts | Statut |
|---|---|---|---|
| 9.1 | Forecast : naïf, moyenne mobile, tendance, croissance, saisonnalité, budget | 5 | [MVP] ✅ |
| 9.2 | Sélection automatique de la méthode par backtest (MAPE) | 3 | [MVP] ✅ |
| 9.3 | What-if multi-leviers avec impact immédiat | 5 | [MVP] ✅ |
| 9.4 | Impact sur CA, marge, résultat, seuil, trésorerie | 3 | [MVP] ✅ |
| 9.5 | Sauvegarde et comparaison de scénarios | 3 | [MVP] ✅ |
| 9.6 | Projection de trésorerie sur encaissements réels (DSO) | 5 | [V1] |
| 9.7 | Simulation Monte-Carlo | 8 | [V3] |

## EPIC 10 — Intelligence

| # | Story | Pts | Statut |
|---|---|---|---|
| 10.1 | Détection d'anomalies et de ruptures | 5 | [MVP] ✅ |
| 10.2 | Alertes par règles, avec preuve | 3 | [MVP] ✅ |
| 10.3 | Explication d'écart (décomposition + contributeurs) | 5 | [MVP] ✅ |
| 10.4 | Copilote outillé, réponses sourcées | 8 | [MVP] ✅ |
| 10.5 | Fournisseur IA substituable, mode local par défaut | 3 | [MVP] ✅ |
| 10.6 | Contrôle post-génération des nombres | 3 | [MVP] ✅ |
| 10.7 | Recommandations chiffrées par le what-if | 5 | [V1] |
| 10.8 | Commentaire de gestion mensuel généré | 3 | [MVP] ✅ |

## EPIC 11 — Restitution

| # | Story | Pts | Statut |
|---|---|---|---|
| 11.1 | Rapport mensuel généré (écran + impression) | 5 | [MVP] ✅ |
| 11.2 | Export CSV (marges, écarts, indicateurs, affectations, écritures) | 2 | [MVP] ✅ |
| 11.3 | Export PDF | 3 | [V1] |
| 11.4 | Diffusion par email programmée | 5 | [V2] |
| 11.5 | Rapports par centre / par projet / direction | 3 | [V1] |

## EPIC 12 — Écosystème

| # | Story | Pts | Statut |
|---|---|---|---|
| 12.1 | Templates sectoriels (5 packs) | 5 | [MVP] ✅ |
| 12.2 | 6 packs supplémentaires | 5 | [V1] |
| 12.3 | Packs stockés en base et éditables | 8 | [V2] |
| 12.4 | Marketplace de modèles | 13 | [V2] |
| 12.5 | Benchmarking anonymisé inter-entreprises | 13 | [V3] |
| 12.6 | API publique complète | 8 | [V2] |

**Total MVP livré : ~185 points**, dont 3 éléments partiels (◐) dont le moteur est en place et
l'interface planifiée en V1.

### Vérification du statut

| Preuve | Commande |
|---|---|
| Moteurs (135 tests, dont les cas d'école DCG) | `npm test` |
| Trois profils sur le même moteur | `npm test -- three-profiles` |
| Garde-fous d'architecture | `npm test -- architecture` |
| Toutes les routes répondent | `npm run smoke` |
| Sorties chiffrées des trois entreprises | `npm run inspect 2026-03` |
