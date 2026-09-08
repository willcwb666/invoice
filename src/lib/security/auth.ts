import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
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
  if (configured) return configured;

  const generated = generateRandomPassword();
  console.warn(
    `[Auth] ADMIN_INITIAL_PASSWORD não configurada. Uma senha temporária foi gerada para ${DEFAULT_ADMIN_EMAIL}: ${generated}\n` +
      "Defina ADMIN_INITIAL_PASSWORD no ambiente para controlar essa senha e evite depender desta geração automática em produção."
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
      company = await prisma.companyProfile.create({
        data: {
          name: DEFAULT_ADMIN_NAME,
          email: DEFAULT_ADMIN_EMAIL,
        },
      });
    }

    const admin = await prisma.user.findUnique({
      where: { email: DEFAULT_ADMIN_EMAIL.toLowerCase() },
    });

    if (!admin) {
      const passwordHash = await hashPassword(resolveAdminBootstrapPassword());
      return await prisma.user.create({
        data: {
          email: DEFAULT_ADMIN_EMAIL.toLowerCase(),
          name: DEFAULT_ADMIN_NAME,
          phone: "9704129406",
          role: "ADMIN",
          status: "ACTIVE",
          companyId: company.id,
          verificationToken: passwordHash, // Stored safely in verificationToken column
        },
      });
    }

    // If admin exists but has no password hash set
    if (!admin.verificationToken) {
      const passwordHash = await hashPassword(resolveAdminBootstrapPassword());
      return await prisma.user.update({
        where: { id: admin.id },
        data: {
          verificationToken: passwordHash,
          status: "ACTIVE",
          role: "ADMIN",
        },
      });
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
}: {
  email: string;
  password?: string;
  name?: string;
  phone?: string;
  role?: "ADMIN" | "FINANCIAL" | "OPERATOR" | "VIEWER";
  status?: "PENDING_APPROVAL" | "ACTIVE" | "SUSPENDED";
}) {
  const normalizedEmail = email.trim().toLowerCase();

  let company = await prisma.companyProfile.findFirst();
  if (!company) {
    company = await prisma.companyProfile.create({
      data: {
        name: DEFAULT_ADMIN_NAME,
        email: DEFAULT_ADMIN_EMAIL,
      },
    });
  }

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    throw new Error("Este e-mail já está cadastrado no sistema.");
  }

  const totalUsers = await prisma.user.count();
  const isFirstUser = totalUsers === 0;

  // Self-registration is never auto-elevated: role/status only come from an
  // authenticated ADMIN caller (see POST /api/v1/users); otherwise this is
  // always a pending, unprivileged account.
  const assignedRole = role || "OPERATOR";
  const assignedStatus = status || "PENDING_APPROVAL";

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
      companyId: company.id,
      verificationToken: passwordHash,
      emailVerified: null,
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

    if (user.status !== "ACTIVE") {
      return {
        success: false,
        error:
          user.status === "PENDING_APPROVAL"
            ? "Sua conta ainda está pendente de aprovação pelo administrador."
            : "Sua conta foi suspensa. Entre em contato com o suporte.",
      };
    }

    const storedHash = user.verificationToken;
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

  // 1. Check if headers were populated by Next.js middleware
  const headerUserId = req.headers.get("x-user-id");
  const headerEmail = req.headers.get("x-user-email");
  const headerRole = req.headers.get("x-user-role");

  if (headerUserId && headerEmail && headerRole) {
    return {
      sub: headerUserId,
      email: headerEmail,
      role: headerRole,
      name: req.headers.get("x-user-name") || "Usuário",
      companyId: req.headers.get("x-user-company-id") || undefined,
      exp: 0,
      iat: 0,
    };
  }

  // 2. Otherwise extract session token from cookie header
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
  const token = match ? decodeURIComponent(match[1]) : null;

  if (!token) return null;
  return await verifySessionToken(token);
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
