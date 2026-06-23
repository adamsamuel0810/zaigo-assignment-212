import {
  Finding,
  HighlightRegion,
  PositionMetadata,
  RuleCategory,
  SlideMetadata,
  TextMetadata,
} from "@/lib/types";
import {
  getSubstringPosition,
  getTableCellPosition,
  getTableRowPosition,
} from "@/lib/utils/slide-geometry";

export type { HighlightRegion };

function parseActualSegments(actualValue: string): string[] {
  return actualValue
    .split(/;\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 200);
}

function textMatches(segment: string, text: string): boolean {
  const a = segment.toLowerCase().trim();
  const b = text.toLowerCase().trim();
  if (!a || !b) return false;
  return b.includes(a) || a.includes(b);
}

function findInTextShape(
  shape: TextMetadata,
  segments: string[],
): HighlightRegion[] {
  const regions: HighlightRegion[] = [];

  for (const paragraph of shape.paragraphs) {
    const paraText = paragraph.text.trim();
    if (!paraText) continue;

    for (const segment of segments) {
      if (!textMatches(segment, paraText)) continue;

      const position =
        paraText.toLowerCase() === segment.toLowerCase()
          ? shape.position
          : getSubstringPosition(shape.position, paraText, segment);

      regions.push({
        position,
        label: segment.length > 40 ? `${segment.slice(0, 40)}…` : segment,
      });
    }
  }

  return regions;
}

function findInTables(
  slide: SlideMetadata,
  shapeId: string | undefined,
  segments: string[],
): HighlightRegion[] {
  const regions: HighlightRegion[] = [];
  const tables = shapeId
    ? slide.tables.filter((t) => t.shape_id === shapeId)
    : slide.tables;

  for (const table of tables) {
    for (const cell of table.cells) {
      const cellText = cell.text.trim();
      if (!cellText) continue;

      for (const segment of segments) {
        if (!textMatches(segment, cellText)) continue;

        const cellPos = getTableCellPosition(table, cell.row, cell.col);
        const position =
          cellText.toLowerCase() === segment.toLowerCase()
            ? cellPos
            : getSubstringPosition(cellPos, cellText, segment);

        regions.push({
          position,
          label: cellText,
        });
      }
    }
  }

  return regions;
}

function findByRulePattern(
  slide: SlideMetadata,
  finding: Finding,
): HighlightRegion[] {
  const regions: HighlightRegion[] = [];

  if (finding.rule_id === "TABLE_003") {
    for (const table of slide.tables) {
      for (const cell of table.cells) {
        const matches = [...cell.text.matchAll(/\b(\d+(?:st|nd|rd|th)?\s+)?percentile\b/gi)];
        if (matches.length === 0) continue;
        const cellPos = getTableCellPosition(table, cell.row, cell.col);
        for (const m of matches) {
          regions.push({
            position: getSubstringPosition(cellPos, cell.text, m[0]),
            label: `“${m[0]}” → %ile`,
          });
        }
      }
    }
  }

  if (finding.rule_id === "TABLE_001") {
    for (const table of slide.tables) {
      for (const cell of table.cells.filter((c) => c.row === 0)) {
        if (cell.fill_hex && cell.fill_hex.toUpperCase() !== "#006EBE") {
          regions.push({
            position: getTableCellPosition(table, cell.row, cell.col),
            label: `Header fill ${cell.fill_hex}`,
          });
        }
      }
    }
  }

  if (finding.rule_id === "TABLE_002" || finding.rule_id === "TABLE_004") {
    const rowMatch = finding.description.match(/Row (\d+)/i);
    if (rowMatch) {
      const row = parseInt(rowMatch[1], 10) - 1;
      for (const table of slide.tables) {
        if (row >= 0 && row < table.rows) {
          regions.push({
            position: getTableRowPosition(table, row),
            label: finding.description,
          });
        }
      }
    }
  }

  if (finding.rule_id === "TABLE_006") {
    for (const table of slide.tables) {
      for (const cell of table.cells.filter((c) => c.row === 0)) {
        if (/\bincumbent\b/i.test(cell.text)) {
          regions.push({
            position: getTableCellPosition(table, cell.row, cell.col),
            label: `“${cell.text.trim()}” → Executive`,
          });
        }
      }
    }
  }

  if (finding.rule_id === "TERM_002") {
    for (const table of slide.tables) {
      for (const cell of table.cells.filter((c) => c.row === 0)) {
        if (/^company name$/i.test(cell.text.trim())) {
          regions.push({
            position: getTableCellPosition(table, cell.row, cell.col),
            label: `“Company Name” → Company`,
          });
        }
      }
    }
  }

  if (finding.rule_id === "BULLET_002") {
    for (const text of slide.texts) {
      for (const p of text.paragraphs) {
        if (p.text.trim() && /[.!?:;]$/.test(p.text.trim())) {
          regions.push({
            position: getSubstringPosition(
              text.position,
              p.text,
              p.text.trim().slice(-1),
            ),
            label: "Remove punctuation",
          });
        }
      }
    }
  }

  if (finding.rule_id === "TITLE_003") {
    if (slide.title) {
      const t = slide.title.full_text.trim();
      const last = t.slice(-1);
      if (/[.!?:;]/.test(last)) {
        regions.push({
          position: getSubstringPosition(slide.title.position, t, last),
          label: `Remove “${last}”`,
        });
      }
    }
  }

  return regions;
}

