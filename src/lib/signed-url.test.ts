import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasValidSignature, temporarySignedUrl } from "./signed-url";

beforeEach(() => {
  vi.stubEnv("APP_KEY", "test-key");
  vi.stubEnv("APP_URL", "http://localhost:3000");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("signed URLs", () => {
  it("accepts its own link, unchanged and in time", () => {
    const url = temporarySignedUrl("/verifikasi-email/7/abc", 60);

    expect(url).toMatch(/^http:\/\/localhost:3000\/verifikasi-email\/7\/abc\?expires=\d+&signature=[0-9a-f]{64}$/);
    expect(hasValidSignature(url)).toBe(true);
  });

  it("rejects a tampered, unsigned or expired link", () => {
    const url = temporarySignedUrl("/verifikasi-email/7/abc", 60);

    expect(hasValidSignature(url.replace("/7/", "/8/"))).toBe(false);
    expect(hasValidSignature("http://localhost:3000/verifikasi-email/7/abc")).toBe(false);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61 * 60 * 1000);
    expect(hasValidSignature(url)).toBe(false);
  });

  it("checks against APP_URL, so the link still holds behind a proxy", () => {
    const url = temporarySignedUrl("/verifikasi-email/7/abc", 60);

    expect(hasValidSignature(url.replace("http://localhost:3000", "http://10.0.0.5:8080"))).toBe(true);
  });
});
