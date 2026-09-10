import { z } from "zod";

// Unlike every other mutating route in the app, PATCH /api/v1/company and
// POST/PATCH /api/v1/company/address used to spread req.json() straight
// into a Prisma write with no schema at all - a malformed or oversized
// payload (in `terms`/`paymentMethods`, both later rendered as raw text on
// the public pay page) went straight to the database.
export const updateCompanySchema = z.object({
  name: z.string().trim().min(1, "Nome não pode ser vazio").max(200, "Nome muito longo").optional(),
  email: z.string().trim().email("E-mail inválido").max(150, "E-mail muito longo").optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+()\s-]*$/, "Telefone contém caracteres inválidos")
    .max(25, "Telefone muito longo")
    .optional(),
  monthlyRevenueGoal: z.coerce.number().nonnegative("Meta mensal deve ser positiva").max(10_000_000).optional(),
  paymentMethods: z.string().trim().max(2000, "Texto muito longo").optional(),
  terms: z.string().trim().max(5000, "Texto muito longo").optional(),
  signatureUrl: z.string().trim().max(500).optional(),
  logoUrl: z.string().trim().max(500).optional(),
  icloudCalendarUrl: z.string().trim().max(1000).optional(),
  // Capped at 730 to match RECURRENCE_HORIZON_DAYS in lib/calendar/icloud.ts
  // - no point letting the window ask for more than the recurrence expander
  // itself is willing to generate.
  icloudSyncWindowDays: z.coerce.number().int().min(1).max(730).optional(),
});
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

export const createCompanyAddressSchema = z.object({
  label: z.string().trim().max(100).optional(),
  street: z.string().trim().min(1, "Rua é obrigatória").max(200, "Rua muito longa"),
  city: z.string().trim().min(1, "Cidade é obrigatória").max(100, "Cidade muito longa"),
  state: z.string().trim().max(10).optional().default("CO"),
  zipCode: z.string().trim().min(1, "CEP é obrigatório").max(20, "CEP muito longo"),
  isDefault: z.boolean().optional().default(false),
});
export type CreateCompanyAddressInput = z.infer<typeof createCompanyAddressSchema>;

export const updateCompanyAddressSchema = z.object({
  addressId: z.string().min(1, "ID do endereço é obrigatório"),
  isDefault: z.boolean().optional(),
});
export type UpdateCompanyAddressInput = z.infer<typeof updateCompanyAddressSchema>;
