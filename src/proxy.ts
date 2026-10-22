import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/security/tokens";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Next.js 16 Proxy Convention
 * Replaces traditional middleware with high-performance request-level proxying.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Always allow static Next.js assets, public assets, and media files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|woff2?|map)$/i)
  ) {
    return NextResponse.next();
  }

  // Strip any x-user-* headers the client may have sent, on every path —
  // including the public allowlist below. Route handlers no longer trust
  // these headers (getSessionUser re-verifies the signed cookie itself), but
  // stripping them here too means a client-supplied x-user-id/x-user-role
  // can never reach a route handler and be mistaken for something proxy.ts
  // vouched for, even if a future code path starts reading them again.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.delete("x-user-id");
  requestHeaders.delete("x-user-email");
  requestHeaders.delete("x-user-role");
  requestHeaders.delete("x-user-name");
  requestHeaders.delete("x-user-company-id");
  const next = () => NextResponse.next({ request: { headers: requestHeaders } });

  // 2. Explicitly allowed public paths:
  // - /login (auth screen)
  // - /pay/* (public invoice pay and view link for customers)
  // - /api/auth/* (Better Auth endpoints)
  // - /api/v1/auth/* (login, logout, register, me)
  // - /api/v1/public/* (public endpoints for invoice customer portal)
  // - /api/v1/cron/* (cron dispatchers with their own secret verification)
  const isLoginPage = pathname === "/login";
  const isPublicPay = pathname.startsWith("/pay/");
  const isAuthApi = pathname.startsWith("/api/v1/auth/") || pathname.startsWith("/api/auth/");
  const isPublicApi = pathname.startsWith("/api/v1/public/");
  const isCronApi = pathname.startsWith("/api/v1/cron/");
  const isWebcalFeed = pathname === "/api/v1/agenda/feed.ics";

  // 3. Extract and cryptographically verify session (Better Auth or legacy token)
  let session: any = null;
  let pendingOnboardingStatus: string | null = null;
  try {
    const betterSession = await auth.api.getSession({ headers: req.headers });
    const betterUser = betterSession?.user as any;
    if (betterUser?.status === "PENDING_ONBOARDING") {
      pendingOnboardingStatus = "PENDING_ONBOARDING";
    }
    // Mirrors getSessionUser's ACTIVE check - Better Auth's own autoSignIn
    // doesn't know about this app's PENDING_APPROVAL/SUSPENDED statuses, so
    // without this a newly self-registered or suspended user would hold a
    // valid Better Auth cookie that still gets past this page gate.
    if (betterUser && (!betterUser.status || betterUser.status === "ACTIVE")) {
      session = {
        sub: betterUser.id,
        email: betterUser.email,
        name: betterUser.name,
        role: betterUser.role,
        companyId: betterUser.companyId,
      };
    }
  } catch {}

  if (!session && !pendingOnboardingStatus) {
    const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const legacyPayload = sessionCookie ? await verifySessionToken(sessionCookie) : null;
    if (legacyPayload) {
      // The legacy token doesn't carry a live status (it's a long-lived
      // signed JWT, not re-checked against the DB on every page load like
      // getSessionUser does for API routes) - re-check it here so a
      // PENDING_ONBOARDING self-registration (see Task 3) is routed to
      // /onboarding at the page level too, not just rejected later when an
      // API call 401s.
      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: legacyPayload.sub },
          select: { status: true },
        });
        if (dbUser?.status === "PENDING_ONBOARDING") {
          pendingOnboardingStatus = "PENDING_ONBOARDING";
        } else if (dbUser?.status === "ACTIVE") {
          session = legacyPayload;
        }
        // Any other status (PENDING_APPROVAL, SUSPENDED) leaves both
        // `session` and `pendingOnboardingStatus` unset, i.e. "no session" -
        // same outcome getSessionUser already produces for API routes.
      } catch (err) {
        // Same fail-closed behavior as getSessionUser's equivalent lookup:
        // on a DB error, leave both `session` and `pendingOnboardingStatus`
        // unset and fall through to the unauthenticated handling below,
        // rather than trusting the unverified JWT payload.
        console.error("Erro ao verificar status de sessão do usuário no banco:", err);
      }
    }
  }

  // A PENDING_ONBOARDING user (either auth mechanism) can only reach the
  // onboarding wizard itself, its API, and the auth endpoints (so they can
  // still log out / abandon onboarding) - no matter what else they request.
  if (pendingOnboardingStatus) {
    const isOnboardingPath =
      pathname === "/onboarding" || pathname.startsWith("/api/v1/onboarding/") || isAuthApi;
    if (!isOnboardingPath) {
      return NextResponse.redirect(new URL("/onboarding", req.url));
    }
    return next();
  }

  // If already authenticated and accesses /login, redirect directly to dashboard
  if (isLoginPage && session) {
    const from = req.nextUrl.searchParams.get("from");
    const isSafeFrom =
      from &&
      from.startsWith("/") &&
      !from.startsWith("//") &&
      !from.startsWith("/\\") &&
      from !== "/login";
    const redirectUrl = isSafeFrom ? from : "/";
    return NextResponse.redirect(new URL(redirectUrl, req.url));
  }

  // Allow public routes and cron routes
  if (isLoginPage || isPublicPay || isAuthApi || isPublicApi || isCronApi) {
    return next();
  }

  // Calendar feed protection: allow if authenticated OR matching the secret feed token
  if (isWebcalFeed) {
    if (session) return next();
    const token = req.nextUrl.searchParams.get("token");
    const expectedToken = process.env.WEBCAL_SECRET;
    if (expectedToken && token && token === expectedToken) {
      return next();
    }
    return NextResponse.json(
      {
        error:
          "Acesso não autorizado ao feed da agenda. Efetue login ou forneça o token seguro de assinatura.",
      },
      { status: 401 }
    );
  }

  // 4. Handle Unauthenticated Requests for protected routes:
  if (!session) {
    // If it's an API route (/api/*), return JSON 401 Unauthorized
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "Acesso não autorizado. Autenticação obrigatória.",
          code: "UNAUTHORIZED",
        },
        { status: 401 }
      );
    }

    // If it's a dashboard or web route, redirect to /login with original path preserved in `from`
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 5. Authenticated: let the request through with the sanitized headers.
  // Route handlers re-derive the session from the cookie themselves (see
  // getSessionUser) rather than trusting headers set here.
  return next();
}

export default proxy;

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
