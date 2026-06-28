import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
} from "@/lib/auth/session";

describe("session", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    process.env.APP_EMAIL = "reviewer@acme.com";
    process.env.APP_PASSWORD = "secret-pass";
    process.env.APP_AUTH_SECRET = "test-secret";
  });

  afterEach(() => {
    process.env = env;
  });

  it("creates and verifies a session token", async () => {
    const token = await createSessionToken("reviewer@acme.com");
    expect(await verifySessionToken(token)).toBe(true);
  });

  it("rejects tampered token", async () => {
    const token = await createSessionToken("reviewer@acme.com");
    expect(await verifySessionToken(`${token}x`)).toBe(false);
  });

  it("rejects empty token", async () => {
    expect(await verifySessionToken(undefined)).toBe(false);
  });
});
