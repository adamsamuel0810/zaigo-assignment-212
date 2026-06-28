import { describe, expect, it } from "vitest";
import { humanizeError } from "@/lib/utils/user-facing-errors";

describe("humanizeError", () => {
  it("maps region restriction to a clear warning", () => {
    const result = humanizeError(
      "[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-lite:generateContent: [400 Bad Request] User location is not supported for the API use.",
      "auto-fix",
    );
    expect(result.title).toBe("AI service unavailable in this region");
    expect(result.variant).toBe("warning");
    expect(result.message).not.toContain("generativelanguage");
  });

  it("maps quota errors", () => {
    const result = humanizeError("429 Too Many Requests: quota exceeded");
    expect(result.title).toBe("AI capacity limit reached");
    expect(result.variant).toBe("warning");
  });

  it("maps timeout errors", () => {
    const result = humanizeError("FUNCTION_INVOCATION_TIMEOUT", "auto-fix");
    expect(result.title).toBe("Preview timed out");
  });
});
