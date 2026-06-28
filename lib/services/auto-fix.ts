import {
  ACME_PALETTE,
  BULLET_FONT_SIZE_PT,
  TABLE_HEADER_COLOR,
  TABLE_ZEBRA_COLOR,
  TITLE_FONT_SIZE_PT,
  colorDistance,
  isAcmeColor,
  normalizeHex,
} from "@/lib/rules/constants";
import { getMainBulletParagraphs } from "@/lib/rules/helpers";
import { isActualBulletParagraph } from "@/lib/rules/run-style";
import { Finding, PresentationMetadata, SlideMetadata } from "@/lib/types";

export interface AutoFixResult {
  slide: SlideMetadata;
  fixable: boolean;
  applied: string[];
}

const FIXABLE_RULE_IDS = new Set([
  "TITLE_001",
  "TITLE_002",
  "TITLE_003",
  "TITLE_005",
  "BULLET_001",
  "BULLET_002",
  "BULLET_003",
  "BULLET_004",
  "COLOR_001",
  "TABLE_001",
  "TABLE_003",
  "TERM_001",
  "TERM_002",
  "TERM_003",
  "TERM_004",
  "FOOTER_002",
  "FOOTER_004",
  "CHART_004",
]);

export function canAutoFix(ruleId: string): boolean {
  if (FIXABLE_RULE_IDS.has(ruleId)) return true;
  return false;
}

/** Rules that can show preview via deterministic fix, AI assist, or both. */
export function canPreviewFix(ruleId: string): boolean {
  if (canAutoFix(ruleId)) return true;
  if (ruleId.startsWith("AI_")) return true;
  if (AI_PREVIEW_RULE_IDS.has(ruleId)) return true;
  return false;
}

const AI_PREVIEW_RULE_IDS = new Set([
  "BULLET_005",
  "TITLE_004",
  "FOOTER_001",
  "ANNOT_001",
]);

export function needsAiPreview(ruleId: string): boolean {
  if (ruleId.startsWith("AI_")) return true;
  return AI_PREVIEW_RULE_IDS.has(ruleId);
}

function nearestPaletteColor(hex: string): string {
  const normalized = normalizeHex(hex) ?? hex;
  let best = normalized;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const palette of ACME_PALETTE) {
    const d = colorDistance(normalized, palette);
    if (d < bestDist) {
      bestDist = d;
      best = palette;
    }
  }
  return best;
}

function cloneSlide(slide: SlideMetadata): SlideMetadata {
  return structuredClone(slide);
}

function rebuildFullText(paragraphs: { text: string; runs: { text: string }[] }[]): string {
  return paragraphs.map((p) => p.text || p.runs.map((r) => r.text).join("")).join("\n");
}

function syncParagraphText(
  paragraphs: SlideMetadata["texts"][0]["paragraphs"],
): void {
  for (const p of paragraphs) {
    p.text = p.runs.map((r) => r.text).join("");
  }
}

function replaceInTextShape(
  text: SlideMetadata["texts"][0] | NonNullable<SlideMetadata["title"]>,
  pattern: RegExp | string,
  replacement: string,
): boolean {
  let changed = false;
  for (const p of text.paragraphs) {
    for (const run of p.runs) {
      const before = run.text;
      if (typeof pattern === "string") {
        if (run.text.includes(pattern)) {
          run.text = run.text.split(pattern).join(replacement);
        }
      } else if (pattern.test(run.text)) {
        run.text = run.text.replace(pattern, replacement);
        pattern.lastIndex = 0;
      }
      if (run.text !== before) changed = true;
    }
    syncParagraphText(text.paragraphs);
  }
  text.full_text = rebuildFullText(text.paragraphs);
  return changed;
}

function replaceAcrossSlide(
  slide: SlideMetadata,
  pattern: RegExp | string,
  replacement: string,
): boolean {
  let changed = false;
  if (slide.title) changed = replaceInTextShape(slide.title, pattern, replacement) || changed;
  for (const text of slide.texts) {
    changed = replaceInTextShape(text, pattern, replacement) || changed;
  }
  for (const table of slide.tables) {
    for (const cell of table.cells) {
      const before = cell.text;
      if (typeof pattern === "string") {
        if (cell.text.includes(pattern)) {
          cell.text = cell.text.split(pattern).join(replacement);
        }
      } else if (pattern.test(cell.text)) {
        cell.text = cell.text.replace(pattern, replacement);
        pattern.lastIndex = 0;
      }
      if (cell.text !== before) changed = true;
    }
  }
  return changed;
}

