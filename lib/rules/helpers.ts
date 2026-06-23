import { v4 as uuidv4 } from "uuid";
import {
  Confidence,
  Finding,
  FindingSource,
  RuleResult,
  SlideMetadata,
  TextMetadata,
} from "@/lib/types";

/** Placeholder types that represent the main body content of a content slide. */
const BODY_PLACEHOLDER_TYPES = new Set([
  "BODY",
  "OBJECT",
  "SUBTITLE",
  "CONTENT",
]);

/**
 * True when a text shape is the slide's main body content (a bulleted/text
 * content placeholder) rather than a decorative textbox, diagram shape,
 * slide-number/footer placeholder, or the title.
 *
 * Margin/boundary checks should only apply to this kind of "content" — free
 * textboxes and shapes in diagrams are intentionally placed across the canvas.
 */
export function isBodyContentText(text: TextMetadata): boolean {
  if (text.is_title) return false;
  if (text.is_placeholder && text.placeholder_type) {
    return BODY_PLACEHOLDER_TYPES.has(text.placeholder_type.toUpperCase());
  }
  // Fallback for decks where the placeholder type is not resolvable.
  return /content placeholder|text placeholder/i.test(text.shape_name);
}

/** Minimum width (inches) for a body placeholder to be the slide's main list. */
const MAIN_BODY_MIN_WIDTH_IN = 5.0;

/**
 * The slide's *primary* body content placeholder(s) — wide content areas that
 * hold the main bulleted list. Narrow sidebars, "key/legend" boxes, and
 * compact diagram callouts deliberately use smaller, denser type, so font
 * size / symbol / punctuation checks are scoped to the main body to avoid
 * false positives.
 */
export function isMainBodyText(text: TextMetadata): boolean {
  return (
    isBodyContentText(text) &&
    text.position.width_inches >= MAIN_BODY_MIN_WIDTH_IN
  );
}

export function getMainBulletParagraphs(slide: SlideMetadata) {
  const paragraphs = slide.texts
    .filter(isMainBodyText)
    .flatMap((t) => t.paragraphs);
  return paragraphs.filter(
    (p) =>
      p.text.trim() &&
      (p.level > 0 || (p.bullet_char != null && p.bullet_char !== "auto")),
  );
}

export function createFinding(
  partial: Omit<Finding, "id" | "accepted" | "rejected">,
): Finding {
  return {
    ...partial,
    id: uuidv4(),
    accepted: false,
    rejected: false,
  };
}

export function pass(): RuleResult {
  return { pass: true };
}

export function fail(
  partial: Omit<Finding, "id" | "accepted" | "rejected">,
): RuleResult {
  return {
    pass: false,
    finding: partial,
  };
}

export function getTitleRuns(slide: SlideMetadata) {
  if (!slide.title) return [];
  return slide.title.paragraphs.flatMap((p) => p.runs);
}

export function getTitleText(slide: SlideMetadata): string {
  return slide.title?.full_text?.trim() ?? "";
}

export function countTitleLines(slide: SlideMetadata): number {
  const text = getTitleText(slide);
  if (!text) return 0;
  return text.split(/\r?\n/).filter((l) => l.trim()).length || 1;
}

/**
 * Approximate visual line count of the title by estimating word-wrap inside the
 * title box. Calibrated against the calibration deck so 3-line titles pass and
 * 4+-line titles flag. Uses ~6.8 characters per inch at the 24pt title size and
 * scales inversely with the actual font size.
 */
export function estimateTitleLines(slide: SlideMetadata): number {
  if (!slide.title) return 0;
  const explicit = countTitleLines(slide);

  const width = slide.title.position.width_inches;
  if (!width || width <= 0) return explicit;

  const runs = getTitleRuns(slide).filter((r) => r.text.trim());
  const sizes = runs.map((r) => r.font_size_pt).filter((s): s is number => !!s);
  const fontSize = sizes.length ? Math.max(...sizes) : 24;

  const charsPerInch = 6.8 * (24 / fontSize);
  const charsPerLine = Math.max(1, width * charsPerInch);

  // Sum wrapped lines per explicit paragraph so hard breaks are respected.
  const text = getTitleText(slide);
  const paragraphs = text.split(/\r?\n/).filter((l) => l.trim());
  const wrapped = paragraphs.reduce(
    (sum, p) => sum + Math.max(1, Math.ceil(p.trim().length / charsPerLine)),
    0,
  );

  return Math.max(explicit, wrapped);
}

export function getBulletParagraphs(slide: SlideMetadata) {
  const paragraphs = slide.texts.flatMap((t) => t.paragraphs);
  return paragraphs.filter(
    (p) =>
      p.text.trim() &&
      (p.level > 0 || (p.bullet_char != null && p.bullet_char !== "auto")),
  );
}

export function getFooterText(slide: SlideMetadata): string {
  return slide.confidentiality?.full_text?.trim() ?? "";
}

/**
 * Decorative / diagram text shapes — not the title, body placeholder, or footer.
 * Used for "Collections of PowerPoint Shapes" font rules.
 */
export function isDiagramText(text: TextMetadata): boolean {
  if (text.is_title) return false;
  if (isBodyContentText(text)) return false;
  if (/slide number|page number|footer/i.test(text.shape_name)) return false;
  if (text.position.top_inches > 6.5 && text.full_text.length < 200) {
    if (/confidential|proprietary|privacy/i.test(text.full_text)) return false;
  }
  return text.full_text.trim().length > 0;
}

export function deterministicDefaults(
  partial: Omit<Finding, "id" | "accepted" | "rejected" | "source" | "confidence">,
): Omit<Finding, "id" | "accepted" | "rejected"> {
  return {
    ...partial,
    source: FindingSource.Deterministic,
    confidence: Confidence.High,
  };
}
