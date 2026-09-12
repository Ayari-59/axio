"use client";

import { useState } from "react";
import { TutorialStep } from "../types";

interface TutorialOverlayProps {
  title: string;
  steps: TutorialStep[];
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onSkip: () => void;
}

export function TutorialOverlay({
  title,
  steps,
  currentStep,
  onNext,
  onPrev,
  onClose,
  onSkip,
}: TutorialOverlayProps) {
  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  if (!step) return null;

  const targetElement = step.targetElement ? document.querySelector(step.targetElement) : null;
  const rect = targetElement?.getBoundingClientRect();

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Highlight box (if element found) */}
      {rect && (
        <div
          className="fixed border-2 border-brand-500 rounded-lg z-50 pointer-events-none"
          style={{
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.3)",
          }}
          aria-hidden="true"
        />
      )}

      {/* Tooltip */}
      <div
        className="fixed bg-white dark:bg-slate-900 rounded-lg shadow-lg p-4 max-w-sm z-50 border border-slate-200 dark:border-slate-700"
        style={{
          top: rect ? rect.bottom + 16 : "50%",
          left: rect ? Math.max(16, rect.left) : "50%",
          transform: !rect ? "translate(-50%, -50%)" : undefined,
        }}
      >
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-sm">{step.title}</h3>
            <p className="text-xs muted mt-1">{step.description}</p>
          </div>

          {step.action && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-2 text-xs">
              <span className="font-medium text-blue-900 dark:text-blue-300">Action : </span>
              {step.action}
            </div>
          )}

          {step.hint && (
            <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded p-2">
              💡 {step.hint}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs muted">
              Étape {currentStep + 1} / {steps.length}
            </span>
            <div className="flex gap-2">
              <button
                onClick={onSkip}
                className="text-xs px-2 py-1 rounded border hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Passer
              </button>
              <button
                onClick={onPrev}
                disabled={isFirst}
                className="text-xs px-2 py-1 rounded border hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                ← Retour
              </button>
              <button
                onClick={onNext}
                className="text-xs px-3 py-1 rounded bg-brand-600 text-white hover:bg-brand-700"
              >
                {isLast ? "Terminer" : "Suivant →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
