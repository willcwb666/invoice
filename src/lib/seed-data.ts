import { prisma } from "@/lib/prisma";
import { BillingType, InvoiceStatus } from "@prisma/client";
import { getOrCreateSignatureFile } from "@/lib/pdf-signature";
import { ensureAdminUser } from "@/lib/security/auth";
import { DEFAULT_ICLOUD_URL, ensureICloudCalendarSynced } from "@/lib/calendar/icloud";

export async function ensureExampleInvoicesSeeded() {
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
    const hollandLaw = await prisma.client.upsert({
      where: { id: "holland-law-office-id" },
      update: {},
      create: {
        id: "holland-law-office-id",
        companyId: company.id,
        name: "Holland Law Office",
        email: "contact@hollandlawoffice.com",
        phone: "9705550199",
        address: "5652 McWhinney Blvd",
        city: "Loveland",
        state: "CO",
        zipCode: "89538",
        billingType: BillingType.CONSOLIDATED_MONTHLY,
        notes: "Cliente mensal comercial. Faturamento consolidado no dia 10 do mês.",
      },
    });

    const marieWarren = await prisma.client.upsert({
      where: { id: "marie-warren-id" },
      update: {},
      create: {
        id: "marie-warren-id",
        companyId: company.id,
        name: "Marie Warren",
        email: "marie.warren@example.com",
        phone: "9705550144",
        address: "5084 46th ave",
        city: "Greeley",
        state: "CO",
        zipCode: "80634",
        billingType: BillingType.PER_JOB,
        notes: "Cliente residencial de serviços avulsos / Move-out.",
      },
    });

    const prajaktaBorawake = await prisma.client.upsert({
      where: { id: "prajakta-borawake-id" },
      update: {},
      create: {
        id: "prajakta-borawake-id",
        companyId: company.id,
        name: "Prajakta Borawake",
        email: "prajakta.borawake@example.com",
        phone: "9705550188",
        address: "1896 Los Cabos Dr",
        city: "Windsor",
        state: "CO",
        zipCode: "80550",
        billingType: BillingType.PER_JOB,
        notes: "Move-out cleaning residencial em Windsor.",
      },
    });

    // 3. Define all 8 Invoices from exemple/
    const allInvoicesData = [
      {
        invoiceNumber: "02 - 2026",
        clientId: hollandLaw.id,
        status: InvoiceStatus.PAID,
        issueDate: new Date("2026-02-17T10:00:00Z"),
        dueDate: new Date("2026-02-24T10:00:00Z"),
        providerAddress: "1705 30th St., #104 - Greeley, CO - 80631",
        subtotal: 770.0,
        totalAmount: 770.0,
        paidAmount: 770.0,
        paidAt: new Date("2026-02-20T14:00:00Z"),
        notes: "Serviços executados em Janeiro de 2026.",
        items: [
          { serviceDate: new Date("2026-01-03T09:00:00Z"), description: "Office - Half standard cleaning", quantity: 1, unitPrice: 50.0, total: 50.0 },
          { serviceDate: new Date("2026-01-08T09:00:00Z"), description: "House - Standard cleaning", quantity: 1, unitPrice: 180.0, total: 180.0 },
          { serviceDate: new Date("2026-01-10T09:00:00Z"), description: "Office - Standard cleaning", quantity: 1, unitPrice: 130.0, total: 130.0 },
          { serviceDate: new Date("2026-01-17T09:00:00Z"), description: "Office - Half standard cleaning", quantity: 1, unitPrice: 50.0, total: 50.0 },
          { serviceDate: new Date("2026-01-22T09:00:00Z"), description: "House - Standard cleaning", quantity: 1, unitPrice: 180.0, total: 180.0 },
          { serviceDate: new Date("2026-01-24T09:00:00Z"), description: "Office - Standard cleaning", quantity: 1, unitPrice: 130.0, total: 130.0 },
          { serviceDate: new Date("2026-01-31T09:00:00Z"), description: "Office - Half standard cleaning", quantity: 1, unitPrice: 50.0, total: 50.0 },
        ],
      },
      {
        invoiceNumber: "03 - 2026",
        clientId: hollandLaw.id,
        status: InvoiceStatus.PAID,
        issueDate: new Date("2026-03-28T10:00:00Z"),
        dueDate: new Date("2026-04-04T10:00:00Z"),
        providerAddress: "1705 30th St., #104 - Greeley, CO - 80631",
        subtotal: 1390.0,
        totalAmount: 1390.0,
        paidAmount: 1390.0,
        paidAt: new Date("2026-04-02T16:00:00Z"),
        notes: "Serviços executados em Fevereiro e Março de 2026.",
        items: [
          { serviceDate: new Date("2026-02-04T09:00:00Z"), description: "House - Standard cleaning", quantity: 1, unitPrice: 180.0, total: 180.0 },
          { serviceDate: new Date("2026-02-07T09:00:00Z"), description: "Office - Standard cleaning", quantity: 1, unitPrice: 130.0, total: 130.0 },
          { serviceDate: new Date("2026-02-14T09:00:00Z"), description: "Office - Half standard cleaning", quantity: 1, unitPrice: 50.0, total: 50.0 },
          { serviceDate: new Date("2026-02-19T09:00:00Z"), description: "House - Standard cleaning", quantity: 1, unitPrice: 180.0, total: 180.0 },
          { serviceDate: new Date("2026-02-21T09:00:00Z"), description: "Office - Standard cleaning", quantity: 1, unitPrice: 130.0, total: 130.0 },
          { serviceDate: new Date("2026-03-06T09:00:00Z"), description: "House - Standard cleaning", quantity: 1, unitPrice: 180.0, total: 180.0 },
          { serviceDate: new Date("2026-03-07T09:00:00Z"), description: "Office - Standard cleaning", quantity: 1, unitPrice: 130.0, total: 130.0 },
          { serviceDate: new Date("2026-03-14T09:00:00Z"), description: "Office - Half standard cleaning", quantity: 1, unitPrice: 50.0, total: 50.0 },
          { serviceDate: new Date("2026-03-19T09:00:00Z"), description: "House - Standard cleaning", quantity: 1, unitPrice: 180.0, total: 180.0 },
          { serviceDate: new Date("2026-03-21T09:00:00Z"), description: "Office - Standard cleaning", quantity: 1, unitPrice: 130.0, total: 130.0 },
          { serviceDate: new Date("2026-03-28T09:00:00Z"), description: "Office - Half standard cleaning", quantity: 1, unitPrice: 50.0, total: 50.0 },
        ],
      },
      {
        invoiceNumber: "04 - 2026",
        clientId: prajaktaBorawake.id,
        status: InvoiceStatus.PAID,
        issueDate: new Date("2026-03-24T10:00:00Z"),
        dueDate: new Date("2026-03-31T10:00:00Z"),
        providerAddress: "1705 30th St., #104 - Greeley, CO - 80631",
        subtotal: 400.0,
        totalAmount: 400.0,
        paidAmount: 400.0,
        paidAt: new Date("2026-03-25T11:00:00Z"),
        notes: "Move-out cleaning services for 1896 Los Cabos Dr - Windsor, CO",
        items: [
          { serviceDate: new Date("2026-03-24T08:30:00Z"), description: "Move-out cleaning services", quantity: 1, unitPrice: 400.0, total: 400.0 },
        ],
      },
      {
        invoiceNumber: "05 - 2026",
        clientId: marieWarren.id,
        status: InvoiceStatus.PAID,
        issueDate: new Date("2026-05-11T10:00:00Z"),
        dueDate: new Date("2026-05-18T10:00:00Z"),
        providerAddress: "1705 30th St., #104 - Greeley, CO - 80631",
        subtotal: 550.0,
        totalAmount: 550.0,
        paidAmount: 550.0,
        paidAt: new Date("2026-05-15T10:00:00Z"),
        notes: "Move-out cleaning services for 1805 Axial Dr - Loveland, CO",
        items: [
          { serviceDate: new Date("2026-05-09T08:00:00Z"), description: "Move-out cleaning services for 1805 Axial Dr - Loveland, CO", quantity: 1, unitPrice: 550.0, total: 550.0 },
        ],
      },
      {
        invoiceNumber: "06 - 2026",
        clientId: hollandLaw.id,
        status: InvoiceStatus.PAID,
        issueDate: new Date("2026-05-11T10:00:00Z"),
        dueDate: new Date("2026-05-18T10:00:00Z"),
        providerAddress: "1705 30th St., #104 - Greeley, CO - 80631",
        subtotal: 900.0,
        totalAmount: 900.0,
        paidAmount: 900.0,
        paidAt: new Date("2026-05-16T15:00:00Z"),
        notes: "Serviços executados em Abril de 2026.",
        items: [
          { serviceDate: new Date("2026-04-02T09:00:00Z"), description: "House - Standard cleaning", quantity: 1, unitPrice: 180.0, total: 180.0 },
          { serviceDate: new Date("2026-04-04T09:00:00Z"), description: "Office - Standard cleaning", quantity: 1, unitPrice: 130.0, total: 130.0 },
          { serviceDate: new Date("2026-04-11T09:00:00Z"), description: "Office - Half standard cleaning", quantity: 1, unitPrice: 50.0, total: 50.0 },
          { serviceDate: new Date("2026-04-16T09:00:00Z"), description: "House - Standard cleaning", quantity: 1, unitPrice: 180.0, total: 180.0 },
          { serviceDate: new Date("2026-04-18T09:00:00Z"), description: "Office - Standard cleaning", quantity: 1, unitPrice: 130.0, total: 130.0 },
          { serviceDate: new Date("2026-04-25T09:00:00Z"), description: "Office - Half standard cleaning", quantity: 1, unitPrice: 50.0, total: 50.0 },
          { serviceDate: new Date("2026-04-30T09:00:00Z"), description: "House - Standard cleaning", quantity: 1, unitPrice: 180.0, total: 180.0 },
        ],
      },
      {
        invoiceNumber: "07 - 2026",
        clientId: hollandLaw.id,
        status: InvoiceStatus.PAID,
        issueDate: new Date("2026-07-16T10:00:00Z"),
        dueDate: new Date("2026-07-23T10:00:00Z"),
        providerAddress: "1705 30th St., #104 - Greeley, CO - 80631",
        subtotal: 1570.0,
        totalAmount: 1570.0,
        paidAmount: 1570.0,
        paidAt: new Date("2026-07-20T12:00:00Z"),
        notes: "Serviços executados em Maio e Junho de 2026.",
        items: [
          { serviceDate: new Date("2026-05-02T09:00:00Z"), description: "Office - Standard cleaning", quantity: 1, unitPrice: 130.0, total: 130.0 },
          { serviceDate: new Date("2026-05-09T09:00:00Z"), description: "Office - Half standard cleaning", quantity: 1, unitPrice: 50.0, total: 50.0 },
          { serviceDate: new Date("2026-05-14T09:00:00Z"), description: "House - Standard cleaning", quantity: 1, unitPrice: 180.0, total: 180.0 },
          { serviceDate: new Date("2026-05-16T09:00:00Z"), description: "Office - Standard cleaning", quantity: 1, unitPrice: 130.0, total: 130.0 },
          { serviceDate: new Date("2026-05-23T09:00:00Z"), description: "Office - Half standard cleaning", quantity: 1, unitPrice: 50.0, total: 50.0 },
          { serviceDate: new Date("2026-05-28T09:00:00Z"), description: "House - Standard cleaning", quantity: 1, unitPrice: 180.0, total: 180.0 },
          { serviceDate: new Date("2026-05-30T09:00:00Z"), description: "Office - Standard cleaning", quantity: 1, unitPrice: 130.0, total: 130.0 },
          { serviceDate: new Date("2026-06-06T09:00:00Z"), description: "Office - Half standard cleaning", quantity: 1, unitPrice: 50.0, total: 50.0 },
          { serviceDate: new Date("2026-06-11T09:00:00Z"), description: "House - Standard cleaning", quantity: 1, unitPrice: 180.0, total: 180.0 },
          { serviceDate: new Date("2026-06-13T09:00:00Z"), description: "Office - Standard cleaning", quantity: 1, unitPrice: 130.0, total: 130.0 },
          { serviceDate: new Date("2026-06-20T09:00:00Z"), description: "Office - Half standard cleaning", quantity: 1, unitPrice: 50.0, total: 50.0 },
          { serviceDate: new Date("2026-06-25T09:00:00Z"), description: "House - Standard cleaning", quantity: 1, unitPrice: 180.0, total: 180.0 },
          { serviceDate: new Date("2026-06-27T09:00:00Z"), description: "Office - Standard cleaning", quantity: 1, unitPrice: 130.0, total: 130.0 },
        ],
      },
      {
        invoiceNumber: "08 - 2026",
        clientId: hollandLaw.id,
        status: InvoiceStatus.PAID,
        issueDate: new Date("2026-08-10T10:00:00Z"),
        dueDate: new Date("2026-08-17T10:00:00Z"),
        providerAddress: "4172 MeadowView - Evans, CO - 80620",
        subtotal: 720.0,
        totalAmount: 720.0,
        paidAmount: 720.0,
        paidAt: new Date("2026-08-15T15:00:00Z"),
        notes: "Serviços executados no mês de Julho de 2026.",
        items: [
          { serviceDate: new Date("2026-07-04T09:00:00Z"), description: "Office - Half standard cleaning", quantity: 1, unitPrice: 50.0, total: 50.0 },
          { serviceDate: new Date("2026-07-09T09:00:00Z"), description: "House - Standard cleaning", quantity: 1, unitPrice: 180.0, total: 180.0 },
          { serviceDate: new Date("2026-07-11T09:00:00Z"), description: "Office - Standard cleaning", quantity: 1, unitPrice: 130.0, total: 130.0 },
          { serviceDate: new Date("2026-07-18T09:00:00Z"), description: "Office - Half standard cleaning", quantity: 1, unitPrice: 50.0, total: 50.0 },
          { serviceDate: new Date("2026-07-23T09:00:00Z"), description: "House - Standard cleaning", quantity: 1, unitPrice: 180.0, total: 180.0 },
          { serviceDate: new Date("2026-07-25T09:00:00Z"), description: "Office - Standard cleaning", quantity: 1, unitPrice: 130.0, total: 130.0 },
        ],
      },
      {
        invoiceNumber: "09 - 2026",
        clientId: hollandLaw.id,
        status: InvoiceStatus.PENDING,
        issueDate: new Date("2026-09-01T10:00:00Z"),
        dueDate: new Date("2026-09-08T10:00:00Z"),
        providerAddress: "4172 MeadowView - Evans, CO - 80620",
        subtotal: 720.0,
        totalAmount: 720.0,
        paidAmount: 0.0,
        notes: "Serviços executados no mês de Agosto de 2026.",
        items: [
          { serviceDate: new Date("2026-08-06T09:00:00Z"), description: "House - Standard cleaning", quantity: 1, unitPrice: 180.0, total: 180.0 },
          { serviceDate: new Date("2026-08-08T09:00:00Z"), description: "Office - Standard cleaning", quantity: 1, unitPrice: 130.0, total: 130.0 },
          { serviceDate: new Date("2026-08-15T09:00:00Z"), description: "Office - Half standard cleaning", quantity: 1, unitPrice: 50.0, total: 50.0 },
          { serviceDate: new Date("2026-08-21T09:00:00Z"), description: "House - Standard cleaning", quantity: 1, unitPrice: 180.0, total: 180.0 },
          { serviceDate: new Date("2026-08-22T09:00:00Z"), description: "Office - Standard cleaning", quantity: 1, unitPrice: 130.0, total: 130.0 },
          { serviceDate: new Date("2026-08-29T09:00:00Z"), description: "Office - Half standard cleaning", quantity: 1, unitPrice: 50.0, total: 50.0 },
        ],
      },
    ];

    for (const invData of allInvoicesData) {
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
            paidAt: (invData as any).paidAt || null,
            notes: invData.notes,
            items: {
              create: invData.items,
            },
          },
        });
      }
    }

    // 4. Executa rotina de sincronização automática com o iPhone (iCloud)
    try {
      await ensureICloudCalendarSynced(true);
    } catch (syncErr) {
      console.error("Erro na sincronização automática do iCloud:", syncErr);
    }
  } catch (err) {
    console.error("Erro ao sincronizar faturas do exemplo:", err);
  }
}
