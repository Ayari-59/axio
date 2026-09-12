"use client";

import { useState } from "react";
import { GlossaryEntry } from "../types";

interface GlossaryPanelProps {
  entries: GlossaryEntry[];
  onClose: () => void;
  defaultOpen?: string;
}

export function GlossaryPanel({ entries, onClose, defaultOpen }: GlossaryPanelProps) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | undefined>(defaultOpen);

  const filtered = entries.filter(
    (e) =>
      e.term.toLowerCase().includes(search.toLowerCase()) ||
      e.definition.toLowerCase().includes(search.toLowerCase())
  );

  const byCategory = filtered.reduce(
    (acc, entry) => {
      if (!acc[entry.category]) acc[entry.category] = [];
      acc[entry.category].push(entry);
      return acc;
    },
    {} as Record<string, GlossaryEntry[]>
  );

  const categoryLabels: Record<string, string> = {
    costing: "Concepts de coûts",
    finance: "Finance",
    insight: "Insights & Analyses",
    tool: "Outils & Système",
  };

  return (
    <div className="fixed right-0 top-0 h-screen w-80 bg-white dark:bg-slate-900 shadow-xl z-50 flex flex-col border-l border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Glossaire ABC</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            ✕
          </button>
        </div>
        <input
          type="text"
          placeholder="Chercher un terme..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm px-2 py-1.5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-4 text-center text-sm muted">Aucun terme ne correspond.</div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {Object.entries(byCategory).map(([category, categoryEntries]) => (
              <div key={category}>
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800 text-xs font-medium uppercase tracking-wide muted sticky top-0">
                  {categoryLabels[category] || category}
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {categoryEntries.map((entry) => (
                    <div key={entry.id} className="border-0">
                      <button
                        onClick={() =>
                          setExpandedId(expandedId === entry.id ? undefined : entry.id)
                        }
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium truncate">{entry.term}</h3>
                            <p className="text-xs muted line-clamp-2 mt-0.5">
                              {entry.definition}
                            </p>
                          </div>
                          <span className="text-xs muted flex-shrink-0 mt-1">
                            {expandedId === entry.id ? "−" : "+"}
                          </span>
                        </div>
                      </button>

                      {expandedId === entry.id && (
                        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 text-xs space-y-3">
                          {entry.example && (
                            <div>
                              <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Exemple
                              </p>
                              <p className="text-slate-600 dark:text-slate-400 italic">
                                {entry.example}
                              </p>
                            </div>
                          )}

                          {entry.relatedTerms && entry.relatedTerms.length > 0 && (
                            <div>
                              <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Termes liés
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {entry.relatedTerms.map((term) => (
                                  <span
                                    key={term}
                                    className="inline-block px-2 py-0.5 bg-white dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300"
                                  >
                                    {term}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
