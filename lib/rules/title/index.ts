import {
  PresentationMetadata,
  RuleCategory,
  Severity,
  SlideMetadata,
  SlideType,
} from "@/lib/types";
import {
  TITLE_FONT_SIZE_PT,
  fontMatchesCalibri,
} from "@/lib/rules/constants";
import {
  deterministicDefaults,
  estimateTitleLines,
  fail,
  getTitleRuns,
  getTitleText,
  pass,
} from "@/lib/rules/helpers";
import {
  hasExplicitBold,
  hasExplicitFontFamily,
  hasExplicitFontSize,
} from "@/lib/rules/run-style";
import { BaseRule } from "@/lib/types";

/**
 * A title is "moved" when its anchor (left edge / bottom edge) deviates from
 * the deck's standard by at least this much. Below this we treat differences as
 * normal autofit jitter.
 */
const TITLE_MOVE_MIN_IN = 0.25;
/**
 * Deviations beyond this almost always mean a deliberately different layout
 * (e.g. a centered section/divider title), not an accidental nudge, so we skip
 * them to avoid false positives.
 */
const TITLE_MOVE_MAX_IN = 1.5;

/**
 * The deck's standard title anchor (modal left edge and modal bottom edge of
 * the title box across content slides). Titles are bottom-aligned in the ACME
 * master, so the bottom edge is the stable reference point.
 */
function standardTitleAnchor(
  deck: PresentationMetadata,
): { left: number; bottom: number } | null {
  if (!deck?.slides) return null;
  const lefts = new Map<string, number>();
  const bottoms = new Map<string, number>();
  for (const s of deck.slides) {
    if (s.slide_type !== SlideType.Content || !s.title) continue;
    const p = s.title.position;
    const l = p.left_inches.toFixed(2);
    const b = (p.top_inches + p.height_inches).toFixed(2);
    lefts.set(l, (lefts.get(l) ?? 0) + 1);
    bottoms.set(b, (bottoms.get(b) ?? 0) + 1);
  }
  if (bottoms.size === 0) return null;
  const top = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1])[0];
  const [leftVal, leftCount] = top(lefts);
  const [bottomVal] = top(bottoms);
  // Need a real standard shared by several slides to compare against.
  if (leftCount < 3) return null;
  return { left: parseFloat(leftVal), bottom: parseFloat(bottomVal) };
}

const movedFromDefault = (dev: number) =>
  dev >= TITLE_MOVE_MIN_IN && dev <= TITLE_MOVE_MAX_IN;

