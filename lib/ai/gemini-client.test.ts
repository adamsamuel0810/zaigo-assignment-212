import { describe, expect, it } from "vitest";
import {
  isGeminiQuotaError,
  parseGeminiRetryDelayMs,
  resolveGeminiModelCandidates,
} from "@/lib/ai/gemini-client";

describe("gemini client helpers", () => {
  it("dedupes model candidates with primary first", () => {
    expect(resolveGeminiModelCandidates("gemini-2.5-flash-lite")).toEqual([
      "gemini-2.5-flash-lite",
      "gemini-2.5-flash",
    ]);
    expect(resolveGeminiModelCandidates("gemini-2.0-flash")).toEqual([
      "gemini-2.0-flash",
      "gemini-2.5-flash-lite",
      "gemini-2.5-flash",
    ]);
  });

  it("detects quota errors", () => {
    expect(isGeminiQuotaError("[429 Too Many Requests] quota exceeded")).toBe(
      true,
    );
    expect(isGeminiQuotaError("invalid api key")).toBe(false);
  });

  it("parses retry delay from error text", () => {
    expect(parseGeminiRetryDelayMs("Please retry in 1.768470231s.")).toBe(1769);
    expect(parseGeminiRetryDelayMs('"retryDelay":"3s"')).toBe(3000);
  });
});
