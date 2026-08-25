import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SECTORS } from "@/core/templates";
import { Logo } from "@/components/brand";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/app");

  return (
    <main className="min-h-screen">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo size={32} className="text-brand-600" />
          <span className="font-semibold tracking-tight">Axio</span>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/login" className="px-3 py-2 rounded-lg hover:bg-ink-100">
            Se connecter
          </Link>
          <Link href="/register" className="px-3.5 py-2 rounded-lg bg-brand-600 text-white font-medium">
            Créer un compte
          </Link>
        </nav>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-10 pb-16">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
          L&apos;Operating System du contrôle de gestion
        </p>
        <h1 className="mt-3 text-4xl sm:text-5xl font-semibold tracking-tight max-w-3xl leading-tight">
          Votre système de pilotage, construit automatiquement à partir de votre modèle économique.
        </h1>
        <p className="mt-5 text-lg muted max-w-2xl">
          Axio n&apos;est ni un logiciel de comptabilité, ni un ERP. C&apos;est un moteur qui analyse la façon dont
          votre entreprise gagne de l&apos;argent, puis construit son modèle de coûts, ses budgets, ses
          indicateurs et son cockpit — sans paramétrage technique.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/register" className="px-5 py-3 rounded-lg bg-brand-600 text-white font-medium">
            Configurer mon entreprise
          </Link>
          <Link href="/login" className="px-5 py-3 rounded-lg border font-medium">
            J&apos;ai déjà un compte
          </Link>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {[
            {
              title: "Il s'adapte, vous ne vous adaptez pas",
              body: "Cinq écrans décrivent votre modèle économique. Le moteur de règles en déduit vos axes d'analyse, vos objets de coûts, vos clés de répartition et vos indicateurs.",
            },
            {
              title: "Des calculs, pas des impressions",
              body: "Coûts complets, ABC, marge sur coûts variables, écarts prix/volume/mix, budget/activité/rendement, seuil de rentabilité : les méthodes du contrôle de gestion, appliquées à vos données.",
            },
            {
              title: "L'IA commente, elle ne calcule jamais",
              body: "Chaque chiffre vient du moteur. Le copilote explique, décompose et cite ses sources — et fonctionne même sans aucune clé d'API.",
            },
          ].map((item) => (
            <div key={item.title} className="card p-5">
              <h2 className="font-semibold">{item.title}</h2>
              <p className="muted text-sm mt-2 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-14">
          <h2 className="text-sm font-semibold uppercase tracking-wide muted">
            Un seul moteur, des pilotages radicalement différents
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SECTORS.filter((s) => s.code !== "other").map((sector) => (
              <div key={sector.code} className="card p-4">
                <p className="font-medium text-sm">{sector.label}</p>
                <p className="muted text-xs mt-1">{sector.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-6xl mx-auto px-6 py-6 muted text-xs flex flex-wrap gap-4 justify-between">
          <span>Axio — plateforme de contrôle de gestion générique.</span>
          <span>Configuration &gt; code · Moteur &gt; module · Dimensions &gt; tables spécialisées</span>
        </div>
      </footer>
    </main>
  );
}
