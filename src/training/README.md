# Business Arena Training System

Système modulaire et extensible de formation ABC et coûts pour Business Arena.

## 📋 Structure

```
src/training/
├── types.ts              # Définitions TypeScript
├── glossary.ts           # Glossaire ABC (20+ termes)
├── modules.ts            # Tutoriels, cas d'étude, ressources
├── components/           # Composants React
│   ├── tutorial-overlay.tsx
│   ├── glossary-panel.tsx
│   ├── training-gallery.tsx
│   └── help-card.tsx
├── hooks/                # Hooks React personnalisés
│   └── useGlossary.ts
├── services/             # Services métier
│   └── progress.service.ts
└── index.ts              # Exports principaux
```

## 🎓 4 Types de modules

### 1. **Tutoriels** (Tutorial)
Guides interactifs avec overlays et étapes dirigées.

**Exemples existants:**
- `settings-rules-intro` — Paramétrer les 3 étapes des règles d'affectation
- `settings-activities-abc` — Mettre en place l'ABC et les inducteurs
- `cockpit-first-look` — Découvrir le tableau de bord

**Création rapide:**
```typescript
const myTutorial: Tutorial = {
  id: "my-tutorial",
  type: "tutorial",
  title: "Mon tutoriel",
  description: "...",
  difficulty: "beginner",
  estimatedTime: 10,
  tags: ["abc"],
  pageRoute: "/app/[companyId]/settings/activities",
  steps: [
    {
      id: "step-1",
      title: "Étape 1",
      description: "...",
      targetElement: "[data-tutorial='target']",
      action: "Cliquez sur...",
      hint: "💡 ...",
      position: "right",
    },
  ],
};
```

### 2. **Cas d'étude** (Scenario)
Scénarios pédagogiques avec données, objectifs, et questions.

**Exemples existants:**
- `case-fabric-mill` — Filature textile ABC 3 tissus
- `case-hotel-segments` — Hôtel 4-étoiles par segment client

**Création rapide:**
```typescript
const myScenario: Scenario = {
  id: "my-case",
  type: "scenario",
  title: "Mon cas d'étude",
  description: "...",
  difficulty: "intermediate",
  estimatedTime: 45,
  tags: ["abc", "real-case"],
  icon: "📋",
  caseStudy: `# Titre\n\nContenu markdown...`,
  objectives: [
    "Objectif 1",
    "Objectif 2",
  ],
  datasets: [
    {
      name: "Données",
      description: "...",
      downloadUrl: "/training/datasets/file.csv",
      format: "csv",
    },
  ],
  questions: [
    {
      id: "q1",
      question: "Question ?",
      type: "text",
      expectedAnswer: "Réponse",
    },
  ],
};
```

### 3. **Ressources** (Resource)
Guides, aide-mémoires, vidéos, articles.

**Exemples existants:**
- `guide-abc-steps` — 7 étapes pour implémenter l'ABC
- `cheatsheet-drivers` — 30 inducteurs par secteur
- `video-abc-basics` — Vidéo 8 min ABC basics

**Création rapide:**
```typescript
const myResource: Resource = {
  id: "my-resource",
  type: "resource",
  category: "guide",
  title: "Mon guide",
  description: "...",
  difficulty: "beginner",
  estimatedTime: 30,
  tags: ["abc"],
  contentUrl: "/training/guides/my-guide.html",
  contentType: "html",
  authors: ["Nom"],
  publishedDate: "2025-01-15",
};
```

### 4. **Glossaire** (Glossary)
Dictionnaire interactif des termes ABC et finance.

**20+ entrées existantes:** `abc`, `activity`, `driver`, `cost-pool`, `cost-object`, `margin`, `cross-subsidy`, etc.

**Ajouter un terme:**
```typescript
GLOSSARY["my-term"] = {
  id: "my-term",
  type: "glossary",
  term: "Terme français",
  definition: "Courte définition...",
  example: "Exemple concret...",
  category: "costing",
  relatedTerms: ["autre-terme"],
};
```

## 📦 Parcours pédagogiques (TrainingPath)

Chemins d'apprentissage guidés, ordonnés par module.

**Existants:**
- `beginner-abc` — 3h pour maîtriser les fondamentaux
- `intermediate-analysis` — 5h ABC avancée et rentabilité

**Créer un parcours:**
```typescript
const myPath: TrainingPath = {
  id: "my-path",
  name: "Mon parcours",
  description: "...",
  targetAudience: "beginner",
  estimatedDuration: 180,
  modules: [
    "tutorial-id",
    "scenario-id",
    "resource-id",
    // ...
  ],
};
```

## 🎯 Composants

### TutorialOverlay
Affiche une étape guidée avec highlight et tooltip.

```tsx
<TutorialOverlay
  title="Titre"
  steps={steps}
  currentStep={0}
  onNext={() => {}}
  onPrev={() => {}}
  onClose={() => {}}
  onSkip={() => {}}
