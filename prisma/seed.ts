import { PrismaClient, Role, UserStatus, BillingType, InvoiceStatus, ExpenseCategory, AppointmentStatus, AppointmentOrigin } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Iniciando o Seed dos dados reais no Supabase...");

  // 1. Criar ou buscar CompanyProfile
  let company = await prisma.companyProfile.findFirst();
  if (!company) {
    company = await prisma.companyProfile.create({
      data: {
        name: "Renata Matos de Oliveira",
        email: "renatamatoz@gmail.com",
        phone: "9704129406",
        monthlyRevenueGoal: 6000.0,
        bookingSlug: "renata",
        paymentMethods:
          "Zelle: 9704129406\nVenmo: @RenataMatoz\nCheck payable to: Renata Matos de Oliveira",
        terms:
          "Payment is due within 7 days of invoice date. Late payments are subject to a 1.5% monthly finance charge.",
      },
    });
    console.log("✓ Perfil da Empresa criado:", company.name);
  }

  // 2. Criar os dois endereços da empresa (Evans atual e Greeley histórico)
  const existingAddresses = await prisma.companyAddress.findMany({
    where: { companyId: company.id },
  });

  if (existingAddresses.length === 0) {
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
    console.log("✓ Endereços de Evans (atual) e Greeley (histórico) cadastrados!");
  }

  // 3. Usuário Administrador Mestre
  const adminUser = await prisma.user.upsert({
    where: { email: "renatamatoz@gmail.com" },
    update: {
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      companyId: company.id,
    },
    create: {
      name: "Renata Matos",
      email: "renatamatoz@gmail.com",
      phone: "9704129406",
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      companyId: company.id,
      emailVerified: new Date(),
    },
  });
  console.log("✓ Usuário Admin configurado:", adminUser.email);

  // 4. Serviços Identificados nos PDFs
  const servicesData = [
    {
      name: "Office - Standard cleaning",
      description: "Limpeza padrão de escritório comercial",
      basePrice: 130.0,
      defaultDurationMinutes: 120,
    },
    {
      name: "Office - Half standard cleaning",
      description: "Meia limpeza padrão em escritório",
      basePrice: 50.0,
      defaultDurationMinutes: 60,
    },
    {
      name: "House - Standard cleaning",
      description: "Limpeza residencial padrão completa",
      basePrice: 180.0,
      defaultDurationMinutes: 180,
    },
    {
      name: "Move-out cleaning services",
      description: "Limpeza pesada de mudança (Move-out / Move-in)",
      basePrice: 550.0,
      defaultDurationMinutes: 300,
    },
  ];

  for (const s of servicesData) {
    const existing = await prisma.service.findFirst({
      where: { companyId: company.id, name: s.name },
    });
    if (!existing) {
      await prisma.service.create({
        data: {
          companyId: company.id,
          name: s.name,
          description: s.description,
          basePrice: s.basePrice,
          defaultDurationMinutes: s.defaultDurationMinutes,
        },
      });
    }
  }
  console.log("✓ Serviços essenciais cadastrados com sucesso!");

  // 5. Clientes Reais dos PDFs
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
  console.log("✓ Clientes reais cadastrados: Holland Law Office e Marie Warren!");

  // 6. Fatura Histórica: Holland Law Office (08 - 2026)
  const existingInvHolland = await prisma.invoice.findUnique({
    where: { invoiceNumber: "08 - 2026" },
  });

  if (!existingInvHolland) {
    await prisma.invoice.create({
      data: {
        companyId: company.id,
        clientId: hollandLaw.id,
        invoiceNumber: "08 - 2026",
        status: InvoiceStatus.PAID,
        issueDate: new Date("2026-08-10T10:00:00Z"),
        dueDate: new Date("2026-08-17T10:00:00Z"),
        providerAddress: "4172 MeadowView - Evans, CO - 80620",
        subtotal: 720.0,
        discount: 0.0,
        tax: 0.0,
        totalAmount: 720.0,
        paidAmount: 720.0,
        paidAt: new Date("2026-08-15T15:00:00Z"),
        notes: "Serviços executados no mês de Julho/Agosto.",
        items: {
          create: [
            {
              serviceDate: new Date("2026-07-04T09:00:00Z"),
              description: "Office - Half standard cleaning",
              quantity: 1,
              unitPrice: 50.0,
              total: 50.0,
            },
            {
              serviceDate: new Date("2026-07-09T09:00:00Z"),
              description: "House - Standard cleaning",
              quantity: 1,
              unitPrice: 180.0,
              total: 180.0,
            },
            {
              serviceDate: new Date("2026-07-11T09:00:00Z"),
              description: "Office - Standard cleaning",
              quantity: 1,
              unitPrice: 130.0,
              total: 130.0,
            },
            {
              serviceDate: new Date("2026-07-18T09:00:00Z"),
              description: "Office - Half standard cleaning",
              quantity: 1,
              unitPrice: 50.0,
              total: 50.0,
            },
            {
              serviceDate: new Date("2026-07-23T09:00:00Z"),
              description: "House - Standard cleaning",
              quantity: 1,
              unitPrice: 180.0,
              total: 180.0,
            },
            {
              serviceDate: new Date("2026-07-25T09:00:00Z"),
              description: "Office - Standard cleaning",
              quantity: 1,
              unitPrice: 130.0,
              total: 130.0,
            },
          ],
        },
      },
    });
    console.log("✓ Fatura real 08 - 2026 criada (Holland Law - $720.00)");
  }

  // 7. Fatura Histórica: Marie Warren (05 - 2026)
  const existingInvMarie = await prisma.invoice.findUnique({
    where: { invoiceNumber: "05 - 2026" },
  });

  if (!existingInvMarie) {
    await prisma.invoice.create({
      data: {
        companyId: company.id,
        clientId: marieWarren.id,
        invoiceNumber: "05 - 2026",
        status: InvoiceStatus.PENDING,
        issueDate: new Date("2026-05-11T10:00:00Z"),
        dueDate: new Date("2026-05-18T10:00:00Z"),
        providerAddress: "1705 30th St., #104 - Greeley, CO - 80631",
        subtotal: 550.0,
        discount: 0.0,
        tax: 0.0,
        totalAmount: 550.0,
        paidAmount: 0.0,
        notes: "Move-out cleaning services for 1805 Axial Dr - Loveland, CO",
        items: {
          create: [
            {
              serviceDate: new Date("2026-05-09T08:00:00Z"),
              description: "Move-out cleaning services for 1805 Axial Dr - Loveland, CO",
              quantity: 1,
              unitPrice: 550.0,
              total: 550.0,
            },
          ],
        },
      },
    });
    console.log("✓ Fatura real 05 - 2026 criada (Marie Warren - $550.00)");
  }

  // 8. Despesas Iniciais para teste do fluxo financeiro
  const countExpenses = await prisma.expense.count({ where: { companyId: company.id } });
  if (countExpenses === 0) {
    await prisma.expense.createMany({
      data: [
        {
          companyId: company.id,
          category: ExpenseCategory.FUEL,
          description: "Gasolina (deslocamento Evans - Loveland - Greeley)",
          amount: 55.0,
          date: new Date(),
        },
        {
          companyId: company.id,
          category: ExpenseCategory.CLEANING_SUPPLIES,
          description: "Produtos de limpeza (desinfetantes, microfibra)",
          amount: 89.5,
          date: new Date(),
        },
      ],
    });
    console.log("✓ Despesas operacionais cadastradas!");
  }

  console.log("🎉 SEED CONCLUÍDO COM SUCESSO NO SUPABASE!");
}

main()
  .catch((e) => {
    console.error("Erro no Seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
