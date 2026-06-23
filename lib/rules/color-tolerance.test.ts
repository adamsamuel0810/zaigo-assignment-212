import { describe, expect, it } from "vitest";
import { colorClose, isAcmeColor } from "@/lib/rules/constants";

describe("color tolerance", () => {
  it("treats near-palette colors as ACME", () => {
    expect(isAcmeColor("#006CBD")).toBe(true); // ~ #006EBE
    expect(isAcmeColor("#FFFFDC")).toBe(true); // ~ #FFFFDB
    expect(isAcmeColor("#FF0000")).toBe(true); // ~ #E80000 (emphasis red)
  });

  it("flags genuinely foreign colors", () => {
    expect(isAcmeColor("#00FF00")).toBe(false); // saturated green far from palette
    expect(isAcmeColor("#FF00FF")).toBe(false); // magenta, not in palette
    expect(isAcmeColor("#654321")).toBe(false); // brown, not in palette
  });

  it("colorClose matches brand blue within tolerance", () => {
    expect(colorClose("#006EBE", "#006CBD")).toBe(true);
    expect(colorClose("#006EBE", "#FFD7D7")).toBe(false);
  });
});
