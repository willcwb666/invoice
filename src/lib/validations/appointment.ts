import { z } from "zod";

export const createAppointmentSchema = z.object({
  clientId: z.string().min(1, "ID do cliente obrigatório"),
  serviceIds: z.array(z.string().min(1)).optional().default([]),
  title: z
    .string()
    .trim()
    .min(2, "Título deve ter no mínimo 2 caracteres")
    .max(150, "Título muito longo"),
  date: z.string().datetime("Data inválida (formato ISO 8601)"),
  startTime: z.string().datetime("Horário de início inválido"),
  endTime: z.string().datetime("Horário de término inválido"),
  location: z.string().trim().max(250, "Endereço muito longo").optional().nullable(),
  price: z
    .number()
    .positive("Preço deve ser maior que zero")
    .max(100000, "Valor muito alto"),
  origin: z
    .enum(["INTERNAL", "ICLOUD_SYNC", "PUBLIC_BOOKING"])
    .default("INTERNAL"),
  // Não Faturável: false exclui este atendimento de toda a parte financeira
  // (meta mensal, gráfico de receita, tela de Pagamentos) mesmo com um preço
  // preenchido - útil para eventos sincronizados do iCloud que não são
  // trabalhos pagos.
  billable: z.boolean().default(true),
  notes: z.string().trim().max(1000, "Observações muito longas").optional().nullable(),
  recurrenceRule: z
    .enum(["NONE", "WEEKLY", "BIWEEKLY", "EVERY_3_WEEKS", "MONTHLY"])
    .optional(),
  recurrenceDurationMonths: z.number().int().min(1).max(24).optional(),
  professionalIds: z.array(z.string().min(1)).optional(),
  cleaningCategory: z.enum(["STANDARD", "DEEP", "MOVE_IN_OUT", "CUSTOM"]).optional(),
});

// Full edit of an existing appointment (e.g. clicking one imported from the
// iPhone) — every field optional so callers can send only what changed.
export const updateAppointmentSchema = z.object({
  clientId: z.string().min(1).optional(),
  serviceIds: z.array(z.string().min(1)).optional(),
  title: z.string().trim().min(2, "Título deve ter no mínimo 2 caracteres").max(150, "Título muito longo").optional(),
  date: z.string().datetime("Data inválida (formato ISO 8601)").optional(),
  startTime: z.string().datetime("Horário de início inválido").optional(),
  endTime: z.string().datetime("Horário de término inválido").optional(),
  location: z.string().trim().max(250, "Endereço muito longo").optional().nullable(),
  price: z.number().positive("Preço deve ser maior que zero").max(100000, "Valor muito alto").optional(),
  notes: z.string().trim().max(1000, "Observações muito longas").optional().nullable(),
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  recurrenceRule: z
    .enum(["NONE", "WEEKLY", "BIWEEKLY", "EVERY_3_WEEKS", "MONTHLY"])
    .optional()
    .nullable(),
  recurrenceDurationMonths: z.number().int().min(1).max(24).optional().default(12),
  updateScope: z
    .enum(["THIS_ONLY", "THIS_AND_FOLLOWING", "ALL_SERIES"])
    .optional()
    .default("THIS_ONLY"),
  professionalIds: z.array(z.string().min(1)).optional(),
  cleaningCategory: z.enum(["STANDARD", "DEEP", "MOVE_IN_OUT", "CUSTOM"]).optional(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
