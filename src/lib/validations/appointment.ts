import { z } from "zod";

export const createAppointmentSchema = z.object({
  clientId: z.string().min(1, "ID do cliente obrigatório"),
  serviceId: z.string().min(1, "ID do serviço inválido").optional().nullable(),
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

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
