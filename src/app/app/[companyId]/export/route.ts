import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCompany } from "@/lib/repository";
import { buildSnapshot } from "@/services/analysis.service";
import { buildVarianceView } from "@/services/budget.service";

/**
 * Export CSV des vues d'analyse (docs/14 story 11.2).
 * Les chiffres proviennent du même snapshot que l'écran : un export ne recalcule rien
 * différemment de ce que l'utilisateur a sous les yeux.
 *
 *   /app/{companyId}/export?type=margins&dim=PROJECT&period=2026-03
 */

const SEPARATOR = ";";

type CsvValue = string | number | null | undefined;

function toCsv(headers: string[], rows: CsvValue[][]): string {
  const escape = (value: CsvValue): string => {
    if (value === null || value === undefined) return "";
    const text = typeof value === "number" ? String(value).replace(".", ",") : value;
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers, ...rows].map((row) => row.map(escape).join(SEPARATOR)).join("\r\n");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });
  const company = await getCompany(companyId, user.organizationId);
  if (!company) return new NextResponse("Introuvable", { status: 404 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "margins";
  const period = url.searchParams.get("period") ?? undefined;
  const dimensionCode = url.searchParams.get("dim") ?? undefined;

  const snapshot = await buildSnapshot(companyId, period);
  let filename = `axio-${company.slug}-${type}-${snapshot.periodCode}.csv`;
  let csv = "";

  switch (type) {
    case "margins": {
      const code = dimensionCode ?? snapshot.dataset.dimensions.find((d) => d.isCostObject)?.code;
      const result = code ? snapshot.margins[code] : undefined;
      if (!result) return new NextResponse("Axe inconnu", { status: 400 });
      csv = toCsv(
        [
          "Objet",
          "Code",
          "CA",
          "Coûts variables directs",
          "Coûts fixes directs",
          "Marge sur coûts variables",
          "Taux de marge (%)",
          "Marge contributive",
          "Indirects affectés",
          "Marge opérationnelle",
        ],
        result.lines.map((line) => [
          line.memberLabel,
          line.memberCode,
          line.revenue,
          line.variableDirectCost,
          line.fixedDirectCost,
          line.contributionMargin,
          line.contributionMarginRate,
          line.contributiveMargin,
          line.allocatedIndirect,
          line.operatingMargin,
        ]),
      );
      filename = `axio-${company.slug}-marges-${code}-${snapshot.periodCode}.csv`;
      break;
    }

    case "variances": {
      const view = buildVarianceView(snapshot.dataset, snapshot.periodCode, { dimensionCode });
      csv = toCsv(
        ["Nature", "Type", "Réel", "Budget", "N-1", "Écart", "Écart (%)", "Sens", "Contribution (%)"],
        view.lines.map((line) => [
          line.label,
          line.kind === "REVENUE" ? "Produit" : "Charge",
          line.actual,
          line.budget,
          line.lastYear,
          line.variance,
          line.variancePct,
          line.sense,
          line.contribution,
        ]),
      );
      break;
    }

    case "entries": {
      const entries = snapshot.dataset.entries.filter((e) => e.periodCode === snapshot.periodCode);
      const dimensionCodes = snapshot.dataset.dimensions.map((d) => d.code);
      csv = toCsv(
        ["Date", "Type", "Libellé", "Compte", "Comportement", "Traçabilité", "Quantité", "Montant", ...dimensionCodes],
        entries.map((entry) => [
          entry.date.slice(0, 10),
          entry.kind,
          entry.label,
          entry.accountNumber,
          entry.behavior,
          entry.traceability,
          entry.quantity ?? null,
          entry.amount,
          ...dimensionCodes.map((code) => entry.dims[code] ?? ""),
        ]),
      );
      break;
    }

    case "allocations": {
      csv = toCsv(
        ["Étape", "Règle", "Source", "Axe cible", "Membre cible", "Inducteur", "Base", "Total base", "Montant"],
        snapshot.costing.allocations.map((allocation) => [
          allocation.stage,
          allocation.ruleName,
          allocation.sourceRef,
          allocation.targetDimension,
          allocation.targetMemberCode,
          allocation.driverKey ?? "",
          allocation.driverValue ?? null,
          allocation.driverTotal ?? null,
          allocation.amount,
        ]),
      );
      break;
    }

    case "kpis": {
      csv = toCsv(
        ["Code", "Indicateur", "Catégorie", "Valeur", "Unité", "Période précédente", "Variation (%)", "Cible", "État", "Formule"],
        snapshot.kpis.map((kpi) => [
          kpi.code,
          kpi.name,
          kpi.category,
          kpi.value,
          kpi.unit,
          kpi.previous,
          kpi.deltaPct,
          kpi.target,
          kpi.status,
          kpi.formula,
        ]),
      );
      break;
    }

    default:
      return new NextResponse("Type d'export inconnu", { status: 400 });
  }

  // BOM UTF-8 : sans lui, Excel en français affiche « Ã© » à la place de « é ».
  return new NextResponse("﻿" + csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
