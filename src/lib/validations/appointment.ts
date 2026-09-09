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
  notes: z.string().trim().max(1000, "Observações muito longas").optional().nullable(),
});

export const updateAppointmentStatusSchema = z.object({
  id: z.string().min(1, "ID do agendamento obrigatório"),
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
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
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
