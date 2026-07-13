import { beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimit } from "../rate-limit";

/**
 * REDIS_URL is unset in the unit-test environment, so these exercise the
 * in-memory fallback path — the same path production falls back to if Redis
 * itself errors at runtime.
 */
describe("rateLimit (in-memory fallback)", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit", async () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(await rateLimit(key, 5, 60_000)).toBe(true);
    }
  });

  it("blocks once the limit is exceeded", async () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect(await rateLimit(key, 3, 60_000)).toBe(true);
    }
    expect(await rateLimit(key, 3, 60_000)).toBe(false);
  });

  it("scopes limits independently per key", async () => {
    const a = `test:a:${Math.random()}`;
    const b = `test:b:${Math.random()}`;
    expect(await rateLimit(a, 1, 60_000)).toBe(true);
    expect(await rateLimit(a, 1, 60_000)).toBe(false);
    expect(await rateLimit(b, 1, 60_000)).toBe(true);
  });

  it("resets once the window elapses", async () => {
    vi.useFakeTimers();
    try {
      const key = `test:window:${Math.random()}`;
      expect(await rateLimit(key, 1, 1_000)).toBe(true);
      expect(await rateLimit(key, 1, 1_000)).toBe(false);
      vi.advanceTimersByTime(1_001);
      expect(await rateLimit(key, 1, 1_000)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
