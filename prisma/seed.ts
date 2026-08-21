/**
 * Jeu de démonstration : trois entreprises aux modèles économiques radicalement différents,
 * traitées par le MÊME moteur (docs/16 §3).
 *
 *   1. Delta Conseil     — services facturés au temps
 *   2. Nordmeca          — industrie, production d'unités
 *   3. Bâtir Atlantique  — BTP, affaires à l'avancement
 *
 * Les données sont générées par un PRNG à graine fixe : deux exécutions produisent
 * exactement les mêmes chiffres (condition des tests de non-régression numérique).
 */

import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";
import { businessModelProfileSchema, type BusinessModelProfile } from "../src/core/model/profile";
import { applyConfiguration, buildConfigurationPlan, ensurePeriods } from "../src/services/configuration.service";
import { createBudgetFromHistory } from "../src/services/budget.service";

const pool = new Pool({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  connectionTimeoutMillis: 20_000,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// ---------------------------------------------------------------- utilitaires

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Identifiant applicatif : permet de créer les lignes liées dans un second lot groupé. */
function newId(): string {
  return randomUUID();
}

/** Insertion par lots de 500 : au-delà, la requête devient trop lourde pour le pooler. */
async function insertMany<T>(
  create: (rows: T[]) => Promise<unknown>,
  rows: T[],
  size = 500,
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    await create(rows.slice(i, i + size));
  }
}

const PERIODS = [
  ...Array.from({ length: 12 }, (_, i) => `2025-${String(i + 1).padStart(2, "0")}`),
  ...Array.from({ length: 6 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`),
];

type EntryInput = {
  periodCode: string;
  kind: "REVENUE" | "COST";
  amount: number;
  quantity?: number | null;
  unitPrice?: number | null;
  behavior: "FIXED" | "VARIABLE" | "SEMI_VARIABLE";
  traceability: "DIRECT" | "INDIRECT";
  label: string;
  dims: Record<string, string>;
};

type DriverInput = {
  periodCode: string;
  driverCode: string;
  dimensionCode?: string;
  memberCode?: string;
  value: number;
};

async function createMembers(
  companyId: string,
  dimensionCode: string,
  members: { code: string; label: string; attributes?: Record<string, unknown> }[],
) {
  const dimension = await prisma.dimension.findUnique({
    where: { companyId_code: { companyId, code: dimensionCode } },
  });
  if (!dimension) throw new Error(`Dimension ${dimensionCode} absente`);
  for (const member of members) {
    await prisma.dimensionMember.upsert({
      where: { dimensionId_code: { dimensionId: dimension.id, code: member.code } },
      create: {
        companyId,
        dimensionId: dimension.id,
        code: member.code,
        label: member.label,
        attributes: JSON.stringify(member.attributes ?? {}),
      },
      update: { label: member.label, attributes: JSON.stringify(member.attributes ?? {}) },
    });
  }
}

async function insertEntries(companyId: string, entries: EntryInput[]) {
  const [periods, dimensions, members] = await Promise.all([
    prisma.period.findMany({ where: { companyId } }),
    prisma.dimension.findMany({ where: { companyId } }),
    prisma.dimensionMember.findMany({ where: { companyId } }),
  ]);
  const periodByCode = new Map(periods.map((p) => [p.code, p]));
  const dimensionByCode = new Map(dimensions.map((d) => [d.code, d]));
  const memberByKey = new Map(members.map((m) => [`${m.dimensionId}|${m.code}`, m]));

  // Insertions groupées : une base distante ne supporte pas 200 allers-retours dans une
  // transaction de 5 s (erreur P2028). Les identifiants sont générés ici pour pouvoir
  // créer les liens dimensionnels dans un second lot.
  const entryRows: Record<string, unknown>[] = [];
  const linkRows: Record<string, unknown>[] = [];

  for (const entry of entries) {
    const period = periodByCode.get(entry.periodCode);
    if (!period) throw new Error(`Période ${entry.periodCode} absente`);
    const entryId = newId();
    const [year, month] = entry.periodCode.split("-").map(Number);

    entryRows.push({
      id: entryId,
      companyId,
      periodId: period.id,
      date: new Date(Date.UTC(year, month - 1, 28)),
      kind: entry.kind,
      amount: Math.round(entry.amount * 100) / 100,
      quantity: entry.quantity ?? null,
      unitPrice: entry.unitPrice ?? null,
      behavior: entry.behavior,
      traceability: entry.traceability,
      label: entry.label,
    });

    for (const [dimensionCode, memberCode] of Object.entries(entry.dims)) {
      const dimension = dimensionByCode.get(dimensionCode);
      if (!dimension) continue;
      const member = memberByKey.get(`${dimension.id}|${memberCode}`);
      if (!member) continue;
      linkRows.push({ id: newId(), entryId, dimensionId: dimension.id, memberId: member.id });
    }
  }

  await insertMany((rows) => prisma.entry.createMany({ data: rows as never }), entryRows);
  await insertMany((rows) => prisma.entryDimension.createMany({ data: rows as never }), linkRows);
}

async function insertDrivers(companyId: string, drivers: DriverInput[]) {
  const [periods, dimensions, members] = await Promise.all([
    prisma.period.findMany({ where: { companyId } }),
    prisma.dimension.findMany({ where: { companyId } }),
    prisma.dimensionMember.findMany({ where: { companyId } }),
  ]);
  const periodByCode = new Map(periods.map((p) => [p.code, p]));
  const dimensionByCode = new Map(dimensions.map((d) => [d.code, d]));
  const memberByKey = new Map(members.map((m) => [`${m.dimensionId}|${m.code}`, m]));

  const rows = drivers.map((driver) => {
    const period = periodByCode.get(driver.periodCode)!;
    const dimension = driver.dimensionCode ? dimensionByCode.get(driver.dimensionCode) : undefined;
    const member =
      dimension && driver.memberCode ? memberByKey.get(`${dimension.id}|${driver.memberCode}`) : undefined;
    return {
      id: newId(),
      companyId,
      periodId: period.id,
      driverCode: driver.driverCode,
      dimensionId: dimension?.id ?? null,
      memberId: member?.id ?? null,
      value: Math.round(driver.value * 100) / 100,
    };
  });

  await insertMany((batch) => prisma.driverValue.createMany({ data: batch as never }), rows);
}

async function setupCompany(input: {
  organizationId: string;
  name: string;
  industry: string;
  activity: string;
  profile: BusinessModelProfile;
}) {
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const company = await prisma.company.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      slug,
      industry: input.industry,
      activity: input.activity,
      currency: "EUR",
      fiscalYearStartMonth: 1,
    },
  });

  await ensurePeriods(company.id, 2025, 12);
  await ensurePeriods(company.id, 2026, 12);

  await prisma.businessModelProfile.create({
    data: { companyId: company.id, payload: JSON.stringify(input.profile) },
  });

  const { plan } = await buildConfigurationPlan(company.id);
  await applyConfiguration(company.id, plan, null);

  return company;
}

const profile = (overrides: Record<string, unknown>): BusinessModelProfile =>
  businessModelProfileSchema.parse(overrides);

// ------------------------------------------------------------- 1. conseil

async function seedConsulting(organizationId: string) {
  const company = await setupCompany({
    organizationId,
    name: "Delta Conseil",
    industry: "consulting",
    activity: "Conseil en organisation et transformation",
    profile: profile({
      identity: { activity: "Conseil en organisation", revenueBand: 860_000, headcount: 8, siteCount: 1, establishmentCount: 1 },
      revenue: {
        models: ["time", "project"],
        billingUnits: ["day", "hour", "fixed_price"],
        recurringSharePct: 25,
        seasonality: "moderate",
        topClientSharePct: 34,
      },
      costs: {
        payrollSharePct: 62,
        purchasesSharePct: 8,
        subcontractingSharePct: 12,
        overheadSharePct: 18,
        indirectSharePct: 18,
        marginDrivers: ["utilization", "price", "mix"],
      },
      organization: { units: [{ type: "department", label: "Pôles", count: 3 }] },
      pilotObjects: ["CLIENT", "PROJECT", "EMPLOYEE"],
      objectLabels: { PROJECT: "Mission", EMPLOYEE: "Consultant" },
      objectives: ["improve_margin", "client_profitability", "productivity"],
      maturity: "intermediate",
      dataSources: ["accounting", "timesheets", "excel"],
    }),
  });

  const clients = [
    { code: "FONCIA", label: "Foncia" },
    { code: "ORION", label: "Orion Industries" },
    { code: "VEGA", label: "Vega Santé" },
    { code: "ALTIS", label: "Altis Mutuelle" },
    { code: "MERIDIAN", label: "Meridian Banque" },
  ];
  const missions = [
    { code: "SI_DELTA", label: "Refonte SI Delta", client: "FONCIA", rate: 980 },
    { code: "AUDIT_ORION", label: "Audit organisation Orion", client: "ORION", rate: 890 },
    { code: "CADRAGE_VEGA", label: "Cadrage Vega", client: "VEGA", rate: 640 },
    { code: "PMO_ALTIS", label: "PMO Altis", client: "ALTIS", rate: 870 },
    { code: "DATA_MERIDIAN", label: "Gouvernance data Meridian", client: "MERIDIAN", rate: 1040 },
  ];
  const consultants = [
    { code: "C_MARTIN", label: "A. Martin", cost: 380 },
    { code: "C_BENALI", label: "S. Benali", cost: 340 },
    { code: "C_LEROY", label: "P. Leroy", cost: 420 },
    { code: "C_DUBOIS", label: "M. Dubois", cost: 300 },
    { code: "C_NGUYEN", label: "T. Nguyen", cost: 395 },
  ];

  await createMembers(company.id, "CLIENT", clients);
  await createMembers(
    company.id,
    "PROJECT",
    missions.map((m) => ({ code: m.code, label: m.label, attributes: { client: m.client, dailyRate: m.rate } })),
  );
  await createMembers(company.id, "EMPLOYEE", consultants);

  const random = mulberry32(20260820);
  const entries: EntryInput[] = [];
  const drivers: DriverInput[] = [];

  PERIODS.forEach((periodCode, index) => {
    const month = Number(periodCode.split("-")[1]);
    const seasonal = month === 8 ? 0.55 : month === 12 ? 0.85 : 1 + (random() - 0.5) * 0.12;
    const drift = 1 + index * 0.004;
    let billableHours = 0;

    for (const mission of missions) {
      const baseDays = mission.code === "CADRAGE_VEGA" ? 9 : 12 + random() * 8;
      const days = Math.round(baseDays * seasonal * drift);
      if (days <= 0) continue;
      // Érosion tarifaire progressive sur une mission : source de l'effet prix.
      const rate = mission.code === "CADRAGE_VEGA" ? mission.rate * (1 - index * 0.006) : mission.rate;
      const hours = days * 7;

      const consultant = consultants[(missions.indexOf(mission) + index) % consultants.length];

      entries.push({
        periodCode,
        kind: "REVENUE",
        amount: days * rate,
        quantity: days,
        unitPrice: Math.round(rate * 100) / 100,
        behavior: "VARIABLE",
        traceability: "DIRECT",
        label: `Honoraires ${mission.label}`,
        dims: { CLIENT: mission.client, PROJECT: mission.code, EMPLOYEE: consultant.code },
      });

      entries.push({
        periodCode,
        kind: "COST",
        amount: days * consultant.cost,
        quantity: days,
        unitPrice: consultant.cost,
        behavior: "FIXED",
        traceability: "DIRECT",
        label: `Production ${consultant.label}`,
        dims: { PROJECT: mission.code, CLIENT: mission.client, EMPLOYEE: consultant.code, NATURE: "PAYROLL", CENTER: "DELIVERY" },
      });

      if (mission.code === "SI_DELTA" || mission.code === "DATA_MERIDIAN") {
        entries.push({
          periodCode,
          kind: "COST",
          amount: days * 180 * (1 + index * 0.01),
          behavior: "VARIABLE",
          traceability: "DIRECT",
          label: "Sous-traitance experts",
          dims: { PROJECT: mission.code, CLIENT: mission.client, NATURE: "SUBCONTRACTING", CENTER: "DELIVERY" },
        });
      }

      entries.push({
        periodCode,
        kind: "COST",
        amount: days * 42,
        behavior: "VARIABLE",
        traceability: "DIRECT",
        label: "Déplacements",
        dims: { PROJECT: mission.code, CLIENT: mission.client, NATURE: "TRAVEL", CENTER: "DELIVERY" },
      });

      billableHours += hours;
    }

    // Les heures facturables sont réparties entre les consultants : le total par axe
    // EMPLOYEE est donc identique au total par axe PROJECT (cohérence des inducteurs).
    for (const consultant of consultants) {
      drivers.push({
        periodCode,
        driverCode: "BILLABLE_HOURS",
        dimensionCode: "EMPLOYEE",
        memberCode: consultant.code,
        value: Math.round(billableHours / consultants.length),
      });
      drivers.push({ periodCode, driverCode: "AVAILABLE_HOURS", dimensionCode: "EMPLOYEE", memberCode: consultant.code, value: 151 });
      drivers.push({ periodCode, driverCode: "HOURS", dimensionCode: "EMPLOYEE", memberCode: consultant.code, value: 151 });
    }

    drivers.push({ periodCode, driverCode: "FTE", value: 8 });
    drivers.push({ periodCode, driverCode: "HEADCOUNT", dimensionCode: "CENTER", memberCode: "DELIVERY", value: 5 });
    drivers.push({ periodCode, driverCode: "HEADCOUNT", dimensionCode: "CENTER", memberCode: "SALES", value: 1 });
    drivers.push({ periodCode, driverCode: "HEADCOUNT", dimensionCode: "CENTER", memberCode: "ADMIN", value: 2 });

    entries.push(
      {
        periodCode,
        kind: "COST",
        amount: 12_000 * (1 + index * 0.003),
        behavior: "FIXED",
        traceability: "INDIRECT",
        label: "Structure et support",
        dims: { NATURE: "OVERHEAD", CENTER: "ADMIN" },
      },
      {
        periodCode,
        kind: "COST",
        amount: 6_000,
        behavior: "FIXED",
        traceability: "INDIRECT",
        label: "Équipe commerciale",
        dims: { NATURE: "PAYROLL", CENTER: "SALES" },
      },
      {
        periodCode,
        kind: "COST",
        amount: 2_100 + random() * 400,
        behavior: "SEMI_VARIABLE",
        traceability: "INDIRECT",
        label: "Licences et outils",
        dims: { NATURE: "TOOLS", CENTER: "ADMIN" },
      },
    );
  });

  await insertEntries(company.id, entries);
  await insertDrivers(company.id, drivers);
  return company;
}

// ---------------------------------------------------------- 2. industrie

async function seedManufacturing(organizationId: string) {
  const company = await setupCompany({
    organizationId,
    name: "Nordmeca",
    industry: "manufacturing",
    activity: "Usinage de précision et assemblage mécanique",
    profile: profile({
      identity: { activity: "Usinage de précision", revenueBand: 8_600_000, headcount: 64, siteCount: 1, establishmentCount: 1 },
      revenue: {
        models: ["unit"],
        billingUnits: ["quantity"],
        recurringSharePct: 10,
        seasonality: "moderate",
        topClientSharePct: 22,
      },
      costs: {
        payrollSharePct: 34,
        purchasesSharePct: 41,
        subcontractingSharePct: 6,
        overheadSharePct: 19,
        indirectSharePct: 32,
        marginDrivers: ["material_cost", "productivity", "scrap"],
      },
      organization: { units: [{ type: "workshop", label: "Ateliers", count: 2 }] },
      pilotObjects: ["PRODUCT", "CLIENT"],
      objectLabels: { PRODUCT: "Produit", CENTER: "Atelier" },
      objectives: ["reduce_cost", "improve_margin", "productivity"],
      maturity: "advanced",
      dataSources: ["accounting", "erp"],
    }),
  });

  const products = [
    { code: "VANNE_DN80", label: "Vanne DN80", price: 148, material: 61, units: 14_400 },
    { code: "BRIDE_A2", label: "Bride A2", price: 62, material: 26, units: 31_200 },
    { code: "CARTER_X", label: "Carter X", price: 310, material: 138, units: 5_400 },
    { code: "AXE_T4", label: "Axe T4", price: 44, material: 17, units: 44_400 },
  ];
  const clients = [
    { code: "AIRTEC", label: "Airtec" },
    { code: "HYDRALIS", label: "Hydralis" },
    { code: "SOGEP", label: "Sogep" },
  ];

  await createMembers(company.id, "PRODUCT", products);
  await createMembers(company.id, "CLIENT", clients);

  const random = mulberry32(19881010);
  const entries: EntryInput[] = [];
  const drivers: DriverInput[] = [];

  PERIODS.forEach((periodCode, index) => {
    const month = Number(periodCode.split("-")[1]);
    const seasonal = month === 8 ? 0.6 : 1 + (random() - 0.5) * 0.1;
    // Inflation matière progressive : c'est l'origine de la dérive de marge du profil.
    const materialInflation = 1 + index * 0.009;

    products.forEach((product, productIndex) => {
      const units = Math.round((product.units / 12) * seasonal);
      const client = clients[(productIndex + index) % clients.length];

      entries.push({
        periodCode,
        kind: "REVENUE",
        amount: units * product.price,
        quantity: units,
        unitPrice: product.price,
        behavior: "VARIABLE",
        traceability: "DIRECT",
        label: `Ventes ${product.label}`,
        dims: { PRODUCT: product.code, CLIENT: client.code },
      });

      entries.push({
        periodCode,
        kind: "COST",
        amount: units * product.material * materialInflation,
        quantity: units,
        unitPrice: Math.round(product.material * materialInflation * 100) / 100,
        behavior: "VARIABLE",
        traceability: "DIRECT",
        label: `Matières ${product.label}`,
        dims: { PRODUCT: product.code, NATURE: "MATERIAL", CENTER: "MACHINING" },
      });

      entries.push({
        periodCode,
        kind: "COST",
        amount: units * product.price * 0.14,
        behavior: "FIXED",
        traceability: "DIRECT",
        label: `Main-d'œuvre directe ${product.label}`,
        dims: { PRODUCT: product.code, NATURE: "PAYROLL", CENTER: "ASSEMBLY" },
      });

      const machineHours = units * (product.code === "CARTER_X" ? 0.9 : 0.25);
      drivers.push({ periodCode, driverCode: "MACHINE_HOURS", dimensionCode: "PRODUCT", memberCode: product.code, value: machineHours });
      drivers.push({ periodCode, driverCode: "UNITS_PRODUCED", dimensionCode: "PRODUCT", memberCode: product.code, value: units });
      drivers.push({
        periodCode,
        driverCode: "UNITS_SCRAPPED",
        dimensionCode: "PRODUCT",
        memberCode: product.code,
        value: Math.round(units * (0.02 + index * 0.0012)),
      });
      drivers.push({ periodCode, driverCode: "MACHINE_HOURS", dimensionCode: "CENTER", memberCode: "MACHINING", value: machineHours * 0.7 });
      drivers.push({ periodCode, driverCode: "MACHINE_HOURS", dimensionCode: "CENTER", memberCode: "ASSEMBLY", value: machineHours * 0.3 });
    });

    drivers.push({ periodCode, driverCode: "FTE", value: 64 });
    drivers.push({ periodCode, driverCode: "HEADCOUNT", dimensionCode: "CENTER", memberCode: "MACHINING", value: 26 });
    drivers.push({ periodCode, driverCode: "HEADCOUNT", dimensionCode: "CENTER", memberCode: "ASSEMBLY", value: 22 });
    drivers.push({ periodCode, driverCode: "HEADCOUNT", dimensionCode: "CENTER", memberCode: "LOGISTICS", value: 9 });
    drivers.push({ periodCode, driverCode: "HEADCOUNT", dimensionCode: "CENTER", memberCode: "ADMIN", value: 7 });

    entries.push(
      {
        periodCode,
        kind: "COST",
        amount: 41_000 + random() * 5_000,
        behavior: "SEMI_VARIABLE",
        traceability: "INDIRECT",
        label: "Énergie atelier",
        dims: { NATURE: "ENERGY", CENTER: "MACHINING" },
      },
      {
        periodCode,
        kind: "COST",
        amount: 22_000 + random() * 3_500,
        behavior: "SEMI_VARIABLE",
        traceability: "INDIRECT",
        label: "Maintenance",
        dims: { NATURE: "MAINTENANCE", CENTER: "MACHINING" },
      },
      {
        periodCode,
        kind: "COST",
        amount: 17_500,
        behavior: "FIXED",
        traceability: "INDIRECT",
        label: "Contrôle qualité",
        dims: { NATURE: "QUALITY", CENTER: "ASSEMBLY" },
      },
      {
        periodCode,
        kind: "COST",
        amount: 38_000 * (1 + index * 0.002),
        behavior: "FIXED",
        traceability: "INDIRECT",
        label: "Structure et administration",
        dims: { NATURE: "OVERHEAD", CENTER: "ADMIN" },
      },
      {
        periodCode,
        kind: "COST",
        amount: 12_400,
        behavior: "FIXED",
        traceability: "INDIRECT",
        label: "Logistique",
        dims: { NATURE: "EXTERNAL", CENTER: "LOGISTICS" },
      },
    );
  });

  await insertEntries(company.id, entries);
  await insertDrivers(company.id, drivers);
  return company;
}

