import { BillingType, InvoiceStatus } from "@prisma/client";

/**
 * The real historical clients/invoices for this business (from the PDFs in
 * exemple/), used to bootstrap a fresh database. Previously duplicated
 * verbatim (~300 lines) between prisma/seed.ts (one-time `prisma db seed`)
 * and src/lib/seed-data.ts (ensureExampleInvoicesSeeded, the app's own
 * runtime self-heal) - a price correction made to one silently never
 * reached the other. This is the one copy both import.
 */

export interface SeedClientFixture {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  billingType: BillingType;
  notes: string;
}

export const SEED_CLIENTS: SeedClientFixture[] = [
  {
    id: "holland-law-office-id",
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
  {
    id: "marie-warren-id",
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
  {
    id: "prajakta-borawake-id",
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
];

export interface SeedInvoiceItemFixture {
  serviceDate: Date;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface SeedInvoiceFixture {
  invoiceNumber: string;
  clientId: string;
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date;
  providerAddress: string;
  subtotal: number;
  totalAmount: number;
  paidAmount: number;
  paidAt?: Date;
  notes: string;
  items: SeedInvoiceItemFixture[];
}

export const SEED_INVOICES: SeedInvoiceFixture[] = [
  {
    invoiceNumber: "02 - 2026",
    clientId: "holland-law-office-id",
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
    clientId: "holland-law-office-id",
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
    clientId: "prajakta-borawake-id",
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
    clientId: "marie-warren-id",
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
    clientId: "holland-law-office-id",
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
    clientId: "holland-law-office-id",
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
    clientId: "holland-law-office-id",
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
    clientId: "holland-law-office-id",
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
