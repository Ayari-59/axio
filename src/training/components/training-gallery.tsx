"use client";

import { TrainingModule, TrainingPath } from "../types";

interface TrainingGalleryProps {
  path: TrainingPath;
  modules: Map<string, TrainingModule>;
  onSelectModule: (moduleId: string) => void;
  completedModules: Set<string>;
}

export function TrainingGallery({
  path,
  modules,
  onSelectModule,
  completedModules,
}: TrainingGalleryProps) {
  const difficultyColors = {
    beginner: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
    intermediate: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300",
    advanced: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
  };

  const typeEmojis: Record<string, string> = {
    tutorial: "🎓",
    scenario: "📋",
    resource: "📚",
    glossary: "📖",
  };

  const typeLabels: Record<string, string> = {
    tutorial: "Tutoriel",
    scenario: "Cas d'étude",
    resource: "Ressource",
    glossary: "Glossaire",
  };

  const categoryLabels: Record<string, string> = {
    guide: "Guide",
    cheatsheet: "Aide-mémoire",
    video: "Vidéo",
    article: "Article",
    tool: "Outil",
  };

  const totalTime = path.modules.reduce((sum, moduleId) => {
    return sum + (modules.get(moduleId)?.estimatedTime || 0);
  }, 0);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Path Header */}
      <div>
        <h1 className="text-2xl font-semibold mb-2">{path.name}</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-4">{path.description}</p>
        <div className="flex gap-4 text-sm">
          <div>
            <span className="muted">Niveau</span>
            <p className="font-medium capitalize">{path.targetAudience}</p>
          </div>
          <div>
            <span className="muted">Durée totale</span>
            <p className="font-medium">{Math.round(totalTime / 60)}h {totalTime % 60}m</p>
          </div>
          <div>
            <span className="muted">Progression</span>
            <p className="font-medium">
              {completedModules.size} / {path.modules.length}
            </p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-brand-600 transition-all"
          style={{
            width: `${(completedModules.size / path.modules.length) * 100}%`,
          }}
        />
      </div>

      {/* Module Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {path.modules.map((moduleId) => {
          const module = modules.get(moduleId);
          if (!module) return null;

          const isCompleted = completedModules.has(moduleId);
          const emoji = typeEmojis[module.type] || "📌";
          const label =
            module.type === "resource"
              ? categoryLabels[(module as any).category] || typeLabels[module.type]
              : typeLabels[module.type];

          return (
            <button
              key={moduleId}
              onClick={() => onSelectModule(moduleId)}
              className="group text-left p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="text-2xl">{module.icon || emoji}</div>
                {isCompleted && <span className="text-xl">✓</span>}
              </div>

              <h3 className="font-semibold text-sm mb-1 group-hover:text-brand-600">
                {module.title}
              </h3>

              <p className="text-xs muted mb-3 line-clamp-2">{module.description}</p>

              <div className="flex items-center justify-between">
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    difficultyColors[module.difficulty]
                  }`}
                >
                  {module.difficulty}
                </span>
                <span className="text-xs muted">{module.estimatedTime}m</span>
              </div>

              <div className="flex gap-1 flex-wrap mt-3">
                {module.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="text-xs bg-slate-100 dark:bg-slate-800 rounded px-2 py-0.5">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="text-xs text-brand-600 font-medium mt-3 group-hover:text-brand-700">
                {label} →
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
