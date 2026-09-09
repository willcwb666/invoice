import { PrismaClient, Role, UserStatus, ExpenseCategory } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";
import { SEED_CLIENTS, SEED_INVOICES } from "../src/lib/seed-fixtures";

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

  // 5. Clientes reais dos PDFs (compartilhado com ensureExampleInvoicesSeeded via seed-fixtures.ts)
  for (const c of SEED_CLIENTS) {
    await prisma.client.upsert({
      where: { id: c.id },
      update: {},
      create: { ...c, companyId: company.id },
    });
  }
  console.log("✓ Clientes reais cadastrados: Holland Law Office, Marie Warren e Prajakta Borawake!");

  // Invoices from exemple folder (idem)
  for (const inv of SEED_INVOICES) {
    const existing = await prisma.invoice.findUnique({
      where: { invoiceNumber: inv.invoiceNumber },
    });

    if (!existing) {
      await prisma.invoice.create({
        data: {
          companyId: company.id,
          clientId: inv.clientId,
          invoiceNumber: inv.invoiceNumber,
          status: inv.status,
          issueDate: inv.issueDate,
          dueDate: inv.dueDate,
          providerAddress: inv.providerAddress,
          subtotal: inv.subtotal,
          discount: 0.0,
          tax: 0.0,
          totalAmount: inv.totalAmount,
          paidAmount: inv.paidAmount,
          paidAt: inv.paidAt || null,
          notes: inv.notes,
          items: {
            create: inv.items,
          },
        },
      });
      console.log(`✓ Fatura real ${inv.invoiceNumber} criada!`);
    }
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
