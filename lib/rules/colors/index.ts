import { RuleCategory, Severity, SlideMetadata, SlideType } from "@/lib/types";
import { isAcmeColor, normalizeHex } from "@/lib/rules/constants";
import { deterministicDefaults, fail, pass } from "@/lib/rules/helpers";
import { BaseRule } from "@/lib/types";

function collectColors(slide: SlideMetadata): string[] {
  const colors: string[] = [];

  // Text run colors on content slides only — title/section use theme accents (e.g. red DRAFT)
  if (slide.slide_type === SlideType.Content) {
    for (const text of [slide.title, ...slide.texts].filter(Boolean)) {
      for (const para of text!.paragraphs) {
        for (const run of para.runs) {
          if (run.color?.hex) colors.push(run.color.hex);
        }
      }
    }
  }

  for (const table of slide.tables) {
    for (const cell of table.cells) {
      if (cell.fill_hex) colors.push(cell.fill_hex);
      if (cell.font_color_hex) colors.push(cell.font_color_hex);
    }
  }
  for (const shape of slide.shapes) {
    if (shape.fill_hex) colors.push(shape.fill_hex);
  }
  return colors.map((c) => normalizeHex(c)!).filter(Boolean);
}

export const colorRules: BaseRule[] = [
  {
    id: "COLOR_001",
    name: "Colors must belong to ACME palette",
    description: "All colors must be from the approved ACME palette.",
    category: RuleCategory.Colors,
    severity: Severity.Error,
    run(slide: SlideMetadata) {
      const colors = collectColors(slide);
      const invalid = [...new Set(colors.filter((c) => !isAcmeColor(c)))];
      if (invalid.length === 0) return [pass()];
      return [
        fail(
          deterministicDefaults({
            rule_id: "COLOR_001",
            slide_number: slide.slide_number,
            title: "Non-ACME color detected",
            description: "One or more colors are outside the ACME palette.",
            category: RuleCategory.Colors,
            severity: Severity.Error,
            expected_value: "ACME palette colors only",
            actual_value: invalid.join(", "),
            recommendation: "Replace with the nearest ACME palette color.",
          }),
        ),
      ];
    },
  },
];

export function runColorRules(slide: SlideMetadata) {
  return colorRules.flatMap((rule) => rule.run(slide, {} as never));
}
