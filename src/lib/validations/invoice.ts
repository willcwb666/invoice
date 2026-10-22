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

export const invoiceAdjustmentSchema = z.object({
  type: z.enum(["CREDIT", "DISCOUNT"]),
  description: z
    .string()
    .trim()
    .min(1, "Descrição do ajuste obrigatória")
    .max(200, "Descrição muito longa"),
  amount: z
    .number()
    .positive("Valor do ajuste deve ser maior que zero")
    .max(10000000, "Valor muito alto"),
});

export const createInvoiceSchema = z
  .object({
    clientId: z.string().min(1, "ID do cliente obrigatório"),
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
    items: z.array(invoiceItemSchema).default([]),
    // Atendimentos concluídos e ainda não faturados a incluir automaticamente
    appointmentIds: z.array(z.string().min(1)).default([]),
    // Ajustes dinâmicos (Crédito (+) ou Desconto (-))
    adjustments: z.array(invoiceAdjustmentSchema).default([]),
    discount: z.number().nonnegative().optional().default(0),
  })
  .refine(
    (data) =>
      data.items.length > 0 ||
      data.appointmentIds.length > 0 ||
      data.adjustments.length > 0,
    {
      message: "A fatura deve ter pelo menos 1 item, agendamento ou ajuste informado.",
      path: ["items"],
    }
  );

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
