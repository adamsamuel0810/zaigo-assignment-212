import { describe, expect, it } from "vitest";
import { runParallelRules } from "@/lib/rules/parallel";
import {
  ParagraphMetadata,
  SlideMetadata,
  SlideType,
  TextMetadata,
} from "@/lib/types";

function para(text: string): ParagraphMetadata {
  return { level: 0, text, runs: [] };
}

function bodyShape(texts: string[]): TextMetadata {
  return {
    shape_id: "1",
    shape_name: "Content Placeholder 1",
    is_title: false,
    is_placeholder: true,
    placeholder_type: "OBJECT",
    position: { left_inches: 1, top_inches: 2, width_inches: 8, height_inches: 4 },
    paragraphs: texts.map(para),
    full_text: texts.join("\n"),
  };
}

function slideWith(shape: TextMetadata): SlideMetadata {
  return {
    slide_number: 1,
    slide_type: SlideType.Content,
    notes: "",
    title: null,
    confidentiality: null,
    texts: [shape],
    tables: [],
    charts: [],
    shapes: [],
    has_confidentiality: false,
    authors: [],
    contains_draft: false,
  };
}

function ruleIds(slide: SlideMetadata): string[] {
  return runParallelRules(slide)
    .filter((r) => !r.pass && r.finding)
    .map((r) => r.finding!.rule_id);
}

describe("BULLET_005 parallel structure", () => {
  it("flags bullets with mixed grammatical openings", () => {
    const slide = slideWith(
      bodyShape([
        "ACME conducted its annual review of the peer group",
        "We updated our peer screening criteria",
        "We also used AI to identify additional peers",
        "Goofy's current peers still meet the screening criteria",
        "None of the additional companies warrant inclusion",
      ]),
    );
    expect(ruleIds(slide)).toContain("BULLET_005");
  });

  it("does not flag a consistent verb-led list", () => {
    const slide = slideWith(
      bodyShape([
        "Reviewed the compensation peer group annually",
        "Updated the screening criteria for the new year",
        "Assessed the impact of recent M&A activity",
        "Removed peers that no longer fit the criteria",
      ]),
    );
    expect(ruleIds(slide)).not.toContain("BULLET_005");
  });

  it("does not flag a consistent noun-led list", () => {
    const slide = slideWith(
      bodyShape([
        "Revenue grew faster than the peer median",
        "Margins expanded across all business segments",
        "Headcount remained flat year over year",
      ]),
    );
    expect(ruleIds(slide)).not.toContain("BULLET_005");
  });

  it("does not flag a consistent pronoun-led list", () => {
    const slide = slideWith(
      bodyShape([
        "We reviewed the peer group",
        "We updated the criteria",
        "We assessed M&A activity",
      ]),
    );
    expect(ruleIds(slide)).not.toContain("BULLET_005");
  });

  it("ignores short lists below the minimum bullet count", () => {
    const slide = slideWith(
      bodyShape(["We did this", "None of that"]),
    );
    expect(ruleIds(slide)).not.toContain("BULLET_005");
  });
});
