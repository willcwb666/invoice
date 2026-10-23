import { AddressNormalizer } from "@/lib/address-normalizer";

export interface PropertyData {
  bedrooms: number | null;
  bathrooms: number | null;
  squareFeet: number | null;
  propertyType: string | null;
  formattedAddress?: string;
}

export interface PropertyFetchResult {
  data: PropertyData | null;
  error?: string;
}

interface CacheEntry {
  data: PropertyData | null;
  timestamp: number;
}

const propertyCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class RentCastService {
  /**
   * Sanitizes address string using AddressNormalizer
   */
  public static sanitizeAddress(address: string): string {
    return AddressNormalizer.normalize(address).fullAddress;
  }

  /**
   * Normalizes address string for cache consistency
   */
  private static normalizeAddress(address: string): string {
    return AddressNormalizer.normalize(address).fullAddress.toLowerCase().replace(/\s+/g, " ");
  }

  /**
   * Clears in-memory property cache (useful for testing or cache resets)
   */
  public static clearCache(): void {
    propertyCache.clear();
  }

  /**
   * Fetches property dimensions with detailed error reporting (e.g. inactive subscriptions).
   */
  public static async fetchPropertyDetailed(rawAddress: string): Promise<PropertyFetchResult> {
    if (!rawAddress || typeof rawAddress !== "string" || rawAddress.trim().length < 5) {
      return { data: null };
    }

    const norm = AddressNormalizer.normalize(rawAddress);
    const cacheKey = norm.fullAddress.toLowerCase().replace(/\s+/g, " ");

    const cached = propertyCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return { data: cached.data };
    }

    const apiKey = process.env.RENTCAST_API_KEY;
    if (!apiKey) {
      console.warn("[RentCast] RENTCAST_API_KEY não configurada no ambiente.");
      return {
        data: null,
        error: "A chave RENTCAST_API_KEY não foi detectada no ambiente.",
      };
    }

    const executeQuery = async (
      queryAddress: string
    ): Promise<{ data: any[] | null; error?: string }> => {
      const url = `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(queryAddress)}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-Api-Key": apiKey,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        let errorMsg = `Erro HTTP ${response.status}: ${response.statusText}`;
        try {
          const errJson = await response.json();
          if (
            errJson.error === "billing/subscription-inactive" ||
            errJson.message?.includes("subscription")
          ) {
            errorMsg =
              "A chave RentCast não possui um plano ativo no painel. Ative o plano (gratuito) em https://app.rentcast.io/app/api";
          } else if (errJson.message) {
            errorMsg = `RentCast: ${errJson.message}`;
          }
        } catch {}
        console.warn(`[RentCast] Erro ao consultar endereço (${response.status}):`, errorMsg);
        return { data: null, error: errorMsg };
      }

      const json = await response.json();
      return { data: Array.isArray(json) ? json : null };
    };

    try {
      // 1. Tenta a consulta com o endereço completo normalizado
      let queryRes = await executeQuery(norm.fullAddress);

      // Se deu erro de assinatura/auth, repassa o erro diretamente
      if (queryRes.error && !queryRes.data) {
        return { data: null, error: queryRes.error };
      }

      let data = queryRes.data;

      // 2. Fallback inteligente sem CEP
      if (
        (!data || data.length === 0) &&
        norm.fallbackAddress &&
        norm.fallbackAddress !== norm.fullAddress
      ) {
        const fallbackRes = await executeQuery(norm.fallbackAddress);
        if (fallbackRes.data && fallbackRes.data.length > 0) {
          data = fallbackRes.data;
        }
      }

      if (!data || data.length === 0) {
        // Cache negative lookup to prevent re-querying unknown address immediately
        propertyCache.set(cacheKey, { data: null, timestamp: Date.now() });
        return { data: null };
      }

      const firstMatch = data[0];
      const propertyData: PropertyData = {
        bedrooms: typeof firstMatch.bedrooms === "number" ? firstMatch.bedrooms : null,
        bathrooms: typeof firstMatch.bathrooms === "number" ? firstMatch.bathrooms : null,
        squareFeet: typeof firstMatch.squareFootage === "number" ? firstMatch.squareFootage : null,
        propertyType: firstMatch.propertyType || null,
        formattedAddress: firstMatch.formattedAddress || undefined,
      };

      propertyCache.set(cacheKey, { data: propertyData, timestamp: Date.now() });
      return { data: propertyData };
    } catch (error) {
      console.error("[RentCast] Exceção inesperada ao consultar API:", error);
      return { data: null, error: "Erro interno de comunicação com a RentCast." };
    }
  }

  /**
   * Fetches property dimensions (bedrooms, bathrooms, square footage, property type)
   * from RentCast API with caching to preserve monthly API quota.
   */
  public static async fetchProperty(rawAddress: string): Promise<PropertyData | null> {
    const res = await this.fetchPropertyDetailed(rawAddress);
    return res.data;
  }
}