// ------------------------------------------------------------------ 3. BTP

async function seedConstruction(organizationId: string) {
  const company = await setupCompany({
    organizationId,
    name: "Bâtir Atlantique",
    industry: "construction",
    activity: "Gros œuvre et réhabilitation de logements collectifs",
    profile: profile({
      identity: { activity: "Gros œuvre", revenueBand: 4_700_000, headcount: 45, siteCount: 1, establishmentCount: 1 },
      revenue: {
        models: ["progress", "project"],
        billingUnits: ["progress", "fixed_price"],
        recurringSharePct: 0,
        seasonality: "moderate",
        topClientSharePct: 41,
      },
      costs: {
        payrollSharePct: 28,
        purchasesSharePct: 26,
        subcontractingSharePct: 33,
        overheadSharePct: 13,
        indirectSharePct: 21,
        marginDrivers: ["subcontracting", "material_cost", "productivity"],
      },
      organization: { units: [{ type: "site", label: "Dépôts", count: 3 }] },
      pilotObjects: ["PROJECT", "CLIENT"],
      objectLabels: { PROJECT: "Chantier", EMPLOYEE: "Compagnon" },
      objectives: ["project_control", "improve_margin", "control_budget"],
      maturity: "intermediate",
      dataSources: ["accounting", "excel"],
    }),
  });

  const clients = [
    { code: "FONCIA_IMMO", label: "Foncia Immobilier" },
    { code: "OPH_ATLANTIQUE", label: "OPH Atlantique" },
    { code: "SEM_VILLE", label: "SEM Ville de Nantes" },
  ];

  const sites = [
    {
      code: "ALBA",
      label: "Résidence Alba",
      client: "FONCIA_IMMO",
      contractValue: 4_960_000,
      budgetTotal: 4_040_000,
      progress: 0.62,
      months: 18,
      driftFactor: 1.22,
    },
    {
      code: "BREA",
      label: "Îlot Bréa",
      client: "OPH_ATLANTIQUE",
      contractValue: 3_180_000,
      budgetTotal: 2_640_000,
      progress: 0.48,
      months: 18,
      driftFactor: 1.12,
    },
    {
      code: "CARENE",
      label: "Groupe scolaire Carène",
      client: "SEM_VILLE",
      contractValue: 2_240_000,
      budgetTotal: 1_880_000,
      progress: 0.81,
      months: 18,
      driftFactor: 0.95,
    },
    {
      code: "DUNES",
      label: "Réhabilitation Les Dunes",
      client: "OPH_ATLANTIQUE",
      contractValue: 1_720_000,
      budgetTotal: 1_460_000,
      progress: 0.35,
      months: 18,
      driftFactor: 0.98,
    },
  ];

  await createMembers(company.id, "CLIENT", clients);
  await createMembers(
    company.id,
    "PROJECT",
    sites.map((s) => ({
      code: s.code,
      label: s.label,
      attributes: {
        client: s.client,
        contractValue: s.contractValue,
        budgetTotal: s.budgetTotal,
        progress: s.progress,
      },
    })),
  );

  const random = mulberry32(20250314);
  const entries: EntryInput[] = [];
  const drivers: DriverInput[] = [];

  PERIODS.forEach((periodCode, index) => {
    const month = Number(periodCode.split("-")[1]);
    const seasonal = month === 8 ? 0.5 : month === 1 ? 0.8 : 1 + (random() - 0.5) * 0.15;

    for (const site of sites) {
      // Les flux mensuels sont calés sur l'avancement déclaré : au terme des 18 périodes,
      // le cumul des coûts vaut budget × avancement × dérive, cohérent avec l'attribut progress.
      const costMonth = ((site.budgetTotal * site.progress) / site.months) * seasonal * site.driftFactor;
      const revenueMonth = ((site.contractValue * site.progress) / site.months) * seasonal;

      entries.push({
        periodCode,
        kind: "REVENUE",
        amount: revenueMonth,
        quantity: 1,
        unitPrice: Math.round(revenueMonth * 100) / 100,
        behavior: "VARIABLE",
        traceability: "DIRECT",
        label: `Situation de travaux ${site.label}`,
        dims: { PROJECT: site.code, CLIENT: site.client },
      });

      entries.push(
        {
          periodCode,
          kind: "COST",
          amount: costMonth * 0.3,
          behavior: "VARIABLE",
          traceability: "DIRECT",
          label: `Matériaux ${site.label}`,
          dims: { PROJECT: site.code, CLIENT: site.client, NATURE: "MATERIAL", CENTER: "WORKS" },
        },
        {
          periodCode,
          kind: "COST",
          amount: costMonth * 0.4 * (1 + index * 0.004),
          behavior: "VARIABLE",
          traceability: "DIRECT",
          label: `Sous-traitance ${site.label}`,
          dims: { PROJECT: site.code, CLIENT: site.client, NATURE: "SUBCONTRACTING", CENTER: "WORKS" },
        },
        {
          periodCode,
          kind: "COST",
          amount: costMonth * 0.22,
          behavior: "FIXED",
          traceability: "DIRECT",
          label: `Main-d'œuvre ${site.label}`,
          dims: { PROJECT: site.code, CLIENT: site.client, NATURE: "PAYROLL", CENTER: "WORKS" },
        },
      );

      drivers.push({
        periodCode,
        driverCode: "HOURS",
        dimensionCode: "PROJECT",
        memberCode: site.code,
        value: Math.round((costMonth * 0.22) / 32),
      });
    }

    drivers.push({ periodCode, driverCode: "FTE", value: 45 });
    drivers.push({ periodCode, driverCode: "HEADCOUNT", dimensionCode: "CENTER", memberCode: "WORKS", value: 34 });
    drivers.push({ periodCode, driverCode: "HEADCOUNT", dimensionCode: "CENTER", memberCode: "DEPOT", value: 5 });
    drivers.push({ periodCode, driverCode: "HEADCOUNT", dimensionCode: "CENTER", memberCode: "ADMIN", value: 6 });

    entries.push(
      {
        periodCode,
        kind: "COST",
        amount: 26_000 + random() * 4_000,
        behavior: "SEMI_VARIABLE",
        traceability: "INDIRECT",
        label: "Matériel et engins",
        dims: { NATURE: "EQUIPMENT", CENTER: "DEPOT" },
      },
      {
        periodCode,
        kind: "COST",
        amount: 20_000 * (1 + index * 0.002),
        behavior: "FIXED",
        traceability: "INDIRECT",
        label: "Encadrement et structure",
        dims: { NATURE: "OVERHEAD", CENTER: "ADMIN" },
      },
    );
  });

  await insertEntries(company.id, entries);
  await insertDrivers(company.id, drivers);
  return company;
}

