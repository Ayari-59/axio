"use client";

import { useState, useEffect } from "react";
import { notFound } from "next/navigation";
import { TRAINING_PATHS, TUTORIALS, SCENARIOS, RESOURCES } from "@/training/modules";
import { TrainingModule } from "@/training/types";
import { TrainingGallery } from "@/training/components";
import Link from "next/link";

export default function TrainingPathPage({
  params,
}: {
  params: { companyId: string; pathId: string };
}) {
  const { companyId, pathId } = params;
  const path = Object.values(TRAINING_PATHS).find((p) => p.id === pathId);
  const [completedModules, setCompletedModules] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Load completed modules from localStorage (simplified for demo)
    // In production, this would fetch from the database
    const stored = localStorage.getItem(`training_completed_${companyId}`);
    if (stored) {
      setCompletedModules(new Set(JSON.parse(stored)));
    }
  }, [companyId]);

  if (!path) {
    notFound();
  }

  // Build module map
  const modules = new Map<string, TrainingModule>();
  Object.values(TUTORIALS).forEach((m) => modules.set(m.id, m));
  Object.values(SCENARIOS).forEach((m) => modules.set(m.id, m));
  Object.values(RESOURCES).forEach((m) => modules.set(m.id, m));

  const handleSelectModule = (moduleId: string) => {
    const module = modules.get(moduleId);
    if (!module) return;

    // Navigate based on module type
    const base = `/app/${companyId}`;
    if (module.type === "tutorial") {
      // For tutorials, navigate to the target page with tutorial flag
      const tutorial = TUTORIALS[moduleId];
      window.location.href = `${tutorial.pageRoute}?tutorial=${moduleId}`;
    } else if (module.type === "scenario") {
      // For scenarios, show in a modal or navigate to details page
      // For now, mark as started
      const updated = new Set(completedModules);
      updated.add(moduleId);
      setCompletedModules(updated);
      localStorage.setItem(
        `training_completed_${companyId}`,
        JSON.stringify(Array.from(updated))
      );
    } else if (module.type === "resource") {
      // For resources, open in new tab
      const resource = RESOURCES[moduleId];
      if (resource.contentType === "html" || resource.contentType === "pdf") {
        window.open(resource.contentUrl, "_blank");
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <Link href={`/app/${companyId}/training`} className="text-sm text-brand-600 mb-6 inline-flex items-center gap-1">
        ← Tous les parcours
      </Link>

      <TrainingGallery
        path={path}
        modules={modules}
        onSelectModule={handleSelectModule}
        completedModules={completedModules}
      />
    </div>
  );
}
