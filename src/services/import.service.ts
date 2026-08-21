import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { audit, loadDataset } from "@/lib/repository";
import { parseJsonLoose } from "@/lib/json";
import { parseCsv } from "@/core/import/csv";
import {
  memberCodeFrom,
  profileColumns,
  suggestMapping,
  transformRow,
  type AccountDefaults,
  type ColumnProfile,
  type ImportMapping,
  type MappingSuggestion,
} from "@/core/import/mapping";
import { runQualityChecks } from "@/core/quality/checks";
import type { CoreEntry } from "@/core/model/types";

/**
 * Import de données (docs/12 P4).
 * Trois temps : analyse → essai à blanc → validation. Rien n'est écrit avant la validation,
 * et un lot importé reste annulable.
 */

export type ImportAnalysis = {
  batchId: string;
  filename: string;
  delimiter: string;
  headers: string[];
  rowCount: number;
  profiles: ColumnProfile[];
  suggestions: MappingSuggestion[];
  preview: string[][];
};

export async function analyzeImport(
  companyId: string,
  filename: string,
  content: string,
): Promise<ImportAnalysis> {
  const parsed = parseCsv(content);
  const dataset = await loadDataset(companyId);
  const profiles = profileColumns(parsed.headers, parsed.rows);
  const suggestions = suggestMapping(profiles, dataset.dimensions);

  const batch = await prisma.importBatch.create({
    data: {
      companyId,
      filename,
      rowCount: parsed.totalRows,
      status: "DRAFT",
      rawContent: content,
      mapping: JSON.stringify(buildDefaultMapping(suggestions)),
    },
  });

  return {
    batchId: batch.id,
    filename,
    delimiter: parsed.delimiter,
    headers: parsed.headers,
    rowCount: parsed.totalRows,
    profiles,
    suggestions,
    preview: parsed.rows.slice(0, 12),
  };
}

/** Relit un lot existant (reprise du mapping après interruption). */
export async function getAnalysis(companyId: string, batchId: string): Promise<ImportAnalysis | null> {
  const batch = await prisma.importBatch.findFirst({ where: { id: batchId, companyId } });
  if (!batch) return null;

  const parsed = parseCsv(batch.rawContent);
  const dataset = await loadDataset(companyId);
  const profiles = profileColumns(parsed.headers, parsed.rows);
  const suggestions = suggestMapping(profiles, dataset.dimensions);

  return {
    batchId: batch.id,
    filename: batch.filename,
    delimiter: parsed.delimiter,
    headers: parsed.headers,
    rowCount: parsed.totalRows,
    profiles,
    suggestions,
    preview: parsed.rows.slice(0, 12),
  };
}

function buildDefaultMapping(suggestions: MappingSuggestion[]): ImportMapping {
  return {
    columns: suggestions.map((s) => ({
      column: s.column,
      index: s.index,
      target: s.confidence >= 70 ? s.target : "ignore",
    })),
    defaults: {},
    createMissingMembers: true,
  };
}

export type DryRunReport = {
  valid: number;
  rejected: { row: number; reason: string }[];
  newMembers: { dimensionCode: string; codes: string[] }[];
  newPeriods: string[];
  totals: { revenue: number; cost: number };
  qualityScore: number;
  qualityIssues: { code: string; label: string; count: number; fix: string }[];
};

export async function dryRun(
  companyId: string,
  batchId: string,
  mapping: ImportMapping,
): Promise<DryRunReport> {
  const batch = await prisma.importBatch.findFirst({ where: { id: batchId, companyId } });
  if (!batch) throw new Error("IMPORT_NOT_FOUND");

  const parsed = parseCsv(batch.rawContent);
  const dataset = await loadDataset(companyId);
  const accountDefaults = await loadAccountDefaults(companyId);

  const existingMembers = new Set(dataset.members.map((m) => `${m.dimensionCode}|${m.code}`));
  const existingPeriods = new Set(dataset.periods.map((p) => p.code));
  const newMembers = new Map<string, Set<string>>();
  const newPeriods = new Set<string>();
  const rejected: DryRunReport["rejected"] = [];
  const staged: CoreEntry[] = [];

  let revenue = 0;
  let cost = 0;

  const resolveMember = buildMemberResolver(dataset);

  parsed.rows.forEach((row, index) => {
    const result = transformRow(row, { mapping, accountDefaults, resolveMember });
    if (!result.ok || !result.entry) {
      rejected.push({ row: index + 2, reason: result.error ?? "Ligne invalide" });
      return;
    }
    const entry = result.entry;
    if (entry.kind === "REVENUE") revenue += entry.amount;
    else cost += entry.amount;

    if (!existingPeriods.has(entry.periodCode)) newPeriods.add(entry.periodCode);
    for (const [dimensionCode, memberCode] of Object.entries(entry.dims)) {
      if (existingMembers.has(`${dimensionCode}|${memberCode}`)) continue;
      const set = newMembers.get(dimensionCode) ?? new Set<string>();
      set.add(memberCode);
      newMembers.set(dimensionCode, set);
    }

    staged.push({
      id: `staged-${index}`,
      periodCode: entry.periodCode,
      date: entry.date,
      kind: entry.kind,
      amount: entry.amount,
      quantity: entry.quantity,
      unitPrice: entry.unitPrice,
      unit: null,
      accountNumber: entry.accountNumber,
      behavior: entry.behavior,
      traceability: entry.traceability,
      label: entry.label,
      dims: entry.dims,
    });
  });

  // Contrôle qualité sur le jeu résultant (existant + importé), sans rien écrire.
  const simulated = {
    ...dataset,
    entries: [...dataset.entries, ...staged],
    members: [
      ...dataset.members,
      ...[...newMembers.entries()].flatMap(([dimensionCode, codes]) =>
        [...codes].map((code) => ({ dimensionCode, code, label: code, attributes: {} })),
      ),
    ],
  };
  const quality = runQualityChecks(simulated);

  return {
    valid: staged.length,
    rejected: rejected.slice(0, 50),
    newMembers: [...newMembers.entries()].map(([dimensionCode, codes]) => ({
      dimensionCode,
      codes: [...codes],
    })),
    newPeriods: [...newPeriods],
    totals: { revenue: Math.round(revenue), cost: Math.round(cost) },
    qualityScore: quality.score,
    qualityIssues: quality.issues.map((i) => ({ code: i.code, label: i.label, count: i.count, fix: i.fix })),
  };
}

