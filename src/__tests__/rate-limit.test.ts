import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit } from "@/lib/security/rate-limit";

describe("Rate Limiting (In-Memory Sliding Window)", () => {
  it("allows requests under the specified limit", () => {
    const key = `test_rate_${Date.now()}`;
    const r1 = checkRateLimit(key, { limit: 5, windowMs: 10000 });
    expect(r1.success).toBe(true);
    expect(r1.remaining).toBe(4);

    const r2 = checkRateLimit(key, { limit: 5, windowMs: 10000 });
    expect(r2.success).toBe(true);
    expect(r2.remaining).toBe(3);
  });

  it("blocks requests that exceed the limit", () => {
    const key = `test_block_${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      checkRateLimit(key, { limit: 3, windowMs: 10000 });
    }
    const blocked = checkRateLimit(key, { limit: 3, windowMs: 10000 });
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });
});