function dedupeRegions(regions: HighlightRegion[]): HighlightRegion[] {
  const seen = new Set<string>();
  return regions.filter((r) => {
    const key = [
      r.label,
      r.position.left_inches.toFixed(3),
      r.position.top_inches.toFixed(3),
      r.position.width_inches.toFixed(3),
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveFallbackPosition(
  slide: SlideMetadata,
  finding: Finding,
  slideWidthInches: number,
  slideHeightInches: number,
): PositionMetadata | null {
  if (finding.highlight) return finding.highlight;

  if (finding.shape_id) {
    if (slide.title?.shape_id === finding.shape_id) return slide.title.position;
    const text = slide.texts.find((t) => t.shape_id === finding.shape_id);
    if (text) return text.position;
    const table = slide.tables.find((t) => t.shape_id === finding.shape_id);
    if (table) return table.position;
  }

  if (slide.title && finding.category === RuleCategory.Title) {
    return slide.title.position;
  }

  if (finding.category === RuleCategory.Footer) {
    return {
      left_inches: 0.5,
      top_inches: slideHeightInches - 0.6,
      width_inches: slideWidthInches - 1,
      height_inches: 0.4,
    };
  }

  return slide.title?.position ?? null;
}

/** Resolve precise highlight regions (cells, words, rows) for a finding. */
export function resolveFindingHighlights(
  slide: SlideMetadata,
  finding: Finding,
  slideWidthInches: number,
  slideHeightInches: number,
): HighlightRegion[] {
  if (finding.highlight_regions && finding.highlight_regions.length > 0) {
    return finding.highlight_regions;
  }

  const segments = parseActualSegments(finding.actual_value);
  let regions: HighlightRegion[] = [];

  if (segments.length > 0) {
    regions.push(...findInTables(slide, finding.shape_id, segments));

    const textShapes = [
      slide.title,
      slide.confidentiality,
      ...slide.texts,
    ].filter(Boolean) as TextMetadata[];

    for (const shape of textShapes) {
      if (finding.shape_id && shape.shape_id !== finding.shape_id) continue;
      regions.push(...findInTextShape(shape, segments));
    }
  }

  regions.push(...findByRulePattern(slide, finding));
  regions = dedupeRegions(regions);

  if (regions.length > 0) return regions;

  const fallback = resolveFallbackPosition(
    slide,
    finding,
    slideWidthInches,
    slideHeightInches,
  );
  if (fallback) {
    return [
      {
        position: fallback,
        label: finding.actual_value.slice(0, 50) || finding.title,
      },
    ];
  }

  return [];
}

export function resolveFindingPosition(
  slide: SlideMetadata,
  finding: Finding,
  slideWidthInches: number,
  slideHeightInches: number,
): PositionMetadata | null {
  return (
    resolveFindingHighlights(slide, finding, slideWidthInches, slideHeightInches)[0]
      ?.position ?? null
  );
}

export function getFindingHighlightLabel(finding: Finding): string {
  return finding.title;
}

/** Build cell-level highlight regions for table rule findings. */
export function buildTableCellHighlights(
  table: import("@/lib/types").TableMetadata,
  cells: import("@/lib/types").TableCellMetadata[],
  labelFn: (cellText: string) => string,
  substringFn?: (cellText: string) => string | null,
): HighlightRegion[] {
  return cells.map((cell) => {
    const cellPos = getTableCellPosition(table, cell.row, cell.col);
    const sub = substringFn?.(cell.text);
    const position = sub
      ? getSubstringPosition(cellPos, cell.text, sub)
      : cellPos;
    return {
      position,
      label: labelFn(cell.text.trim()),
    };
  });
}
