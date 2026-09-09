/**
 * Sliding Window Rate Limiter
 * Protege rotas de API e endpoints sensíveis contra força bruta, scraping e abuso de requisições.
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

// Limpeza periódica para evitar vazamento de memória
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
      if (now > record.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  }, 60000);
}

export interface RateLimitOptions {
  limit?: number; // Máximo de requisições permitidas
  windowMs?: number; // Janela de tempo em milissegundos
}

export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
} {
  const limit = options.limit ?? 60; // 60 requisições por padrão
  const windowMs = options.windowMs ?? 60000; // 1 minuto por padrão
  const now = Date.now();

  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: Math.ceil((now + windowMs) / 1000),
    };
  }

  if (record.count >= limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      reset: Math.ceil(record.resetTime / 1000),
    };
  }

  record.count += 1;
  return {
    success: true,
    limit,
    remaining: limit - record.count,
    reset: Math.ceil(record.resetTime / 1000),
  };
}

export function getClientIp(req: Request): string {
  // X-Forwarded-For is "client, proxy1, proxy2, ..." — every entry except
  // the last is whatever the CLIENT chose to send (or a previous hop just
  // copied along), so taking the first entry (the old behavior here) let
  // anyone reset their own rate-limit bucket by sending a fresh fake value
  // on every request. Only the entry appended by our own reverse proxy /
  // platform edge — the LAST one — is outside client control, assuming a
  // single trusted hop in front of this app. If this is ever deployed
  // behind more than one trusted proxy, adjust which entry is trusted here.
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const hops = forwardedFor.split(",").map((h) => h.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }
  return req.headers.get("x-real-ip") || "127.0.0.1";
}
