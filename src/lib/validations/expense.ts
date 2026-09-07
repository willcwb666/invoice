import { z } from "zod";

export const createExpenseSchema = z.object({
  category: z.enum([
    "FUEL",
    "CLEANING_SUPPLIES",
    "VEHICLE_MAINTENANCE",
    "EQUIPMENT",
    "MEALS",
    "OTHER",
  ]),
  description: z
    .string()
    .trim()
    .min(2, "Descrição deve ter no mínimo 2 caracteres")
    .max(200, "Descrição muito longa"),
  amount: z
    .number()
    .positive("Valor da despesa deve ser positivo")
    .max(1000000, "Valor muito alto"),
  date: z.string().datetime().optional(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
