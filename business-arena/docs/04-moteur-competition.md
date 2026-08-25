# 04 — Architecture du moteur de compétition

Couvre le point 5 de la mission n°37 (§25–§26). Le MVP n'implémente que le socle
(mode compétition simple) ; le mode concours « BUSINESS ARENA CHAMPIONSHIP » est
**anticipé dans le schéma et les contrats**, pas développé (ADR-12).

---

## 1. Les trois modes de jeu

| | Apprentissage | Compétition | Concours (post-MVP) |
|---|---|---|---|
| Indices | complets | limités (quota) | selon phase, souvent aucun |
| Décisions | modifiables, tour rejouable en bac à sable | **verrouillées après validation** | verrouillées + échéance stricte |
| Règles | adaptables par l'enseignant | identiques pour tous, figées à la création | identiques + auditées |
| Classement | facultatif, formatif | temps réel ou différé (choix organisateur) | différé jusqu'à l'annonce |
| Information | selon difficulté | selon difficulté, symétrique | symétrique, souvent réduite |

Le mode est un attribut de la partie (`games.mode`) qui pilote les politiques
(verrouillage, indices, visibilité du classement) dans la **couche services** — le moteur
économique est identique dans les trois modes.

## 2. Socle MVP (mode compétition, §25)

- **Équité** : toutes les entreprises d'une partie partagent le même instantané de scénario,
  la même graine, la même échéance de tour. Les événements `scope: market` frappent tout le
  monde ; les événements `scope: company` sont tirés par le PRNG commun (auditables au rejeu).
- **Verrouillage** : la validation des décisions est définitive (horodatée serveur) ;
  l'absence de validation à l'échéance reconduit les décisions précédentes (ADR-04).
- **Anti-triche MVP** (ADR-13) : résolution 100 % serveur, journal append-only des décisions,
  graine et paramètres cachés non exposés, indices tracés, rejeu de contrôle
  (`scripts/replay.ts` doit reproduire exactement les résultats publiés).
- **Classement** : par le BPI (doc 08), pas par le seul résultat financier ; l'historique
  des décisions de chaque équipe est archivé et consultable après la partie.

## 3. Moteur de concours (`src/competition`) — contrats posés dès le MVP

Un **concours** (`competitions`) est un arbre de **phases** (`competition_stages`) :

```
Concours ──< Stages (qualification | groupes | élimination | demi-finale | finale)
                │  format: { type, gamesPerStage, teamsPerGame, advanceCount, tieBreakers[] }
                └──< Games (parties ordinaires, games.competition_stage_id renseigné)
Inscriptions ──< competition_entries (équipe, organisation, statut)
```

- Chaque phase engendre des **parties ordinaires** : le moteur de compétition ne fait que
  composer les groupes (seeding par BPI ou tirage seedé), agréger les classements de phase
  et propager les qualifiés vers la phase suivante (`advanceCount`, `tieBreakers` :
  BPI, puis performance financière, puis trésorerie finale).
- Classement individuel ET par équipe : l'individuel agrège les BPI des parties jouées par
  le joueur (les équipes étant possiblement recomposées entre phases).
- Ce design garantit qu'organiser un championnat national = de l'orchestration de parties
  existantes, **zéro modification du moteur économique**.

## 4. Rôles et cycle de vie

- `organizer` (rôle sur le concours) : crée les phases, fixe le calendrier, publie les
  résultats. L'enseignant est l'organisateur naturel d'une compétition de classe.
- Cycle d'une partie : `draft → open → round_in_progress ⇄ round_closed → finished → archived`.
- Cycle d'un concours : `draft → registration → running(stage k) → finished`.
- Les échéances (tours et phases) sont exécutées par le cron Vercel (doc 01 §5), idempotent.
