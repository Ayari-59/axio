# Business Arena — Spécification du cycle Produit & UX post-audit

## Verdict de préparation

### 🟢 READY TO BUILD — C1 et B1 sont livrés

### 🟡 READY WITH DECISIONS — A1

La chaîne Situation → Concept → Compétence est entièrement câblée.
Deux décisions fonctionnelles doivent être tranchées avant le code :

1. **Profondeur du lien causal affiché** : les règles de détection nomment des
   variables de résultat, pas des décisions. Le système peut dire « votre
   trésorerie nette est négative malgré un résultat positif » mais pas « c'est
   parce que vous avez accordé 60 jours de délai ». Faut-il afficher le
   contexte factuel seul, ou tenter un rapprochement heuristique
   décision → variable ?

2. **Emplacement du composant causal** : dans la carte situation existante
   (enrichissement) ou dans une section dédiée entre le débriefing et le
   formulaire de décisions ?

Recommandation : contexte factuel seul (pas d'heuristique) + enrichissement de
la carte existante. Argumentaire dans la section A1 ci-dessous.

---

## 1. Contexte

L'audit Produit & UX a conclu :

> Produit techniquement solide mais valeur insuffisamment visible.

Le cycle post-audit se compose de trois interventions ordonnées :

| Code | Intervention | Statut |
|------|-------------|--------|
| C1 | Rafraîchissement automatique du statut du tour | ✅ Livré (PR #1, `main`) |
| B1 | Réorganisation de la page joueur | ✅ Livré (PR #2, `main`) |
| A1 | Causalité pédagogique visible | À implémenter |

---

## 2. C1 — Rafraîchissement automatique (livré)

### Ce qui a été fait

Polling côté client avec `visibilitychange` : la page joueur et la page
enseignant interrogent l'état du tour toutes les 30 secondes lorsque l'onglet
est visible, et cessent lorsqu'il est masqué. Au retour en premier plan, un
rafraîchissement immédiat est déclenché.

### Données surveillées

| Page | Donnée | Endpoint | Changement détecté | Rafraîchissement |
|------|--------|----------|-------------------|-----------------|
| Joueur (`/arena/[gameId]`) | `round.status` | Server action (revalidation) | `open → resolved` | Rechargement complet (nouvelle page serveur) |
| Enseignant (`/teacher/games/[gameId]`) | `decisions[].status` | Server action (revalidation) | Nombre de `validated` change | Rechargement de la table des équipes |

### Décision technique

Option B retenue (polling + `visibilitychange`). Pas de WebSocket ni SSE.

---

## 3. B1 — Réorganisation de la page joueur (livré)

### Ce qui a été fait

Restructuration de la hiérarchie visuelle de `/arena/[gameId]` pour que
l'action principale (prendre ses décisions) soit accessible en moins de
5 secondes.

### Structure cible atteinte

```
┌─────────────────────────────────────────────┐
│ EN-TÊTE : Tour N / Total · Niveau · Équipe  │
├─────────────────────────────────────────────┤
│ BANNIÈRE DE STATUT                           │
│ « À vous de jouer » / « En attente »         │
├─────────────────────────────────────────────┤
│ RÉSUMÉ RAPIDE : 4 KPI (CA, Résultat,        │
│ Trésorerie, Production)                      │
├─────────────────────────────────────────────┤
│ CONTEXTE DU TOUR : Paramètres + Dilemme      │
├─────────────────────────────────────────────┤
│ SITUATIONS ACTIVES (diagnostic + QCM)         │
├─────────────────────────────────────────────┤
│ ⬇ FORMULAIRE DE DÉCISIONS                    │
├─────────────────────────────────────────────┤
│ ▸ Résultats détaillés (repliable)            │
│ ▸ Analyses (repliable)                       │
│ ▸ Informations détaillées (repliable)        │
└─────────────────────────────────────────────┘
```

### Analyse des sections (état actuel du code)

La page `arena/[gameId]/page.tsx` rend les sections suivantes, de haut en bas :

| # | Section | Composant | Repliable | Position cible |
|---|---------|-----------|-----------|---------------|
| 1 | En-tête (tour, équipe, niveau) | Inline JSX | Non | Fixe en haut |
| 2 | Nom d'équipe (tour 1) | `TeamNameForm` | Non | Fixe en haut |
| 3 | KPI tiles (×4) | `KpiCard` | Non | Résumé rapide |
| 4 | KPI sectoriels | Inline JSX | Non | Résumé rapide |
| 5 | Graphiques (CA, Trésorerie) | `RevenueChart`, `TreasuryChart` | Non | Résultats |
| 6 | Marché du tour | Inline `<table>` | Non | Résultats |
| 7 | Cartes événement | `EventCard` | Non | Résultats |
| 8 | Commandes exceptionnelles | Inline `<p>` | Non | Résultats |
| 9 | Prévisions vs réalisé | Inline `<table>` | Non | Résultats |
| 10 | Refus d'emprunt | Inline `<p>` | Non | Résultats |
| 11 | États financiers (×4) | `FinancialStatements` | ✅ `<details>` | Analyses |
| 12 | Études achetées | `StudyReportsPanel` | Non | Analyses |
| 13-19 | Notices (capital, dette, trésorerie, investissement, qualité, RH, assurance) | Inline `<p>` | Non | Informations |
| 20 | Classement BPI | Inline `<ol>` | Non | Informations |
| 21 | Profil BPI | `BpiPanel` | Non | Informations |
| 22 | Débriefing situations | `SituationDebrief` | Non | Après résultats |
| 23 | Briefing du tour + Paramètres + Dilemme | `ParametersPanels`, `DilemmaCard` | Non | Contexte |
| 24 | Historique des ventes | `SalesHistory` | ✅ `<details>` | Informations |
| 25 | Notes de saison | Inline `<section>` | Non | Contexte |
| 26 | Cartes annoncées | `EventCard` | Non | Contexte |
| 27 | Situations actives | `SituationCard` | Non | Avant l'action |
| 28 | **Formulaire de décisions** | `DecisionForm` | Non | **L'action** |

Le formulaire est la section #28 sur 28. B1 a remonté l'action en la
plaçant après le résumé rapide et le contexte, avant les détails.

---

## 4. A1 — Rendre visible la causalité pédagogique

### 4.1. Chaîne de causalité dans le code

La chaîne complète a été tracée dans le code source :

```
DÉCISION (RoundDecisions)
    ↓  simulateRound() — moteur pur, déterministe
RÉSULTAT (CompanyRoundResult)
    ↓  detectSituations() — 5 règles explicites
SITUATION DÉTECTÉE (SituationInstance)
    ↓  SituationDef.conceptCodes — déclaratif
CONCEPT (ConceptDef)
    ↓  ConceptDef.axis — déclaratif
COMPÉTENCE (PlayerSkills)
```

#### Fichiers clés

| Maillon | Fichier | Fonction / Structure |
|---------|---------|---------------------|
| Décisions | `src/services/game.service.ts:527` | `submitTeamDecisions()` |
| Résolution | `src/engine/simulation/index.ts:74` | `simulateRound()` |
| Résultats | `src/engine/types.ts:586` | `CompanyRoundResult` |
| Détection | `src/pedagogy/detection.ts:8` | `detectSituations()` |
| Instanciation | `src/services/pedagogy.service.ts:155` | `openSituationsForRound()` |
| Définitions | `src/config/scenarios/nova/situations.ts` | `NOVA_SITUATIONS[]` |
| Concepts | `src/config/pedagogy/concepts.ts` | `CONCEPTS[]`, `conceptByCode` |
| Progression | `src/pedagogy/progress.ts` | `updateMastery()`, `aggregateAxis()` |
| Débriefing | `src/services/pedagogy.service.ts:449` | `debriefRound()` |

#### Règles de détection existantes

| DetectCode | Condition sur `CompanyRoundResult` | Variables observées |
|---|---|---|
| `profitable_illiquid` | `netIncome > 0 AND netTreasury < 0` | `incomeStatement.netIncome`, `functionalBalance.netTreasury` |
| `below_breakeven` | `netIncome < 0` | `incomeStatement.netIncome` |
| `stockout` | `sold > 0 AND lost > 10% × sold` | `market.bySegment[*].sold`, `.lost` |
| `capacity_saturated` | `utilizationRate ≥ 0.97 AND sold > 0 AND lost > 5% × sold` | `production.utilizationRate`, `market.bySegment` |
| `idle_cash` | `overdraft < 0.5 AND shortTermInvestment < 0.5 AND cash > 1.5 × fixedCosts` | `balanceSheet.overdraft`, `.cash`, `incomeStatement.fixedCosts` |

#### Liaison Situation → Concept (NOVA)

| Situation | conceptCodes | Axe de compétence |
|-----------|-------------|-------------------|
| `nova_t1_takeover` | `revenue`, `fixed_costs`, `variable_costs`, `contribution_margin`, `breakeven` | finance, finance, finance, finance, finance |
| `detect_profitable_illiquid` | `net_treasury`, `bfr`, `frng` | finance, finance, finance |
| `detect_stockout` | `stock`, `capacity`, `seasonality` | production, production, analysis |
| `detect_below_breakeven` | `breakeven`, `contribution_margin`, `fixed_costs`, `safety_margin`, `dead_point` | finance, finance, finance, risk, finance |
| `detect_capacity_saturated` | `discounting`, `irr_payback`, `capacity`, `contribution_margin` | finance, finance, production, finance |
| `detect_idle_cash` | `net_treasury`, `frng`, `bfr`, `profitability_vs_return` | finance, finance, finance, analysis |

### 4.2. Traçabilité : ce qui est disponible et ce qui ne l'est pas

#### ✅ Démontrable (données disponibles)

| Lien | Source | Mécanisme |
|------|--------|-----------|
| Résultat → Situation | `detection.ts` | Les règles nomment explicitement les variables de résultat et les seuils. Les valeurs réelles sont dans `roundResults`. |
| Situation → Concepts | `SituationDef.conceptCodes` | Déclaratif, stocké dans `situation_concepts` en base. |
| Concepts → Compétence | `ConceptDef.axis` | Déclaratif dans la config statique. `recomputeSkills()` agrège. |
| Score situation → Progression | `debriefRound()` | Moyenne exponentielle via `updateMastery()`. |

#### ⚠️ Rupture structurelle

| Lien manquant | Pourquoi | Conséquence |
|---------------|----------|-------------|
| **Décision → Variable de résultat** | Le moteur de simulation est un calcul continu (élasticité, allocation de marché, coûts, états financiers). Il n'y a pas de métadonnée déclarant « la décision `price` affecte `revenue` ». Le lien existe dans le code d'exécution, pas dans une structure interrogeable. | On ne peut pas dire « votre prix à 80 € a causé la perte ». |
| **Décision → Situation** | Corollaire du précédent. `situationInstances` enregistre l'équipe et le tour, pas les décisions qui ont mené au déclenchement. | On ne peut pas dire « votre décision X a directement causé la situation Y ». |

### 4.3. Recommandation : contexte factuel, pas causalité inventée

La spécification distingue deux registres :

**Causalité démontrable** (à afficher) :
> Votre résultat net est positif (12 400 €) mais votre trésorerie nette
> est négative (−8 200 €). Cette situation a déclenché l'analyse
> « Rentable mais illiquide ».

**Causalité non démontrable** (à ne pas afficher) :
> Votre décision de fixer le prix à 80 € a causé la perte.

Le système affiche les **faits comptables** qui ont déclenché la détection,
pas une attribution de causalité aux décisions. Cette contrainte est une
force pédagogique : c'est à l'étudiant de remonter la chaîne causale,
guidé par le diagnostic, les indices et les concepts.

### 4.4. Conception du composant pédagogique

#### Enrichissement de `SituationCard` et `SituationDebrief`

Plutôt que créer un composant séparé, enrichir les cartes existantes avec
un bloc « Pourquoi cette situation ? » qui exploite des données déjà
disponibles.

##### État actuel de `SituationCard` (`situation-panel.tsx`)

```
┌ Situation détectée dans vos comptes ────────────┐
│ Titre                                            │
│ Récit (narrative)                                │
│ Problème posé (problem)                          │
│                                                  │
│ 1 · Votre diagnostic [formulaire]                │
│ 2 · Connaissances et modèle [QCM]               │
│ 3 · Indices progressifs [déblocage]              │
└──────────────────────────────────────────────────┘
```

##### État cible de `SituationCard`

```
┌ Situation détectée dans vos comptes ────────────┐
│ Titre                                            │
│ Récit (narrative)                                │
│ Problème posé (problem)                          │
│                                                  │
│ ┌ POURQUOI CETTE SITUATION ? ──────────────────┐ │  ← NOUVEAU
│ │ Résultat net : 12 400 € (positif)            │ │
│ │ Trésorerie nette : −8 200 € (négative)       │ │
│ │                                               │ │
│ │ → Votre entreprise gagne de l'argent          │ │
│ │   mais n'en a pas en caisse.                  │ │
│ └───────────────────────────────────────────────┘ │
│                                                  │
│ 1 · Votre diagnostic [formulaire]                │
│ 2 · Connaissances et modèle [QCM]               │
│ 3 · Indices progressifs [déblocage]              │
└──────────────────────────────────────────────────┘
```

##### État cible de `SituationDebrief`

```
┌ Débriefing ─────────────────────────────────────┐
│ Titre                              Score: 72/100 │
│                                                  │
│ ┌ CHEMINEMENT PÉDAGOGIQUE ─────────────────────┐ │  ← NOUVEAU
│ │                                               │ │
│ │ Vos résultats                                 │ │
│ │   Résultat net : 12 400 €                     │ │
│ │   Trésorerie nette : −8 200 €                 │ │
│ │           ↓                                   │ │
│ │ Situation détectée                            │ │
│ │   Rentable mais illiquide                     │ │
│ │           ↓                                   │ │
│ │ Notions mobilisées                            │ │
│ │   [Trésorerie nette] [BFR] [FRNG]            │ │
│ │           ↓                                   │ │
│ │ Objectif d'apprentissage                      │ │
│ │   Identifier l'origine du besoin              │ │
│ │   de financement du cycle d'exploitation.     │ │
│ │                                               │ │
│ └───────────────────────────────────────────────┘ │
│                                                  │
│ Diagnostic [correction]                          │
│ Connaissances [correction]                       │
│ Le bon outil ici [modèle]                        │
│ Notions mobilisées [badges existants]            │
└──────────────────────────────────────────────────┘
```

#### Données nécessaires (toutes existantes)

| Donnée | Source actuelle | Exposition actuelle | Action A1 |
|--------|----------------|--------------------| --------- |
| Variables de détection et leurs valeurs | `roundResults` (jsonb) | Pas dans `SituationView` | Ajouter `triggerFacts` à `SituationView` |
| Condition de détection (seuils) | `detection.ts` (code) | Pas exposée | Créer un registre `DETECTION_METADATA` |
| Concepts (code + nom) | `conceptByCode` | Dans `debrief.concepts` (après débriefing uniquement) | Exposer aussi dans les situations actives |
| Définition des concepts | `ConceptDef` | Page `/notions` uniquement | Ajouter `definition` aux concepts servis |
| Axe de compétence | `ConceptDef.axis` | Pas dans `SituationView` | Ajouter `axis` aux concepts servis |

### 4.5. Changements techniques détaillés

#### Étape 1 — Registre de métadonnées de détection

Créer un registre déclaratif dans `src/pedagogy/detection.ts` :

```typescript
export interface DetectionMeta {
  code: DetectCode;
  variables: {
    key: string;                    // chemin dans CompanyRoundResult
    label: string;                  // libellé français
    format: "euro" | "percent" | "units" | "ratio";
  }[];
  summary: (values: Record<string, number>) => string;
}

export const DETECTION_METADATA: Record<DetectCode, DetectionMeta> = {
  profitable_illiquid: {
    code: "profitable_illiquid",
    variables: [
      { key: "incomeStatement.netIncome", label: "Résultat net", format: "euro" },
      { key: "functionalBalance.netTreasury", label: "Trésorerie nette", format: "euro" },
    ],
    summary: (v) =>
      `Votre entreprise dégage un résultat positif (${formatEuro(v["incomeStatement.netIncome"]!)}) mais sa trésorerie nette est négative (${formatEuro(v["functionalBalance.netTreasury"]!)}).`,
  },
  below_breakeven: { /* ... */ },
  stockout: { /* ... */ },
  capacity_saturated: { /* ... */ },
  idle_cash: { /* ... */ },
};
```

Ce registre ne modifie pas la logique de détection. Il la documente.

#### Étape 2 — Enrichir `SituationView`

Ajouter à l'interface `SituationView` dans `pedagogy.service.ts` :

```typescript
/** Faits comptables ayant déclenché la situation (situations détectées uniquement). */
triggerFacts: {
  variables: { label: string; value: number; format: string }[];
  summary: string;
} | null;

/** Concepts mobilisés (toujours servis, pas seulement au débriefing). */
concepts: { code: string; name: string; definition: string; axis: string }[];
```

#### Étape 3 — Alimenter `triggerFacts` dans `toView()`

Dans `pedagogy.service.ts`, la fonction `toView()` doit recevoir les résultats
du tour précédent pour les situations détectées. Ces résultats sont déjà
disponibles dans `roundResults` — il faut les passer au moment de la
construction de la vue.

```typescript
function toView(
  instance: ...,
  def: SituationDef,
  levels: number[],
  quizMode: QuizMode,
  hintCap: ...,
  triggerResult?: CompanyRoundResult,  // ← NOUVEAU paramètre
): SituationView {
  // ...
  const triggerFacts = buildTriggerFacts(def, triggerResult);
  // ...
}
```

`buildTriggerFacts()` :
1. Vérifie que `def.trigger` est `{ detect: DetectCode }`.
2. Cherche la `DetectionMeta` correspondante.
3. Extrait les valeurs depuis `triggerResult`.
4. Appelle `meta.summary(values)`.

#### Étape 4 — Enrichir les composants UI

**`SituationCard`** : ajouter un bloc `<section>` entre le `<header>` et le
diagnostic, montrant `triggerFacts.summary` et les variables formatées.

**`SituationDebrief`** : ajouter un bloc « Cheminement pédagogique » avant
la correction du diagnostic, avec :
- Les faits déclencheurs (`triggerFacts`)
- La flèche vers le titre de la situation
- Les concepts mobilisés (déjà dans `debrief.concepts`)
- Le concept `definition` (premier niveau d'explication)

#### Étape 5 — Exposer les concepts dans les situations actives

Actuellement, `debrief.concepts` n'est renseigné qu'après le débriefing.
Ajouter un champ `concepts` au niveau racine de `SituationView`, toujours
renseigné (y compris pour les situations `open`). Cela permet d'afficher
« Notions en jeu : [BFR] [FRNG] [Trésorerie nette] » avant même que
l'étudiant n'ait soumis son diagnostic.

### 4.6. Ce qui N'est PAS créé

| Élément | Raison |
|---------|--------|
| Nouvelle table | Les `roundResults` et `situationInstances` suffisent |
| Nouvelle colonne | Les variables sont lues depuis le jsonb existant |
| Nouveau service | `buildTriggerFacts()` est une fonction pure, pas un service |
| Nouvelle API | La vue est servie par le même `getTeamSituations()` |
| Nouveau calcul | On lit des résultats existants, on ne calcule rien |
| Heuristique décision → résultat | Trop fragile, fausse pédagogie |

---

## 5. Cohérence des trois interventions

### Scénario bout-en-bout

```
ENSEIGNANT CLÔTURE LE TOUR
        ↓
  C1 : Le joueur voit le changement sans recharger
        ↓
  B1 : Le nouveau tour apparaît avec l'action en premier
        ↓
  A1 : La situation détectée montre POURQUOI elle est là
        ↓
JOUEUR COMPREND LE LIEN ENTRE SES RÉSULTATS ET LA SITUATION
        ↓
JOUEUR RÉPOND AU DIAGNOSTIC AVEC CONTEXTE
        ↓
JOUEUR PREND SES DÉCISIONS
        ↓
ENSEIGNANT VOIT LA PROGRESSION
```

Vérification : chaque intervention améliore un segment distinct du parcours.
Aucun chevauchement, aucune dépendance circulaire.

### Flux de données

```
                   C1                    B1                    A1
                   ↓                     ↓                     ↓
polling       → détection          réorganisation      triggerFacts
visibilitychange  du changement    hiérarchique        dans SituationView
                   ↓                     ↓                     ↓
              rechargement page    action en haut       bloc "Pourquoi ?"
                                   détails en bas       dans SituationCard
```

---

## 6. Inventaire technique

### A1 uniquement (C1 et B1 sont livrés)

| Dimension | Éléments concernés |
|-----------|-------------------|
| **Routes** | `/arena/[gameId]` (lecture seule, pas de nouvelle route) |
| **Composants** | `SituationCard` (`src/components/situation-panel.tsx`), `SituationDebrief` (même fichier) |
| **Services** | `pedagogy.service.ts` — fonctions `toView()` et `getTeamSituations()` |
| **Fonctions pures** | Nouveau : `buildTriggerFacts()`. Nouveau registre : `DETECTION_METADATA` dans `src/pedagogy/detection.ts` |
| **Config** | `src/config/pedagogy/concepts.ts` — lecture seule (pas de modification) |
| **Types** | `SituationView` — 2 champs ajoutés (`triggerFacts`, `concepts` au niveau racine) |
| **DB** | Aucune migration. Lecture du jsonb `roundResults.incomeStatement`, `.functionalBalance`, `.market`, `.production`, `.balanceSheet` |
| **API** | Aucune. Les données passent par le rendu serveur existant. |

---

## 7. Plan d'implémentation

### Étape 1 — Registre `DETECTION_METADATA`

**Fichier** : `src/pedagogy/detection.ts`

Ajouter le registre `DETECTION_METADATA` qui documente chaque règle de
détection : les variables observées (chemin dans `CompanyRoundResult`,
libellé, format) et une fonction `summary()` qui produit la phrase
factuelle.

**Critère** : le registre est importable et les 5 `DetectCode` sont couverts.
Aucun changement de comportement.

### Étape 2 — `buildTriggerFacts()`

**Fichier** : `src/pedagogy/detection.ts` (ou nouveau fichier `src/pedagogy/trigger-facts.ts`)

Fonction pure :
- Entrée : `SituationDef`, `CompanyRoundResult | undefined`
- Sortie : `TriggerFacts | null`
- Logique : si `trigger` est `{ detect }`, extraire les variables du résultat
  via `DETECTION_METADATA`, formater, appeler `summary()`.

**Critère** : test unitaire avec un `CompanyRoundResult` minimal.

### Étape 3 — Enrichir `SituationView` et `toView()`

**Fichier** : `src/services/pedagogy.service.ts`

1. Ajouter `triggerFacts` et `concepts` (racine) à `SituationView`.
2. Modifier `toView()` pour accepter un `triggerResult` optionnel.
3. Modifier `getTeamSituations()` pour charger les `roundResults` du tour
   précédent et les passer à `toView()` pour les situations détectées.

**Critère** : `getTeamSituations()` retourne des `SituationView` avec
`triggerFacts` renseigné pour les situations `origin === "detected"` et
`concepts` toujours renseigné.

### Étape 4 — Enrichir `SituationCard`

**Fichier** : `src/components/situation-panel.tsx`

Ajouter un bloc entre le `<header>` et le diagnostic :
- Titre « Pourquoi cette situation ? »
- Liste des variables avec valeurs formatées
- Phrase résumé (`triggerFacts.summary`)
- Badges de concepts (code + nom, lien vers `/notions#code`)

Rendu uniquement si `triggerFacts` n'est pas null.

**Critère** : visuellement vérifié sur une partie avec situation détectée.

### Étape 5 — Enrichir `SituationDebrief`

**Fichier** : `src/components/situation-panel.tsx`

Ajouter un bloc « Cheminement pédagogique » avant la correction du diagnostic :
- Faits déclencheurs → titre de la situation → concepts → objectif
- Flèche visuelle (↓) entre chaque niveau

**Critère** : visuellement vérifié sur une partie avec situation débriefée.

### Étape 6 — Tests

Voir section 8.

---

## 8. Tests à prévoir

### Tests unitaires

| Test | Fichier cible | Ce qu'il vérifie |
|------|---------------|-----------------|
| `DETECTION_METADATA` couvre tous les `DetectCode` | `detection.test.ts` | Chaque code a un registre, chaque variable pointe vers un chemin valide dans `CompanyRoundResult` |
| `buildTriggerFacts()` — situation détectée | `trigger-facts.test.ts` | Retourne les bonnes variables et le bon résumé pour chaque `DetectCode` |
| `buildTriggerFacts()` — situation scriptée | `trigger-facts.test.ts` | Retourne `null` |
| `buildTriggerFacts()` — pas de résultat | `trigger-facts.test.ts` | Retourne `null` |
| `toView()` — concepts toujours servis | `pedagogy.service.test.ts` | `concepts` est renseigné même pour les situations `open` |

### Tests e2e

| Test | Fichier | Ce qu'il vérifie |
|------|---------|-----------------|
| Bloc « Pourquoi » visible | `situations.e2e.ts` (nouveau ou ajouté à l'existant) | Une situation détectée affiche le bloc avec les variables |
| Bloc absent pour scriptée | `situations.e2e.ts` | Une situation scriptée n'affiche pas le bloc |
| Cheminement au débriefing | `situations.e2e.ts` | Le débriefing affiche le cheminement pédagogique |
| Lien vers `/notions` | `situations.e2e.ts` | Les badges de concepts sont des liens fonctionnels |

### Tests de non-régression

| Composant sensible | Risque | Test |
|-------------------|--------|------|
| `SituationCard` — diagnostic | Le nouveau bloc déplace le formulaire | Vérifier que le diagnostic reste fonctionnel |
| `SituationCard` — indices | Le nouveau bloc interfère avec le layout | Vérifier que les indices s'affichent correctement |
| `SituationDebrief` — score | Le nouveau bloc modifie l'affichage du score | Vérifier que le score reste visible |
| `getTeamSituations()` — performance | La jointure sur `roundResults` ajoute une requête | Mesurer le temps de réponse |

---

## 9. Risques

| Risque | Prob. | Impact | Prévention |
|--------|------:|-------:|-----------|
| **Mauvaise attribution de causalité** | Élevée si on invente des liens | Fort (pédagogie trompeuse) | Ne montrer que les faits comptables vérifiables. Pas d'heuristique décision → résultat. |
| **Surcharge de la carte situation** | Moyen | Moyen (lisibilité) | Le bloc « Pourquoi » est compact : 2-4 lignes de variables + 1 phrase résumé. Pas de tableau. |
| **Régression des situations** | Faible | Fort | Tests existants couvrent la mécanique diagnostic/QCM/indices. Ajouter des tests pour le nouveau bloc. |
| **Performance de `getTeamSituations()`** | Faible | Faible | Une seule requête supplémentaire (`roundResults` du tour précédent). Les résultats sont déjà en base, pas de calcul. |
| **Duplication de données** | Faible | Faible | `triggerFacts` est calculé à la volée depuis `roundResults`, pas stocké. Aucune duplication. |
| **Divergence entre `detection.ts` et `DETECTION_METADATA`** | Moyen | Moyen (incohérence) | Test unitaire vérifiant que les deux registres couvrent les mêmes `DetectCode`. |

---

## 10. Priorité d'implémentation

### Ordre retenu : C1 → B1 → A1

Cet ordre est confirmé par l'analyse du dépôt :

| Critère | C1 | B1 | A1 |
|---------|:--:|:--:|:--:|
| Dépendances | Aucune | Aucune | Aucune (indépendant de C1/B1) |
| Valeur immédiate | Forte (friction supprimée) | Forte (action accessible) | Forte (compréhension) |
| Risque | Faible (polling simple) | Faible (réorganisation CSS) | Faible (lecture seule) |
| Complexité | Faible | Moyenne | Moyenne |
| Réutilisation | Aucune | Aucune | `DETECTION_METADATA` réutilisable pour le tableau de bord enseignant |

C1 et B1 sont livrés. A1 ne dépend ni de C1 ni de B1 techniquement, mais
la séquence d'expérience utilisateur est logique : d'abord supprimer la
friction (C1), puis rendre l'action visible (B1), puis rendre la valeur
pédagogique visible (A1).

---

## 11. Verdict détaillé pour A1

### 🟡 READY WITH DECISIONS

**Prêt à construire sous réserve de deux décisions :**

1. **Affichage des concepts dans `SituationCard` active** : faut-il montrer
   les concepts mobilisés AVANT que l'étudiant ait soumis son diagnostic ?
   Avantage : l'étudiant sait quoi réviser. Inconvénient : ça peut orienter
   le diagnostic.

   → Recommandation : **oui**, les concepts sont déjà visibles sur la page
   `/notions` et dans le titre de la situation. Les cacher ne protège pas
   l'exercice, les montrer aide la navigation.

2. **Registre `DETECTION_METADATA` inline ou séparé** : ajouter le registre
   dans `detection.ts` (co-localisé avec les règles) ou dans un fichier
   séparé `detection-metadata.ts` ?

   → Recommandation : **inline dans `detection.ts`**, pour que toute
   modification d'une règle de détection force la mise à jour des
   métadonnées dans le même fichier.

### Fichiers exacts à modifier

| Fichier | Modification |
|---------|-------------|
| `src/pedagogy/detection.ts` | Ajouter `DetectionMeta`, `DETECTION_METADATA`, `buildTriggerFacts()` |
| `src/services/pedagogy.service.ts` | Enrichir `SituationView`, `toView()`, `getTeamSituations()` |
| `src/components/situation-panel.tsx` | Enrichir `SituationCard` et `SituationDebrief` |
| Tests unitaires (nouveau) | `buildTriggerFacts()`, cohérence des registres |
| Tests e2e (ajout) | Vérifier le rendu du bloc causal |

### Données exactes à utiliser

| Donnée | Table/Source | Champ |
|--------|-------------|-------|
| Résultat net | `round_results` | `incomeStatement` (jsonb) → `.netIncome` |
| Trésorerie nette | `round_results` | Dénormalisé : `netTreasury` (colonne directe) |
| FRNG | `round_results` | Dénormalisé : `frng` (colonne directe) |
| BFR | `round_results` | Dénormalisé : `bfr` (colonne directe) |
| Taux d'utilisation | `round_results` | `engineTrace` (jsonb) ou recalcul depuis `production` |
| Ventes / Manqué | `round_results` | `marketDetail` (jsonb) → `.bySegment[*].sold`, `.lost` |
| Cash | `round_results` | Dénormalisé : `cash` (colonne directe) |
| Découvert | `round_results` | `balanceSheet` (jsonb) → `.overdraft` |
| Charges fixes | `round_results` | `incomeStatement` (jsonb) → `.fixedCosts` |
| Concepts | `concepts` (table) + `conceptByCode` (config) | `code`, `name`, `definition`, `axis` |
| Lien situation-concept | `situation_concepts` (table) | Jointure |

### Critères d'acceptation

1. Une situation **détectée** affiche un bloc « Pourquoi cette situation ? »
   avec les valeurs comptables réelles du tour qui l'a déclenchée.
2. Une situation **scriptée** n'affiche pas ce bloc.
3. Le **débriefing** affiche le cheminement complet :
   Résultats → Situation → Concepts → Objectif.
4. Les **concepts** sont cliquables et mènent à `/notions#code`.
5. Les concepts sont visibles **avant** le diagnostic (pas seulement au
   débriefing).
6. Aucune phrase n'attribue un résultat à une décision spécifique.
7. `DETECTION_METADATA` couvre les 5 `DetectCode` existants.
8. Pas de nouvelle table, pas de nouvelle colonne, pas de migration.
9. Tous les tests existants passent.
10. Le temps de chargement de la page joueur n'augmente pas de plus de 50 ms.
