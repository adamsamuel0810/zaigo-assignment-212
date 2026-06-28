import {
  ParagraphMetadata,
  PositionMetadata,
  SlideMetadata,
  TableMetadata,
  TextMetadata,
  TextRunMetadata,
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

function paragraphHasContent(p: ParagraphMetadata): boolean {
  return Boolean(p.text.trim() || p.runs.some((r) => r.text.trim()));
}

function nonEmptyParagraphs(text: TextMetadata): ParagraphMetadata[] {
  return text.paragraphs.filter(paragraphHasContent);
}

function defaultFontSizePt(text: TextMetadata): number {
  if (text.is_title) return 24;
  return 16;
}

function styleRunFromParagraph(p: ParagraphMetadata): Partial<TextRunMetadata> {
  const run = p.runs.find((r) => r.text.trim()) ?? p.runs[0];
  if (!run) return {};
  const { text: _text, ...style } = run;
  return style;
}

/** Apply new text while keeping paragraph layout + run styling from the template. */
export function applyTextToParagraphTemplate(
  template: ParagraphMetadata,
  newText: string,
  fallbackStyle: Partial<TextRunMetadata> = {},
): ParagraphMetadata {
  const style = {
    ...fallbackStyle,
    ...styleRunFromParagraph(template),
    font_size_pt:
      styleRunFromParagraph(template).font_size_pt ??
      fallbackStyle.font_size_pt,
    font_family:
      styleRunFromParagraph(template).font_family ??
      fallbackStyle.font_family ??
      "Calibri",
    bold:
      styleRunFromParagraph(template).bold ?? fallbackStyle.bold ?? false,
  };

  return {
    ...template,
    text: newText,
    runs: newText.trim()
      ? [{ ...style, text: newText }]
      : [{ ...style, text: "" }],
  };
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
  const slots = originalText.paragraphs;
  const origContent = nonEmptyParagraphs(originalText);
  const fixedContent = nonEmptyParagraphs(fixed);
  const shapeStyle = dominantRunStyle(originalText);
  const fallbackStyle: Partial<TextRunMetadata> = {
    ...shapeStyle,
    font_size_pt: shapeStyle.font_size_pt ?? defaultFontSizePt(originalText),
    font_family: shapeStyle.font_family ?? "Calibri",
    bold: shapeStyle.bold ?? originalText.is_title,
  };

  if (origContent.length === 0) {
    const text = fixed.full_text.trim();
    return [
      {
        level: 0,
        text,
        runs: [{ text, ...fallbackStyle }],
      },
    ];
  }

  // Same number of content paragraphs — preserve each original paragraph's style.
  if (
    origContent.length === fixedContent.length &&
    origContent.length > 0
  ) {
    let fixedIndex = 0;
    return slots.map((slot) => {
      if (!paragraphHasContent(slot)) return slot;
      const merged = applyTextToParagraphTemplate(
        slot,
        fixedContent[fixedIndex]?.text ?? "",
        fallbackStyle,
      );
      fixedIndex += 1;
      return merged;
    });
  }

  // Title / block rewrite collapsed to one paragraph — use first original slot styling.
  if (fixedContent.length === 1) {
    const newText = fixedContent[0].text || fixed.full_text.trim();
    const template = origContent[0];
    return [applyTextToParagraphTemplate(template, newText, fallbackStyle)];
  }

  // More fixed lines than original content slots — map by index with first slot style.
  if (fixedContent.length > 0 && origContent.length > 0) {
    return fixedContent.map((fixedPara, index) =>
      applyTextToParagraphTemplate(
        origContent[Math.min(index, origContent.length - 1)],
        fixedPara.text,
        fallbackStyle,
      ),
    );
  }

  const combined = fixed.full_text.trim();
  return [
    applyTextToParagraphTemplate(origContent[0], combined, fallbackStyle),
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

function expandMaskPosition(
  position: PositionMetadata,
  scale: number,
  padPx = 2,
): PositionMetadata {
  const padIn = padPx / Math.max(scale, 1);
  return {
    left_inches: Math.max(0, position.left_inches - padIn),
    top_inches: Math.max(0, position.top_inches - padIn),
    width_inches: position.width_inches + padIn * 2,
    height_inches: position.height_inches + padIn * 2,
  };
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

export { expandMaskPosition };
