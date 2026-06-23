import { RuleCategory, Severity, SlideMetadata } from "@/lib/types";
import { fontMatchesCalibri } from "@/lib/rules/constants";
import {
  deterministicDefaults,
  fail,
  isDiagramText,
  pass,
} from "@/lib/rules/helpers";
import { hasExplicitFontFamily, hasExplicitFontSize } from "@/lib/rules/run-style";
import { BaseRule } from "@/lib/types";

export const shapeRules: BaseRule[] = [
  {
    id: "SHAPE_001",
    name: "Shape text must be Calibri",
    description: "Text in diagram/callout shapes must use Calibri (Body).",
    category: RuleCategory.Shapes,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const diagramTexts = slide.texts.filter(isDiagramText);
      const wrong = diagramTexts.flatMap((t) =>
        t.paragraphs.flatMap((p) =>
          p.runs.filter(
            (r) =>
              r.text.trim() &&
              hasExplicitFontFamily(r) &&
              !fontMatchesCalibri(r.font_family),
          ),
        ),
      );
      if (wrong.length === 0) return [pass()];
      return [
        fail(
          deterministicDefaults({
            rule_id: "SHAPE_001",
            slide_number: slide.slide_number,
            title: "Shape text not Calibri",
            description: "Diagram/callout shape text should use Calibri.",
            category: RuleCategory.Shapes,
            severity: Severity.Warning,
            expected_value: "Calibri",
            actual_value: [...new Set(wrong.map((r) => r.font_family ?? "unknown"))].join(
              ", ",
            ),
            recommendation: "Set shape text to Calibri (Body).",
          }),
        ),
      ];
    },
  },
  {
    id: "SHAPE_002",
    name: "Shape text size must be consistent",
    description: "Font size must be consistent across shapes on a slide.",
    category: RuleCategory.Shapes,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const diagramTexts = slide.texts.filter(isDiagramText);
      const sized = diagramTexts.flatMap((t) =>
        t.paragraphs.flatMap((p) =>
          p.runs.filter((r) => r.text.trim() && hasExplicitFontSize(r)),
        ),
      );
      if (sized.length < 3) return [pass()];
      const counts = new Map<number, number>();
      for (const r of sized) {
        const sz = r.font_size_pt as number;
        counts.set(sz, (counts.get(sz) ?? 0) + 1);
      }
      if (counts.size < 2) return [pass()];
      const [dominant, dominantCount] = [...counts.entries()].sort(
        (a, b) => b[1] - a[1],
      )[0];
      if (dominantCount / sized.length < 0.7) return [pass()];
      const outliers = sized.filter(
        (r) => Math.abs((r.font_size_pt as number) - dominant) > 0.5,
      );
      if (outliers.length === 0) return [pass()];
      return [
        fail(
          deterministicDefaults({
            rule_id: "SHAPE_002",
            slide_number: slide.slide_number,
            title: "Inconsistent shape text size",
            description: `Most shape text is ${dominant}pt but some shapes differ.`,
            category: RuleCategory.Shapes,
            severity: Severity.Warning,
            expected_value: `${dominant}pt across shapes`,
            actual_value: [
              ...new Set(outliers.map((r) => `${r.font_size_pt}pt`)),
            ].join(", "),
            recommendation: `Use ${dominant}pt consistently across all shapes.`,
          }),
        ),
      ];
    },
  },
];

export function runShapeRules(slide: SlideMetadata) {
  return shapeRules.flatMap((rule) => rule.run(slide, {} as never));
}
