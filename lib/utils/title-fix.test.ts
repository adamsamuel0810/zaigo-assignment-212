import { describe, expect, it } from "vitest";
import { estimateTitleLines } from "@/lib/rules/helpers";
import { SlideMetadata, SlideType } from "@/lib/types";
import {
  rewriteTitleText,
  shortenTitleToLineLimit,
} from "@/lib/utils/title-fix";

function makeSlide(titleText: string, widthInches = 9): SlideMetadata {
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
        width_inches: widthInches,
        height_inches: 1.2,
      },
      paragraphs: titleText.split("\n").map((line) => ({
        level: 0,
        text: line,
        runs: [{ text: line, font_size_pt: 24 }],
      })),
    },
    texts: [],
    tables: [],
    charts: [],
    shapes: [],
  };
}

describe("title fix helpers", () => {
  it("collapses multi-paragraph titles into one paragraph", () => {
    const title = makeSlide("Line one\nLine two").title!;
    rewriteTitleText(title, "Short title");
    expect(title.paragraphs).toHaveLength(1);
    expect(title.full_text).toBe("Short title");
  });

  it("shortens an overlong title to three lines or fewer", () => {
    const longTitle =
      "Each year, ACME reviews Goofy's Compensation Peer Group to ensure the best size, business, and strategic fit possible. Given the analytic work conducted by ACME in prior years, we took a more cursory approach this year, leveraging AI";
    const slide = makeSlide(longTitle);
    expect(estimateTitleLines(slide)).toBeGreaterThan(3);

    const shortened = shortenTitleToLineLimit(slide, 3);
    expect(shortened).toBeTruthy();
    rewriteTitleText(slide.title!, shortened!);
    expect(estimateTitleLines(slide)).toBeLessThanOrEqual(3);
  });
});
