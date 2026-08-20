# 15 — Roadmap MVP → V1 → V2 → V3

## MVP — « Le moteur prouve qu'il s'adapte » (livré)

**Objectif** : démontrer qu'un seul moteur produit trois systèmes de pilotage différents
pour un cabinet de conseil, une PME industrielle et une entreprise de BTP.

Périmètre livré :

- authentification, organisation, entreprises, isolation, audit trail ;
- assistant de configuration en 5 étapes et `BusinessModelProfile` ;
- moteur de règles + 5 packs sectoriels + plan de configuration expliqué ;
- import CSV avec profilage, auto-mapping, import à blanc, annulation ;
- contrôle qualité (10 contrôles, score) ;
- moteur de coûts : classement, affectation directe, clés, pourcentages, multi-étages, ABC ;
- marges : cascade, rentabilité par objet, Pareto, seuil de rentabilité, levier ;
- budgets : versions, saisie, comparaisons, écarts prix/volume/mix et budget/activité/rendement ;
- attribution des contributeurs et drill-down multidimensionnel ;
- KPI : catalogue, évaluateur de formules, sélection automatique, mode pédagogique ;
- cockpit dynamique généré par les règles ;
- forecast (6 méthodes + backtest), what-if multi-leviers, scénarios ;
- alertes, insights, commentaire de gestion, rapport mensuel ;
- copilote outillé, fournisseur IA substituable, mode local par défaut ;
- jeux de démonstration pour les trois profils et suite de tests.

**Critère de sortie** : `tests/three-profiles.test.ts` passe, et un utilisateur non formé produit
un cockpit chiffré en moins de 30 minutes.

## V1 — « Utilisable en production par une équipe » (≈ 8 semaines)

| Thème | Contenu |
|---|---|
| Collaboration | Invitations, rôles, périmètres dimensionnels, workflow budgétaire (saisie décentralisée, soumission, approbation) |
| Données | Import Excel natif, mappings mémorisés, corrections en masse depuis l'écran qualité |
| Coûts | Prestations réciproques, coûts standards, imputation rationnelle |
| Prévision | Rolling forecast automatique, trésorerie sur encaissements (DSO) |
| Restitution | Export PDF, rapports par centre / projet / direction, cockpit réorganisable |
| Configuration | Diff de reconfiguration, montée de maturité guidée, KPI personnalisés |
| Industrialisation | Migration PostgreSQL/Neon, sauvegardes, monitoring, RGPD (registre, export, effacement) |

**Critère de sortie** : 5 entreprises pilotes utilisent le produit pour leur clôture mensuelle
pendant 3 mois consécutifs sans retour à Excel.

## V2 — « Plateforme » (≈ 6 mois)

| Thème | Contenu |
|---|---|
| Connecteurs | Pennylane, Sage, Cegid, Odoo, agrégation bancaire, paie |
| Ouverture | API publique (ingestion + lecture), webhooks, clés d'API |
| Écosystème | Packs sectoriels stockés en base, éditeur de règles visuel, marketplace de modèles |
| Analyse | Analyse multi-entreprises (consolidation cabinet), comparaison inter-sites avancée |
| IA | Recommandations chiffrées, détection avancée, résumé automatique de clôture |

**Critère de sortie** : un nouveau secteur est ajouté par un consultant externe, sans
intervention de l'éditeur.

## V3 — « Avantage de données » (≈ 12 mois)

| Thème | Contenu |
|---|---|
| Benchmarking | Comparaison anonymisée par secteur et par taille (k-anonymat ≥ 20) |
| Prévision | Modèles statistiques avancés, Monte-Carlo, intervalles de confiance |
| Entreprise | SSO/SAML, résidence des données, audit externe, SLA |
| Mobile | Consultation et alertes sur mobile |

## Jalons et dépendances

```
MVP ──▶ V1 ──▶ V2 ──▶ V3
 │       │       │
 │       │       └── les connecteurs conditionnent le benchmarking (volume de données)
 │       └── la migration PostgreSQL conditionne le multi-utilisateur réel
 └── le moteur de règles conditionne tout le reste : rien ne doit le contourner
```

## Risques et parades

| Risque | Impact | Parade |
|---|---|---|
| Dérive vers du code sectoriel sous pression client | Perte de l'avantage produit | Test automatisé « aucun nom de secteur dans `core/` » |
| Qualité des données clients insuffisante | Analyses fausses | Score de qualité bloquant + indice de confiance affiché |
| Complexité perçue à l'onboarding | Abandon | Maturité progressive, 5 écrans maximum, valeurs par défaut |
| Hallucination d'un LLM | Perte de confiance irréversible | L'IA ne calcule jamais + contrôle post-génération des nombres |
| Volume (10⁶ écritures) | Lenteur | Pré-agrégation par empreinte, index, pagination serveur |
| Dépendance à un connecteur comptable | Blocage commercial | L'import CSV reste toujours le chemin de secours |
