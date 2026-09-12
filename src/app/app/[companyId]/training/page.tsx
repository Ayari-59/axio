import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCompany } from "@/lib/repository";
import { TRAINING_PATHS } from "@/training/modules";
import Link from "next/link";

export default async function TrainingPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCompany(companyId, user.organizationId);
  if (!company) notFound();

  const base = `/app/${companyId}`;
  const paths = Object.values(TRAINING_PATHS);

  const difficultyColors = {
    beginner: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
    intermediate: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300",
    advanced: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
  };

  const difficultyLabels = {
    beginner: "Débutant",
    intermediate: "Intermédiaire",
    advanced: "Avancé",
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold mb-2">Formation ABC & Coûts</h1>
      <p className="text-slate-600 dark:text-slate-400 mb-8">
        Parcours guidés pour maîtriser la comptabilité par activités et optimiser votre tarification.
      </p>

      <div className="space-y-6">
        {paths.map((path) => (
          <Link
            key={path.id}
            href={`${base}/training/${path.id}`}
            className="group block p-6 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-lg font-semibold group-hover:text-brand-600">{path.name}</h2>
              <span className={`text-xs px-3 py-1 rounded ${difficultyColors[path.targetAudience]}`}>
                {difficultyLabels[path.targetAudience]}
              </span>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{path.description}</p>

            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="muted">Durée totale</span>
                <p className="font-medium">
                  {Math.round(path.estimatedDuration / 60)}h{" "}
                  {path.estimatedDuration % 60 > 0 ? `${path.estimatedDuration % 60}m` : ""}
                </p>
              </div>
              <div>
                <span className="muted">Modules</span>
                <p className="font-medium">{path.modules.length} modules</p>
              </div>
            </div>

            <div className="text-xs text-brand-600 font-medium mt-4 group-hover:text-brand-700">
              Commencer →
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-12 p-6 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <h3 className="font-semibold text-sm mb-2">💡 Besoin d'aide rapide ?</h3>
        <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">
          Consultez le glossaire ABC intégré dans chaque page des paramètres — cliquez sur le
          bouton 📖 en haut à droite.
        </p>
        <Link href={`${base}/settings`} className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline">
          Aller aux Paramètres →
        </Link>
      </div>

      <p className="muted text-xs mt-8">
        <Link href={`${base}`} className="text-brand-600 hover:underline">
          ← Retour au cockpit
        </Link>
      </p>
    </div>
  );
}
