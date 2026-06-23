/** ACME brand color palette from guidelines */
export const ACME_PALETTE = new Set([
  "#FFFFFF",
  "#000000",
  "#75FDF7",
  "#006EBE",
  "#F2F2F2",
  "#808080",
  "#E1FFFE",
  "#BDE3FF",
  "#D9D9D9",
  "#595959",
  "#C7FEFB",
  "#7DC8FF",
  "#BFBFBF",
  "#404040",
  "#ABFEFA",
  "#3EADFF",
  "#A6A6A6",
  "#262626",
  "#18FCF0",
  "#00518C",
  "#808080",
  "#0D0D0D",
  "#03B6AD",
  "#00365E",
  "#7DD7FF",
  "#B9FF6E",
  "#FFFF50",
  "#FF3737",
  "#E3F7FF",
  "#F1FFE1",
  "#FFFFDB",
  "#FFD7D7",
  "#CAEFFF",
  "#E2FFC4",
  "#FFFFB9",
  "#FFAEAE",
  "#B0E8FF",
  "#D6FFA8",
  "#FFFF95",
  "#FF8686",
  "#1EBBFF",
  "#8FFF13",
  "#FBFB00",
  "#E80000",
  "#0085BD",
  "#60B700",
  "#A8A800",
  "#9B0000",
  "#FFCD69",
  "#972FFF",
  "#FFF4DF",
  "#EAD5FF",
  "#FFEBC1",
  "#D5AAFF",
  "#FFE1A4",
  "#C082FF",
  "#FFB00D",
  "#7100E1",
  "#B37800",
  "#4B0097",
]);

export const TABLE_HEADER_COLOR = "#006EBE";
export const TABLE_ZEBRA_COLOR = "#F2F2F2";
export const TABLE_STATS_COLOR = "#FFFFDB";
export const TABLE_CLIENT_COLOR = "#F1FFE1";

export const TITLE_FONT_SIZE_PT = 24;
export const BULLET_FONT_SIZE_PT = 16;
export const FOOTER_FONT_SIZE_PT = 8;
export const TABLE_TITLE_FONT_SIZE_PT = 14;
export const CHART_TITLE_FONT_SIZE_PT = 14;
export const CHART_SOURCE_FONT_SIZE_PT = 9;
export const FOOTNOTE_FONT_SIZE_PT = 10;

export function normalizeHex(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const cleaned = hex.trim().toUpperCase();
  if (cleaned.startsWith("#")) return cleaned;
  return `#${cleaned}`;
}

/**
 * Maximum Euclidean RGB distance at which two colors are treated as the same
 * brand color. PowerPoint theme resolution, anti-aliasing, and minor authoring
 * drift produce near-identical colors (e.g. #006CBD vs the brand #006EBE, or
 * #FFFFDC vs #FFFFDB). Treating these as off-palette creates noise, so we allow
 * a small tolerance. Genuinely foreign colors are far outside this radius.
 */
export const COLOR_MATCH_TOLERANCE = 26;

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

export function colorDistance(a: string, b: string): number {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return Number.POSITIVE_INFINITY;
  return Math.sqrt(
    (ra[0] - rb[0]) ** 2 + (ra[1] - rb[1]) ** 2 + (ra[2] - rb[2]) ** 2,
  );
}

/** Distance from a color to the nearest ACME palette color. */
export function nearestPaletteDistance(hex: string): number {
  let best = Number.POSITIVE_INFINITY;
  for (const palette of ACME_PALETTE) {
    const d = colorDistance(hex, palette);
    if (d < best) best = d;
    if (best === 0) break;
  }
  return best;
}

export function isAcmeColor(hex: string | null | undefined): boolean {
  const normalized = normalizeHex(hex);
  if (!normalized) return true;
  if (ACME_PALETTE.has(normalized)) return true;
  return nearestPaletteDistance(normalized) <= COLOR_MATCH_TOLERANCE;
}

export function fontMatchesCalibri(font: string | null | undefined): boolean {
  if (!font) return true;
  // Theme font reference tokens (e.g. "+mn-lt" minor latin, "+mj-lt" major
  // latin) resolve to the deck theme font, which is Calibri in the ACME master.
  // Treat them as compliant rather than flagging every theme-styled run/cell.
  if (font.trim().startsWith("+")) return true;
  return font.toLowerCase().includes("calibri");
}

/** Icon/symbol fonts used for glyphs (checkmarks, arrows) — not body text. */
export function isSymbolFont(font: string | null | undefined): boolean {
  if (!font) return false;
  return /wingdings|webdings|symbol|marlett/i.test(font);
}

export function approxEqual(a: number, b: number, tolerance = 0.5): boolean {
  return Math.abs(a - b) <= tolerance;
}

export function hexMatches(expected: string, actual: string | null | undefined): boolean {
  return normalizeHex(expected) === normalizeHex(actual);
}

/** True when `actual` is the same brand color as `expected` within tolerance. */
export function colorClose(
  expected: string,
  actual: string | null | undefined,
  tolerance: number = COLOR_MATCH_TOLERANCE,
): boolean {
  const a = normalizeHex(actual);
  if (!a) return true;
  if (normalizeHex(expected) === a) return true;
  return colorDistance(expected, a) <= tolerance;
}

/** Red accent fills used for emphasis callout boxes (guideline line 175). */
const RED_FILL_ANCHORS = ["#FF3737", "#FFD7D7", "#FFAEAE", "#FF8686", "#E80000", "#9B0000"];

export function isRedEmphasisFill(hex: string | null | undefined): boolean {
  const n = normalizeHex(hex);
  if (!n) return false;
  return RED_FILL_ANCHORS.some((r) => colorClose(r, n, 20));
}

/** True when text is a plain numeric value (optionally with commas/decimals). */
export function isPlainNumber(text: string): boolean {
  const t = text.trim().replace(/,/g, "");
  return /^\d+(\.\d+)?$/.test(t);
}

/** True when text looks like a percentage value missing its % symbol. */
export function isPercentWithoutSymbol(text: string): boolean {
  const t = text.trim();
  if (/%/.test(t)) return false;
  if (!isPlainNumber(t.replace(/[$\s]/g, ""))) return false;
  const n = parseFloat(t.replace(/,/g, ""));
  return n >= 0 && n <= 100;
}

/** True when text looks like currency missing a symbol. */
export function isCurrencyWithoutSymbol(text: string): boolean {
  const t = text.trim();
  if (/[$€£¥]/.test(t)) return false;
  if (!/^[\d,]+(\.\d+)?$/.test(t.replace(/\s/g, ""))) return false;
  const n = parseFloat(t.replace(/,/g, ""));
  return n > 100 || t.includes(",");
}