// --------------------------------------------------------------------- main

async function main() {
  console.log("Réinitialisation…");
  await prisma.auditLog.deleteMany();
  await prisma.entryDimension.deleteMany();
  await prisma.entry.deleteMany();
  await prisma.driverValue.deleteMany();
  await prisma.budgetLine.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.kpiValue.deleteMany();
  await prisma.kpiDefinition.deleteMany();
  await prisma.costAllocation.deleteMany();
  await prisma.calculationRun.deleteMany();
  await prisma.allocationRule.deleteMany();
  await prisma.dimensionMember.deleteMany();
  await prisma.dimension.deleteMany();
  await prisma.account.deleteMany();
  await prisma.period.deleteMany();
  await prisma.configurationVersion.deleteMany();
  await prisma.businessModelProfile.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.report.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.scenario.deleteMany();
  await prisma.company.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  const organization = await prisma.organization.create({
    data: { name: "Cabinet Axio Démo", slug: "cabinet-axio-demo", plan: "firm" },
  });

  const user = await prisma.user.create({
    data: {
      email: "demo@axio.fr",
      name: "Démonstration Axio",
      passwordHash: await bcrypt.hash("Pilotage2026!", 10),
    },
  });

  await prisma.membership.create({
    data: { userId: user.id, organizationId: organization.id, role: "ADMIN" },
  });

  console.log("1/3 — Delta Conseil (services facturés au temps)…");
  const consulting = await seedConsulting(organization.id);
  console.log("2/3 — Nordmeca (industrie)…");
  const manufacturing = await seedManufacturing(organization.id);
  console.log("3/3 — Bâtir Atlantique (BTP)…");
  const construction = await seedConstruction(organization.id);

  console.log("Budgets 2026 construits depuis le réel 2025…");
  for (const company of [consulting, manufacturing, construction]) {
    const { budgetId } = await createBudgetFromHistory({
      companyId: company.id,
      name: "Budget 2026",
      fiscalYear: 2026,
      sourceFiscalYear: 2025,
      growthPct: 6,
      costGrowthPct: 4,
    });
    await prisma.budget.update({ where: { id: budgetId }, data: { status: "APPROVED" } });
  }

  // La configuration est rejouée : le budget existe désormais, la capacité budget_control s'active.
  for (const company of [consulting, manufacturing, construction]) {
    const { plan } = await buildConfigurationPlan(company.id);
    await applyConfiguration(company.id, plan, null);
  }

  const counts = await Promise.all(
    [consulting, manufacturing, construction].map(async (company) => ({
      name: company.name,
      entries: await prisma.entry.count({ where: { companyId: company.id } }),
      drivers: await prisma.driverValue.count({ where: { companyId: company.id } }),
      kpis: await prisma.kpiDefinition.count({ where: { companyId: company.id } }),
    })),
  );

  console.table(counts);
  console.log("\nCompte de démonstration : demo@axio.fr / Pilotage2026!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