export async function commitImport(
  companyId: string,
  batchId: string,
  mapping: ImportMapping,
  actorId?: string | null,
): Promise<{ imported: number; rejected: number }> {
  const batch = await prisma.importBatch.findFirst({ where: { id: batchId, companyId } });
  if (!batch) throw new Error("IMPORT_NOT_FOUND");
  if (batch.status === "COMMITTED") throw new Error("IMPORT_ALREADY_COMMITTED");

  const parsed = parseCsv(batch.rawContent);
  const accountDefaults = await loadAccountDefaults(companyId);

  const dataset = await loadDataset(companyId);
  const resolveMember = buildMemberResolver(dataset);
  const rows = parsed.rows
    .map((row) => transformRow(row, { mapping, accountDefaults, resolveMember }))
    .filter((r) => r.ok && r.entry);
  const rejected = parsed.rows.length - rows.length;

  const dimensions = await prisma.dimension.findMany({ where: { companyId } });
  const dimensionByCode = new Map(dimensions.map((d) => [d.code, d]));

  // 1. Périodes manquantes
  const periodCodes = [...new Set(rows.map((r) => r.entry!.periodCode))];
  for (const code of periodCodes) {
    const [year, month] = code.split("-").map(Number);
    await prisma.period.upsert({
      where: { companyId_code: { companyId, code } },
      create: {
        companyId,
        code,
        start: new Date(Date.UTC(year, month - 1, 1)),
        end: new Date(Date.UTC(year, month, 0)),
        type: "MONTH",
        fiscalYear: year,
      },
      update: {},
    });
  }
  const periods = await prisma.period.findMany({ where: { companyId } });
  const periodByCode = new Map(periods.map((p) => [p.code, p]));

  // 2. Membres manquants
  if (mapping.createMissingMembers) {
    const needed = new Map<string, Map<string, string>>();
    for (const { entry } of rows) {
      for (const [dimensionCode, memberCode] of Object.entries(entry!.dims)) {
        const map = needed.get(dimensionCode) ?? new Map<string, string>();
        if (!map.has(memberCode)) map.set(memberCode, memberCode);
        needed.set(dimensionCode, map);
      }
    }
    for (const [dimensionCode, members] of needed) {
      const dimension = dimensionByCode.get(dimensionCode);
      if (!dimension) continue;
      for (const [code, label] of members) {
        await prisma.dimensionMember.upsert({
          where: { dimensionId_code: { dimensionId: dimension.id, code } },
          create: { companyId, dimensionId: dimension.id, code, label: humanize(label) },
          update: {},
        });
      }
    }
  }

  const members = await prisma.dimensionMember.findMany({ where: { companyId } });
  const memberKey = (dimensionId: string, code: string) => `${dimensionId}|${code}`;
  const memberByKey = new Map(members.map((m) => [memberKey(m.dimensionId, m.code), m]));

  // 3. Comptes rencontrés
  const accountNumbers = [...new Set(rows.map((r) => r.entry!.accountNumber).filter(Boolean))] as string[];
  for (const number of accountNumbers) {
    await prisma.account.upsert({
      where: { companyId_number: { companyId, number } },
      create: {
        companyId,
        number,
        label: `Compte ${number}`,
        type: number.startsWith("7") ? "REVENUE" : "EXPENSE",
      },
      update: {},
    });
  }
  const accounts = await prisma.account.findMany({ where: { companyId } });
  const accountByNumber = new Map(accounts.map((a) => [a.number, a]));

  // 4. Écritures — insertions groupées.
  // Surtout pas 200 créations imbriquées dans une transaction : sur une base distante,
  // les allers-retours dépassent le délai de transaction de Prisma (P2028) dès quelques
  // centaines de lignes. On génère les identifiants pour créer les liens dimensionnels
  // dans un second lot.
  const entryRows: Record<string, unknown>[] = [];
  const linkRows: Record<string, unknown>[] = [];

  for (const { entry } of rows) {
    const period = periodByCode.get(entry!.periodCode);
    if (!period) continue;
    const entryId = randomUUID();

    entryRows.push({
      id: entryId,
      companyId,
      periodId: period.id,
      date: new Date(entry!.date),
      kind: entry!.kind,
      amount: entry!.amount,
      quantity: entry!.quantity,
      unitPrice: entry!.unitPrice,
      accountId: entry!.accountNumber ? (accountByNumber.get(entry!.accountNumber)?.id ?? null) : null,
      behavior: entry!.behavior,
      traceability: entry!.traceability,
      label: entry!.label,
      importBatchId: batchId,
    });

    for (const [dimensionCode, memberCode] of Object.entries(entry!.dims)) {
      const dimension = dimensionByCode.get(dimensionCode);
      if (!dimension) continue;
      const member = memberByKey.get(memberKey(dimension.id, memberCode));
      if (!member) continue;
      linkRows.push({ id: randomUUID(), entryId, dimensionId: dimension.id, memberId: member.id });
    }
  }

  const BATCH = 500;
  for (let i = 0; i < entryRows.length; i += BATCH) {
    await prisma.entry.createMany({ data: entryRows.slice(i, i + BATCH) as never });
  }
  for (let i = 0; i < linkRows.length; i += BATCH) {
    await prisma.entryDimension.createMany({ data: linkRows.slice(i, i + BATCH) as never });
  }
  const imported = entryRows.length;

  await prisma.importBatch.update({
    where: { id: batchId },
    data: {
      status: "COMMITTED",
      committedAt: new Date(),
      mapping: JSON.stringify(mapping),
      rowCount: parsed.totalRows,
    },
  });

  await audit({
    companyId,
    actorId,
    action: "import.commit",
    entity: "ImportBatch",
    entityId: batchId,
    diff: { imported, rejected },
  });

  return { imported, rejected };
}

