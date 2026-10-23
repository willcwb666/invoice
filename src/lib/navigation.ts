import { AddressNormalizer } from "./address-normalizer";

/**
 * Builds standard Google Maps directions destination URL.
 */
export function buildGoogleMapsUrl(address: string, city?: string, state?: string): string {
  const norm = AddressNormalizer.normalize(address, city, state);
  const target = norm.fullAddress || address;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target)}`;
}

/**
 * Builds standard Apple Maps destination URL.
 */
export function buildAppleMapsUrl(address: string, city?: string, state?: string): string {
  const norm = AddressNormalizer.normalize(address, city, state);
  const target = norm.fullAddress || address;
  return `https://maps.apple.com/?daddr=${encodeURIComponent(target)}`;
}

/**
 * Detects whether the current device is running iOS (iPhone, iPad, or iPod),
 * including iPadOS Safari that reports MacIntel with touch support.
 */
export function isIosUserAgent(userAgent?: string, platform?: string, maxTouchPoints?: number): boolean {
  const ua = userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "") ?? "";
  const plat = platform ?? (typeof navigator !== "undefined" ? navigator.platform : "") ?? "";
  const touch = maxTouchPoints ?? (typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0);

  return /iPad|iPhone|iPod/.test(ua) || (plat === "MacIntel" && touch > 1);
}
