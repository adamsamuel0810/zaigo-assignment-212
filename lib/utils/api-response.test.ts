import { describe, expect, it } from "vitest";
import { friendlyHttpError } from "@/lib/utils/api-response";

describe("friendlyHttpError", () => {
  it("maps Vercel timeout text to a user-friendly message", () => {
    const msg = friendlyHttpError(
      504,
      "An error occurred with your deployment\n\nFUNCTION_INVOCATION_TIMEOUT",
    );
    expect(msg).toContain("timed out");
    expect(msg).not.toContain("Unexpected token");
  });

  it("maps deployment error without status 504", () => {
    const msg = friendlyHttpError(
      500,
      "An error occurred with your deployment",
    );
    expect(msg).toContain("timed out");
  });
});
