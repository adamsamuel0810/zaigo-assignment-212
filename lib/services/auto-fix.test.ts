import { describe, expect, it } from "vitest";
import { applyAutoFix, canAutoFix, canPreviewFix } from "@/lib/services/auto-fix";
import { Finding, RuleCategory, Severity, Confidence, SlideType } from "@/lib/types";

function makeFinding(overrides: Partial<Finding>): Finding {
  return {
    id: "f1",
    rule_id: "TERM_001",
    slide_number: 1,
    title: "Test",
    description: "Test",
    category: RuleCategory.Terminology,
    severity: Severity.Warning,
    confidence: Confidence.High,
    expected_value: "Target",
    actual_value: "TGT",
    recommendation: "Fix it",
    accepted: true,
    rejected: false,
    source: "deterministic",
    ...overrides,
  };
}

const baseSlide = {
  slide_number: 1,
  slide_type: SlideType.Content,
  notes: "",
  texts: [
    {
      shape_id: "t1",
      shape_name: "Content",
      is_title: false,
      position: { left_inches: 1, top_inches: 2, width_inches: 8, height_inches: 4 },
      paragraphs: [
        {
          level: 0,
          text: "Use TGT peer group",
          runs: [{ text: "Use TGT peer group" }],
          bullet_char: "▪",
        },
      ],
      full_text: "Use TGT peer group",
    },
  ],
  tables: [],
  charts: [],
  shapes: [],
  has_confidentiality: false,
  authors: [],
  contains_draft: false,
};

describe("canAutoFix", () => {
  it("returns true for supported deterministic rules", () => {
    expect(canAutoFix("TERM_001")).toBe(true);
    expect(canAutoFix("TITLE_002")).toBe(true);
  });

  it("returns false for AI and writing-style rules handled separately", () => {
    expect(canAutoFix("AI_HEADLINE_QUALITY")).toBe(false);
    expect(canAutoFix("BULLET_005")).toBe(false);
  });
});

describe("canPreviewFix", () => {
  it("includes deterministic and AI-assisted rules", () => {
    expect(canPreviewFix("TERM_001")).toBe(true);
    expect(canPreviewFix("BULLET_005")).toBe(true);
    expect(canPreviewFix("AI_PARALLEL_GRAMMAR")).toBe(true);
  });
});

describe("applyAutoFix", () => {
  it("replaces TGT with Target", () => {
    const result = applyAutoFix(baseSlide, makeFinding({ rule_id: "TERM_001" }));
    expect(result.fixable).toBe(true);
    expect(result.slide.texts[0].full_text).toContain("Target");
    expect(result.slide.texts[0].full_text).not.toContain("TGT");
  });

  it("sets title font size to 24pt", () => {
    const slide = {
      ...baseSlide,
      title: {
        shape_id: "title",
        shape_name: "Title",
        is_title: true,
        position: { left_inches: 1, top_inches: 0.5, width_inches: 8, height_inches: 1 },
        paragraphs: [
          {
            level: 0,
            text: "Big title",
            runs: [{ text: "Big title", font_size_pt: 18 }],
          },
        ],
        full_text: "Big title",
      },
    };
    const result = applyAutoFix(
      slide,
      makeFinding({ rule_id: "TITLE_002", actual_value: "18pt", expected_value: "24pt" }),
    );
    expect(result.slide.title?.paragraphs[0].runs[0].font_size_pt).toBe(24);
  });
});
