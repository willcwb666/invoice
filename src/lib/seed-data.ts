import { prisma } from "@/lib/prisma";
import { getOrCreateSignatureFile } from "@/lib/pdf-signature";
import { ensureAdminUser } from "@/lib/security/auth";
import { DEFAULT_ICLOUD_URL } from "@/lib/calendar/icloud";
import { SEED_CLIENTS, SEED_INVOICES } from "@/lib/seed-fixtures";
import { DEFAULT_COMPANY_SETTINGS } from "@/lib/company-defaults";

// ensureExampleInvoicesSeeded is called defensively from many places (server
// boot, dashboard layout, invoice listing, appointments, agenda sync,
// company route) as a self-healing "make sure the real bootstrap data and
// admin account exist" step. Without memoization each of those calls redid
// the full ~10 sequential DB round trips (company lookup, signature check,
// 3 client upserts, 8 invoice existence checks, a full iCloud sync attempt)
// on essentially every request. The actual work only ever needs to happen
// once per running server instance — after that it's a no-op by
// construction (everything here is upsert / "create if missing") — so cache
// the in-flight/completed promise and hand every caller the same one. A
// failed attempt clears the cache so the next call retries instead of the
// process being stuck never-seeded until restart.
let seedPromise: Promise<void> | null = null;

export function ensureExampleInvoicesSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = performSeed().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

async function performSeed(): Promise<void> {
  try {
    // 1. Ensure CompanyProfile exists
    let company = await prisma.companyProfile.findFirst({
      include: { addresses: true },
    });

    const signaturePath = getOrCreateSignatureFile();

    if (!company) {
      // Only reachable when the DB has zero companies - nothing to
      // self-heal onto yet, so this branch is unconditionally safe.
      company = await prisma.companyProfile.create({
        data: {
          name: DEFAULT_COMPANY_SETTINGS.name,
          email: DEFAULT_COMPANY_SETTINGS.email,
          phone: DEFAULT_COMPANY_SETTINGS.phone,
          monthlyRevenueGoal: DEFAULT_COMPANY_SETTINGS.monthlyRevenueGoal,
          signatureUrl: signaturePath,
          bookingSlug: "renata",
          icloudCalendarUrl: DEFAULT_ICLOUD_URL,
          paymentMethods: DEFAULT_COMPANY_SETTINGS.paymentMethods,
          terms: DEFAULT_COMPANY_SETTINGS.terms,
          addresses: {
            create: [
              {
                label: "Evans (Atual / Vigente)",
                street: "4172 MeadowView",
                city: "Evans",
                state: "CO",
                zipCode: "80620",
                isDefault: true,
              },
              {
                label: "Greeley (Histórico)",
                street: "1705 30th St., #104",
                city: "Greeley",
                state: "CO",
                zipCode: "80631",
                isDefault: false,
              },
            ],
          },
        },
        include: { addresses: true },
      });

      // Ensure primary admin user (Renata Matos de Oliveira) is seeded -
      // only on the legacy single-tenant bootstrap path above, same as
      // every write below.
      await ensureAdminUser();

      // Ensure Clients exist
      for (const c of SEED_CLIENTS) {
        await prisma.client.upsert({
          where: { id: c.id },
          update: {},
          create: { ...c, companyId: company.id },
        });
      }

      // Ensure the 8 real invoices from exemple/ exist
      for (const invData of SEED_INVOICES) {
        const existing = await prisma.invoice.findUnique({
          where: { invoiceNumber: invData.invoiceNumber },
        });

        if (!existing) {
          await prisma.invoice.create({
            data: {
              companyId: company.id,
              clientId: invData.clientId,
              invoiceNumber: invData.invoiceNumber,
              status: invData.status,
              issueDate: invData.issueDate,
              dueDate: invData.dueDate,
              providerAddress: invData.providerAddress,
              subtotal: invData.subtotal,
              discount: 0,
              tax: 0,
              totalAmount: invData.totalAmount,
              paidAmount: invData.paidAmount,
              paidAt: invData.paidAt || null,
              notes: invData.notes,
              items: {
                create: invData.items,
              },
            },
          });
        }
      }
      return;
    }

    // From here on, `company` already existed in the DB - it's whichever
    // row Postgres's unordered findFirst() happened to return, which is
    // undefined/arbitrary once more than one company exists (and can change
    // over time, since the row is updated by frequent sync timestamps). Every
    // step below is a "fill in Renata's real data if missing" self-heal
    // (her real signature path, her real DEFAULT_ICLOUD_URL, her real street
    // addresses, her real example clients/invoices) - safe ONLY while the DB
    // still holds exactly the one legacy company this was all seeded for.
    // The instant a second, unrelated company exists, `company` could BE
    // that new company, and self-healing it here would silently write
    // Renata's real personal/business data onto it. So: do nothing more
    // once count > 1 (do NOT add an ORDER BY to findFirst above - that would
    // make the wrong behavior deterministic instead of occasional, which is
    // worse, not better).
    const totalCompanies = await prisma.companyProfile.count();
    if (totalCompanies > 1) {
      return;
    }

    const needsUpdate = !company.signatureUrl || !company.icloudCalendarUrl;
    if (needsUpdate) {
      company = await prisma.companyProfile.update({
        where: { id: company.id },
        data: {
          ...(!company.signatureUrl ? { signatureUrl: signaturePath } : {}),
          ...(!company.icloudCalendarUrl ? { icloudCalendarUrl: DEFAULT_ICLOUD_URL } : {}),
        },
        include: { addresses: true },
      });
    }

    // Ensure Addresses exist
    if (!company.addresses || company.addresses.length === 0) {
      await prisma.companyAddress.createMany({
        data: [
          {
            companyId: company.id,
            label: "Evans (Atual / Vigente)",
            street: "4172 MeadowView",
            city: "Evans",
            state: "CO",
            zipCode: "80620",
            isDefault: true,
          },
          {
            companyId: company.id,
            label: "Greeley (Histórico)",
            street: "1705 30th St., #104",
            city: "Greeley",
            state: "CO",
            zipCode: "80631",
            isDefault: false,
          },
        ],
      });
    }

    // Ensure primary admin user (Renata Matos de Oliveira) is seeded
    await ensureAdminUser();

    // 2. Ensure Clients exist
    for (const c of SEED_CLIENTS) {
      await prisma.client.upsert({
        where: { id: c.id },
        update: {},
        create: { ...c, companyId: company.id },
      });
    }

    // 3. Ensure the 8 real invoices from exemple/ exist
    for (const invData of SEED_INVOICES) {
      const existing = await prisma.invoice.findUnique({
        where: { invoiceNumber: invData.invoiceNumber },
      });

      if (!existing) {
        await prisma.invoice.create({
          data: {
            companyId: company.id,
            clientId: invData.clientId,
            invoiceNumber: invData.invoiceNumber,
            status: invData.status,
            issueDate: invData.issueDate,
            dueDate: invData.dueDate,
            providerAddress: invData.providerAddress,
            subtotal: invData.subtotal,
            discount: 0,
            tax: 0,
            totalAmount: invData.totalAmount,
            paidAmount: invData.paidAmount,
            paidAt: invData.paidAt || null,
            notes: invData.notes,
            items: {
              create: invData.items,
            },
          },
        });
      }
    }
  } catch (err) {
    console.error("Erro ao sincronizar faturas do exemplo:", err);
    // Re-thrown so ensureExampleInvoicesSeeded() knows this attempt failed
    // and allows the next call to retry, instead of caching a silent no-op
    // as permanent success for the lifetime of the process.
    throw err;
  }
}
