import { describe, it, expect } from "vitest";
import {
  buildGoogleMapsUrl,
  buildAppleMapsUrl,
  isIosUserAgent,
} from "../lib/navigation";

describe("Navigation Helpers", () => {
  it("builds correct Google Maps URL", () => {
    const url = buildGoogleMapsUrl("3068 Aries Drive", "Loveland", "CO");
    expect(url).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=3068%20Aries%20Drive%2C%20Loveland%2C%20CO"
    );
  });

  it("builds correct Apple Maps URL", () => {
    const url = buildAppleMapsUrl("3068 Aries Drive", "Loveland", "CO");
    expect(url).toBe(
      "https://maps.apple.com/?daddr=3068%20Aries%20Drive%2C%20Loveland%2C%20CO"
    );
  });

  it("detects iOS devices accurately", () => {
    // iPhone user agent
    const iphoneUA =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15";
    expect(isIosUserAgent(iphoneUA, "iPhone", 5)).toBe(true);

    // iPad with desktop-class user agent (MacIntel with touch points)
    const ipadUA =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";
    expect(isIosUserAgent(ipadUA, "MacIntel", 5)).toBe(true);

    // Desktop Mac (MacIntel without touch points)
    expect(isIosUserAgent(ipadUA, "MacIntel", 0)).toBe(false);

    // Android device
    const androidUA =
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36";
    expect(isIosUserAgent(androidUA, "Linux armv8l", 5)).toBe(false);

    // Windows PC
    const windowsUA =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
    expect(isIosUserAgent(windowsUA, "Win32", 0)).toBe(false);
  });
});
