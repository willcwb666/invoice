import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth as betterAuth } from "@/lib/auth";
import { DEFAULT_COMPANY_SETTINGS } from "@/lib/company-defaults";
import {
  SessionPayload,
  SESSION_COOKIE_NAME,
  verifySessionToken,
  hashPassword,
  verifyPassword,
  generateRandomPassword,
} from "./tokens";

export * from "./tokens";

const DEFAULT_ADMIN_EMAIL = "renatamatoz@gmail.com";
const DEFAULT_ADMIN_NAME = "Renata Matos de Oliveira";

/**
 * Resolves the password to use when (re)provisioning the admin account.
 * If ADMIN_INITIAL_PASSWORD isn't set, a random one is generated and
 * printed once to the server logs — never hardcoded in source.
 */
function resolveAdminBootstrapPassword(): string {
  const configured = process.env.ADMIN_INITIAL_PASSWORD;
  if (configured && configured.trim().length > 0) return configured.trim();

  const generated = generateRandomPassword();
  console.warn(
    `[Auth] ADMIN_INITIAL_PASSWORD não configurada para ${DEFAULT_ADMIN_EMAIL}. ` +
      "Uma credencial aleatória criptograficamente segura foi atribuída (nunca impressa em logs). " +
      "Autentique-se via Google OAuth ou defina ADMIN_INITIAL_PASSWORD nas variáveis de ambiente."
  );
  return generated;
}

/**
 * Ensures that the primary administrator account exists in the database.
 */
export async function ensureAdminUser() {
  try {
    let company = await prisma.companyProfile.findFirst();
    if (!company) {
      // CompanyProfile.name/email/phone/paymentMethods have no schema-level
      // default (Task 1) - this bootstrap path still needs to supply all
      // four explicitly, same values seed-data.ts uses for the same
      // "Renata's own company" row, via the DEFAULT_COMPANY_SETTINGS
      // constant Task 2 kept for exactly this single-admin bootstrap use.
      company = await prisma.companyProfile.create({
        data: {
          name: DEFAULT_ADMIN_NAME,
          email: DEFAULT_ADMIN_EMAIL,
          phone: DEFAULT_COMPANY_SETTINGS.phone,
          paymentMethods: DEFAULT_COMPANY_SETTINGS.paymentMethods,
        },
      });
    }

    const admin = await prisma.user.findUnique({
      where: { email: DEFAULT_ADMIN_EMAIL.toLowerCase() },
    });

    if (!admin) {
      const passwordHash = await hashPassword(resolveAdminBootstrapPassword());
      const createdAdmin = await prisma.user.create({
        data: {
          email: DEFAULT_ADMIN_EMAIL.toLowerCase(),
          name: DEFAULT_ADMIN_NAME,
          phone: "9704129406",
          role: "ADMIN",
          status: "ACTIVE",
          companyId: company.id,
          passwordHash,
          verificationToken: null,
        },
      });

      return createdAdmin;
    }

    // Se o admin existir mas não tiver passwordHash preenchido
    if (!admin.passwordHash) {
      const hashToUse = admin.verificationToken || (await hashPassword(resolveAdminBootstrapPassword()));
      const updatedAdmin = await prisma.user.update({
        where: { id: admin.id },
        data: {
          passwordHash: hashToUse,
          verificationToken: null,
          status: "ACTIVE",
          role: "ADMIN",
        },
      });

      return updatedAdmin;
    }

    return admin;
  } catch (error) {
    console.error("Erro ao inicializar usuário administrador padrão:", error);
    return null;
  }
}

/**
 * Registers a new user via the public, password-based registration form.
 * Self-reported email is NOT proof of ownership, so this never grants
 * ADMIN automatically — every new self-registration starts as OPERATOR
 * and PENDING_APPROVAL, awaiting an existing admin's approval. The only
 * account allowed to bootstrap as ADMIN is provisioned by ensureAdminUser()
 * at server startup. Callers with an authenticated ADMIN session (see
 * /api/v1/users) may still pass an explicit role/status.
 */
export async function registerUser({
  email,
  password,
  name,
  phone,
  role,
  status,
  companyId,
}: {
  email: string;
  password?: string;
  name?: string;
  phone?: string;
  role?: "ADMIN" | "FINANCIAL" | "OPERATOR" | "VIEWER";
  status?: "PENDING_ONBOARDING" | "PENDING_APPROVAL" | "ACTIVE" | "SUSPENDED";
  // Caller's own company (admin-created teammate, see POST /api/v1/users).
  // Omitted entirely for public self-registration - that path creates a
  // user with no company at all, pending the /onboarding wizard, never
  // "whichever company happens to exist first."
  companyId?: string;
}) {
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    throw new Error("Este e-mail já está cadastrado no sistema.");
  }

  const totalUsers = await prisma.user.count();
  const isFirstUser = totalUsers === 0;

  // Public self-registration (no companyId passed) is never auto-elevated
  // and never joins an existing company - it always starts a brand-new
  // company via /onboarding. Only an authenticated ADMIN caller (passing
  // companyId) may set role/status explicitly, to add a teammate directly.
  const assignedRole = companyId ? role || "OPERATOR" : "OPERATOR";
  const assignedStatus = companyId
    ? status || "ACTIVE"
    : "PENDING_ONBOARDING";

  // Admin-created users (POST /api/v1/users) may omit a password; the UI
  // documents this default and instructs the new user to change it on
  // first login. Self-registration always supplies its own password.
  const passwordHash = await hashPassword(password || "Mudar@1234");

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: name?.trim() || "Usuário",
      phone: phone?.trim() || null,
      role: assignedRole,
      status: assignedStatus,
      companyId: companyId || null,
      passwordHash,
      verificationToken: null,
      emailVerified: false,
    },
  });

  return {
    user,
    isFirstUser,
  };
}

