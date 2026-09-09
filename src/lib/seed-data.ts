import { prisma } from "@/lib/prisma";
import { getOrCreateSignatureFile } from "@/lib/pdf-signature";
import { ensureAdminUser } from "@/lib/security/auth";
import { DEFAULT_ICLOUD_URL, ensureICloudCalendarSynced } from "@/lib/calendar/icloud";
import { SEED_CLIENTS, SEED_INVOICES } from "@/lib/seed-fixtures";

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
      company = await prisma.companyProfile.create({
        data: {
          name: "Renata Matos de Oliveira",
          email: "renatamatoz@gmail.com",
          phone: "9704129406",
          monthlyRevenueGoal: 6000.0,
          signatureUrl: signaturePath,
          bookingSlug: "renata",
          icloudCalendarUrl: DEFAULT_ICLOUD_URL,
          paymentMethods:
            "Zelle: 9704129406\nVenmo: @RenataMatoz\nCheck payable to: Renata Matos de Oliveira",
          terms:
            "Payment is due within 7 days of invoice date. Late payments are subject to a 1.5% monthly finance charge.",
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
    } else {
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

    // 4. Executa rotina de sincronização automática com o iPhone (iCloud) —
    // deliberately non-fatal: a broken/unreachable iCloud feed shouldn't be
    // treated as "seeding failed" and trigger a retry of the whole function.
    try {
      await ensureICloudCalendarSynced(true);
    } catch (syncErr) {
      console.error("Erro na sincronização automática do iCloud:", syncErr);
    }
  } catch (err) {
    console.error("Erro ao sincronizar faturas do exemplo:", err);
    // Re-thrown so ensureExampleInvoicesSeeded() knows this attempt failed
    // and allows the next call to retry, instead of caching a silent no-op
    // as permanent success for the lifetime of the process.
    throw err;
  }
}
