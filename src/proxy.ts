import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/security/tokens";

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
  // - /api/v1/auth/* (login, logout, register, me)
  // - /api/v1/public/* (public endpoints for invoice customer portal)
  const isLoginPage = pathname === "/login";
  const isPublicPay = pathname.startsWith("/pay/");
  const isAuthApi = pathname.startsWith("/api/v1/auth/");
  const isPublicApi = pathname.startsWith("/api/v1/public/");
  const isWebcalFeed = pathname === "/api/v1/agenda/feed.ics";

  // 3. Extract and cryptographically verify session token from cookie
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionCookie ? await verifySessionToken(sessionCookie) : null;

  // If already authenticated and accesses /login, redirect directly to dashboard
  if (isLoginPage && session) {
    const from = req.nextUrl.searchParams.get("from");
    const redirectUrl = from && from.startsWith("/") && from !== "/login" ? from : "/";
    return NextResponse.redirect(new URL(redirectUrl, req.url));
  }

  // Allow public routes
  if (isLoginPage || isPublicPay || isAuthApi || isPublicApi) {
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
