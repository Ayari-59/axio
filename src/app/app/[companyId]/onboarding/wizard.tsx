"use client";

import { useMemo, useState, useTransition } from "react";
import {
  BILLING_UNITS,
  MARGIN_DRIVERS,
  OBJECTIVES,
  ORG_UNIT_TYPES,
  PILOT_OBJECTS,
  REVENUE_MODELS,
  type BusinessModelProfile,
} from "@/core/model/profile";
import {
  BILLING_UNIT_LABELS,
  MARGIN_DRIVER_LABELS,
  OBJECTIVE_LABELS,
  ORG_UNIT_LABELS,
  PILOT_OBJECT_LABELS,
  REVENUE_MODEL_LABELS,
} from "@/core/templates/vocabulary";
import { saveProfileAction } from "./actions";

const STEPS = ["Identité", "Modèle économique", "Organisation", "Objets de pilotage", "Objectifs"];

export function OnboardingWizard({
  companyId,
  companyName,
  sectorLabel,
  initial,
  suggestedLabels,
}: {
  companyId: string;
  companyName: string;
  sectorLabel: string;
  initial: BusinessModelProfile;
  suggestedLabels: Record<string, string>;
}) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<BusinessModelProfile>(initial);
  const [pending, startTransition] = useTransition();

  const update = (patch: Partial<BusinessModelProfile>) => setProfile((p) => ({ ...p, ...patch }));

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const costTotal =
    profile.costs.payrollSharePct +
    profile.costs.purchasesSharePct +
    profile.costs.subcontractingSharePct +
    profile.costs.overheadSharePct;

  const canContinue = useMemo(() => {
    if (step === 1) return profile.revenue.models.length > 0 && profile.revenue.billingUnits.length > 0;
    if (step === 3) return profile.pilotObjects.length > 0;
    if (step === 4) return profile.objectives.length > 0;
    return true;
  }, [step, profile]);

  const submit = () => {
    const payload = {
      ...profile,
      costs: {
        ...profile.costs,
        indirectSharePct: Math.round(profile.costs.overheadSharePct),
      },
    };
    startTransition(() => {
      void saveProfileAction(companyId, JSON.stringify(payload));
    });
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Configuration de {companyName}</h1>
          <p className="muted text-sm mt-1">
            5 écrans pour configurer le moteur.
          </p>
        </div>
        <span className="muted text-sm whitespace-nowrap">
          Étape {step + 1} / {STEPS.length}
        </span>
      </div>

      <ol className="flex gap-2 mb-6">
        {STEPS.map((label, index) => (
          <li key={label} className="flex-1">
            <div
              className="h-1.5 rounded-full"
              style={{ background: index <= step ? "var(--color-brand-500)" : "var(--border)" }}
            />
            <span className={`block text-xs mt-1.5 ${index === step ? "font-medium" : "muted"}`}>{label}</span>
          </li>
        ))}
      </ol>

      <div className="card p-6 space-y-5">
        {step === 0 && (
          <>
            <h2 className="font-semibold">Votre entreprise</h2>
            <p className="muted text-sm">
              Secteur : <strong>{sectorLabel}</strong>. Les étapes suivantes affinent la configuration.
            </p>
            <label className="block">
              <span className="block text-sm font-medium mb-1">Activité</span>
              <input
                value={profile.identity.activity}
                onChange={(e) => update({ identity: { ...profile.identity, activity: e.target.value } })}
                placeholder="Ce que vous faites, en une phrase"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="block text-sm font-medium mb-1">Chiffre d&apos;affaires annuel (€)</span>
                <input
                  type="number"
                  min={0}
                  value={profile.identity.revenueBand}
                  onChange={(e) =>
                    update({ identity: { ...profile.identity, revenueBand: Number(e.target.value) } })
                  }
                />
              </label>
              <label className="block">
                <span className="block text-sm font-medium mb-1">Effectif</span>
                <input
                  type="number"
                  min={0}
                  value={profile.identity.headcount}
                  onChange={(e) =>
                    update({ identity: { ...profile.identity, headcount: Number(e.target.value) } })
                  }
                />
              </label>
              <label className="block">
                <span className="block text-sm font-medium mb-1">Nombre de sites</span>
                <input
                  type="number"
                  min={1}
                  value={profile.identity.siteCount}
                  onChange={(e) =>
                    update({ identity: { ...profile.identity, siteCount: Number(e.target.value) } })
                  }
                />
              </label>
              <label className="block">
                <span className="block text-sm font-medium mb-1">Nombre d&apos;établissements</span>
                <input
                  type="number"
                  min={1}
                  value={profile.identity.establishmentCount}
                  onChange={(e) =>
                    update({
                      identity: { ...profile.identity, establishmentCount: Number(e.target.value) },
                    })
                  }
                />
              </label>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="font-semibold">Comment gagnez-vous de l&apos;argent ?</h2>
            <p className="muted text-sm">
              L&apos;écran central du moteur de coûts.
            </p>

            <fieldset>
              <legend className="text-sm font-medium mb-2">Ce que vous vendez</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {REVENUE_MODELS.map((model) => (
                  <label key={model} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={profile.revenue.models.includes(model)}
                      onChange={() =>
                        update({ revenue: { ...profile.revenue, models: toggle(profile.revenue.models, model) } })
                      }
                    />
                    <span>{REVENUE_MODEL_LABELS[model]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-medium mb-2">Comment vous facturez</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {BILLING_UNITS.map((unit) => (
                  <label key={unit} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={profile.revenue.billingUnits.includes(unit)}
                      onChange={() =>
                        update({
                          revenue: { ...profile.revenue, billingUnits: toggle(profile.revenue.billingUnits, unit) },
                        })
                      }
                    />
                    <span>{BILLING_UNIT_LABELS[unit]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <Slider
                label="Part de chiffre d'affaires récurrent"
                value={profile.revenue.recurringSharePct}
                onChange={(value) => update({ revenue: { ...profile.revenue, recurringSharePct: value } })}
              />
              <Slider
                label="Part du plus gros client"
                value={profile.revenue.topClientSharePct}
                onChange={(value) => update({ revenue: { ...profile.revenue, topClientSharePct: value } })}
              />
            </div>

            <label className="block">
              <span className="block text-sm font-medium mb-1">Saisonnalité</span>
              <select
                value={profile.revenue.seasonality}
                onChange={(e) =>
                  update({
                    revenue: {
                      ...profile.revenue,
                      seasonality: e.target.value as BusinessModelProfile["revenue"]["seasonality"],
                    },
                  })
                }
              >
                <option value="none">Faible</option>
                <option value="moderate">Modérée</option>
                <option value="strong">Forte</option>
              </select>
            </label>

            <fieldset>
              <legend className="text-sm font-medium mb-2">
                Structure de coûts{" "}
                <span className={costTotal === 100 ? "muted" : "text-warn-500"}>(total {costTotal} %)</span>
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <Slider
                  label="Masse salariale"
                  value={profile.costs.payrollSharePct}
                  onChange={(value) => update({ costs: { ...profile.costs, payrollSharePct: value } })}
                />
                <Slider
                  label="Achats / matières"
                  value={profile.costs.purchasesSharePct}
                  onChange={(value) => update({ costs: { ...profile.costs, purchasesSharePct: value } })}
                />
                <Slider
                  label="Sous-traitance"
                  value={profile.costs.subcontractingSharePct}
                  onChange={(value) => update({ costs: { ...profile.costs, subcontractingSharePct: value } })}
                />
                <Slider
                  label="Structure (indirect)"
                  value={profile.costs.overheadSharePct}
                  onChange={(value) => update({ costs: { ...profile.costs, overheadSharePct: value } })}
                />
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-medium mb-2">Vos facteurs de marge</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {MARGIN_DRIVERS.map((driver) => (
                  <label key={driver} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={profile.costs.marginDrivers.includes(driver)}
                      onChange={() =>
                        update({
                          costs: { ...profile.costs, marginDrivers: toggle(profile.costs.marginDrivers, driver) },
                        })
                      }
                    />
                    <span>{MARGIN_DRIVER_LABELS[driver]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="font-semibold">Comment êtes-vous organisé ?</h2>
            <p className="muted text-sm">
              Centres de responsabilité — complétez par import.
            </p>
            <div className="space-y-3">
              {ORG_UNIT_TYPES.map((type) => {
                const existing = profile.organization.units.find((u) => u.type === type);
                return (
                  <div key={type} className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm flex-1">
                      <input
                        type="checkbox"
                        checked={Boolean(existing)}
                        onChange={() =>
                          update({
                            organization: {
                              units: existing
                                ? profile.organization.units.filter((u) => u.type !== type)
                                : [
                                    ...profile.organization.units,
                                    { type, label: ORG_UNIT_LABELS[type], count: 1 },
                                  ],
                            },
                          })
                        }
                      />
                      <span>{ORG_UNIT_LABELS[type]}</span>
                    </label>
                    {existing && (
                      <input
                        type="number"
                        min={1}
                        className="w-24"
                        value={existing.count}
                        onChange={(e) =>
                          update({
                            organization: {
                              units: profile.organization.units.map((u) =>
                                u.type === type ? { ...u, count: Number(e.target.value) } : u,
                              ),
                            },
                          })
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="font-semibold">Que voulez-vous piloter ?</h2>
            <p className="muted text-sm">
              Axes d&apos;analyse — renommez avec votre vocabulaire.
            </p>
            <div className="space-y-3">
              {PILOT_OBJECTS.map((object) => {
                const checked = profile.pilotObjects.includes(object);
                return (
                  <div key={object} className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm flex-1 min-w-56">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => update({ pilotObjects: toggle(profile.pilotObjects, object) })}
                      />
                      <span>{PILOT_OBJECT_LABELS[object]}</span>
                    </label>
                    {checked && (
                      <input
                        className="w-56"
                        placeholder={suggestedLabels[object] ?? "Libellé affiché"}
                        value={profile.objectLabels[object] ?? ""}
                        onChange={(e) =>
                          update({ objectLabels: { ...profile.objectLabels, [object]: e.target.value } })
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="font-semibold">Vos priorités</h2>
            <p className="muted text-sm">
              Jusqu&apos;à 3 priorités pour le cockpit.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {OBJECTIVES.map((objective) => {
                const checked = profile.objectives.includes(objective);
                const disabled = !checked && profile.objectives.length >= 3;
                return (
                  <label
                    key={objective}
                    className={`flex items-center gap-2 text-sm ${disabled ? "opacity-40" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => update({ objectives: toggle(profile.objectives, objective) })}
                    />
                    <span>{OBJECTIVE_LABELS[objective]}</span>
                  </label>
                );
              })}
            </div>

            <label className="block">
              <span className="block text-sm font-medium mb-1">Maturité de votre contrôle de gestion</span>
              <select
                value={profile.maturity}
                onChange={(e) =>
                  update({ maturity: e.target.value as BusinessModelProfile["maturity"] })
                }
              >
                <option value="starter">Débutant — je pars d&apos;Excel ou de rien</option>
                <option value="intermediate">Intermédiaire — j&apos;ai un budget et des tableaux de bord</option>
                <option value="advanced">Avancé — je pratique l&apos;analyse d&apos;écarts et les coûts par activité</option>
              </select>
            </label>
          </>
        )}
      </div>

      <div className="flex items-center justify-between mt-6">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="rounded-lg border px-4 py-2.5 text-sm font-medium disabled:opacity-40"
        >
          Retour
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canContinue}
            className="rounded-lg bg-brand-600 text-white px-4 py-2.5 text-sm font-medium disabled:opacity-40"
          >
            Continuer
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!canContinue || pending}
            className="rounded-lg bg-brand-600 text-white px-4 py-2.5 text-sm font-medium disabled:opacity-40"
          >
            {pending ? "Analyse…" : "Voir le système proposé"}
          </button>
        )}
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-sm font-medium mb-1">
        <span>{label}</span>
        <span className="tabular muted">{value} %</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
