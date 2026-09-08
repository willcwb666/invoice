import { NextRequest, NextResponse } from "next/server";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  getSessionCookieOptions,
  ensureAdminUser,
} from "@/lib/security/auth";

const DEFAULT_ADMIN_EMAIL = "renatamatoz@gmail.com";
const DEFAULT_ADMIN_NAME = "Renata Matos de Oliveira";
const ADMIN_WHITELIST = [
  "renatamatoz@gmail.com",
  "willcwb666@gmail.com",
];

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const accessToken = requestUrl.searchParams.get("access_token");
  const codeVerifierParam = requestUrl.searchParams.get("code_verifier");
  const cookieVerifier = req.cookies.get("sb_pkce_verifier")?.value;
  const verifier = codeVerifierParam || cookieVerifier;
  const noVerifier = requestUrl.searchParams.get("no_verifier") === "1";
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const next = requestUrl.searchParams.get("next") || "/";

  // 1. Error returned from OAuth provider
  if (error) {
    console.error("Erro no OAuth retornado pelo Supabase:", error, errorDescription);
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set(
      "error",
      errorDescription || error || "Falha na autenticação com o Google."
    );
    return NextResponse.redirect(loginUrl);
  }

  // 2. If neither accessToken nor code+verifier are present, serve the client bridge
  if (!accessToken && (!code || (!verifier && !noVerifier))) {
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Autenticando com o Google...</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #f8fafc;
      color: #334155;
      padding: 1rem;
    }
    .card {
      background: white;
      padding: 2.5rem 2rem;
      border-radius: 1.5rem;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
      text-align: center;
      max-width: 400px;
      width: 100%;
    }
    .spinner {
      width: 2.5rem;
      height: 2.5rem;
      border: 3px solid #e2e8f0;
      border-top-color: #4f46e5;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 1.25rem auto;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h3 { margin: 0 0 0.5rem 0; font-size: 1.1rem; font-weight: 700; color: #0f172a; }
    p { margin: 0; font-size: 0.875rem; color: #64748b; line-height: 1.4; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h3>Concluindo Acesso Seguro</h3>
    <p>Validando suas credenciais do Google com o Supabase...</p>
  </div>
  <script>
    (async function() {
      try {
        const hash = window.location.hash;
        const search = window.location.search;
        const urlParams = new URLSearchParams(search);
        const hashParams = hash ? new URLSearchParams(hash.substring(1)) : new URLSearchParams();

        // 1. Provider error returned in URL
        const error = urlParams.get("error_description") || urlParams.get("error") ||
                      hashParams.get("error_description") || hashParams.get("error");
        if (error) {
          window.location.replace("/login?error=" + encodeURIComponent(error));
          return;
        }

        // 2. Implicit Flow: access_token in URL hash
        const hashToken = hashParams.get("access_token");
        if (hashToken) {
          window.location.replace("/api/v1/auth/callback?access_token=" + encodeURIComponent(hashToken));
          return;
        }

        // 3. PKCE Flow: auth code in search params
        const authCode = urlParams.get("code") || ${code ? JSON.stringify(code) : "null"};
        if (authCode) {
          let codeVerifier = null;
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && (key.endsWith("-code-verifier") || key.includes("verifier"))) {
                codeVerifier = localStorage.getItem(key);
                break;
              }
            }
          } catch (storageErr) {}

          if (codeVerifier) {
            const cleanVerifier = codeVerifier.split("/")[0];
            // Attempt direct exchange with Supabase Auth endpoint
            try {
              const res = await fetch("${SUPABASE_URL}/auth/v1/token?grant_type=pkce", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "apikey": "${SUPABASE_ANON_KEY}",
                },
                body: JSON.stringify({
                  auth_code: authCode,
                  code_verifier: cleanVerifier,
                }),
              });
              const data = await res.json();
              if (data && data.access_token) {
                window.location.replace("/api/v1/auth/callback?access_token=" + encodeURIComponent(data.access_token));
                return;
              }
            } catch (fetchErr) {
              console.warn("Direct exchange attempt failed, falling back to server exchange:", fetchErr);
            }

            // Fallback: pass code and verifier to server
            window.location.replace(
              "/api/v1/auth/callback?code=" + encodeURIComponent(authCode) +
              "&code_verifier=" + encodeURIComponent(cleanVerifier)
            );
            return;
          }

          // If no verifier in localStorage, request server exchange attempt
          window.location.replace("/api/v1/auth/callback?code=" + encodeURIComponent(authCode) + "&no_verifier=1");
          return;
        }

        // Neither code nor token present
        window.location.replace("/login?error=" + encodeURIComponent("Código de autorização não recebido do Google."));
      } catch (err) {
        window.location.replace("/login?error=" + encodeURIComponent("Erro ao processar autenticação com o Google."));
      }
    })();
  </script>
