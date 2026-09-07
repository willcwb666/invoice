import { z } from "zod";

export const createClientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(120, "Nome não pode exceder 120 caracteres"),
  email: z
    .string()
    .trim()
    .email("E-mail inválido")
    .max(150, "E-mail muito longo")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+()\s-]*$/, "Telefone contém caracteres inválidos")
    .max(25, "Telefone muito longo")
    .optional()
    .or(z.literal("")),
  document: z
    .string()
    .trim()
    .regex(/^[0-9./-]*$/, "Documento contém caracteres inválidos")
    .max(20, "Documento muito longo")
    .optional()
    .or(z.literal("")),
  address: z
    .string()
    .trim()
    .max(250, "Endereço muito longo")
    .optional()
    .or(z.literal("")),
});

export const updateClientSchema = createClientSchema.partial().extend({
  id: z.string().uuid("ID de cliente inválido"),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
