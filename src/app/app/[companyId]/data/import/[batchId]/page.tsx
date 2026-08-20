import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCompany, loadDataset } from "@/lib/repository";
import { getAnalysis } from "@/services/import.service";
import { PageHeader } from "@/components/ui";
import { MappingEditor } from "./mapping-editor";

export default async function ImportMappingPage({
  params,
}: {
  params: Promise<{ companyId: string; batchId: string }>;
}) {
  const { companyId, batchId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCompany(companyId, user.organizationId);
  if (!company) notFound();

  const analysis = await getAnalysis(companyId, batchId);
  if (!analysis) notFound();
  const dataset = await loadDataset(companyId);

  return (
    <div>
      <PageHeader
        title={`Import — ${analysis.filename}`}
        description={`${analysis.rowCount} lignes · séparateur « ${analysis.delimiter === "\t" ? "tabulation" : analysis.delimiter} ». Le mapping est proposé automatiquement ; vous validez.`}
      />
      <MappingEditor
        companyId={companyId}
        batchId={batchId}
        analysis={analysis}
        dimensions={dataset.dimensions.map((d) => ({ code: d.code, label: d.label }))}
      />
    </div>
  );
}
