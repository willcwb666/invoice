import { describe, it, expect } from "vitest";
import { AddressNormalizer } from "../lib/address-normalizer";

describe("AddressNormalizer", () => {
  it("normalizes Amber's multi-line iCloud address with United States", () => {
    const raw = "2109 Outer Banks Ct\nWindsor, CO, United States";
    const result = AddressNormalizer.normalize(raw, "Windsor", "CO", "80550");

    expect(result.street).toBe("2109 Outer Banks Ct");
    expect(result.city).toBe("Windsor");
    expect(result.state).toBe("CO");
    expect(result.zipCode).toBe("80550");
    expect(result.fullAddress).toBe("2109 Outer Banks Ct, Windsor, CO 80550");
    expect(result.fallbackAddress).toBe("2109 Outer Banks Ct, Windsor, CO");
  });

  it("normalizes Alissa's address with duplicated city and hyphenated state", () => {
    const raw = "3068 Aries Drive, Loveland, Loveland - CO 80538";
    const result = AddressNormalizer.normalize(raw);

    expect(result.street).toBe("3068 Aries Drive");
    expect(result.city).toBe("Loveland");
    expect(result.state).toBe("CO");
    expect(result.zipCode).toBe("80538");
    expect(result.fullAddress).toBe("3068 Aries Drive, Loveland, CO 80538");
    expect(result.fallbackAddress).toBe("3068 Aries Drive, Loveland, CO");
  });

  it("normalizes address with USA suffix and commas", () => {
    const raw = "10309 West 11th Street, Greeley, CO, USA";
    const result = AddressNormalizer.normalize(raw, "Greeley", "CO", "80631");

    expect(result.street).toBe("10309 West 11th Street");
    expect(result.city).toBe("Greeley");
    expect(result.state).toBe("CO");
    expect(result.fullAddress).toBe("10309 West 11th Street, Greeley, CO 80631");
  });

  it("normalizes County Road address with newline", () => {
    const raw = "32499 County Road 53\nGreeley, CO, United States";
    const result = AddressNormalizer.normalize(raw);

    expect(result.street).toBe("32499 County Road 53");
    expect(result.city).toBe("Greeley");
    expect(result.state).toBe("CO");
    expect(result.fallbackAddress).toBe("32499 County Road 53, Greeley, CO");
  });

  it("cleans messy street-only string without altering street name", () => {
    const cleaned = AddressNormalizer.cleanStreet("2109 Outer Banks Ct\nWindsor, CO, United States", "Windsor");
    expect(cleaned).toBe("2109 Outer Banks Ct");
  });

  it("handles clean simple street correctly", () => {
    const raw = "401 Pulsar St";
    const result = AddressNormalizer.normalize(raw, "Fort Collins", "CO", "80525");

    expect(result.street).toBe("401 Pulsar St");
    expect(result.city).toBe("Fort Collins");
    expect(result.state).toBe("CO");
    expect(result.zipCode).toBe("80525");
    expect(result.fullAddress).toBe("401 Pulsar St, Fort Collins, CO 80525");
  });

  it("handles Fort Collins with newline and apartment", () => {
    const raw = "2613 Wyandotte Dr Apt 2\nFort Collins, CO, United States";
    const result = AddressNormalizer.normalize(raw);

    expect(result.street).toBe("2613 Wyandotte Dr Apt 2");
    expect(result.city).toBe("Fort Collins");
    expect(result.state).toBe("CO");
    expect(result.fullAddress).toBe("2613 Wyandotte Dr Apt 2, Fort Collins, CO");
  });
});
