/** Training modules for Business Arena */

export type ModuleType = "tutorial" | "scenario" | "resource" | "glossary";
export type Difficulty = "beginner" | "intermediate" | "advanced";
export type ModuleStatus = "locked" | "available" | "in-progress" | "completed";

export interface TrainingModule {
  id: string;
  type: ModuleType;
  title: string;
  description: string;
  difficulty: Difficulty;
  estimatedTime: number; // minutes
  tags: string[];
  prerequisites?: string[]; // IDs of modules that must be completed first
  icon?: string;
}

export interface Tutorial extends TrainingModule {
  type: "tutorial";
  steps: TutorialStep[];
  pageRoute: string; // Where the tutorial applies
}

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetElement?: string; // CSS selector for highlight
  action?: string; // What user should do
  hint?: string;
  position?: "top" | "bottom" | "left" | "right";
}

export interface Scenario extends TrainingModule {
  type: "scenario";
  caseStudy: string; // Markdown content
  objectives: string[];
  datasets: ScenarioDataset[];
  questions?: ScenarioQuestion[];
}

export interface ScenarioDataset {
  name: string;
  description: string;
  downloadUrl: string;
  format: "csv" | "excel";
}

export interface ScenarioQuestion {
  id: string;
  question: string;
  type: "text" | "multiple-choice" | "numeric";
  expectedAnswer?: string | number;
  options?: string[]; // for multiple-choice
}

export interface Resource extends TrainingModule {
  type: "resource";
  category: "guide" | "cheatsheet" | "video" | "article" | "tool";
  contentUrl: string;
  contentType: "html" | "pdf" | "video" | "external";
  authors?: string[];
  publishedDate?: string;
}

export interface GlossaryEntry {
  id: string;
  type: "glossary";
  term: string;
  definition: string;
  example?: string;
  relatedTerms?: string[];
  category: string;
}

export interface ModuleProgress {
  moduleId: string;
  status: ModuleStatus;
  startedAt?: Date;
  completedAt?: Date;
  currentStep?: number; // for tutorials
  score?: number; // for scenarios with questions
}

export interface TrainingPath {
  id: string;
  name: string;
  description: string;
  modules: string[]; // module IDs in order
  targetAudience: Difficulty;
  estimatedDuration: number; // minutes
}
