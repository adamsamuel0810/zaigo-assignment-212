import { PositionMetadata, TableMetadata } from "@/lib/types";

/** Vertical space reserved for an optional table title band inside the shape box. */
function tableTitleBandInches(table: TableMetadata): number {
  if (!table.has_title || !table.title_text?.trim()) return 0;
  const titlePt = table.title_font_size_pt ?? 10;
  return Math.min(table.position.height_inches * 0.14, (titlePt / 72) * 1.6 + 0.08);
}

function tableGridBounds(table: TableMetadata): PositionMetadata {
  const titleBand = tableTitleBandInches(table);
  return {
    left_inches: table.position.left_inches,
    top_inches: table.position.top_inches + titleBand,
    width_inches: table.position.width_inches,
    height_inches: Math.max(table.position.height_inches - titleBand, 0.1),
  };
}

export function getTableCellPosition(
  table: TableMetadata,
  row: number,
  col: number,
): PositionMetadata {
  const grid = tableGridBounds(table);
  const cellW = grid.width_inches / Math.max(table.cols, 1);
  const cellH = grid.height_inches / Math.max(table.rows, 1);
  return {
    left_inches: grid.left_inches + col * cellW,
    top_inches: grid.top_inches + row * cellH,
    width_inches: cellW,
    height_inches: cellH,
  };
}

/** Opaque mask region for a table cell text fix on top of a PNG preview. */
export function getTableCellMaskPosition(
  table: TableMetadata,
  row: number,
  col: number,
  originalText: string,
  fontSizePt?: number | null,
): PositionMetadata {
  const cell = getTableCellPosition(table, row, col);
  const bleedIn = 3 / 96;

  let width = cell.width_inches;
  const trimmed = originalText.trim();
  if (trimmed && fontSizePt) {
    const estTextWidth = (trimmed.length * fontSizePt * 0.52) / 72;
    width = Math.max(width, estTextWidth + bleedIn);
  }

  const maxWidth =
    table.position.left_inches +
    table.position.width_inches -
    cell.left_inches;
  width = Math.min(width + bleedIn, maxWidth + bleedIn);

  return {
    left_inches: cell.left_inches - bleedIn,
    top_inches: cell.top_inches - bleedIn,
    width_inches: width + bleedIn,
    height_inches: cell.height_inches + bleedIn * 2,
  };
}

export function tableCellFontSizePx(
  fontSizePt: number | null | undefined,
  scale: number,
): number {
  if (!fontSizePt) return Math.max(5, 7 * (scale / 80));
  return Math.max(5, (fontSizePt / 72) * scale);
}

export function getTableRowPosition(
  table: TableMetadata,
  row: number,
): PositionMetadata {
  const grid = tableGridBounds(table);
  const cellH = grid.height_inches / Math.max(table.rows, 1);
  return {
    left_inches: grid.left_inches,
    top_inches: grid.top_inches + row * cellH,
    width_inches: grid.width_inches,
    height_inches: cellH,
  };
}

export function getSubstringPosition(
  container: PositionMetadata,
  fullText: string,
  matchText: string,
): PositionMetadata {
  const normalized = fullText.toLowerCase();
  const needle = matchText.toLowerCase();
  let idx = normalized.indexOf(needle);

  if (idx < 0) {
    const wordMatch = matchText.match(/[\w%]+/gi);
    if (wordMatch) {
      for (const word of wordMatch) {
        idx = normalized.indexOf(word.toLowerCase());
        if (idx >= 0) break;
      }
    }
  }

  if (idx < 0) return container;

  const matchedLength = Math.min(matchText.length, fullText.length - idx);
  const startRatio = idx / Math.max(fullText.length, 1);
  const widthRatio = matchedLength / Math.max(fullText.length, 1);
  const padding = container.height_inches * 0.12;

  return {
    left_inches: container.left_inches + container.width_inches * startRatio,
    top_inches: container.top_inches + padding,
    width_inches: Math.max(container.width_inches * widthRatio, 0.25),
    height_inches: Math.max(container.height_inches - padding * 2, 0.12),
  };
}
