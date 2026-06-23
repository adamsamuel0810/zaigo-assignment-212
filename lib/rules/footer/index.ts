import {
  PresentationMetadata,
  RuleCategory,
  Severity,
  SlideMetadata,
} from "@/lib/types";
import { FOOTER_FONT_SIZE_PT, fontMatchesCalibri } from "@/lib/rules/constants";
import { deterministicDefaults, fail, pass } from "@/lib/rules/helpers";
import { BaseRule } from "@/lib/types";

/** The deck's standard footer top/left, taken as the modal position. */
function standardFooterPosition(
  deck: PresentationMetadata,
): { top: number; left: number } | null {
  const tops = new Map<string, number>();
  const lefts = new Map<string, number>();
  for (const s of deck.slides) {
    if (!s.confidentiality) continue;
    const t = s.confidentiality.position.top_inches.toFixed(2);
    const l = s.confidentiality.position.left_inches.toFixed(2);
    tops.set(t, (tops.get(t) ?? 0) + 1);
    lefts.set(l, (lefts.get(l) ?? 0) + 1);
  }
  if (tops.size === 0) return null;
  const mode = (m: Map<string, number>) =>
    parseFloat([...m.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  return { top: mode(tops), left: mode(lefts) };
}

const FOOTER_POSITION_TOLERANCE_IN = 0.06;

/**
 * Minimum overlap (inches) in both axes to treat two boxes as overlapping.
 * The vertical threshold is generous enough to ignore the small text-box
 * padding overlaps that occur when a footnote merely sits just above the footer.
 */
const OVERLAP_MIN_VERTICAL_IN = 0.12;
const OVERLAP_MIN_HORIZONTAL_IN = 0.5;

interface Rect {
  left_inches: number;
  top_inches: number;
  width_inches: number;
  height_inches: number;
}

/** Returns the {horizontal, vertical} intersection size of two boxes in inches. */
function overlapInches(a: Rect, b: Rect) {
  const horizontal =
    Math.min(a.left_inches + a.width_inches, b.left_inches + b.width_inches) -
    Math.max(a.left_inches, b.left_inches);
  const vertical =
    Math.min(a.top_inches + a.height_inches, b.top_inches + b.height_inches) -
    Math.max(a.top_inches, b.top_inches);
  return { horizontal, vertical };
}

export const footerRules: BaseRule[] = [
  {
    id: "FOOTER_001",
    name: "Confidentiality statement must exist",
    description: "Every slide must include the confidentiality statement.",
    category: RuleCategory.Footer,
    severity: Severity.Error,
    run(slide: SlideMetadata) {
      if (slide.has_confidentiality) return [pass()];
      return [
        fail(
          deterministicDefaults({
            rule_id: "FOOTER_001",
            slide_number: slide.slide_number,
            title: "Confidentiality statement removed",
            description:
              "The confidentiality/privacy statement must appear on every slide.",
            category: RuleCategory.Footer,
            severity: Severity.Error,
            expected_value: "Confidentiality statement present",
            actual_value: "Not found",
            recommendation:
              "Restore the standard confidentiality footer from the slide master.",
          }),
        ),
      ];
    },
  },
  {
    id: "FOOTER_002",
    name: "Footer font size must be 8pt",
    description: "Confidentiality statement must be 8pt Calibri.",
    category: RuleCategory.Footer,
    severity: Severity.Error,
    run(slide: SlideMetadata) {
      if (!slide.confidentiality) return [pass()];
      const runs = slide.confidentiality.paragraphs.flatMap((p) => p.runs);
      const wrongSize = runs.filter(
        (r) =>
          r.text.trim() &&
          r.font_size_pt &&
          Math.abs(r.font_size_pt - FOOTER_FONT_SIZE_PT) > 0.5,
      );
      const wrongFont = runs.filter(
        (r) => r.text.trim() && !fontMatchesCalibri(r.font_family),
      );
      if (wrongSize.length === 0 && wrongFont.length === 0) return [pass()];
      return [
        fail(
          deterministicDefaults({
            rule_id: "FOOTER_002",
            slide_number: slide.slide_number,
            title: "Footer formatting incorrect",
            description: "Confidentiality statement must be Calibri 8pt.",
            category: RuleCategory.Footer,
            severity: Severity.Error,
            expected_value: "Calibri 8pt",
            actual_value: [
              ...wrongSize.map((r) => `${r.font_size_pt}pt`),
              ...wrongFont.map((r) => r.font_family ?? "unknown font"),
            ].join(", "),
            recommendation: "Set footer text to Calibri 8pt.",
            shape_id: slide.confidentiality.shape_id,
            highlight: slide.confidentiality.position,
          }),
        ),
      ];
    },
  },
  {
    id: "FOOTER_003",
    name: "Confidentiality statement position",
    description:
      "The confidentiality statement must stay in its standard master position.",
    category: RuleCategory.Footer,
    severity: Severity.Warning,
    run(slide: SlideMetadata, deck: PresentationMetadata) {
      if (!slide.confidentiality || !deck?.slides) return [pass()];
      const standard = standardFooterPosition(deck);
      if (!standard) return [pass()];

      const pos = slide.confidentiality.position;
      const dTop = Math.abs(pos.top_inches - standard.top);
      const dLeft = Math.abs(pos.left_inches - standard.left);
      if (
        dTop <= FOOTER_POSITION_TOLERANCE_IN &&
        dLeft <= FOOTER_POSITION_TOLERANCE_IN
      ) {
        return [pass()];
      }
      return [
        fail(
          deterministicDefaults({
            rule_id: "FOOTER_003",
            slide_number: slide.slide_number,
            title: "Confidentiality statement moved",
            description:
              "The confidentiality statement is not in its standard master position.",
            category: RuleCategory.Footer,
            severity: Severity.Warning,
            expected_value: `≈ ${standard.left.toFixed(2)}", ${standard.top.toFixed(2)}" from top-left`,
            actual_value: `${pos.left_inches.toFixed(2)}", ${pos.top_inches.toFixed(2)}"`,
            recommendation:
              "Restore the confidentiality statement to the standard footer position.",
            shape_id: slide.confidentiality.shape_id,
            highlight: slide.confidentiality.position,
          }),
        ),
      ];
    },
  },
  {
    id: "FOOTER_004",
    name: "Confidentiality statement must not be overlapped",
    description:
      "Other content must not overlap the confidentiality/privacy statement.",
    category: RuleCategory.Footer,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      if (!slide.confidentiality) return [pass()];
      const conf = slide.confidentiality;
      const confPos = conf.position;

      const offender = slide.texts.find((t) => {
        if (t.shape_id === conf.shape_id) return false;
        if (t.is_title) return false;
        if (/slide number|page number/i.test(t.shape_name)) return false;
        if (!t.full_text.trim()) return false;
        const { horizontal, vertical } = overlapInches(confPos, t.position);
        return (
          vertical >= OVERLAP_MIN_VERTICAL_IN &&
          horizontal >= OVERLAP_MIN_HORIZONTAL_IN
        );
      });

      if (!offender) return [pass()];

      return [
        fail(
          deterministicDefaults({
            rule_id: "FOOTER_004",
            slide_number: slide.slide_number,
            title: "Confidentiality statement overlapped by content",
            description:
              "Another text box overlaps the confidentiality/privacy statement.",
            category: RuleCategory.Footer,
            severity: Severity.Warning,
            expected_value: "No content overlapping the confidentiality footer",
            actual_value: `Overlapped by "${offender.full_text.trim().slice(0, 40)}"`,
            recommendation:
              "Move footnotes or other content above the confidentiality footer so they do not overlap.",
            shape_id: conf.shape_id,
            highlight: confPos,
          }),
        ),
      ];
    },
  },
  {
    id: "FOOTER_005",
    name: "Confidentiality legal language modified",
    description: "The confidentiality statement must not be paraphrased.",
    category: RuleCategory.Footer,
    severity: Severity.Warning,
    run(slide: SlideMetadata, deck: PresentationMetadata) {
      if (!slide.confidentiality || !deck?.slides) return [pass()];
      const footers = deck.slides.filter((s) => s.confidentiality);
      if (footers.length < 3) return [pass()];

      const wordCounts = new Map<string, number>();
      for (const s of footers) {
        const words =
          s.confidentiality!.full_text.toLowerCase().match(/\b[a-z]{5,}\b/g) ?? [];
        for (const w of words) wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1);
      }
      const threshold = footers.length * 0.7;
      const standardWords = [...wordCounts.entries()]
        .filter(([, c]) => c >= threshold)
        .map(([w]) => w);

      if (standardWords.length < 2) return [pass()];

      const slideWords = new Set(
        slide.confidentiality.full_text.toLowerCase().match(/\b[a-z]{5,}\b/g) ?? [],
      );
      const missing = standardWords.filter((w) => !slideWords.has(w));
      if (missing.length < 2) return [pass()];

      return [
        fail(
          deterministicDefaults({
            rule_id: "FOOTER_005",
            slide_number: slide.slide_number,
            title: "Confidentiality language modified",
            description:
              "The confidentiality statement appears paraphrased compared to the deck standard.",
            category: RuleCategory.Footer,
            severity: Severity.Warning,
            expected_value: `Includes standard terms: ${standardWords.slice(0, 4).join(", ")}`,
            actual_value: `Missing: ${missing.slice(0, 4).join(", ")}`,
            recommendation:
              "Restore the exact legal confidentiality language from the slide master.",
            shape_id: slide.confidentiality.shape_id,
            highlight: slide.confidentiality.position,
          }),
        ),
      ];
    },
  },
];

export function runFooterRules(slide: SlideMetadata, deck: PresentationMetadata) {
  return footerRules.flatMap((rule) => rule.run(slide, deck));
}
