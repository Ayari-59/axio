import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCompany, loadProfile } from "@/lib/repository";
import { getSector } from "@/core/templates";
import { OnboardingWizard } from "./wizard";

export default async function OnboardingPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const company = await getCompany(companyId, user.organizationId);
  if (!company) notFound();

  const [profile] = await Promise.all([loadProfile(companyId)]);
  const sector = getSector(company.industry);

  return (
    <OnboardingWizard
      companyId={companyId}
      companyName={company.name}
      sectorLabel={sector.label}
      initial={profile}
      suggestedLabels={sector.objectLabels}
    />
  );
}