export const titleRules: BaseRule[] = [
  {
    id: "TITLE_001",
    name: "Title font must be Calibri Bold",
    description: "Slide titles must use Calibri Bold per ACME brand guidelines.",
    category: RuleCategory.Title,
    severity: Severity.Error,
    run(slide: SlideMetadata) {
      if (!slide.title || slide.slide_type === SlideType.Section) return [pass()];
      const runs = getTitleRuns(slide);
      const offenders = runs.filter((r) => {
        if (!r.text.trim()) return false;
        if (hasExplicitFontFamily(r) && !fontMatchesCalibri(r.font_family)) {
          return true;
        }
        if (hasExplicitBold(r) && r.bold === false) {
          return true;
        }
        return false;
      });
      if (offenders.length === 0) return [pass()];
      return [
        fail(
          deterministicDefaults({
            rule_id: "TITLE_001",
            slide_number: slide.slide_number,
            title: "Title font must be Calibri Bold",
            description: "One or more title text runs are not Calibri Bold.",
            category: RuleCategory.Title,
            severity: Severity.Error,
            expected_value: "Calibri Bold",
            actual_value: offenders
              .map((r) => `${r.font_family ?? "unknown"} bold=${r.bold}`)
              .join(", "),
            recommendation: "Set the slide title to Calibri Bold, 24pt.",
            shape_id: slide.title.shape_id,
            highlight: slide.title.position,
          }),
        ),
      ];
    },
  },
  {
    id: "TITLE_002",
    name: "Title size must be 24pt",
    description: "Slide titles must be 24pt.",
    category: RuleCategory.Title,
    severity: Severity.Error,
    run(slide: SlideMetadata) {
      if (!slide.title) return [pass()];
      const runs = getTitleRuns(slide).filter(
        (r) => r.text.trim() && hasExplicitFontSize(r),
      );
      const wrong = runs.filter(
        (r) => r.font_size_pt && Math.abs(r.font_size_pt - TITLE_FONT_SIZE_PT) > 0.5,
      );
      if (wrong.length === 0) return [pass()];
      return [
        fail(
          deterministicDefaults({
            rule_id: "TITLE_002",
            slide_number: slide.slide_number,
            title: "Title size must be 24pt",
            description: "Title font size deviates from the 24pt standard.",
            category: RuleCategory.Title,
            severity: Severity.Error,
            expected_value: "24pt",
            actual_value: wrong.map((r) => `${r.font_size_pt}pt`).join(", "),
            recommendation: "Set title font size to 24pt.",
            shape_id: slide.title.shape_id,
            highlight: slide.title.position,
          }),
        ),
      ];
    },
  },
  {
    id: "TITLE_003",
    name: "Title should not end with punctuation",
    description: "Slide titles must not end with punctuation.",
    category: RuleCategory.Title,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const text = getTitleText(slide);
      if (!text) return [pass()];
      // A trailing colon introducing a list/table below is acceptable in ACME
      // decks; only sentence-ending punctuation (. ! ?) is flagged.
      if (/[.!?]$/.test(text.trim())) {
        return [
          fail(
            deterministicDefaults({
              rule_id: "TITLE_003",
              slide_number: slide.slide_number,
              title: "Title ends with punctuation",
              description: "ACME titles should not end with punctuation.",
              category: RuleCategory.Title,
              severity: Severity.Warning,
              expected_value: "No ending punctuation",
              actual_value: text.trim().slice(-1),
              recommendation: "Remove trailing punctuation from the title.",
              shape_id: slide.title?.shape_id,
              highlight: slide.title?.position,
            }),
          ),
        ];
      }
      return [pass()];
    },
  },
  {
    id: "TITLE_004",
    name: "Title should not exceed three lines",
    description: "Flag titles exceeding three lines.",
    category: RuleCategory.Title,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const lines = estimateTitleLines(slide);
      if (lines <= 3) return [pass()];
      return [
        fail(
          deterministicDefaults({
            rule_id: "TITLE_004",
            slide_number: slide.slide_number,
            title: "Title exceeds three lines",
            description: `Title spans ${lines} lines; ACME recommends a maximum of three.`,
            category: RuleCategory.Title,
            severity: Severity.Warning,
            expected_value: "≤ 3 lines",
            actual_value: `${lines} lines`,
            recommendation: "Shorten the title or split content across slides.",
            shape_id: slide.title?.shape_id,
            highlight: slide.title?.position,
          }),
        ),
      ];
    },
  },
  {
    id: "TITLE_005",
    name: "Title slide must not contain DRAFT",
    description: "Title slides must have a valid date and no DRAFT designator.",
    category: RuleCategory.Title,
    severity: Severity.Error,
    run(slide: SlideMetadata) {
      if (slide.slide_type !== SlideType.Title) return [pass()];
      if (!slide.contains_draft) return [pass()];
      return [
        fail(
          deterministicDefaults({
            rule_id: "TITLE_005",
            slide_number: slide.slide_number,
            title: "DRAFT designator on title slide",
            description: "Title slides must not include a DRAFT notice.",
            category: RuleCategory.Title,
            severity: Severity.Error,
            expected_value: "No DRAFT designation",
            actual_value: "DRAFT detected",
            recommendation: "Remove DRAFT and ensure a valid date is present.",
          }),
        ),
      ];
    },
  },
  {
    id: "TITLE_006",
    name: "Title slide must include date",
    description: "Title slides must note a valid date.",
    category: RuleCategory.Title,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      if (slide.slide_type !== SlideType.Title) return [pass()];
      if (slide.date_text) return [pass()];
      return [
        fail(
          deterministicDefaults({
            rule_id: "TITLE_006",
            slide_number: slide.slide_number,
            title: "Missing date on title slide",
            description: "Title slides should include a valid date.",
            category: RuleCategory.Title,
            severity: Severity.Warning,
            expected_value: "Valid date present",
            actual_value: "No date found",
            recommendation: "Add a formatted date to the title slide.",
          }),
        ),
      ];
    },
  },
  {
    id: "TITLE_007",
    name: "Title must stay in its default position",
    description:
      "Slide titles must stay in the standard master position used across the deck.",
    category: RuleCategory.Title,
    severity: Severity.Warning,
    run(slide: SlideMetadata, deck: PresentationMetadata) {
      if (!slide.title || slide.slide_type !== SlideType.Content) {
        return [pass()];
      }
      const standard = standardTitleAnchor(deck);
      if (!standard) return [pass()];

      const p = slide.title.position;
      const leftDev = Math.abs(p.left_inches - standard.left);
      const bottomDev = Math.abs(p.top_inches + p.height_inches - standard.bottom);

      if (!movedFromDefault(leftDev) && !movedFromDefault(bottomDev)) {
        return [pass()];
      }
      return [
        fail(
          deterministicDefaults({
            rule_id: "TITLE_007",
            slide_number: slide.slide_number,
            title: "Title moved from default position",
            description:
              "The title box is not in the standard position used by the rest of the deck.",
            category: RuleCategory.Title,
            severity: Severity.Warning,
            expected_value: `left ≈ ${standard.left.toFixed(2)}", bottom ≈ ${standard.bottom.toFixed(2)}"`,
            actual_value: `left ${p.left_inches.toFixed(2)}", bottom ${(p.top_inches + p.height_inches).toFixed(2)}"`,
            recommendation:
              "Restore the title box to the default position from the slide master.",
            shape_id: slide.title.shape_id,
            highlight: slide.title.position,
          }),
        ),
      ];
    },
  },
];

