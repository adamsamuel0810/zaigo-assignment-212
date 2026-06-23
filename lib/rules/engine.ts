import {
  Finding,
  PresentationMetadata,
  RuleResult,
  SlideMetadata,
} from "@/lib/types";
import { runTitleRules } from "@/lib/rules/title";
import { runFooterRules } from "@/lib/rules/footer";
import { runBulletRules } from "@/lib/rules/bullets";
import { runTableRules } from "@/lib/rules/tables";
import { runChartRules } from "@/lib/rules/charts";
import { runColorRules } from "@/lib/rules/colors";
import { runSpacingRules } from "@/lib/rules/spacing";
import { runTerminologyRules } from "@/lib/rules/terminology";
import { runParallelRules } from "@/lib/rules/parallel";
import { runFootnoteRules } from "@/lib/rules/footnotes";
import { runShapeRules } from "@/lib/rules/shapes";
import { runAnnotationRules } from "@/lib/rules/annotations";
import { createFinding } from "@/lib/rules/helpers";

const ALL_RULE_RUNNERS = [
  runTitleRules,
  runFooterRules,
  runBulletRules,
  runTableRules,
  runChartRules,
  runColorRules,
  runSpacingRules,
  runTerminologyRules,
  runParallelRules,
  runFootnoteRules,
  runShapeRules,
  runAnnotationRules,
];

export function runDeterministicRules(
  deck: PresentationMetadata,
  slideFilter?: (slide: SlideMetadata) => boolean,
): Finding[] {
  const findings: Finding[] = [];
  const slides = slideFilter
    ? deck.slides.filter(slideFilter)
    : deck.slides;

  for (const slide of slides) {
    try {
      const results: RuleResult[] = ALL_RULE_RUNNERS.flatMap((runner) =>
        runner(slide, deck),
      );
      for (const result of results) {
        if (!result.pass && result.finding) {
          findings.push(createFinding(result.finding));
        }
      }
    } catch {
      // Continue analysis even if one slide fails
    }
  }
  return findings;
}