/**
 * Authenticates an email and password against the database.
 * Employs anti-enumeration timing safety.
 */
export async function authenticateCredentials(
  emailInput: string,
  passwordInput: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{
  success: boolean;
  error?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    companyId?: string | null;
    status: string;
  };
}> {
  const normalizedEmail = emailInput.trim().toLowerCase();

  try {
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // If it's the primary admin email and not found in DB yet, auto-seed
    if (!user && normalizedEmail === DEFAULT_ADMIN_EMAIL.toLowerCase()) {
      user = await ensureAdminUser();
    }

    if (!user) {
      // Dummy check to mitigate timing-based user enumeration
      const dummySalt = "pbkdf2:sha512:100000:00000000000000000000000000000000:00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
      await verifyPassword(passwordInput, dummySalt);
      return {
        success: false,
        error: "Credenciais inválidas. Verifique seu e-mail e senha.",
      };
    }

    if (user.status !== "ACTIVE" && user.status !== "PENDING_ONBOARDING") {
      return {
        success: false,
        error:
          user.status === "PENDING_APPROVAL"
            ? "Sua conta ainda está pendente de aprovação pelo administrador."
            : "Sua conta foi suspensa. Entre em contato com o suporte.",
      };
    }

    const storedHash = user.passwordHash || user.verificationToken;
    if (!storedHash) {
      return {
        success: false,
        error: "Credenciais inválidas. Verifique seu e-mail e senha.",
      };
    }

    const isValid = await verifyPassword(passwordInput, storedHash);
    if (!isValid) {
      return {
        success: false,
        error: "Credenciais inválidas. Verifique seu e-mail e senha.",
      };
    }

    // Se o usuário ainda não tinha passwordHash salvo nativamente, migra no banco
    if (!user.passwordHash) {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: storedHash, verificationToken: null },
        });
      } catch {}
    }

    // Register audit log for login
    try {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "LOGIN",
          entity: "User",
          entityId: user.id,
          details: JSON.stringify({
            email: user.email,
            timestamp: new Date().toISOString(),
          }),
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });
    } catch (auditErr) {
      console.warn("Falha ao registrar audit log de login:", auditErr);
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || "Usuário",
        role: user.role,
        companyId: user.companyId,
        status: user.status,
      },
    };
  } catch (error) {
    console.error("Erro durante autenticação:", error);
    return {
      success: false,
      error: "Ocorreu um erro ao processar o login. Tente novamente.",
    };
  }
}

/**
 * Extracts and verifies the current session from a Request or NextRequest.
 */
export async function getSessionUser(
  req?: Request | NextRequest
): Promise<SessionPayload | null> {
  if (!req) return null;

  // 1. Check Better Auth session first
  try {
    const betterSession = await betterAuth.api.getSession({
      headers: req.headers,
    });

    if (betterSession?.user) {
      const u = betterSession.user as any;
      // Ensure user is active in DB
      if (u.status && u.status !== "ACTIVE") {
        return null;
      }
      const sessionExpires = betterSession.session?.expiresAt
        ? Math.floor(new Date(betterSession.session.expiresAt).getTime() / 1000)
        : Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
      const sessionIat = betterSession.session?.createdAt
        ? Math.floor(new Date(betterSession.session.createdAt).getTime() / 1000)
        : Math.floor(Date.now() / 1000);

      return {
        sub: u.id,
        email: u.email,
        name: u.name || "Usuário",
        role: u.role || "OPERATOR",
        companyId: u.companyId || undefined,
        exp: sessionExpires,
        iat: sessionIat,
      };
    }
  } catch (baErr) {
    // If Better Auth fails or is bypassed, fall back to legacy token check
  }

  // 2. Legacy token fallback
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
  const token = match ? decodeURIComponent(match[1]) : null;

  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { status: true, role: true, companyId: true, name: true },
    });

    if (!dbUser || dbUser.status !== "ACTIVE") {
      return null;
    }

    return {
      ...payload,
      role: dbUser.role,
      name: dbUser.name || payload.name,
      companyId: dbUser.companyId ?? payload.companyId,
    };
  } catch (err) {
    console.error("Erro ao verificar status de sessão do usuário no banco:", err);
    return null;
  }
}

/**
 * Like getSessionUser, but for the one narrow case getSessionUser
 * deliberately rejects: a user who IS authenticated but hasn't finished
 * onboarding yet (no company, PENDING_ONBOARDING). Used only by the
 * onboarding API route - every other route keeps requiring ACTIVE via
 * getSessionUser/requirePermission, unchanged.
 */
export async function getPendingOnboardingUser(
  req: Request | NextRequest
): Promise<{ id: string; email: string; name: string | null } | null> {
  try {
    const betterSession = await betterAuth.api.getSession({ headers: req.headers });
    const u = betterSession?.user as any;
    if (u && u.status === "PENDING_ONBOARDING") {
      return { id: u.id, email: u.email, name: u.name || null };
    }
  } catch {}

  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
  const token = match ? decodeURIComponent(match[1]) : null;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { status: true, email: true, name: true },
  });
  if (!dbUser || dbUser.status !== "PENDING_ONBOARDING") return null;

  return { id: payload.sub, email: dbUser.email, name: dbUser.name };
}

/**
 * Helper to build standard HTTP-Only Cookie options for session cookie.
 */
export function getSessionCookieOptions(rememberMe: boolean = false) {
  const maxAge = rememberMe ? 30 * 24 * 3600 : 7 * 24 * 3600; // 30 days or 7 days
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
