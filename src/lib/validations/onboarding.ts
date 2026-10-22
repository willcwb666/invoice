import { z } from "zod";

export const onboardingCompleteSchema = z.object({
  companyName: z.string().trim().min(2, "O nome da empresa deve ter pelo menos 2 caracteres"),
  companyPhone: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().max(2).optional(),
  userPhone: z.string().trim().optional(),
});
