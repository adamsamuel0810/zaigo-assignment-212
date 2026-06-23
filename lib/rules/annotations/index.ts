import { RuleCategory, Severity, SlideMetadata } from "@/lib/types";
import { isRedEmphasisFill } from "@/lib/rules/constants";
import { deterministicDefaults, fail, getTitleText, pass } from "@/lib/rules/helpers";
import { BaseRule } from "@/lib/types";

/** Extract meaningful words (4+ chars) from text for loose headline matching. */
function keyWords(text: string): Set<string> {
  const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? [];
  return new Set(words);
}

export const annotationRules: BaseRule[] = [
  {
    id: "ANNOT_001",
    name: "Red callout should be referenced in headline",
    description:
      "Information in a red emphasis box should also appear in the slide headline.",
    category: RuleCategory.Shapes,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const titleText = getTitleText(slide);
      if (!titleText) return [pass()];

      const redBoxes = slide.texts.filter(
        (t) =>
          !t.is_title &&
          t.fill_hex &&
          isRedEmphasisFill(t.fill_hex) &&
          t.full_text.trim().length > 3,
      );
      if (redBoxes.length === 0) return [pass()];

      const titleWords = keyWords(titleText);
      const unmatched = redBoxes.filter((box) => {
        const boxWords = keyWords(box.full_text);
        if (boxWords.size === 0) return false;
        let overlap = 0;
        for (const w of boxWords) if (titleWords.has(w)) overlap += 1;
        return overlap / boxWords.size < 0.25;
      });
      if (unmatched.length === 0) return [pass()];

      return [
        fail(
          deterministicDefaults({
            rule_id: "ANNOT_001",
            slide_number: slide.slide_number,
            title: "Red callout not reflected in headline",
            description:
              "Red emphasis box content should be referenced in the slide title.",
            category: RuleCategory.Shapes,
            severity: Severity.Warning,
            expected_value: "Callout topic appears in headline",
            actual_value: `"${unmatched[0].full_text.trim().slice(0, 50)}"`,
            recommendation:
              "Update the headline to reference the highlighted callout information.",
            shape_id: unmatched[0].shape_id,
            highlight: unmatched[0].position,
          }),
        ),
      ];
    },
  },
];

export function runAnnotationRules(slide: SlideMetadata) {
  return annotationRules.flatMap((rule) => rule.run(slide, {} as never));
}