/** True when the text is written in all-caps (clearly not sentence case). */
function isAllCaps(text: string): boolean {
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length < 3) return false;
  // Must contain a space (multiple words) so a lone acronym isn't flagged.
  if (!/\s/.test(text.trim())) return false;
  return letters === letters.toUpperCase() && letters !== letters.toLowerCase();
}

titleRules.push({
  id: "TITLE_008",
  name: "Title must use sentence case",
  description: "Slide titles must use sentence case, not all caps.",
  category: RuleCategory.Title,
  severity: Severity.Warning,
  run(slide: SlideMetadata) {
    if (!slide.title || slide.slide_type === SlideType.Section) return [pass()];
    const text = getTitleText(slide);
    if (!text || !isAllCaps(text)) return [pass()];
    return [
      fail(
        deterministicDefaults({
          rule_id: "TITLE_008",
          slide_number: slide.slide_number,
          title: "Title is not in sentence case",
          description: "ACME titles use sentence case; this title is all caps.",
          category: RuleCategory.Title,
          severity: Severity.Warning,
          expected_value: "Sentence case",
          actual_value: text.slice(0, 60),
          recommendation: "Rewrite the title in sentence case.",
          shape_id: slide.title.shape_id,
          highlight: slide.title.position,
        }),
      ),
    ];
  },
});

