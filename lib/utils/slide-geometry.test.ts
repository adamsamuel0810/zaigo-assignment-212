import { describe, expect, it } from "vitest";
import {
  getTableCellMaskPosition,
  getTableCellPosition,
  tableCellFontSizePx,
} from "@/lib/utils/slide-geometry";
import { TableMetadata } from "@/lib/types";

function sampleTable(overrides: Partial<TableMetadata> = {}): TableMetadata {
  return {
    shape_id: "table-1",
    shape_name: "Table 1",
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
    cells: [],
    ...overrides,
  };
}

describe("getTableCellMaskPosition", () => {
  it("expands mask width beyond equal column share for long label text", () => {
    const table = sampleTable();
    const cell = getTableCellPosition(table, 3, 0);
    const mask = getTableCellMaskPosition(
      table,
      3,
      0,
      "Goofy Laboratories",
      10,
    );

    expect(mask.width_inches).toBeGreaterThan(cell.width_inches);
    expect(mask.left_inches).toBeLessThanOrEqual(cell.left_inches);
  });

  it("offsets grid below a table title band", () => {
    const table = sampleTable({
      has_title: true,
      title_text: "Goofy Current Compensation Peer Group",
      title_font_size_pt: 11,
    });

    const withoutTitle = getTableCellPosition(sampleTable(), 0, 0);
    const withTitle = getTableCellPosition(table, 0, 0);

    expect(withTitle.top_inches).toBeGreaterThan(withoutTitle.top_inches);
  });
});

describe("tableCellFontSizePx", () => {
  it("scales point sizes to slide pixels", () => {
    expect(tableCellFontSizePx(10, 96)).toBeCloseTo(13.33, 1);
  });
});
