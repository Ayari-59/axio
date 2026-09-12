import { ModuleProgress, ModuleStatus } from "../types";

const STORAGE_KEY = "training_progress";

export class TrainingProgressService {
  static getProgress(userId: string, moduleId: string): ModuleProgress | null {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const progress: Record<string, Record<string, ModuleProgress>> = JSON.parse(stored);
    return progress[userId]?.[moduleId] || null;
  }

  static saveProgress(userId: string, progress: ModuleProgress) {
    const stored = localStorage.getItem(STORAGE_KEY);
    const allProgress: Record<string, Record<string, ModuleProgress>> = stored
      ? JSON.parse(stored)
      : {};

    if (!allProgress[userId]) {
      allProgress[userId] = {};
    }

    allProgress[userId][progress.moduleId] = {
      ...progress,
      startedAt: progress.startedAt ? new Date(progress.startedAt) : undefined,
      completedAt: progress.completedAt ? new Date(progress.completedAt) : undefined,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(allProgress));
  }

  static markAsCompleted(userId: string, moduleId: string) {
    const progress = this.getProgress(userId, moduleId) || {
      moduleId,
      status: "completed" as ModuleStatus,
    };

    this.saveProgress(userId, {
      ...progress,
      status: "completed",
      completedAt: new Date(),
    });
  }

  static startModule(userId: string, moduleId: string) {
    const progress = this.getProgress(userId, moduleId) || {
      moduleId,
      status: "in-progress" as ModuleStatus,
    };

    this.saveProgress(userId, {
      ...progress,
      status: "in-progress",
      startedAt: progress.startedAt || new Date(),
    });
  }

  static updateTutorialStep(userId: string, moduleId: string, step: number) {
    const progress = this.getProgress(userId, moduleId) || {
      moduleId,
      status: "in-progress" as ModuleStatus,
    };

    this.saveProgress(userId, {
      ...progress,
      currentStep: step,
    });
  }

  static recordScenarioScore(userId: string, moduleId: string, score: number) {
    const progress = this.getProgress(userId, moduleId) || {
      moduleId,
      status: "completed" as ModuleStatus,
    };

    this.saveProgress(userId, {
      ...progress,
      score,
      completedAt: progress.completedAt || new Date(),
    });
  }

  static getCompletedModules(userId: string): string[] {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const progress: Record<string, Record<string, ModuleProgress>> = JSON.parse(stored);
    const userProgress = progress[userId] || {};

    return Object.entries(userProgress)
      .filter(([, p]) => p.status === "completed")
      .map(([moduleId]) => moduleId);
  }

  static getPathProgress(userId: string, moduleIds: string[]): number {
    const completed = this.getCompletedModules(userId);
    return Math.round(
      (completed.filter((id) => moduleIds.includes(id)).length / moduleIds.length) * 100
    );
  }

  static clearProgress(userId: string) {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    const allProgress: Record<string, Record<string, ModuleProgress>> = JSON.parse(stored);
    delete allProgress[userId];

    localStorage.setItem(STORAGE_KEY, JSON.stringify(allProgress));
  }
}