function applyRuleFix(
  slide: SlideMetadata,
  finding: Finding,
  deck?: PresentationMetadata,
): string[] {
  const applied: string[] = [];
  void deck;

  switch (finding.rule_id) {
    case "TITLE_001": {
      if (!slide.title) break;
      for (const p of slide.title.paragraphs) {
        for (const run of p.runs) {
          if (!run.text.trim()) continue;
          run.font_family = "Calibri";
          run.bold = true;
        }
      }
      syncParagraphText(slide.title.paragraphs);
      slide.title.full_text = rebuildFullText(slide.title.paragraphs);
      applied.push("Set title to Calibri Bold");
      break;
    }
    case "TITLE_002": {
      if (!slide.title) break;
      for (const p of slide.title.paragraphs) {
        for (const run of p.runs) {
          if (!run.text.trim()) continue;
          run.font_size_pt = TITLE_FONT_SIZE_PT;
        }
      }
      applied.push(`Set title font size to ${TITLE_FONT_SIZE_PT}pt`);
      break;
    }
    case "TITLE_003": {
      if (!slide.title) break;
      for (const p of slide.title.paragraphs) {
        for (const run of p.runs) {
          run.text = run.text.replace(/[.!?]+\s*$/, "");
        }
      }
      syncParagraphText(slide.title.paragraphs);
      slide.title.full_text = rebuildFullText(slide.title.paragraphs);
      applied.push("Removed trailing punctuation from title");
      break;
    }
    case "TITLE_005": {
      if (replaceAcrossSlide(slide, /\bDRAFT\b/gi, "")) {
        applied.push("Removed DRAFT designator");
      }
      slide.contains_draft = false;
      break;
    }
    case "BULLET_001": {
      for (const p of getMainBulletParagraphs(slide)) {
        for (const run of p.runs) {
          if (!run.text.trim()) continue;
          run.font_size_pt = BULLET_FONT_SIZE_PT;
        }
      }
      applied.push(`Set bullet text to ${BULLET_FONT_SIZE_PT}pt`);
      break;
    }
    case "BULLET_002": {
      for (const text of slide.texts) {
        for (const p of text.paragraphs) {
          if (!isActualBulletParagraph(p)) continue;
          for (const run of p.runs) {
            run.text = run.text.replace(/[.!?:;]+\s*$/, "");
          }
          syncParagraphText(text.paragraphs);
        }
        text.full_text = rebuildFullText(text.paragraphs);
      }
      applied.push("Removed trailing punctuation from bullets");
      break;
    }
    case "BULLET_003": {
      for (const text of slide.texts) {
        for (const p of text.paragraphs) {
          if (isActualBulletParagraph(p) && p.level === 0) {
            p.bullet_char = "▪";
          }
        }
      }
      applied.push("Set level 1 bullet symbol to ▪");
      break;
    }
    case "BULLET_004": {
      for (const p of getMainBulletParagraphs(slide)) {
        for (const run of p.runs) {
          if (!run.text.trim()) continue;
          run.font_family = "Calibri";
        }
      }
      applied.push("Set bullet font to Calibri");
      break;
    }
    case "COLOR_001": {
      const snap = (hex: string | null | undefined) => {
        if (!hex) return hex;
        const n = normalizeHex(hex);
        if (!n || isAcmeColor(n)) return n;
        return nearestPaletteColor(n);
      };

      for (const text of [slide.title, ...slide.texts].filter(Boolean)) {
        for (const p of text!.paragraphs) {
          for (const run of p.runs) {
            if (run.color?.hex) run.color.hex = snap(run.color.hex) ?? run.color.hex;
          }
        }
      }
      for (const table of slide.tables) {
        for (const cell of table.cells) {
          if (cell.fill_hex) cell.fill_hex = snap(cell.fill_hex) ?? cell.fill_hex;
          if (cell.font_color_hex) {
            cell.font_color_hex = snap(cell.font_color_hex) ?? cell.font_color_hex;
          }
        }
      }
      for (const shape of slide.shapes) {
        if (shape.fill_hex) shape.fill_hex = snap(shape.fill_hex) ?? shape.fill_hex;
      }
      applied.push("Snapped off-palette colors to nearest ACME color");
      break;
    }
    case "TABLE_001": {
      for (const table of slide.tables) {
        const headerRows = Math.min(2, table.rows);
        for (const cell of table.cells) {
          if (cell.row < headerRows && cell.fill_hex) {
            cell.fill_hex = TABLE_HEADER_COLOR;
          }
        }
        table.header_row_fill_hex = TABLE_HEADER_COLOR;
      }
      applied.push(`Set table header fill to ${TABLE_HEADER_COLOR}`);
      break;
    }
    case "TABLE_003": {
      if (replaceAcrossSlide(slide, /\bpercentile\b/gi, "%ile")) {
        applied.push('Replaced "Percentile" with "%ile"');
      }
      break;
    }
    case "TERM_001": {
      if (replaceAcrossSlide(slide, /\bTGT\b/g, "Target")) {
        applied.push('Replaced "TGT" with "Target"');
      }
      break;
    }
    case "TERM_002": {
      if (replaceAcrossSlide(slide, /Company\s+Name/gi, "Company")) {
        applied.push('Renamed "Company Name" to "Company"');
      }
      break;
    }
    case "TERM_003": {
      const variants = finding.actual_value.split(",").map((v) => v.trim()).filter(Boolean);
      for (const variant of variants) {
        const short = variant.split(/\s+/)[0];
        if (short && short !== variant) {
          replaceAcrossSlide(slide, variant, short);
          applied.push(`Shortened "${variant}" to "${short}"`);
        }
      }
      break;
    }
    case "TERM_004": {
      const match = finding.expected_value.match(/"([^"]+)"/);
      const target = match?.[1];
      const wrong = finding.actual_value.match(/"([^"]+)"/)?.[1];
      if (target && wrong) {
        replaceAcrossSlide(slide, new RegExp(`\\b${wrong}\\b`, "gi"), target);
        applied.push(`Renamed "${wrong}" to "${target}"`);
      }
      break;
    }
    case "FOOTER_002": {
      if (!slide.confidentiality) break;
      for (const p of slide.confidentiality.paragraphs) {
        for (const run of p.runs) {
          run.font_family = "Calibri";
          run.font_size_pt = 8;
        }
      }
      applied.push("Set confidentiality footer to Calibri 8pt");
      break;
    }
    case "FOOTER_004": {
      if (!slide.confidentiality) break;
      for (const p of slide.confidentiality.paragraphs) {
        for (const run of p.runs) {
          run.bold = false;
          run.italic = false;
        }
      }
      applied.push("Removed bold/italic from confidentiality footer");
      break;
    }
    case "CHART_004": {
      for (const chart of slide.charts) {
        if (chart.source_note_text) {
          chart.source_note_italic = true;
        }
      }
      applied.push("Set chart source note to italic");
      break;
    }
    default:
      break;
  }

  if (applied.length === 0) {
    const actual = finding.actual_value.split(";")[0]?.trim();
    const expected = finding.expected_value.trim();
    if (
      actual &&
      expected &&
      actual.length < 80 &&
      expected.length < 80 &&
      actual !== expected &&
      !expected.includes("ACME palette") &&
      !expected.startsWith("≤")
    ) {
      if (replaceAcrossSlide(slide, actual, expected)) {
        applied.push(`Replaced "${actual}" with "${expected}"`);
      }
    }
  }

  return applied;
}

export function applyAutoFix(
  slide: SlideMetadata,
  finding: Finding,
  deck?: PresentationMetadata,
): AutoFixResult {
  if (!canAutoFix(finding.rule_id)) {
    return { slide, fixable: false, applied: [] };
  }

  const fixed = cloneSlide(slide);
  const applied = applyRuleFix(fixed, finding, deck);

  return {
    slide: fixed,
    fixable: applied.length > 0,
    applied,
  };
}
