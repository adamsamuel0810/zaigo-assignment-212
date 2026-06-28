import { describe, expect, it } from "vitest";
import { getFixOverlayPatches } from "@/lib/utils/fix-overlay";
import { SlideType } from "@/lib/types";

describe("getFixOverlayPatches", () => {
  it("creates a text patch when only one shape text changes", () => {
    const original = {
      slide_number: 1,
      slide_type: SlideType.Title,
      notes: "",
      title: {
        shape_id: "title",
        shape_name: "Title",
        is_title: true,
        position: {
          left_inches: 1,
          top_inches: 2,
          width_inches: 8,
          height_inches: 1,
        },
        paragraphs: [
          {
            level: 0,
            text: "Peer Group Assessment",
            runs: [
              { text: "Peer Group Assessment", font_size_pt: 24, bold: true },
            ],
          },
        ],
        full_text: "Peer Group Assessment",
      },
      texts: [
        {
          shape_id: "date",
          shape_name: "Date",
          is_title: false,
          position: {
            left_inches: 0.5,
            top_inches: 0.2,
            width_inches: 9,
            height_inches: 0.4,
          },
          paragraphs: [
            {
              level: 0,
              text: "May 11, 2026 – DRAFT 20260330",
              runs: [
                { text: "May 11, 2026 – ", font_size_pt: 10 },
                { text: "DRAFT", font_size_pt: 10, color: { hex: "#FF0000" } },
                { text: " 20260330", font_size_pt: 10 },
              ],
            },
          ],
          full_text: "May 11, 2026 – DRAFT 20260330",
        },
      ],
      tables: [],
      charts: [],
      shapes: [],
      has_confidentiality: false,
      authors: [],
      contains_draft: true,
    };

    const fixed = structuredClone(original);
    fixed.texts[0].full_text = "May 11, 2026 – 20260330";
    fixed.texts[0].paragraphs[0].text = "May 11, 2026 – 20260330";
    fixed.texts[0].paragraphs[0].runs = [
      { text: "May 11, 2026 – ", font_size_pt: 10 },
      { text: " 20260330", font_size_pt: 10 },
    ];
    fixed.contains_draft = false;

    const patches = getFixOverlayPatches(original, fixed);
    expect(patches).toHaveLength(1);
    expect(patches[0].type).toBe("text");
    if (patches[0].type === "text") {
      expect(patches[0].text.full_text).toBe("May 11, 2026 – 20260330");
      expect(patches[0].text.paragraphs[0].runs[0].font_size_pt).toBe(10);
    }
  });

  it("preserves title font styling when AI collapses multi-line title", () => {
    const original = {
      slide_number: 3,
      slide_type: SlideType.Content,
      notes: "",
      title: {
        shape_id: "title",
        shape_name: "Title",
        is_title: true,
        position: {
          left_inches: 0.5,
          top_inches: 0.3,
          width_inches: 9,
          height_inches: 1.2,
        },
        paragraphs: [
          {
            level: 0,
            text: "Line one of a long title",
            runs: [{ text: "Line one of a long title", font_size_pt: 24, bold: true }],
          },
          {
            level: 0,
            text: "Line two continues here",
            runs: [{ text: "Line two continues here", font_size_pt: 24, bold: true }],
          },
          {
            level: 0,
            text: "Line three more text",
            runs: [{ text: "Line three more text", font_size_pt: 24, bold: true }],
          },
          {
            level: 0,
            text: "Line four ends title",
            runs: [{ text: "Line four ends title", font_size_pt: 24, bold: true }],
          },
        ],
        full_text: "Line one\nLine two\nLine three\nLine four",
      },
      texts: [],
      tables: [],
      charts: [],
      shapes: [],
      has_confidentiality: false,
      authors: [],
      contains_draft: false,
    };

    const fixed = structuredClone(original);
    fixed.title!.paragraphs = [
      {
        level: 0,
        text: "Shortened title text",
        runs: [{ text: "Shortened title text" }],
      },
    ];
    fixed.title!.full_text = "Shortened title text";

    const patches = getFixOverlayPatches(original, fixed);
    expect(patches).toHaveLength(1);
    if (patches[0].type === "text") {
      expect(patches[0].text.paragraphs[0].runs[0].font_size_pt).toBe(24);
      expect(patches[0].text.paragraphs[0].runs[0].bold).toBe(true);
    }
  });

  it("preserves per-bullet styling when rewriting parallel bullets", () => {
    const original = {
      slide_number: 2,
      slide_type: SlideType.Content,
      notes: "",
      title: null,
      texts: [
        {
          shape_id: "body",
          shape_name: "Body",
          is_title: false,
          position: {
            left_inches: 0.5,
            top_inches: 1.5,
            width_inches: 9,
            height_inches: 4,
          },
          paragraphs: [
            {
              level: 0,
              text: "ACME conducted review",
              bullet_char: "▪",
              runs: [{ text: "ACME conducted review", font_size_pt: 16 }],
            },
            {
              level: 0,
              text: "We updated screening",
              bullet_char: "▪",
              runs: [{ text: "We updated screening", font_size_pt: 16 }],
            },
          ],
          full_text: "ACME conducted review\nWe updated screening",
        },
      ],
      tables: [],
      charts: [],
      shapes: [],
      has_confidentiality: false,
      authors: [],
      contains_draft: false,
    };

    const fixed = structuredClone(original);
    fixed.texts[0].paragraphs[0].text = "Conduct annual review";
    fixed.texts[0].paragraphs[0].runs[0].text = "Conduct annual review";
    fixed.texts[0].paragraphs[1].text = "Update peer screening";
    fixed.texts[0].paragraphs[1].runs[0].text = "Update peer screening";
    fixed.texts[0].full_text = "Conduct annual review\nUpdate peer screening";

    const patches = getFixOverlayPatches(original, fixed);
    expect(patches).toHaveLength(1);
    if (patches[0].type === "text") {
      expect(patches[0].text.paragraphs[0].bullet_char).toBe("▪");
      expect(patches[0].text.paragraphs[0].runs[0].font_size_pt).toBe(16);
      expect(patches[0].text.paragraphs[1].runs[0].text).toBe(
        "Update peer screening",
      );
    }
  });

  it("creates a cell patch with a wider mask than the equal-share cell box", () => {
    const table = {
      shape_id: "t1",
      shape_name: "Table",
      position: {
        left_inches: 0.5,
        top_inches: 1,
        width_inches: 6,
        height_inches: 3,
      },
      rows: 4,
      cols: 5,
      has_title: false,
      title_bold: false,
      cells: [
        {
          row: 3,
          col: 0,
          text: "Goofy Laboratories",
          font_size_pt: 10,
          bold: true,
          fill_hex: "#FFFFDB",
          is_merged: false,
        },
      ],
    };

    const original = {
      slide_number: 3,
      slide_type: SlideType.Content,
      notes: "",
      title: null,
      texts: [],
      tables: [structuredClone(table)],
      charts: [],
      shapes: [],
      has_confidentiality: false,
      authors: [],
      contains_draft: false,
    };

    const fixed = structuredClone(original);
    fixed.tables[0].cells[0].text = "Goofy";

    const patches = getFixOverlayPatches(original, fixed);
    expect(patches).toHaveLength(1);
    expect(patches[0].type).toBe("cell");
    if (patches[0].type === "cell") {
      expect(patches[0].text).toBe("Goofy");
      expect(patches[0].maskPosition.width_inches).toBeGreaterThan(
        patches[0].position.width_inches,
      );
    }
  });
});
