import { PositionMetadata, TableMetadata } from "@/lib/types";

export function getTableCellPosition(
  table: TableMetadata,
  row: number,
  col: number,
): PositionMetadata {
  const cellW = table.position.width_inches / Math.max(table.cols, 1);
  const cellH = table.position.height_inches / Math.max(table.rows, 1);
  return {
    left_inches: table.position.left_inches + col * cellW,
    top_inches: table.position.top_inches + row * cellH,
    width_inches: cellW,
    height_inches: cellH,
  };
}

export function getTableRowPosition(
  table: TableMetadata,
  row: number,
): PositionMetadata {
  const cellH = table.position.height_inches / Math.max(table.rows, 1);
  return {
    left_inches: table.position.left_inches,
    top_inches: table.position.top_inches + row * cellH,
    width_inches: table.position.width_inches,
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
