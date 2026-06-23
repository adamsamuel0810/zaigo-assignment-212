import { RuleCategory, Severity, SlideMetadata, TableMetadata } from "@/lib/types";
import {
  TABLE_CLIENT_COLOR,
  TABLE_HEADER_COLOR,
  TABLE_STATS_COLOR,
  TABLE_ZEBRA_COLOR,
  colorClose,
  fontMatchesCalibri,
  isCurrencyWithoutSymbol,
  isPercentWithoutSymbol,
  isSymbolFont,
} from "@/lib/rules/constants";
import { deterministicDefaults, fail, pass } from "@/lib/rules/helpers";
import { BaseRule } from "@/lib/types";
import { buildTableCellHighlights } from "@/lib/utils/finding-highlight";

/**
 * A real data table — not a 1–2 row "key/legend" swatch table. Color/zebra/stats
 * rules only apply to data tables; the small legend tables (a colored cell + a
 * label) otherwise masquerade as mis-colored headers.
 */
function isDataTable(table: TableMetadata): boolean {
  return table.rows >= 3 && table.cols >= 3;
}

/**
 * Rows that make up the (possibly multi-row) header band: the leading rows that
 * carry the header fill color. Used so multi-row headers are not mistaken for
 * mis-striped body rows.
 */
function headerRowCount(table: TableMetadata): number {
  let count = 0;
  for (let r = 0; r < table.rows; r++) {
    const rowCells = table.cells.filter((c) => c.row === r);
    const hasHeaderFill = rowCells.some(
      (c) => c.fill_hex && colorClose(TABLE_HEADER_COLOR, c.fill_hex),
    );
    if (hasHeaderFill) count = r + 1;
    else if (count > 0) break;
  }
  return count || 1;
}

function isStatsRow(cells: { text: string }[]): boolean {
  const text = cells.map((c) => c.text.toLowerCase()).join(" ");
  return (
    text.includes("%ile") ||
    text.includes("percentile") ||
    text.includes("median") ||
    text.includes("mean") ||
    /\bcount\b/.test(text)
  );
}

/**
 * A client row names the client (e.g. "Goofy") in its leading label cell. We
 * match the first non-empty cell exactly (allowing a corporate suffix) rather
 * than any cell containing the name, so ordinary peer rows that merely mention
 * the client are not treated as the highlighted client row.
 */
