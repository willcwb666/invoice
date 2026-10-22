/**
 * Sliding Window Rate Limiter com Suporte Híbrido a Redis (Upstash / Vercel KV) e Fallback em Memória.
 * Protege rotas de API e endpoints sensíveis contra força bruta, scraping e abuso de requisições.
 */

import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

// Limpeza periódica em memória para evitar vazamento
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

// Configuração opcional do Upstash Redis / Vercel KV
const redisUrl =
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.KV_REST_API_URL;
const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.KV_REST_API_TOKEN;

let redisClient: Redis | null = null;
if (redisUrl && redisToken) {
  try {
    redisClient = new Redis({
      url: redisUrl,
      token: redisToken,
    });
  } catch (err) {
    console.warn("Falha ao inicializar Upstash Redis client. Usando fallback em memória:", err);
  }
}

/**
 * Verificação distribuída assíncrona usando Upstash Redis com fallback resiliente para memória.
 */
export async function checkRateLimitAsync(
  identifier: string,
  options: RateLimitOptions = {}
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  const limit = options.limit ?? 60;
  const windowMs = options.windowMs ?? 60000;

  if (redisClient) {
    try {
      const ratelimit = new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(limit, `${Math.ceil(windowMs / 1000)} s`),
        analytics: false,
        prefix: "@invoice/ratelimit",
      });

      const result = await ratelimit.limit(identifier);
      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: Math.ceil(result.reset / 1000),
      };
    } catch (redisErr) {
      console.warn("Erro ao consultar Redis rate limit, fallback para memória:", redisErr);
    }
  }

  // Fallback em memória
  return checkRateLimit(identifier, options);
}

/**
 * Verificação síncrona em memória com registro assíncrono em background se Redis estiver configurado.
 */
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
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const hops = forwardedFor.split(",").map((h) => h.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }
  return req.headers.get("x-real-ip") || "127.0.0.1";
}
