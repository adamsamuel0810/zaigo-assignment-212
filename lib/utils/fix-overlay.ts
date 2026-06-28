import {
  ParagraphMetadata,
  PositionMetadata,
  SlideMetadata,
  TableMetadata,
  TextMetadata,
} from "@/lib/types";
import { dominantRunStyle } from "@/components/slides/slide-render-utils";
import {
  getTableCellMaskPosition,
  getTableCellPosition,
} from "@/lib/utils/slide-geometry";
import { normalizeHex } from "@/lib/rules/constants";

export interface TextFixPatch {
  type: "text";
  id: string;
  text: TextMetadata;
  fontScaleMultiplier: number;
  maskColor: string;
}

export interface CellFixPatch {
  type: "cell";
  id: string;
  /** Where corrected text is drawn (cell bounds). */
  position: PositionMetadata;
  /** Opaque cover that hides original PNG text before drawing the fix. */
  maskPosition: PositionMetadata;
  text: string;
  fillHex?: string | null;
  fontSizePt?: number | null;
  bold?: boolean | null;
  fontColorHex?: string | null;
  alignment?: string | null;
  maskColor: string;
}

export interface FillFixPatch {
  type: "fill";
  id: string;
  position: PositionMetadata;
  color: string;
}

export type FixOverlayPatch = TextFixPatch | CellFixPatch | FillFixPatch;

function collectTextShapes(slide: SlideMetadata): TextMetadata[] {
  const shapes: TextMetadata[] = [];
  if (slide.title) shapes.push(slide.title);
  shapes.push(...slide.texts);
  if (slide.confidentiality) shapes.push(slide.confidentiality);
  return shapes;
}

function mergeFixedTextWithOriginalStyle(
  original: TextMetadata,
  fixed: TextMetadata,
): TextMetadata {
  const mergedParagraphs = mergeParagraphs(original, fixed);
  return {
    ...original,
    full_text: fixed.full_text,
    paragraphs: mergedParagraphs,
  };
}

function mergeParagraphs(
  originalText: TextMetadata,
  fixed: TextMetadata,
): ParagraphMetadata[] {
  const original = originalText.paragraphs;
  const fixedParagraphs = fixed.paragraphs;
  const fixedFullText = fixed.full_text;

  if (
    original.length > 0 &&
    original.length === fixedParagraphs.length &&
    original.every((p, i) => p.runs.length === fixedParagraphs[i].runs.length)
  ) {
    return original.map((origPara, i) => ({
      ...origPara,
      text: fixedParagraphs[i].text,
      bullet_char: fixedParagraphs[i].bullet_char ?? origPara.bullet_char,
      runs: origPara.runs
        .map((origRun, j) => ({
          ...origRun,
          text: fixedParagraphs[i].runs[j]?.text ?? "",
        }))
        .filter((run) => run.text.length > 0),
    }));
  }

  const style = dominantRunStyle(originalText);
  return [
    {
      level: 0,
      text: fixedFullText,
      runs: [{ text: fixedFullText, ...style }],
    },
  ];
}

function fontScaleMultiplierFor(
  slide: SlideMetadata,
  text: TextMetadata,
): number {
  if (slide.confidentiality?.shape_id === text.shape_id) return 0.7;
  if (text.is_title || slide.title?.shape_id === text.shape_id) return 1;
  return 1;
}

function maskColorFor(text: TextMetadata): string {
  return toCssColor(text.fill_hex) ?? "#FFFFFF";
}

function toCssColor(hex?: string | null): string | undefined {
  if (!hex) return undefined;
  const h = hex.replace(/^#/, "");
  if (h.length === 6) return `#${h}`;
  if (h.length === 8) return `#${h.slice(2)}`;
  return hex.startsWith("#") ? hex : `#${hex}`;
}

function tableById(slide: SlideMetadata): Map<string, TableMetadata> {
  return new Map(slide.tables.map((t) => [t.shape_id, t]));
}

export function getFixOverlayPatches(
  original: SlideMetadata,
  fixed: SlideMetadata,
): FixOverlayPatch[] {
  const patches: FixOverlayPatch[] = [];

  const fixedTexts = new Map(
    collectTextShapes(fixed).map((t) => [t.shape_id, t]),
  );

  for (const origText of collectTextShapes(original)) {
    const fixedText = fixedTexts.get(origText.shape_id);
    if (!fixedText) continue;
    if (origText.full_text.trim() === fixedText.full_text.trim()) continue;

    patches.push({
      type: "text",
      id: `text-${origText.shape_id}`,
      text: mergeFixedTextWithOriginalStyle(origText, fixedText),
      fontScaleMultiplier: fontScaleMultiplierFor(original, origText),
      maskColor: maskColorFor(origText),
    });
  }

  const origTables = tableById(original);
  const fixedTables = tableById(fixed);

  for (const [tableId, origTable] of origTables) {
    const fixedTable = fixedTables.get(tableId);
    if (!fixedTable) continue;

    const fixedCellMap = new Map(
      fixedTable.cells.map((c) => [`${c.row},${c.col}`, c]),
    );

    for (const origCell of origTable.cells) {
      const fixedCell = fixedCellMap.get(`${origCell.row},${origCell.col}`);
      if (!fixedCell) continue;

      const textChanged = origCell.text.trim() !== fixedCell.text.trim();
      const fillChanged =
        normalizeHex(origCell.fill_hex) !== normalizeHex(fixedCell.fill_hex);

      if (textChanged) {
        if (origCell.is_merged && !origCell.text.trim()) continue;

        const position = getTableCellPosition(
          origTable,
          origCell.row,
          origCell.col,
        );
        const fontSizePt = origCell.font_size_pt ?? fixedCell.font_size_pt;
        patches.push({
          type: "cell",
          id: `cell-${tableId}-${origCell.row}-${origCell.col}`,
          position,
          maskPosition: getTableCellMaskPosition(
            origTable,
            origCell.row,
            origCell.col,
            origCell.text,
            fontSizePt,
          ),
          text: fixedCell.text,
          fillHex: fixedCell.fill_hex ?? origCell.fill_hex,
          fontSizePt,
          bold: origCell.bold ?? fixedCell.bold,
          fontColorHex: origCell.font_color_hex ?? fixedCell.font_color_hex,
          alignment: origCell.alignment ?? fixedCell.alignment,
          maskColor:
            toCssColor(fixedCell.fill_hex ?? origCell.fill_hex) ?? "#FFFFFF",
        });
      } else if (fillChanged && fixedCell.fill_hex) {
        patches.push({
          type: "fill",
          id: `fill-${tableId}-${origCell.row}-${origCell.col}`,
          position: getTableCellPosition(origTable, origCell.row, origCell.col),
          color: fixedCell.fill_hex,
        });
      }
    }
  }

  for (const origShape of original.shapes) {
    const fixedShape = fixed.shapes.find(
      (s) => s.shape_id === origShape.shape_id,
    );
    if (!fixedShape?.fill_hex || !origShape.fill_hex) continue;
    if (
      normalizeHex(origShape.fill_hex) === normalizeHex(fixedShape.fill_hex)
    ) {
      continue;
    }
    patches.push({
      type: "fill",
      id: `shape-fill-${origShape.shape_id}`,
      position: origShape.position,
      color: fixedShape.fill_hex,
    });
  }

  return patches;
}
