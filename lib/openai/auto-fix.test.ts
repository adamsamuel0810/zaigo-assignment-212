import { describe, expect, it } from "vitest";
import { estimateTitleLines } from "@/lib/rules/helpers";
import { Finding, SlideMetadata, SlideType } from "@/lib/types";
import { applyAiFixResponse } from "@/lib/openai/auto-fix";
import {
  isTitleEllipsisTruncation,
  rewriteTitleText,
  shortenTitleToLineLimit,
} from "@/lib/utils/title-fix";

function makeSlide(titleText: string): SlideMetadata {
  return {
    slide_number: 3,
    slide_type: SlideType.Content,
    title: {
      shape_id: "title-1",
      shape_name: "Title",
      is_title: true,
      full_text: titleText,
      position: {
        left_inches: 0.5,
        top_inches: 0.3,
        width_inches: 9,
        height_inches: 1.2,
      },
      paragraphs: [
        {
          level: 0,
          text: titleText,
          runs: [{ text: titleText, font_size_pt: 24 }],
        },
      ],
    },
    texts: [],
    tables: [],
    charts: [],
    shapes: [],
  };
}

function makeFinding(): Finding {
  return {
    id: "f1",
    slide_number: 3,
    rule_id: "TITLE_004",
    severity: "warning",
    title: "Title exceeds three lines",
    description: "Title spans 4 lines",
    expected_value: "≤ 3 lines",
    actual_value: "4 lines",
    recommendation: "Shorten the title",
    accepted: true,
    rejected: false,
    confidence: 1,
  };
}

describe("TITLE_004 AI fix helpers", () => {
  const longTitle =
    "Each year, ACME reviews Goofy's Compensation Peer Group to ensure the best size, business, and strategic fit possible. Given the analytic work conducted by ACME in prior years, we took a more cursory approach this year, leveraging AI";

  it("detects ellipsis truncation", () => {
    expect(
      isTitleEllipsisTruncation(
        longTitle,
        `${longTitle.slice(0, 120).trim()}…`,
      ),
    ).toBe(true);
    expect(
      isTitleEllipsisTruncation(
        longTitle,
        "ACME reviews Goofy's peer group annually, using a streamlined approach this year.",
      ),
    ).toBe(false);
  });

  it("rejects ellipsis-only title rewrites for TITLE_004", () => {
    const slide = makeSlide(longTitle);
    const truncated = `${longTitle.slice(0, 120).trim()}…`;
    const result = applyAiFixResponse(
      slide,
      {
        title_text: truncated,
        applied_summary: ["Shortened title"],
      },
      makeFinding(),
    );

    expect(result.fixable).toBe(false);
    expect(result.slide.title?.full_text).toBe(longTitle);
  });

  it("accepts a complete shorter rewrite for TITLE_004", () => {
    const slide = makeSlide(longTitle);
    const rewritten =
      "ACME reviews Goofy's Compensation Peer Group annually to confirm size, business, and strategic fit, using a streamlined approach this year.";

    const result = applyAiFixResponse(
      slide,
      {
        title_text: rewritten,
        applied_summary: ["Rewrote title to fit within three lines"],
      },
      makeFinding(),
    );

    expect(result.fixable).toBe(true);
    expect(result.slide.title?.full_text).toBe(rewritten);
    expect(estimateTitleLines(result.slide)).toBeLessThanOrEqual(3);
  });

  it("legacy shortenTitleToLineLimit still fits line budget", () => {
    const slide = makeSlide(longTitle);
    const shortened = shortenTitleToLineLimit(slide, 3);
    expect(shortened).toBeTruthy();
    rewriteTitleText(slide.title!, shortened!);
    expect(estimateTitleLines(slide)).toBeLessThanOrEqual(3);
  });
});
