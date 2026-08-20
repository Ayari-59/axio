import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listCompanies } from "@/lib/repository";
import { prisma } from "@/lib/db";
import { SECTORS } from "@/core/templates";
import { logoutAction } from "../(auth)/actions";
import { NewCompanyForm } from "./new-company-form";

export default async function CompaniesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [companies, organization] = await Promise.all([
    listCompanies(user.organizationId),
    prisma.organization.findUnique({ where: { id: user.organizationId } }),
  ]);

  return (
    <main className="min-h-screen">
      <header className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white font-bold">
              A
            </span>
            <div>
              <p className="font-semibold text-sm leading-tight">{organization?.name ?? "Axio"}</p>
              <p className="muted text-xs">{user.email}</p>
            </div>
          </div>
          <form action={logoutAction}>
            <button className="text-sm muted hover:underline">Se déconnecter</button>
          </form>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-xl font-semibold tracking-tight">Vos entreprises</h1>
        <p className="muted text-sm mt-1">
          Chaque entreprise possède son propre modèle économique, sa configuration et ses données.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {companies.map((company) => {
            const sector = SECTORS.find((s) => s.code === company.industry);
            return (
              <Link
                key={company.id}
                href={company.configuredAt ? `/app/${company.id}` : `/app/${company.id}/onboarding`}
                className="card p-5 hover:border-brand-400 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{company.name}</p>
                    <p className="muted text-xs mt-0.5">{sector?.label ?? company.industry}</p>
                  </div>
                  <span
                    className={`text-xs rounded-full px-2 py-0.5 ${
                      company.configuredAt ? "bg-good-100 text-good-500" : "bg-warn-100 text-warn-500"
                    }`}
                  >
                    {company.configuredAt ? "configurée" : "à configurer"}
                  </span>
                </div>
                {company.activity && <p className="muted text-sm mt-3">{company.activity}</p>}
              </Link>
            );
          })}

          {companies.length === 0 && (
            <div className="card p-6 md:col-span-2">
              <p className="font-medium">Aucune entreprise pour le moment.</p>
              <p className="muted text-sm mt-1">
                Créez votre première entreprise : l&apos;assistant en cinq étapes construira son système de
                pilotage.
              </p>
            </div>
          )}
        </div>

        <div className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide muted">Nouvelle entreprise</h2>
          <NewCompanyForm />
        </div>
      </div>
    </main>
  );
}
