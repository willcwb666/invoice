import { z } from "zod";

export const createServiceSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter no mínimo 2 caracteres").max(150, "Nome muito longo"),
  description: z.string().trim().max(500, "Descrição muito longa").optional().nullable(),
  type: z.enum(["STANDARD", "EXTRA"]).default("STANDARD"),
  basePrice: z.number().positive("Preço deve ser maior que zero").max(100000, "Valor muito alto"),
  defaultDurationMinutes: z.number().int().positive("Duração deve ser maior que zero").max(1440).optional(),
});

export const updateServiceSchema = createServiceSchema.partial();

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