titleRules.push({
  id: "TITLE_009",
  name: "Section header font must be Calibri",
  description: "Section header slides must use the Calibri (Headings) typeface.",
  category: RuleCategory.Title,
  severity: Severity.Error,
  run(slide: SlideMetadata) {
    // Content-slide titles are covered by TITLE_001 (Calibri Bold). This rule
    // covers section/divider slides, where the guideline only requires Calibri
    // 24pt (not necessarily bold).
    if (slide.slide_type !== SlideType.Section || !slide.title) return [pass()];
    const offenders = getTitleRuns(slide).filter(
      (r) =>
        r.text.trim() &&
        hasExplicitFontFamily(r) &&
        !fontMatchesCalibri(r.font_family),
    );
    if (offenders.length === 0) return [pass()];
    return [
      fail(
        deterministicDefaults({
          rule_id: "TITLE_009",
          slide_number: slide.slide_number,
          title: "Section header font not Calibri",
          description: "Section header text is not set in Calibri.",
          category: RuleCategory.Title,
          severity: Severity.Error,
          expected_value: "Calibri (Headings), 24pt",
          actual_value: [
            ...new Set(offenders.map((r) => r.font_family ?? "unknown")),
          ].join(", "),
          recommendation: "Set the section header to Calibri 24pt.",
          shape_id: slide.title.shape_id,
          highlight: slide.title.position,
        }),
      ),
    ];
  },
});

titleRules.push({
  id: "TITLE_010",
  name: "Title slide must identify authors",
  description: "Title slides must list the presentation authors.",
  category: RuleCategory.Title,
  severity: Severity.Warning,
  run(slide: SlideMetadata) {
    if (slide.slide_type !== SlideType.Title) return [pass()];
    if (slide.authors.length > 0) return [pass()];
    return [
      fail(
        deterministicDefaults({
          rule_id: "TITLE_010",
          slide_number: slide.slide_number,
          title: "Authors not identified on title slide",
          description: "Title slides must identify the authors.",
          category: RuleCategory.Title,
          severity: Severity.Warning,
          expected_value: "Author name(s) present",
          actual_value: "No authors found",
          recommendation: "Add author names to the title slide.",
        }),
      ),
    ];
  },
});

function standardTitleDimensions(
  deck: PresentationMetadata,
): { width: number; height: number } | null {
  const widths = new Map<string, number>();
  const heights = new Map<string, number>();
  for (const s of deck.slides) {
    if (s.slide_type !== SlideType.Content || !s.title) continue;
    const w = s.title.position.width_inches.toFixed(2);
    const h = s.title.position.height_inches.toFixed(2);
    widths.set(w, (widths.get(w) ?? 0) + 1);
    heights.set(h, (heights.get(h) ?? 0) + 1);
  }
  if (widths.size === 0) return null;
  const mode = (m: Map<string, number>) =>
    parseFloat([...m.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  const wCount = [...widths.values()].sort((a, b) => b - a)[0];
  if (wCount < 3) return null;
  return { width: mode(widths), height: mode(heights) };
}

const TITLE_SIZE_TOLERANCE_IN = 0.5;

titleRules.push({
  id: "TITLE_011",
  name: "Title box wider than master",
  description:
    'Title placeholder must not be wider than the "Title and Content" master.',
  category: RuleCategory.Title,
  severity: Severity.Warning,
  run(slide: SlideMetadata, deck: PresentationMetadata) {
    if (!slide.title || slide.slide_type !== SlideType.Content) return [pass()];
    const standard = standardTitleDimensions(deck);
    if (!standard) return [pass()];
    const p = slide.title.position;
    // Only flag when the title box is wider than the deck standard. A narrower
    // title box is common and acceptable; widening past the master is not.
    if (p.width_inches <= standard.width + TITLE_SIZE_TOLERANCE_IN) return [pass()];
    return [
      fail(
        deterministicDefaults({
          rule_id: "TITLE_011",
          slide_number: slide.slide_number,
          title: "Title box wider than master",
          description: "The title placeholder is wider than the standard master width.",
          category: RuleCategory.Title,
          severity: Severity.Warning,
          expected_value: `≤ ${standard.width.toFixed(2)}" wide`,
          actual_value: `${p.width_inches.toFixed(2)}" wide`,
          recommendation: "Reset the title box width to the default master size.",
          shape_id: slide.title.shape_id,
          highlight: slide.title.position,
        }),
      ),
    ];
  },
});

export function runTitleRules(
  slide: SlideMetadata,
  deck: PresentationMetadata,
) {
  return titleRules.flatMap((rule) => rule.run(slide, deck));
}
