import { z } from "zod";

export const invoiceItemSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Descrição não pode ser vazia")
    .max(200, "Descrição muito longa"),
  quantity: z
    .number()
    .int("Quantidade deve ser um número inteiro")
    .positive("Quantidade deve ser maior que zero")
    .max(10000, "Quantidade muito alta"),
  unitPrice: z
    .number()
    .positive("Preço deve ser maior que zero")
    .max(10000000, "Valor muito alto"),
});

export const createInvoiceSchema = z.object({
  clientId: z.string().uuid("ID do cliente inválido"),
  invoiceNumber: z
    .string()
    .trim()
    .min(1, "Número da fatura não pode ser vazio")
    .max(50, "Número da fatura muito longo"),
  dueDate: z
    .string()
    .datetime("Data de vencimento inválida (formato ISO 8601)"),
  status: z
    .enum(["DRAFT", "PENDING", "PAID", "OVERDUE", "CANCELLED"])
    .default("PENDING"),
  notes: z
    .string()
    .trim()
    .max(1000, "Observações muito longas")
    .optional()
    .or(z.literal("")),
  items: z
    .array(invoiceItemSchema)
    .min(1, "A fatura deve ter pelo menos 1 item"),
});

export const updateInvoiceStatusSchema = z.object({
  id: z.string().uuid("ID da fatura inválido"),
  status: z.enum(["DRAFT", "PENDING", "PAID", "OVERDUE", "CANCELLED"]),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;