</body>
</html>`;
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  try {
    let authUser: {
      email?: string;
      user_metadata?: { full_name?: string; name?: string; given_name?: string };
    } | null = null;

    // 3. Exchange code for session or validate access_token
    if (accessToken) {
      const { data, error: tokenError } = await supabase.auth.getUser(accessToken);
      if (tokenError || !data?.user) {
        console.error("Erro ao validar token de acesso do Supabase:", tokenError);
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set(
          "error",
          tokenError?.message || "Token de acesso do Google inválido ou expirado."
        );
        return NextResponse.redirect(loginUrl);
      }
      authUser = data.user;
    } else if (code && verifier) {
      try {
        const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            auth_code: code,
            code_verifier: verifier,
          }),
        });
        const tokenData = await tokenRes.json();
        if (tokenData && tokenData.user) {
          authUser = tokenData.user;
        } else if (tokenData && tokenData.access_token) {
          const { data } = await supabase.auth.getUser(tokenData.access_token);
          authUser = data?.user;
        }
      } catch (exchangeErr) {
        console.warn("Falha no exchange direto com endpoint de token:", exchangeErr);
      }
    } else if (code) {
      const { data, error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);
      if (!exchangeError && data?.user) {
        authUser = data.user;
      }
    }

    if (!authUser || !authUser.email) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set(
        "error",
        "Não foi possível validar a sessão com o Google. Tente novamente."
      );
      return NextResponse.redirect(loginUrl);
    }

    const email = authUser.email.trim().toLowerCase();
    const name =
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.name ||
      authUser.user_metadata?.given_name ||
      email.split("@")[0];

    const isPrimaryAdmin = ADMIN_WHITELIST.includes(email.toLowerCase());

    // Ensure company and master admin exist in DB
    await ensureAdminUser();

    let company = await prisma.companyProfile.findFirst();
    if (!company) {
      company = await prisma.companyProfile.create({
        data: {
          name: DEFAULT_ADMIN_NAME,
          email: DEFAULT_ADMIN_EMAIL,
        },
      });
    }

    // Check if user already exists in database
    let dbUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!dbUser) {
      // Automatic RBAC elevation only for the Google-verified admin
      // whitelist — Google itself vouches for ownership of these emails,
      // unlike a self-reported email in the password registration form.
      const assignedRole = isPrimaryAdmin ? "ADMIN" : "OPERATOR";
      const assignedStatus = isPrimaryAdmin ? "ACTIVE" : "PENDING_APPROVAL";

      dbUser = await prisma.user.create({
        data: {
          email,
          name,
          phone: isPrimaryAdmin ? "9704129406" : null,
          role: assignedRole,
          status: assignedStatus,
          companyId: company.id,
          emailVerified: new Date(),
        },
      });

      // Audit log for creation
      try {
        await prisma.auditLog.create({
          data: {
            userId: dbUser.id,
            action: "CREATE",
            entity: "User",
            entityId: dbUser.id,
            details: JSON.stringify({
              provider: "google",
              email,
              role: assignedRole,
              status: assignedStatus,
              isPrimaryAdmin,
            }),
          },
        });
      } catch (logErr) {
        console.warn("Falha ao registrar audit log de cadastro Google:", logErr);
      }
    } else {
      // User exists: enforce ADMIN & ACTIVE for Renata Matos
      if (isPrimaryAdmin && (dbUser.role !== "ADMIN" || dbUser.status !== "ACTIVE")) {
        dbUser = await prisma.user.update({
          where: { id: dbUser.id },
          data: {
            role: "ADMIN",
            status: "ACTIVE",
            emailVerified: new Date(),
          },
        });
      } else if (!dbUser.emailVerified) {
        // Mark email verified via Google
        dbUser = await prisma.user.update({
          where: { id: dbUser.id },
          data: { emailVerified: new Date() },
        });
      }
    }

    // Check status restrictions
    if (dbUser.status === "SUSPENDED") {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set(
        "error",
        "Sua conta foi suspensa. Entre em contato com a administradora."
      );
      return NextResponse.redirect(loginUrl);
    }

    if (dbUser.status === "PENDING_APPROVAL") {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set(
        "info",
        "Conta cadastrada com sucesso via Google! Seu acesso está aguardando liberação do administrador."
      );
      return NextResponse.redirect(loginUrl);
    }

    // User is ACTIVE: Create secure HMAC-SHA256 session token
    const token = await createSessionToken(
      {
        sub: dbUser.id,
        email: dbUser.email,
        name: dbUser.name || "Usuário",
        role: dbUser.role,
        companyId: dbUser.companyId || undefined,
      },
      30 * 24 * 3600 // 30 days
    );

    // Audit log for successful login
    try {
      await prisma.auditLog.create({
        data: {
          userId: dbUser.id,
          action: "LOGIN",
          entity: "User",
          entityId: dbUser.id,
          details: JSON.stringify({
            provider: "google",
            email: dbUser.email,
            role: dbUser.role,
            timestamp: new Date().toISOString(),
          }),
        },
      });
    } catch (logErr) {
      console.warn("Falha ao registrar audit log de login Google:", logErr);
    }

    // Set secure HTTP-Only session cookie and redirect to Dashboard
    const destination = next.startsWith("/") && next !== "/login" ? next : "/";
    const response = NextResponse.redirect(new URL(destination, req.url));
    const cookieOptions = getSessionCookieOptions(true);

    response.cookies.set({
      ...cookieOptions,
      value: token,
    });

    // Clear temporary PKCE verifier cookie if present
    response.cookies.set({
      name: "sb_pkce_verifier",
      value: "",
      path: "/",
      maxAge: 0,
      httpOnly: false,
      sameSite: "lax",
    });

    return response;
  } catch (error: unknown) {
    console.error("Erro inesperado no callback de autenticação Google:", error);
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set(
      "error",
      "Ocorreu um erro interno ao processar a autenticação com o Google. Tente novamente."
    );
    return NextResponse.redirect(loginUrl);
  }
}
