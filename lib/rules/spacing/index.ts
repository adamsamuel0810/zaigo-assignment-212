import {
  PositionMetadata,
  RuleCategory,
  Severity,
  SlideMetadata,
  SlideType,
} from "@/lib/types";
import {
  deterministicDefaults,
  fail,
  isBodyContentText,
  pass,
} from "@/lib/rules/helpers";
import { BaseRule } from "@/lib/types";

/**
 * Tolerance (inches) applied to positional margin checks.
 *
 * The standard "Title and Content" master places the body placeholder a hair
 * left of the title box, so a literal edge comparison flags every slide. ACME
 * reviewers only care about content that is *visibly* pushed past the title
 * margins, so we ignore sub-quarter-inch offsets that come from the master.
 */
const MARGIN_TOLERANCE_IN = 0.25;

/** Minimum distance from the left edge required for body content. */
const MIN_LEFT_MARGIN_IN = 1.0;

type PositionedItem = {
  position: PositionMetadata;
  shape_id?: string;
};

/**
 * The "content" subject to margin checks: only the main body text
 * placeholder(s).
 *
 * Tables and charts/visuals are deliberately excluded — across ACME decks they
 * routinely span wider than the title box and sit near the slide edges by
 * design (the guidelines even expect a table's first column at a ~0.03"
 * margin). Decorative textboxes, arrows, and diagram shapes are likewise
 * intentionally placed across the canvas. Applying margin checks to them
 * produces false positives, so only the bulleted/text body content is checked.
 */
function marginCheckItems(slide: SlideMetadata): PositionedItem[] {
  return slide.texts.filter(isBodyContentText);
}

export const spacingRules: BaseRule[] = [
  {
    id: "SPACING_001",
    name: "Content should not exceed title boundaries",
    description: "Content must not extend beyond title left/right edges.",
    category: RuleCategory.Spacing,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      if (!slide.title) return [pass()];
      const titleLeft = slide.title.position.left_inches;
      const titleRight =
        slide.title.position.left_inches + slide.title.position.width_inches;

      for (const item of marginCheckItems(slide)) {
        const left = item.position.left_inches;
        const right = item.position.left_inches + item.position.width_inches;
        if (
          left < titleLeft - MARGIN_TOLERANCE_IN ||
          right > titleRight + MARGIN_TOLERANCE_IN
        ) {
          return [
            fail(
              deterministicDefaults({
                rule_id: "SPACING_001",
                slide_number: slide.slide_number,
                title: "Content exceeds title boundaries",
                description:
                  "Body content should align within the title box left/right edges.",
                category: RuleCategory.Spacing,
                severity: Severity.Warning,
                expected_value: `Within ${titleLeft.toFixed(2)}" – ${titleRight.toFixed(2)}"`,
                actual_value: `Content at ${left.toFixed(2)}" – ${right.toFixed(2)}"`,
                recommendation: "Realign content to match title margins.",
                shape_id: item.shape_id,
                highlight: item.position,
              }),
            ),
          ];
        }
      }
      return [pass()];
    },
  },
  {
    id: "SPACING_002",
    name: "Minimum left margin for content",
    description: "No element below header should be less than 1\" from left edge.",
    category: RuleCategory.Spacing,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const titleBottom = slide.title
        ? slide.title.position.top_inches + slide.title.position.height_inches
        : 1.5;

      const belowHeader = marginCheckItems(slide).filter(
        (item) => item.position.top_inches > titleBottom,
      );

      for (const item of belowHeader) {
        if (item.position.left_inches < MIN_LEFT_MARGIN_IN - MARGIN_TOLERANCE_IN) {
          return [
            fail(
              deterministicDefaults({
                rule_id: "SPACING_002",
                slide_number: slide.slide_number,
                title: "Content too close to left edge",
                description: "Content below header must be at least 1\" from left edge.",
                category: RuleCategory.Spacing,
                severity: Severity.Warning,
                expected_value: "≥ 1.0\" from left",
                actual_value: `${item.position.left_inches.toFixed(3)}"`,
                recommendation: "Move content to standard left margin.",
                shape_id: item.shape_id,
                highlight: item.position,
              }),
            ),
          ];
        }
      }
      return [pass()];
    },
  },
  {
    id: "SPACING_004",
    name: "Clear separation between title and body",
    description: "Body content must not overlap the slide title.",
    category: RuleCategory.Spacing,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      // "Clear separation between slide title and body" is a content-slide rule.
      // Title/section slides intentionally overlap title and subtitle boxes.
      if (slide.slide_type !== SlideType.Content) return [pass()];
      if (!slide.title) return [pass()];
      const titleBottom =
        slide.title.position.top_inches + slide.title.position.height_inches;
      const overlapping = marginCheckItems(slide).find(
        (item) => item.position.top_inches < titleBottom - 0.1,
      );
      if (!overlapping) return [pass()];
      return [
        fail(
          deterministicDefaults({
            rule_id: "SPACING_004",
            slide_number: slide.slide_number,
            title: "Body overlaps slide title",
            description: "Body content starts above the bottom of the title box.",
            category: RuleCategory.Spacing,
            severity: Severity.Warning,
            expected_value: `Body below ${titleBottom.toFixed(2)}"`,
            actual_value: `Body at ${overlapping.position.top_inches.toFixed(2)}"`,
            recommendation: "Add clear separation between the title and body content.",
            shape_id: overlapping.shape_id,
            highlight: overlapping.position,
          }),
        ),
      ];
    },
  },
  {
    id: "SPACING_005",
    name: "Tables extend past title right edge",
    description: "Tables should not extend beyond the slide title's right edge.",
    category: RuleCategory.Spacing,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      if (!slide.title || slide.slide_type !== SlideType.Content) return [pass()];
      const titleRight =
        slide.title.position.left_inches + slide.title.position.width_inches;

      for (const table of slide.tables) {
        if (table.rows < 3 || table.cols < 3) continue;
        const tableRight = table.position.left_inches + table.position.width_inches;
        if (tableRight > titleRight + MARGIN_TOLERANCE_IN) {
          return [
            fail(
              deterministicDefaults({
                rule_id: "SPACING_005",
                slide_number: slide.slide_number,
                title: "Table extends past title right edge",
                description:
                  "The table extends beyond the right edge of the slide title box.",
                category: RuleCategory.Spacing,
                severity: Severity.Warning,
                expected_value: `Table right ≤ ${titleRight.toFixed(2)}"`,
                actual_value: `Table right ${tableRight.toFixed(2)}"`,
                recommendation: "Resize or reposition the table within the title margins.",
                shape_id: table.shape_id,
                highlight: table.position,
              }),
            ),
          ];
        }
      }
      return [pass()];
    },
  },
];

export function runSpacingRules(slide: SlideMetadata) {
  return spacingRules.flatMap((rule) => rule.run(slide, {} as never));
}