/>
```

### GlossaryPanel
Panneau latéral avec glossaire complet + recherche.

```tsx
<GlossaryPanel
  entries={GLOSSARY}
  defaultOpen="abc"
  onClose={() => setOpen(false)}
/>
```

### TrainingGallery
Galerie visuelle des modules d'un parcours.

```tsx
<TrainingGallery
  path={TRAINING_PATHS.beginner}
  modules={moduleMap}
  completedModules={completed}
  onSelectModule={handleSelect}
/>
```

### HelpCard
Carte d'aide contextuelle (info, actions, dismissible).

```tsx
<HelpCard
  title="Besoin d'aide ?"
  description="Vous pouvez aussi..."
  actions={[{ label: "Voir le guide", onClick: () => {} }]}
  dismissible
/>
```

## 🪝 Hooks

### useGlossary
Gère l'état du glossaire (ouverture, recherche).

```tsx
const { isOpen, setIsOpen, searchTerm, setSearchTerm, entries } = useGlossary();
```

## 🔧 Services

### TrainingProgressService
Gère la progression (localStorage, pas d'API pour la démo).

```typescript
// Démarrer un module
TrainingProgressService.startModule(userId, moduleId);

// Marquer comme complété
TrainingProgressService.markAsCompleted(userId, moduleId);

// Avancer dans un tutoriel
TrainingProgressService.updateTutorialStep(userId, moduleId, 2);

// Enregistrer le score d'un scénario
TrainingProgressService.recordScenarioScore(userId, moduleId, 85);

// Obtenir les modules complétés
const completed = TrainingProgressService.getCompletedModules(userId);

// Progression d'un parcours (%)
const pct = TrainingProgressService.getPathProgress(userId, moduleIds);
```

## 🚀 Intégration UI

### Page Formation
Page d'accueil des parcours: `/app/[companyId]/training`

```tsx
// Dans layout.tsx, ajouter le lien nav
<Link href="/app/[companyId]/training">📚 Formation</Link>
```

### Tutoriels intégrés
Pour ajouter un tutoriel à une page existante:

```tsx
// Dans la page (ex: settings/rules/page.tsx)
"use client";
import { TutorialOverlay } from "@/training/components";
import { TUTORIALS } from "@/training/modules";

// Ajouter les data-tutorial sur les éléments
<div data-tutorial="rule-source">...</div>
```

### Glossaire contextuel
Ajouter un bouton 📖 dans les pages de paramètres:

```tsx
"use client";
import { useState } from "react";
import { GlossaryPanel } from "@/training/components";
import { GLOSSARY } from "@/training/glossary";

export function PageWithGlossary() {
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  return (
    <>
      <button onClick={() => setGlossaryOpen(!glossaryOpen)}>📖 Glossaire</button>
      {glossaryOpen && <GlossaryPanel entries={Object.values(GLOSSARY)} onClose={() => setGlossaryOpen(false)} />}
    </>
  );
}
```

## 📊 Statistiques

**Glossaire:** 20 termes (costing, finance, insights, tools)  
**Tutoriels:** 3 tutoriels interactifs  
**Cas d'étude:** 2 scénarios complets  
**Ressources:** 4 ressources (1 guide, 1 cheatsheet, 1 vidéo, 1 article)  
**Parcours:** 2 chemins (débutant 3h, intermédiaire 5h)

## 🎨 Design

- **Thème clair/sombre:** Tous les composants supportent les deux thèmes
- **Responsive:** Mobile-first, adapté à tous les écrans
- **Accessibilité:** ARIA labels, contraste, navigation clavier
- **Performance:** localStorage pour la progression (pas d'API appels)

## 📝 À ajouter

1. **Davantage de tutoriels** (10-15) sur les pages clés
2. **Davantage de cas d'étude** (5-10) par secteur
3. **Ressources vidéo** (playlists YouTube)
4. **Quiz interactifs** après chaque module
5. **Certification** (badge, certificat PDF)
6. **Analytics** (voir quels modules sont populaires)
7. **Recommandations** (basées sur la progression)
8. **Multiplayer challenges** (cas d'étude en équipe)

## 🔗 URLs

- `/app/[companyId]/training` — Tous les parcours
- `/app/[companyId]/training/[pathId]` — Détails d'un parcours
- Tutoriels: param `?tutorial=id` sur la page cible
