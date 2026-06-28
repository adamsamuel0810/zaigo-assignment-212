import { describe, expect, it } from "vitest";
import { SlideType } from "@/lib/types";
import { buildTextPatches } from "@/lib/utils/text-patches";
import { rewriteTitleText } from "@/lib/utils/title-fix";

describe("buildTextPatches", () => {
  it("emits a patch when title text changes", () => {
    const original = {
      slide_number: 3,
      slide_type: SlideType.Content,
      title: {
        shape_id: "42",
        shape_name: "Title",
        is_title: true,
        full_text: "Long title that spans many lines",
        position: {
          left_inches: 0,
          top_inches: 0,
          width_inches: 9,
          height_inches: 1,
        },
        paragraphs: [
          { level: 0, text: "Long title", runs: [{ text: "Long title" }] },
          { level: 0, text: "that spans many lines", runs: [{ text: "that spans many lines" }] },
        ],
      },
      texts: [],
      tables: [],
      charts: [],
      shapes: [],
    };

    const fixed = structuredClone(original);
    rewriteTitleText(fixed.title!, "Short title");

    const patches = buildTextPatches(3, original, fixed);
    expect(patches).toHaveLength(1);
    expect(patches[0]).toMatchObject({
      slide_number: 3,
      shape_id: "42",
      paragraphs: ["Short title"],
    });
  });
});
