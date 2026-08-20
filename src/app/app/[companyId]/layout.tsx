import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCompany, loadConfiguration } from "@/lib/repository";
import { prisma } from "@/lib/db";
import { logoutAction } from "@/app/(auth)/actions";
import { NavLink } from "./nav-link";

export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const company = await getCompany(companyId, user.organizationId);
  if (!company) notFound();

  const [configuration, dimensions] = await Promise.all([
    loadConfiguration(companyId),
    prisma.dimension.findMany({ where: { companyId, active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const capabilities = configuration?.capabilities ?? [];
  const base = `/app/${companyId}`;

  const costObjects = dimensions.filter((d) => d.isCostObject);
  const progressDimension = capabilities.includes("progress_tracking")
    ? costObjects.find((d) => d.code === "PROJECT")
    : undefined;

  // La navigation est composée à partir des capacités : une fonction inactive n'existe pas.
  const links: { href: string; label: string; show: boolean }[] = [
    { href: base, label: "Cockpit", show: true },
    { href: `${base}/margins`, label: "Marges", show: true },
    { href: `${base}/costs`, label: "Coûts", show: true },
    {
      href: `${base}/objects/${progressDimension?.code ?? "PROJECT"}`,
      label: progressDimension ? progressDimension.label + "s" : "Affaires",
      show: Boolean(progressDimension),
    },
    { href: `${base}/budgets`, label: "Budgets", show: true },
    { href: `${base}/variances`, label: "Écarts", show: capabilities.includes("budget_control") },
    { href: `${base}/forecast`, label: "Prévisions", show: true },
    { href: `${base}/scenarios`, label: "Scénarios", show: true },
    { href: `${base}/kpis`, label: "Indicateurs", show: true },
    { href: `${base}/alerts`, label: "Alertes", show: true },
    { href: `${base}/reports`, label: "Rapports", show: true },
    { href: `${base}/copilot`, label: "Copilote", show: true },
    { href: `${base}/data`, label: "Données", show: true },
    { href: `${base}/settings`, label: "Paramètres", show: true },
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <aside
        className="lg:w-60 lg:min-h-screen border-b lg:border-b-0 lg:border-r shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="px-4 py-4">
          <Link href="/app" className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white font-bold">
              A
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{company.name}</p>
              <p className="muted text-xs truncate">{company.activity || "Axio"}</p>
            </div>
          </Link>
        </div>

        <nav className="px-2 pb-4 flex lg:flex-col gap-0.5 overflow-x-auto">
          {links
            .filter((link) => link.show)
            .map((link) => (
              <NavLink key={link.href} href={link.href} label={link.label} />
            ))}
        </nav>

        <div className="px-4 py-3 border-t hidden lg:block" style={{ borderColor: "var(--border)" }}>
          <p className="muted text-xs truncate">{user.email}</p>
          <form action={logoutAction}>
            <button className="text-xs muted hover:underline mt-1">Se déconnecter</button>
          </form>
        </div>
      </aside>

      <main className="flex-1 min-w-0 px-5 py-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