export async function cancelImport(companyId: string, batchId: string, actorId?: string | null) {
  const batch = await prisma.importBatch.findFirst({ where: { id: batchId, companyId } });
  if (!batch) throw new Error("IMPORT_NOT_FOUND");
  const deleted = await prisma.entry.deleteMany({ where: { companyId, importBatchId: batchId } });
  await prisma.importBatch.update({ where: { id: batchId }, data: { status: "CANCELLED" } });
  await audit({
    companyId,
    actorId,
    action: "import.cancel",
    entity: "ImportBatch",
    entityId: batchId,
    diff: { removed: deleted.count },
  });
  return { removed: deleted.count };
}

export async function getBatchMapping(companyId: string, batchId: string): Promise<ImportMapping | null> {
  const batch = await prisma.importBatch.findFirst({ where: { id: batchId, companyId } });
  if (!batch) return null;
  return parseJsonLoose<ImportMapping | null>(batch.mapping, null);
}

/**
 * Rapproche une valeur de colonne d'un membre existant, par code OU par libellé normalisé.
 * C'est ce qui évite de créer « Refonte SI Delta » à côté de la mission « SI_DELTA ».
 */
function buildMemberResolver(dataset: { members: { dimensionCode: string; code: string; label: string }[] }) {
  const byDimension = new Map<string, Map<string, string>>();
  for (const member of dataset.members) {
    const map = byDimension.get(member.dimensionCode) ?? new Map<string, string>();
    map.set(memberCodeFrom(member.code), member.code);
    map.set(memberCodeFrom(member.label), member.code);
    byDimension.set(member.dimensionCode, map);
  }
  return (dimensionCode: string, rawValue: string): string =>
    byDimension.get(dimensionCode)?.get(memberCodeFrom(rawValue)) ?? memberCodeFrom(rawValue);
}

/**
 * Résolution du classement par défaut d'un compte importé.
 * « 611000 » est rapproché du compte « 611 » du plan : on retient le préfixe le plus long.
 */
async function loadAccountDefaults(companyId: string) {
  const accounts = (await prisma.account.findMany({ where: { companyId } })).sort(
    (a, b) => b.number.length - a.number.length,
  );
  return (accountNumber: string): AccountDefaults | undefined => {
    const clean = accountNumber.trim();
    const account = accounts.find((a) => clean === a.number || clean.startsWith(a.number));
    if (!account) return undefined;
    return {
      kind: account.type === "REVENUE" ? "REVENUE" : "COST",
      behavior: account.defaultBehavior as AccountDefaults["behavior"],
      traceability: account.defaultTraceability as AccountDefaults["traceability"],
      natureCode: account.defaultNatureCode ?? undefined,
    };
  };
}

function humanize(code: string): string {
  return code
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export { memberCodeFrom };
