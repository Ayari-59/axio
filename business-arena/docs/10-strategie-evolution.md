# 10 — Stratégie d'évolution future

Couvre le point 17 de la mission n°37 (§38 : le produit doit rester jeu, outil
pédagogique, outil d'évaluation, outil de formation et plateforme de compétition
nationale). L'architecture est conçue pour que chaque évolution soit un **ajout**,
jamais une réécriture (§36).

---

## 1. Ce que l'architecture garantit déjà

| Évolution future | Garantie architecturale posée au MVP |
|---|---|
| BUSINESS ARENA CHAMPIONSHIP | Moteur de compétition = orchestration de parties ordinaires ; schéma `competitions/stages/entries` déjà en base (doc 04) |
| Nouveaux scénarios (secteurs, DSCG, executive) | Scénario = données versionnées consommées par le moteur (§31) ; publier un scénario n'exige aucune modification de code moteur |
| IA coach / débriefing LLM (étape 12) | Frontière `coach.service` + `/api/coach` réservée ; contexte structuré produit par `pedagogy/debrief` ; interdits garantis par construction (doc 01 §7) |
| Montée en niveau (ARBITRAGE → EXECUTIVE) | Difficulté paramétrique : activer des presets, pas coder des niveaux (doc 08 §2) |
| Multi-produits, RH riche, export | Schéma déjà multi-produits/multi-unités ; modules `hr/`, `investment/` extensibles sans toucher au pipeline |
| Mobile / temps réel / bac à sable client | Moteur isomorphe sans dépendance serveur (ADR-06) |
| Rejeu, audit, e-sport | Déterminisme seedé + journal de décisions append-only (ADR-05, ADR-13) |

## 2. Trajectoire produit proposée (post-MVP)

**Horizon 1 — consolidation pédagogique**
Étape 12 (coach LLM : questionnement socratique, analyse des justifications libres,
génération contrôlée de variantes de situations — validées par un humain avant
publication) ; éditeur visuel de scénarios pour enseignants ; banque de situations
partagée ; export des résultats (CSV/PDF) et intégration cahier de notes.

**Horizon 2 — échelle**
Étape 13 complète : championnat inter-établissements (qualifications → finale),
anti-triche comportemental (signaux multi-comptes, collusion), spectateur/replay,
i18n (l'UI est déjà à clés ; ajouter les dictionnaires et les conventions comptables
paramétrées par « référentiel comptable » du scénario), SSO établissements (GAR/EduConnect,
Google Workspace), facturation SaaS par organisation (sièges enseignants).

**Horizon 3 — plateforme**
API publique de scénarios (marketplace), certification de compétences (profil joueur
exportable, open badges), mode formation professionnelle (scénarios métiers, cohortes
entreprise), analytics d'apprentissage agrégées (tableaux de bord direction).

## 3. Règles de gouvernance technique dans la durée (§36)

1. **Compatibilité** : `ENGINE_VERSION` en semver ; une partie se rejoue toujours avec la
   version qui l'a créée (les versions majeures du moteur cohabitent le temps des parties
   en cours — le moteur étant pur, garder N et N−1 importables coûte peu).
2. **Migrations** : additives d'abord ; toute migration destructive passe par une phase
   de double-écriture ; les JSONB sont versionnés (`configVersion`) avec migrateurs zod.
3. **Référentiels** : concepts/modèles/événements évoluent par seed idempotent versionné ;
   jamais de suppression d'un code référencé (dépréciation par statut).
4. **Qualité** : la barre de tests (doc 09) est un contrat permanent ; les snapshots dorés
   documentent chaque changement d'équilibrage ; les tests d'architecture empêchent
   l'érosion des frontières.
5. **Documentation vivante** : ce dossier `docs/` est mis à jour dans le même commit que
   tout changement d'architecture (revue impossible sinon).
