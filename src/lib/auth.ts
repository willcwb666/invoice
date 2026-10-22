import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: process.env.BETTER_AUTH_SECRET || process.env.SESSION_SECRET,
  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000",
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  session: {
    // Evita bater no banco em toda chamada de getSession() (proxy.ts roda em
    // praticamente toda requisição) — Next recomenda explicitamente não
    // consultar o banco dentro do Proxy. 60s ainda reflete suspensão/exclusão
    // de usuário com atraso baixo.
    cookieCache: {
      enabled: true,
      maxAge: 60,
    },
  },
  user: {
    additionalFields: {
      phone: {
        type: "string",
        required: false,
      },
      gender: {
        type: "string",
        defaultValue: "FEMALE",
        required: false,
      },
      role: {
        type: "string",
        defaultValue: "OPERATOR",
        required: false,
        input: false,
      },
      status: {
        type: "string",
        defaultValue: "PENDING_ONBOARDING",
        required: false,
        input: false,
      },
      companyId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
