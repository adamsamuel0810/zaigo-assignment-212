import { describe, expect, it } from "vitest";
import { isAcmeColor, fontMatchesCalibri, hexMatches } from "@/lib/rules/constants";

describe("ACME palette", () => {
  it("recognizes brand colors", () => {
    expect(isAcmeColor("#006EBE")).toBe(true);
    expect(isAcmeColor("#F2F2F2")).toBe(true);
    expect(isAcmeColor("#FF00FF")).toBe(false);
  });

  it("matches hex case-insensitively", () => {
    expect(hexMatches("#006EBE", "#006ebe")).toBe(true);
  });
});

describe("font matching", () => {
  it("accepts Calibri variants", () => {
    expect(fontMatchesCalibri("Calibri")).toBe(true);
    expect(fontMatchesCalibri("Calibri Light")).toBe(true);
    expect(fontMatchesCalibri("Arial")).toBe(false);
  });
});