function isClientRow(cells: { row: number; col: number; text: string }[]): boolean {
  const sorted = [...cells].sort((a, b) => a.col - b.col);
  const label = sorted.find((c) => c.text.trim())?.text.trim().toLowerCase() ?? "";
  return /^(goofy|pluto\w*)(\b|'|s|\s|$)/.test(label) || label === "client";
}

/**
 * Number of decimal places in a pure numeric cell (after stripping currency,
 * percent, thousands separators, and comparison prefixes). Returns null when
 * the cell is not a single plain number (ranges, text, dashes are ignored).
 */
function decimalPlaces(text: string): number | null {
  const cleaned = text
    .trim()
    .replace(/[$%,\s]/g, "")
    .replace(/^[+\-><≈~]+/, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const dot = cleaned.indexOf(".");
  return dot === -1 ? 0 : cleaned.length - dot - 1;
}

/** True when the column header or body cells indicate percentage data. */
function columnIsPercent(
  table: TableMetadata,
  col: number,
  headerRows: number,
): boolean {
  const headerText = table.cells
    .filter((c) => c.row < headerRows && c.col === col)
    .map((c) => c.text)
    .join(" ");
  if (/%|percent/i.test(headerText)) return true;
  const body = table.cells.filter(
    (c) => c.row >= headerRows && c.col === col && c.text.trim(),
  );
  if (body.length < 3) return false;
  const withPct = body.filter((c) => /%/.test(c.text)).length;
  return withPct / body.length >= 0.5;
}

/** True when the column header or body cells indicate currency data. */
function columnIsCurrency(
  table: TableMetadata,
  col: number,
  headerRows: number,
): boolean {
  const headerText = table.cells
    .filter((c) => c.row < headerRows && c.col === col)
    .map((c) => c.text)
    .join(" ");
  if (/[$€£]|revenue|compensation|\(\$000/i.test(headerText)) return true;
  const body = table.cells.filter(
    (c) => c.row >= headerRows && c.col === col && c.text.trim(),
  );
  if (body.length < 3) return false;
  const withSym = body.filter((c) => /[$€£]/.test(c.text)).length;
  return withSym / body.length >= 0.4;
}

/** True when most body cells in the column are numeric (incl. % and $). */
function columnIsNumeric(
  table: TableMetadata,
  col: number,
  headerRows: number,
): boolean {
  const body = table.cells.filter(
    (c) => c.row >= headerRows && c.col === col && c.text.trim(),
  );
  if (body.length < 4) return false;
  const numeric = body.filter((c) => {
    const t = c.text.trim();
    return (
      /^[$€£]?[\d,]+(\.\d+)?%?$/.test(t) ||
      /^[<>≈~+-]?[\d,]+(\.\d+)?%?$/.test(t) ||
      /^[–—-]$/.test(t)
    );
  });
  return numeric.length / body.length >= 0.65;
}

export const tableRules: BaseRule[] = [
  {
    id: "TABLE_001",
    name: "Header color must be #006EBE",
    description: "Table header row fill must be ACME blue #006EBE.",
    category: RuleCategory.Tables,
    severity: Severity.Error,
    run(slide: SlideMetadata) {
      const results = slide.tables.flatMap((table) => {
        if (!isDataTable(table)) return [pass()];

        const headerRows = headerRowCount(table);
        const headerCells = table.cells.filter((c) => c.row < headerRows);
        const filled = headerCells.filter((c) => c.fill_hex);
        // No header fill at all isn't a "wrong color" — leave to other rules.
        if (filled.length === 0) return [pass()];

        const wrong = [
          ...new Set(
            filled
              .filter((c) => !colorClose(TABLE_HEADER_COLOR, c.fill_hex))
              .map((c) => c.fill_hex as string),
          ),
        ];
        if (wrong.length === 0) return [pass()];
        return [
          fail(
            deterministicDefaults({
              rule_id: "TABLE_001",
              slide_number: slide.slide_number,
              title: "Table header color incorrect",
              description: "Table header cells deviate from #006EBE.",
              category: RuleCategory.Tables,
              severity: Severity.Error,
              expected_value: TABLE_HEADER_COLOR,
              actual_value: wrong.join(", "),
              recommendation: "Set header row fill to #006EBE.",
              shape_id: table.shape_id,
              highlight: table.position,
            }),
          ),
        ];
      });
      return results.length ? results : [pass()];
    },
  },
  {
    id: "TABLE_002",
    name: "Zebra striping must alternate correctly",
    description: "Table body rows should alternate white and #F2F2F2.",
    category: RuleCategory.Tables,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const results = slide.tables.flatMap((table) => {
        if (!isDataTable(table)) return [pass()];
        const headerRows = headerRowCount(table);

        const bodyRows = [
          ...new Set(table.cells.filter((c) => c.row >= headerRows).map((c) => c.row)),
        ].sort((a, b) => a - b);

        for (const row of bodyRows) {
          const rowCells = table.cells.filter((c) => c.row === row);
          if (isStatsRow(rowCells) || isClientRow(rowCells)) continue;
          // Section/group divider rows (a single spanning label) legitimately
          // use accent tints — skip them.
          const nonEmpty = rowCells.filter((c) => c.text.trim());
          if (nonEmpty.length <= 1) continue;

          // Body shading must be white / zebra gray, or one of the legitimate
          // structural row colors (header blue, stats yellow, client green).
          const offending = [
            ...new Set(
              rowCells
                .map((c) => c.fill_hex)
                .filter(
                  (f): f is string =>
                    !!f &&
                    !colorClose("#FFFFFF", f) &&
                    !colorClose(TABLE_ZEBRA_COLOR, f) &&
                    !colorClose(TABLE_HEADER_COLOR, f) &&
                    !colorClose(TABLE_STATS_COLOR, f) &&
                    !colorClose(TABLE_CLIENT_COLOR, f),
                ),
            ),
          ];
          if (offending.length > 0) {
            return [
              fail(
                deterministicDefaults({
                  rule_id: "TABLE_002",
                  slide_number: slide.slide_number,
                  title: "Incorrect body row shading",
                  description: `Row ${row + 1} uses shading outside the white / ${TABLE_ZEBRA_COLOR} zebra pattern.`,
                  category: RuleCategory.Tables,
                  severity: Severity.Warning,
                  expected_value: `Alternating white / ${TABLE_ZEBRA_COLOR}`,
                  actual_value: offending.join(", "),
                  recommendation: "Use white and #F2F2F2 zebra striping for body rows.",
                  shape_id: table.shape_id,
                  highlight: table.position,
                }),
              ),
            ];
          }
        }
        return [pass()];
      });
      return results.length ? results : [pass()];
    },
  },
  {
    id: "TABLE_003",
    name: 'Use "%ile" not "Percentile"',
    description: 'Percentile labels must use "%ile" abbreviation.',
    category: RuleCategory.Terminology,
    severity: Severity.Error,
    run(slide: SlideMetadata) {
      const results = slide.tables.flatMap((table) => {
        const offenders = table.cells.filter((c) =>
          /\bpercentile\b/i.test(c.text) && !/%ile/i.test(c.text),
        );
        if (offenders.length === 0) return [pass()];
        return [
          fail(
            deterministicDefaults({
              rule_id: "TABLE_003",
              slide_number: slide.slide_number,
              title: '"Percentile" should be "%ile"',
              description: 'ACME uses "%ile" not "Percentile".',
              category: RuleCategory.Terminology,
              severity: Severity.Error,
              expected_value: "%ile",
              actual_value: offenders.map((c) => c.text).join("; "),
              recommendation: 'Replace "Percentile" with "%ile".',
              shape_id: table.shape_id,
              highlight_regions: buildTableCellHighlights(
                table,
                offenders,
                (text) => `“${text}” → use %ile`,
                (text) => text.match(/\b(\d+(?:st|nd|rd|th)?\s+)?percentile\b/i)?.[0] ?? null,
              ),
            }),
          ),
        ];
      });
      return results.length ? results : [pass()];
    },
  },
  {
    id: "TABLE_004",
    name: "Statistics row should be yellow",
    description: "Summary statistics rows must use #FFFFDB shading.",
    category: RuleCategory.Tables,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const results = slide.tables.flatMap((table) => {
        if (!isDataTable(table)) return [pass()];
        const headerRows = headerRowCount(table);
        const rows = [...new Set(table.cells.map((c) => c.row))].filter(
          (r) => r >= headerRows,
        );
        for (const row of rows) {
          const rowCells = table.cells.filter((c) => c.row === row);
          if (!isStatsRow(rowCells)) continue;
          const wrong = rowCells.filter(
            (c) => c.fill_hex && !colorClose(TABLE_STATS_COLOR, c.fill_hex),
          );
          if (wrong.length > 0) {
            return [
              fail(
                deterministicDefaults({
                  rule_id: "TABLE_004",
                  slide_number: slide.slide_number,
                  title: "Statistics row color incorrect",
                  description: "Stats rows should use yellow #FFFFDB (not green).",
                  category: RuleCategory.Tables,
                  severity: Severity.Warning,
                  expected_value: TABLE_STATS_COLOR,
                  actual_value: wrong.map((c) => c.fill_hex).join(", "),
                  recommendation: "Set statistics row fill to Yellow Accent 3 (#FFFFDB).",
                  shape_id: table.shape_id,
                  highlight: table.position,
                }),
              ),
            ];
          }
        }
        return [pass()];
      });
      return results.length ? results : [pass()];
    },
  },
  {
    id: "TABLE_005",
    name: "Client row should be green",
    description: "Client rows must use #F1FFE1 shading.",
    category: RuleCategory.Tables,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const results = slide.tables.flatMap((table) => {
        if (!isDataTable(table)) return [pass()];
        const headerRows = headerRowCount(table);
        const rows = [...new Set(table.cells.map((c) => c.row))].filter(
          (r) => r >= headerRows,
        );
        for (const row of rows) {
          const rowCells = table.cells.filter((c) => c.row === row);
          if (!isClientRow(rowCells)) continue;
          // Only flag an explicitly highlighted-but-wrong client row. Neutral
          // fills (none / white / zebra gray) are treated as "not highlighted"
          // rather than a wrong color, to avoid false positives.
          const wrong = rowCells.filter(
            (c) =>
              c.fill_hex &&
              !colorClose(TABLE_CLIENT_COLOR, c.fill_hex) &&
              !colorClose("#FFFFFF", c.fill_hex) &&
              !colorClose(TABLE_ZEBRA_COLOR, c.fill_hex),
          );
          if (wrong.length > 0) {
            return [
              fail(
                deterministicDefaults({
                  rule_id: "TABLE_005",
                  slide_number: slide.slide_number,
                  title: "Client row color incorrect",
                  description: "Client rows should use light green #F1FFE1.",
                  category: RuleCategory.Tables,
                  severity: Severity.Warning,
                  expected_value: TABLE_CLIENT_COLOR,
                  actual_value: wrong.map((c) => c.fill_hex).join(", "),
                  recommendation: "Set client row fill to Light Green Accent 2 (#F1FFE1).",
                  shape_id: table.shape_id,
                  highlight: table.position,
                }),
              ),
            ];
          }
        }
        return [pass()];
      });
      return results.length ? results : [pass()];
    },
  },
  {
    id: "TABLE_006",
    name: "Use Executive not Incumbent",
    description: 'Employee name columns should use "Executive".',
    category: RuleCategory.Terminology,
    severity: Severity.Error,
    run(slide: SlideMetadata) {
      const results = slide.tables.flatMap((table) => {
        const headerCells = table.cells.filter((c) => c.row === 0);
        const incumbent = headerCells.filter((c) =>
          /\bincumbent\b/i.test(c.text),
        );
        if (incumbent.length === 0) return [pass()];
        return [
          fail(
            deterministicDefaults({
              rule_id: "TABLE_006",
              slide_number: slide.slide_number,
              title: 'Use "Executive" not "Incumbent"',
              description: "Employee tables must label the name column Executive.",
              category: RuleCategory.Terminology,
              severity: Severity.Error,
              expected_value: "Executive",
              actual_value: incumbent.map((c) => c.text).join(", "),
              recommendation: 'Rename column header to "Executive".',
              shape_id: table.shape_id,
              highlight: table.position,
            }),
          ),
        ];
      });
      return results.length ? results : [pass()];
    },
  },
  {
    id: "TABLE_007",
    name: "First column margin",
    description: "First table column should be at least 0.03\" from slide left edge.",
    category: RuleCategory.Spacing,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const results = slide.tables.flatMap((table) => {
        if (table.position.left_inches >= 0.03) return [pass()];
        return [
          fail(
            deterministicDefaults({
              rule_id: "TABLE_007",
              slide_number: slide.slide_number,
              title: "Table too close to left edge",
              description: "First column should be at least 0.03\" from slide edge.",
              category: RuleCategory.Spacing,
              severity: Severity.Warning,
              expected_value: "≥ 0.03\" from left",
              actual_value: `${table.position.left_inches}\"`,
              recommendation: "Align table to standard left margin.",
              shape_id: table.shape_id,
              highlight: table.position,
            }),
          ),
        ];
      });
      return results.length ? results : [pass()];
    },
  },
  {
    id: "TABLE_008",
    name: "Table font size must be consistent",
    description:
      "Font size must be consistent across a table (ACME: 10–12pt, uniform).",
    category: RuleCategory.Tables,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const results = slide.tables.flatMap((table) => {
        if (!isDataTable(table)) return [pass()];

        const sized = table.cells.filter(
          (c) => c.text.trim() && typeof c.font_size_pt === "number",
        );
        // Need enough sized cells to establish a dominant size reliably.
        if (sized.length < 6) return [pass()];

        const counts = new Map<number, number>();
        for (const c of sized) {
          const sz = c.font_size_pt as number;
          counts.set(sz, (counts.get(sz) ?? 0) + 1);
        }
        if (counts.size < 2) return [pass()];

        const [dominantSize, dominantCount] = [...counts.entries()].sort(
          (a, b) => b[1] - a[1],
        )[0];
        // Only flag clear outliers against a strong majority size.
        if (dominantCount / sized.length < 0.7) return [pass()];

        const outliers = sized.filter(
          (c) => Math.abs((c.font_size_pt as number) - dominantSize) > 0.5,
        );
        if (outliers.length === 0) return [pass()];

        return [
          fail(
            deterministicDefaults({
              rule_id: "TABLE_008",
              slide_number: slide.slide_number,
              title: "Inconsistent font size in table",
              description: `Most cells are ${dominantSize}pt but some differ, breaking the table's uniform sizing.`,
              category: RuleCategory.Tables,
              severity: Severity.Warning,
              expected_value: `${dominantSize}pt across the table`,
              actual_value: [
                ...new Set(
                  outliers.map(
                    (c) => `"${c.text.trim().slice(0, 24)}" ${c.font_size_pt}pt`,
                  ),
                ),
              ].join("; "),
              recommendation: `Set all cells to ${dominantSize}pt for a consistent table.`,
              shape_id: table.shape_id,
              highlight_regions: buildTableCellHighlights(
                table,
                outliers,
                (text) => `${text} → ${dominantSize}pt`,
              ),
            }),
          ),
        ];
      });
      return results.length ? results : [pass()];
    },
  },
  {
    id: "TABLE_009",
    name: "Table font must be Calibri",
    description: "Table cells must use the Calibri typeface.",
    category: RuleCategory.Tables,
    severity: Severity.Error,
    run(slide: SlideMetadata) {
      const results = slide.tables.flatMap((table) => {
        if (!isDataTable(table)) return [pass()];
        const wrong = [
          ...new Set(
            table.cells
              .filter(
                (c) =>
                  c.text.trim() &&
                  c.font_family &&
                  !isSymbolFont(c.font_family) &&
                  !fontMatchesCalibri(c.font_family),
              )
              .map((c) => c.font_family as string),
          ),
        ];
        if (wrong.length === 0) return [pass()];
        return [
          fail(
            deterministicDefaults({
              rule_id: "TABLE_009",
              slide_number: slide.slide_number,
              title: "Table font not Calibri",
              description: "One or more table cells use a non-Calibri font.",
              category: RuleCategory.Tables,
              severity: Severity.Error,
              expected_value: "Calibri",
              actual_value: wrong.join(", "),
              recommendation: "Set all table cells to Calibri.",
              shape_id: table.shape_id,
              highlight: table.position,
            }),
          ),
        ];
      });
      return results.length ? results : [pass()];
    },
  },
  {
    id: "TABLE_010",
    name: "Table header font must be white",
    description: "Header cells (blue fill) must use white font.",
    category: RuleCategory.Tables,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const results = slide.tables.flatMap((table) => {
        if (!isDataTable(table)) return [pass()];
        const headerRows = headerRowCount(table);
        // Only header cells that actually carry the blue header fill.
        const headerCells = table.cells.filter(
          (c) =>
            c.row < headerRows &&
            c.text.trim() &&
            c.fill_hex &&
            colorClose(TABLE_HEADER_COLOR, c.fill_hex),
        );
        // Flag only explicit, clearly non-white font colors (avoid inherited).
        const wrong = [
          ...new Set(
            headerCells
              .filter(
                (c) => c.font_color_hex && !colorClose("#FFFFFF", c.font_color_hex),
              )
              .map((c) => c.font_color_hex as string),
          ),
        ];
        if (wrong.length === 0) return [pass()];
        return [
          fail(
            deterministicDefaults({
              rule_id: "TABLE_010",
              slide_number: slide.slide_number,
              title: "Table header font not white",
              description: "Header cells on the blue fill should use white text.",
              category: RuleCategory.Tables,
              severity: Severity.Warning,
              expected_value: "White (#FFFFFF)",
              actual_value: wrong.join(", "),
              recommendation: "Set header row font color to white.",
              shape_id: table.shape_id,
              highlight: table.position,
            }),
          ),
        ];
      });
      return results.length ? results : [pass()];
    },
  },
  {
    id: "TABLE_011",
    name: "No left/right border on table",
    description: "Tables must not have outer left or right borders.",
    category: RuleCategory.Tables,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const results = slide.tables.flatMap((table) => {
        if (!isDataTable(table)) return [pass()];
        const cols = table.cells.map((c) => c.col);
        const minCol = Math.min(...cols);
        const maxCol = Math.max(...cols);
        const leftEdge = table.cells.filter(
          (c) => c.col === minCol && c.border_left === true,
        );
        const rightEdge = table.cells.filter(
          (c) => c.col === maxCol && c.border_right === true,
        );
        if (leftEdge.length === 0 && rightEdge.length === 0) return [pass()];
        const sides = [
          leftEdge.length ? "left" : null,
          rightEdge.length ? "right" : null,
        ].filter(Boolean);
        return [
          fail(
            deterministicDefaults({
              rule_id: "TABLE_011",
              slide_number: slide.slide_number,
              title: "Table has outer side border",
              description:
                "The table has a visible left/right outer border; ACME tables use none.",
              category: RuleCategory.Tables,
              severity: Severity.Warning,
              expected_value: "No left/right border",
              actual_value: `${sides.join(" & ")} border present`,
              recommendation: "Remove the table's left and right outer borders.",
              shape_id: table.shape_id,
              highlight: table.position,
            }),
          ),
        ];
      });
      return results.length ? results : [pass()];
    },
  },
  {
    id: "TABLE_012",
    name: "Consistent decimal precision",
    description: "Numeric columns must use consistent decimal precision.",
    category: RuleCategory.Tables,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const results = slide.tables.flatMap((table) => {
        if (!isDataTable(table)) return [pass()];
        const headerRows = headerRowCount(table);
        const cols = [...new Set(table.cells.map((c) => c.col))];

        for (const col of cols) {
          const numeric = table.cells
            .filter((c) => c.row >= headerRows && c.col === col)
            .map((c) => ({ cell: c, dp: decimalPlaces(c.text) }))
            .filter((x): x is { cell: typeof x.cell; dp: number } => x.dp !== null);
          // Need a solid numeric column and at least one fractional value, so we
          // don't flag integer counts mixed with a single decimal stat.
          if (numeric.length < 4) continue;
          if (!numeric.some((x) => x.dp > 0)) continue;

          const counts = new Map<number, number>();
          for (const x of numeric) counts.set(x.dp, (counts.get(x.dp) ?? 0) + 1);
          if (counts.size < 2) continue;

          const [dominant, dominantCount] = [...counts.entries()].sort(
            (a, b) => b[1] - a[1],
          )[0];
          if (dominantCount / numeric.length < 0.6) continue;

          const outliers = numeric.filter((x) => x.dp !== dominant && x.dp > 0);
          if (outliers.length === 0) continue;

          return [
            fail(
              deterministicDefaults({
                rule_id: "TABLE_012",
                slide_number: slide.slide_number,
                title: "Inconsistent decimal precision",
                description: `Column ${col + 1} mixes decimal precision (mostly ${dominant} dp).`,
                category: RuleCategory.Tables,
                severity: Severity.Warning,
                expected_value: `${dominant} decimal place(s)`,
                actual_value: [
                  ...new Set(
                    outliers.map(
                      (x) => `"${x.cell.text.trim().slice(0, 16)}" (${x.dp} dp)`,
                    ),
                  ),
                ].join(", "),
                recommendation: `Use ${dominant} decimal place(s) consistently in this column.`,
                shape_id: table.shape_id,
                highlight_regions: buildTableCellHighlights(
                  table,
                  outliers.map((x) => x.cell),
                  (text) => `${text} → ${dominant} dp`,
                ),
              }),
            ),
          ];
        }
        return [pass()];
      });
      return results.length ? results : [pass()];
    },
  },
  {
    id: "TABLE_013",
    name: "Table title 14pt bold centered",
    description: "Table titles must be Calibri Bold 14pt centered above the table.",
    category: RuleCategory.Tables,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const results = slide.tables.flatMap((table) => {
        if (!isDataTable(table)) return [pass()];
        const tableTop = table.position.top_inches;
        const tableLeft = table.position.left_inches;
        const tableRight = tableLeft + table.position.width_inches;
        const tableCenter = (tableLeft + tableRight) / 2;
        const titleBottom = slide.title
          ? slide.title.position.top_inches + slide.title.position.height_inches
          : 0;

        // A *table title* is a short, BOLD textbox sitting in the gap directly
        // above the table and roughly centered over it. Requiring bold keeps us
        // from mistaking arbitrary labels/notes for a table title.
        const candidate = slide.texts.find((t) => {
          if (t.is_title) return false;
          const text = t.full_text.trim();
          if (!text || text.length > 60) return false;
          const boxBottom = t.position.top_inches + t.position.height_inches;
          const gap = tableTop - boxBottom;
          if (gap < -0.1 || gap > 0.8) return false;
          if (boxBottom <= titleBottom + 0.05) return false; // that's the slide title region
          const boxCenter = t.position.left_inches + t.position.width_inches / 2;
          if (Math.abs(boxCenter - tableCenter) > table.position.width_inches / 2) {
            return false;
          }
          const runs = t.paragraphs.flatMap((p) => p.runs).filter((r) => r.text.trim());
          return runs.some((r) => r.bold === true);
        });
        if (!candidate) return [pass()];

        const runs = candidate.paragraphs
          .flatMap((p) => p.runs)
          .filter((r) => r.text.trim());
        const wrongSize = runs.some(
          (r) => r.font_size_pt != null && Math.abs(r.font_size_pt - 14) > 0.5,
        );
        const aligns = candidate.paragraphs
          .map((p) => p.alignment)
          .filter((a): a is string => a != null);
        const notCentered = aligns.length > 0 && !aligns.includes("CENTER");

        if (!wrongSize && !notCentered) return [pass()];
        const issues = [
          wrongSize ? "not 14pt" : null,
          notCentered ? "not centered" : null,
        ].filter(Boolean);
        return [
          fail(
            deterministicDefaults({
              rule_id: "TABLE_013",
              slide_number: slide.slide_number,
              title: "Table title formatting",
              description: "Table title should be Calibri Bold 14pt centered above the table.",
              category: RuleCategory.Tables,
              severity: Severity.Warning,
              expected_value: "Calibri Bold 14pt, centered",
              actual_value: issues.join(", "),
              recommendation: "Format the table title as Calibri Bold 14pt, centered.",
              shape_id: candidate.shape_id,
              highlight: candidate.position,
            }),
          ),
        ];
      });
      return results.length ? results : [pass()];
    },
  },
  {
    id: "TABLE_014",
    name: "Header cells bottom-aligned",
    description: "Table header cells must be bottom-aligned.",
    category: RuleCategory.Tables,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const results = slide.tables.flatMap((table) => {
        if (!isDataTable(table)) return [pass()];
        const headerRows = headerRowCount(table);
        const headerCells = table.cells.filter(
          (c) =>
            c.row < headerRows &&
            c.text.trim() &&
            c.fill_hex &&
            colorClose(TABLE_HEADER_COLOR, c.fill_hex),
        );
        // Only flag cells that explicitly set a non-bottom anchor.
        const wrong = headerCells.filter(
          (c) =>
            c.vertical_anchor != null &&
            c.vertical_anchor !== "BOTTOM" &&
            c.vertical_anchor !== "MIXED",
        );
        if (wrong.length === 0) return [pass()];
        return [
          fail(
            deterministicDefaults({
              rule_id: "TABLE_014",
              slide_number: slide.slide_number,
              title: "Header not bottom-aligned",
              description: "Header cells should be vertically bottom-aligned.",
              category: RuleCategory.Tables,
              severity: Severity.Warning,
              expected_value: "Bottom aligned",
              actual_value: [
                ...new Set(wrong.map((c) => (c.vertical_anchor ?? "").toLowerCase())),
              ].join(", "),
              recommendation: "Set header cell vertical alignment to bottom.",
              shape_id: table.shape_id,
              highlight: table.position,
            }),
          ),
        ];
      });
      return results.length ? results : [pass()];
    },
  },
  {
    id: "TABLE_015",
    name: "Consistent column justification",
    description: "Justification must be consistent within each table column.",
    category: RuleCategory.Tables,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const results = slide.tables.flatMap((table) => {
        if (!isDataTable(table)) return [pass()];
        const headerRows = headerRowCount(table);
        const cols = [...new Set(table.cells.map((c) => c.col))];

        for (const col of cols) {
          const aligned = table.cells
            .filter((c) => c.row >= headerRows && c.col === col && c.text.trim())
            .map((c) => c.alignment)
            .filter((a): a is string => a != null);
          if (aligned.length < 3) continue;
          const distinct = [...new Set(aligned)];
          if (distinct.length < 2) continue;
          return [
            fail(
              deterministicDefaults({
                rule_id: "TABLE_015",
                slide_number: slide.slide_number,
                title: "Inconsistent column justification",
                description: `Column ${col + 1} mixes ${distinct.join("/").toLowerCase()} alignment.`,
                category: RuleCategory.Tables,
                severity: Severity.Warning,
                expected_value: "One justification per column",
                actual_value: distinct.map((d) => d.toLowerCase()).join(", "),
                recommendation: "Use a single, consistent justification within each column.",
                shape_id: table.shape_id,
                highlight: table.position,
              }),
            ),
          ];
        }
        return [pass()];
      });
      return results.length ? results : [pass()];
    },
  },
  {
    id: "TABLE_016",
    name: "Percentages must include % symbol",
    description: "Percentage values must show the % symbol.",
    category: RuleCategory.Tables,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const results = slide.tables.flatMap((table) => {
        if (!isDataTable(table)) return [pass()];
        const headerRows = headerRowCount(table);
        const cols = [...new Set(table.cells.map((c) => c.col))];
        for (const col of cols) {
          if (!columnIsPercent(table, col, headerRows)) continue;
          const offenders = table.cells.filter(
            (c) =>
              c.row >= headerRows &&
              c.col === col &&
              c.text.trim() &&
              isPercentWithoutSymbol(c.text),
          );
          if (offenders.length === 0) continue;
          return [
            fail(
              deterministicDefaults({
                rule_id: "TABLE_016",
                slide_number: slide.slide_number,
                title: "Percentage missing % symbol",
                description: "Numeric percentage values must include the % symbol.",
                category: RuleCategory.Tables,
                severity: Severity.Warning,
                expected_value: "Values with % (e.g. 8.5%)",
                actual_value: offenders
                  .slice(0, 3)
                  .map((c) => c.text.trim())
                  .join(", "),
                recommendation: "Add the % symbol to percentage values.",
                shape_id: table.shape_id,
                highlight_regions: buildTableCellHighlights(
                  table,
                  offenders,
                  (t) => t,
                ),
              }),
            ),
          ];
        }
        return [pass()];
      });
      return results.length ? results : [pass()];
    },
  },
  {
    id: "TABLE_017",
    name: "Currency values need a symbol",
    description: "Currency figures must include a currency symbol.",
    category: RuleCategory.Tables,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const results = slide.tables.flatMap((table) => {
        if (!isDataTable(table)) return [pass()];
        const headerRows = headerRowCount(table);
        const cols = [...new Set(table.cells.map((c) => c.col))];
        for (const col of cols) {
          if (!columnIsCurrency(table, col, headerRows)) continue;
          const offenders = table.cells.filter(
            (c) =>
              c.row >= headerRows &&
              c.col === col &&
              c.text.trim() &&
              isCurrencyWithoutSymbol(c.text),
          );
          if (offenders.length === 0) continue;
          return [
            fail(
              deterministicDefaults({
                rule_id: "TABLE_017",
                slide_number: slide.slide_number,
                title: "Currency value missing symbol",
                description: "Currency figures must include a currency symbol.",
                category: RuleCategory.Tables,
                severity: Severity.Warning,
                expected_value: "Values with $ or other currency symbol",
                actual_value: offenders
                  .slice(0, 3)
                  .map((c) => c.text.trim())
                  .join(", "),
                recommendation: "Add a currency symbol to monetary values.",
                shape_id: table.shape_id,
                highlight_regions: buildTableCellHighlights(
                  table,
                  offenders,
                  (t) => t,
                ),
              }),
            ),
          ];
        }
        return [pass()];
      });
      return results.length ? results : [pass()];
    },
  },
  {
    id: "TABLE_018",
    name: "N/A values should use en-dash",
    description: "Not-applicable values should use an en-dash (–) or blank, not N/A.",
    category: RuleCategory.Tables,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const results = slide.tables.flatMap((table) => {
        if (!isDataTable(table)) return [pass()];
        const offenders = table.cells.filter((c) =>
          /\bN\/?A\b/i.test(c.text.trim()),
        );
        if (offenders.length === 0) return [pass()];
        return [
          fail(
            deterministicDefaults({
              rule_id: "TABLE_018",
              slide_number: slide.slide_number,
              title: 'Use en-dash instead of "N/A"',
              description: 'Replace "N/A" with an en-dash (–) or leave the cell blank.',
              category: RuleCategory.Tables,
              severity: Severity.Warning,
              expected_value: "– or blank",
              actual_value: offenders.map((c) => c.text.trim()).join(", "),
              recommendation: 'Use an en-dash (–) for not-applicable values.',
              shape_id: table.shape_id,
              highlight_regions: buildTableCellHighlights(table, offenders, (t) => t),
            }),
          ),
        ];
      });
      return results.length ? results : [pass()];
    },
  },
  {
    id: "TABLE_019",
    name: "Table font outside 10–12 pt band",
    description:
      "When a table uses the ACME 10–12 pt range, no cells should fall outside it.",
    category: RuleCategory.Tables,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const results = slide.tables.flatMap((table) => {
        if (!isDataTable(table)) return [pass()];
        const sized = table.cells.filter(
          (c) => c.text.trim() && c.font_size_pt != null,
        );
        if (sized.length < 6) return [pass()];
        const inBand = sized.filter(
          (c) =>
            (c.font_size_pt as number) >= 9.5 &&
            (c.font_size_pt as number) <= 12.5,
        );
        // Table is not predominantly 10–12 pt — skip (e.g. appendix tables at 9 pt).
        if (inBand.length / sized.length < 0.7) return [pass()];
        const wrong = sized.filter(
          (c) =>
            (c.font_size_pt as number) < 9.5 || (c.font_size_pt as number) > 12.5,
        );
        if (wrong.length === 0) return [pass()];
        return [
          fail(
            deterministicDefaults({
              rule_id: "TABLE_019",
              slide_number: slide.slide_number,
              title: "Table font outside 10–12 pt",
              description: "Table cell font size should be between 10 and 12 pt.",
              category: RuleCategory.Tables,
              severity: Severity.Warning,
              expected_value: "10–12 pt",
              actual_value: [
                ...new Set(wrong.map((c) => `${c.font_size_pt}pt`)),
              ].join(", "),
              recommendation: "Set table text to 10–12 pt.",
              shape_id: table.shape_id,
              highlight_regions: buildTableCellHighlights(table, wrong, (t) => t),
            }),
          ),
        ];
      });
      return results.length ? results : [pass()];
    },
  },
  {
    id: "TABLE_020",
    name: "Header cells must be bold",
    description: "Table header cells must use bold typeface.",
    category: RuleCategory.Tables,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const results = slide.tables.flatMap((table) => {
        if (!isDataTable(table)) return [pass()];
        const headerRows = headerRowCount(table);
        const headerCells = table.cells.filter(
          (c) =>
            c.row < headerRows &&
            c.text.trim() &&
            c.fill_hex &&
            colorClose(TABLE_HEADER_COLOR, c.fill_hex),
        );
        const notBold = headerCells.filter((c) => c.bold === false);
        if (notBold.length === 0) return [pass()];
        return [
          fail(
            deterministicDefaults({
              rule_id: "TABLE_020",
              slide_number: slide.slide_number,
              title: "Header cells not bold",
              description: "Header row cells on the blue fill must be bold.",
              category: RuleCategory.Tables,
              severity: Severity.Warning,
              expected_value: "Bold",
              actual_value: notBold.map((c) => c.text.trim().slice(0, 30)).join(", "),
              recommendation: "Set header row text to bold.",
              shape_id: table.shape_id,
              highlight_regions: buildTableCellHighlights(table, notBold, (t) => t),
            }),
          ),
        ];
      });
      return results.length ? results : [pass()];
    },
  },
  {
    id: "TABLE_021",
    name: "Header row needs top and bottom borders",
    description: "Header rows need thin top and bottom border lines.",
    category: RuleCategory.Tables,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const results = slide.tables.flatMap((table) => {
        if (!isDataTable(table)) return [pass()];
        const headerRows = headerRowCount(table);
        const headerCells = table.cells.filter(
          (c) =>
            c.row < headerRows &&
            c.text.trim() &&
            c.fill_hex &&
            colorClose(TABLE_HEADER_COLOR, c.fill_hex),
        );
        const missingTop = headerCells.filter((c) => c.border_top === false);
        const missingBottom = headerCells.filter((c) => c.border_bottom === false);
        if (missingTop.length === 0 && missingBottom.length === 0) return [pass()];
        const issues = [
          missingTop.length ? "top" : null,
          missingBottom.length ? "bottom" : null,
        ].filter(Boolean);
        return [
          fail(
            deterministicDefaults({
              rule_id: "TABLE_021",
              slide_number: slide.slide_number,
              title: "Header row border missing",
              description: `Header row is missing explicit ${issues.join(" and ")} border line(s).`,
              category: RuleCategory.Tables,
              severity: Severity.Warning,
              expected_value: "Thin black line on top and bottom",
              actual_value: `Missing ${issues.join(", ")} border`,
              recommendation: "Add thin black borders on the top and bottom of the header row.",
              shape_id: table.shape_id,
              highlight: table.position,
            }),
          ),
        ];
      });
      return results.length ? results : [pass()];
    },
  },
  {
    id: "TABLE_022",
    name: 'Use "Title" or "Position" for job-title column',
    description: 'Job-title columns should be labeled "Title" or "Position".',
    category: RuleCategory.Terminology,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const results = slide.tables.flatMap((table) => {
        if (!isDataTable(table)) return [pass()];
        const headers = table.cells.filter((c) => c.row <= 2);
        const hasExecutive = headers.some((c) => /\bexecutive\b/i.test(c.text));
        if (!hasExecutive) return [pass()];
        const wrong = headers.filter((c) =>
          /^(job\s*title|role|position\s*title)$/i.test(
            c.text.trim().replace(/\s+/g, " "),
          ),
        );
        if (wrong.length === 0) return [pass()];
        return [
          fail(
            deterministicDefaults({
              rule_id: "TABLE_022",
              slide_number: slide.slide_number,
              title: 'Use "Title" or "Position" for job-title column',
              description:
                'Employee tables should label the job-title column "Title" or "Position".',
              category: RuleCategory.Terminology,
              severity: Severity.Warning,
              expected_value: '"Title" or "Position"',
              actual_value: wrong.map((c) => c.text).join(", "),
              recommendation: 'Rename the column to "Title" or "Position".',
              shape_id: table.shape_id,
              highlight: table.position,
            }),
          ),
        ];
      });
      return results.length ? results : [pass()];
    },
  },
  {
    id: "TABLE_023",
    name: "Numeric columns should be right-aligned",
    description: "Numeric data columns should be right-aligned.",
    category: RuleCategory.Tables,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const results = slide.tables.flatMap((table) => {
        if (!isDataTable(table)) return [pass()];
        const headerRows = headerRowCount(table);
        const cols = [...new Set(table.cells.map((c) => c.col))];
        for (const col of cols) {
          if (!columnIsNumeric(table, col, headerRows)) continue;
          const aligned = table.cells
            .filter((c) => c.row >= headerRows && c.col === col && c.text.trim())
            .map((c) => c.alignment)
            .filter((a): a is string => a != null);
          if (aligned.length < 5) continue;
          const notRight = aligned.filter((a) => a !== "RIGHT");
          if (notRight.length / aligned.length < 0.9) continue;
          return [
            fail(
              deterministicDefaults({
                rule_id: "TABLE_023",
                slide_number: slide.slide_number,
                title: "Numeric column not right-aligned",
                description: `Column ${col + 1} contains numeric data but is not right-aligned.`,
                category: RuleCategory.Tables,
                severity: Severity.Warning,
                expected_value: "Right-aligned",
                actual_value: [...new Set(notRight.map((a) => a.toLowerCase()))].join(", "),
                recommendation: "Right-align numeric columns.",
                shape_id: table.shape_id,
                highlight: table.position,
              }),
            ),
          ];
        }
        return [pass()];
      });
      return results.length ? results : [pass()];
    },
  },
];

export function runTableRules(slide: SlideMetadata) {
  return tableRules.flatMap((rule) => rule.run(slide, {} as never));
}
