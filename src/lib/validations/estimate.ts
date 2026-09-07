import { z } from "zod";

export const estimateItemSchema = z.object({
  serviceId: z.string().min(1).optional().nullable(),
  description: z.string().trim().min(1, "Descrição obrigatória"),
  quantity: z.number().int().positive().default(1),
  unitPrice: z.number().positive("Preço deve ser positivo"),
});

export const createEstimateSchema = z.object({
  clientId: z.string().min(1, "ID do cliente obrigatório"),
  estimateNumber: z.string().trim().min(1, "Número do orçamento obrigatório"),
  validUntil: z.string().datetime("Data de validade inválida"),
  notes: z.string().trim().max(1000).optional().nullable(),
  items: z.array(estimateItemSchema).min(1, "Orçamento precisa de ao menos 1 item"),
});

export type CreateEstimateInput = z.infer<typeof createEstimateSchema>;
export type EstimateItemInput = z.infer<typeof estimateItemSchema>;
