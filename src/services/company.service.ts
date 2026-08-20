import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { ensurePeriods } from "./configuration.service";

/** Comptes, organisations et entreprises (docs/17 CA-1). */

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function uniqueSlug(base: string, exists: (slug: string) => Promise<boolean>): Promise<string> {
  const root = base || "organisation";
  let candidate = root;
  let index = 2;
  while (await exists(candidate)) {
    candidate = `${root}-${index}`;
    index += 1;
  }
  return candidate;
}

export async function registerUser(input: {
  email: string;
  password: string;
  name: string;
  organizationName?: string;
}) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("EMAIL_ALREADY_USED");

  const organizationName = input.organizationName?.trim() || `Organisation de ${input.name}`;
  const slug = await uniqueSlug(slugify(organizationName), async (candidate) =>
    Boolean(await prisma.organization.findUnique({ where: { slug: candidate } })),
  );

  const user = await prisma.user.create({
    data: { email, name: input.name.trim(), passwordHash: await hashPassword(input.password) },
  });

  const organization = await prisma.organization.create({ data: { name: organizationName, slug } });

  await prisma.membership.create({
    data: { userId: user.id, organizationId: organization.id, role: "ADMIN" },
  });

  return { user, organization };
}

export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) return null;
  if (!(await verifyPassword(password, user.passwordHash))) return null;

  const membership = await prisma.membership.findFirst({ where: { userId: user.id } });
  if (!membership) return null;

  return { user, organizationId: membership.organizationId };
}

export async function createCompany(input: {
  organizationId: string;
  name: string;
  industry: string;
  activity?: string;
  country?: string;
  currency?: string;
  fiscalYearStartMonth?: number;
  fiscalYear?: number;
}) {
  const slug = await uniqueSlug(slugify(input.name), async (candidate) =>
    Boolean(
      await prisma.company.findFirst({
        where: { organizationId: input.organizationId, slug: candidate },
      }),
    ),
  );

  const company = await prisma.company.create({
    data: {
      organizationId: input.organizationId,
      name: input.name.trim(),
      slug,
      industry: input.industry,
      activity: input.activity ?? "",
      country: input.country ?? "FR",
      currency: input.currency ?? "EUR",
      fiscalYearStartMonth: input.fiscalYearStartMonth ?? 1,
    },
  });

  const year = input.fiscalYear ?? new Date().getFullYear();
  await ensurePeriods(company.id, year - 1, 12);
  await ensurePeriods(company.id, year, 12);

  return company;
}

export async function archiveCompany(companyId: string, organizationId: string) {
  const company = await prisma.company.findFirst({ where: { id: companyId, organizationId } });
  if (!company) throw new Error("COMPANY_NOT_FOUND");
  await prisma.company.update({ where: { id: companyId }, data: { archivedAt: new Date() } });
}
