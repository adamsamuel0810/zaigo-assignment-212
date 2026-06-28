import { describe, expect, it } from "vitest";
import { SlideType } from "@/lib/types";
import {
  collectSavedTextPatches,
  patchesFromSavedFix,
  type SavedAiFix,
} from "@/lib/utils/saved-ai-fixes";
import { rewriteTitleText } from "@/lib/utils/title-fix";

function makeSavedFix(
  slideNumber: number,
  shapeId: string,
  originalText: string,
  fixedText: string,
): SavedAiFix {
  const base = {
    slide_number: slideNumber,
    slide_type: SlideType.Content,
    texts: [],
    tables: [],
    charts: [],
    shapes: [],
  };

  const originalSlide = {
    ...base,
    title: {
      shape_id: shapeId,
      shape_name: "Title",
      is_title: true,
      full_text: originalText,
      position: {
        left_inches: 0,
        top_inches: 0,
        width_inches: 9,
        height_inches: 1,
      },
      paragraphs: [{ level: 0, text: originalText, runs: [{ text: originalText }] }],
    },
  };

  const fixedSlide = structuredClone(originalSlide);
  rewriteTitleText(fixedSlide.title!, fixedText);

  return {
    findingId: `finding-${slideNumber}`,
    slideNumber,
    ruleId: "TITLE_004",
    title: "Title fix",
    originalSlide,
    fixedSlide,
    applied: ["Shortened title"],
    savedAt: Date.now(),
  };
}

describe("saved AI fixes", () => {
  it("merges patches from multiple saved fixes on different slides", () => {
    const patches = collectSavedTextPatches([
      makeSavedFix(2, "10", "Original slide 2", "Fixed slide 2"),
      makeSavedFix(3, "20", "Original slide 3", "Fixed slide 3"),
    ]);

    expect(patches).toHaveLength(2);
    expect(patches.map((p) => p.slide_number).sort()).toEqual([2, 3]);
  });

  it("later save wins for the same shape", () => {
    const first = makeSavedFix(2, "10", "Original", "First fix");
    const second = makeSavedFix(2, "10", "Original", "Second fix");
    second.findingId = "finding-2b";

    const patches = collectSavedTextPatches([first, second]);
    expect(patches).toHaveLength(1);
    expect(patchesFromSavedFix(second)[0].paragraphs[0]).toBe("Second fix");
  });
});
