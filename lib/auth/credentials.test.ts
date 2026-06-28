import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  getConfiguredEmail,
  normalizeEmail,
  validateCredentials,
} from "@/lib/auth/credentials";

describe("credentials", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    process.env.APP_EMAIL = "reviewer@acme.com";
    process.env.APP_PASSWORD = "secret-pass";
  });

  afterEach(() => {
    process.env = env;
  });

  it("normalizes email", () => {
    expect(normalizeEmail("  Reviewer@ACME.com ")).toBe("reviewer@acme.com");
  });

  it("accepts matching email and password", () => {
    expect(validateCredentials("reviewer@acme.com", "secret-pass")).toBe(true);
  });

  it("rejects wrong email", () => {
    expect(validateCredentials("other@acme.com", "secret-pass")).toBe(false);
  });

  it("rejects wrong password", () => {
    expect(validateCredentials("reviewer@acme.com", "wrong")).toBe(false);
  });

  it("uses APP_EMAIL from env", () => {
    expect(getConfiguredEmail()).toBe("reviewer@acme.com");
  });
});
