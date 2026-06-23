import { RuleCategory, Severity, SlideMetadata } from "@/lib/types";
import { CHART_SOURCE_FONT_SIZE_PT, CHART_TITLE_FONT_SIZE_PT } from "@/lib/rules/constants";
import { deterministicDefaults, fail, pass } from "@/lib/rules/helpers";
import { BaseRule } from "@/lib/types";

export const chartRules: BaseRule[] = [
  {
    id: "CHART_001",
    name: "Chart title size should be 14pt",
    description: "Chart titles must be Calibri Bold 14pt.",
    category: RuleCategory.Charts,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const results = slide.charts.flatMap((chart) => {
        if (!chart.has_title || !chart.title_font_size_pt) return [pass()];
        if (Math.abs(chart.title_font_size_pt - CHART_TITLE_FONT_SIZE_PT) > 0.5) {
          return [
            fail(
              deterministicDefaults({
                rule_id: "CHART_001",
                slide_number: slide.slide_number,
                title: "Chart title size incorrect",
                description: "Chart titles should be 14pt bold.",
                category: RuleCategory.Charts,
                severity: Severity.Warning,
                expected_value: "14pt",
                actual_value: `${chart.title_font_size_pt}pt`,
                recommendation: "Set chart title to Calibri Bold 14pt.",
                shape_id: chart.shape_id,
                highlight: chart.position,
              }),
            ),
          ];
        }
        return [pass()];
      });
      return results.length ? results : [pass()];
    },
  },
  {
    id: "CHART_002",
    name: "Chart source note should be 9pt italic",
    description: "Chart source notes must be 9pt italic below the chart.",
    category: RuleCategory.Charts,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const chartTexts = slide.texts.filter((t) => {
        // Only a *chart source note* — text that begins with "Source" and sits
        // directly below a chart/picture. Slide footnotes (e.g. "(1) Source
        // for…") are a separate element at 10pt italic and must not be flagged.
        if (!/^\s*source\b/i.test(t.full_text)) return false;
        return slide.charts.some((c) => {
          const belowChart =
            t.position.top_inches >=
              c.position.top_inches + c.position.height_inches - 0.2 &&
            t.position.top_inches <=
              c.position.top_inches + c.position.height_inches + 0.6;
          const horizontallyOverlaps =
            t.position.left_inches <
              c.position.left_inches + c.position.width_inches &&
            t.position.left_inches + t.position.width_inches >
              c.position.left_inches;
          return belowChart && horizontallyOverlaps;
        });
      });
      const results = chartTexts.flatMap((text) => {
        const runs = text.paragraphs.flatMap((p) => p.runs);
        const wrong = runs.filter(
          (r) =>
            r.text.trim() &&
            r.font_size_pt &&
            Math.abs(r.font_size_pt - CHART_SOURCE_FONT_SIZE_PT) > 0.5,
        );
        if (wrong.length === 0) return [pass()];
        return [
          fail(
            deterministicDefaults({
              rule_id: "CHART_002",
              slide_number: slide.slide_number,
              title: "Chart source note formatting",
              description: "Source notes below charts must be 9pt italic.",
              category: RuleCategory.Charts,
              severity: Severity.Warning,
              expected_value: "9pt italic",
              actual_value: wrong.map((r) => `${r.font_size_pt}pt italic=${r.italic}`).join(", "),
              recommendation: "Format chart source as Calibri 9pt italic.",
              shape_id: text.shape_id,
              highlight: text.position,
            }),
          ),
        ];
      });
      return results.length ? results : [pass()];
    },
  },
  {
    id: "CHART_003",
    name: "Charts need labeled axes/legend",
    description: "Native charts must clearly label axes and legends.",
    category: RuleCategory.Charts,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      // Only native PowerPoint charts expose this; pictures-from-Excel (the ACME
      // norm) carry their labels inside the image and are skipped.
      const results = slide.charts.flatMap((chart) => {
        if (!chart.is_native_chart) return [pass()];
        const noLegend = chart.has_legend === false;
        const noAxisTitles = chart.has_axis_titles === false;
        if (!noLegend || !noAxisTitles) return [pass()];
        return [
          fail(
            deterministicDefaults({
              rule_id: "CHART_003",
              slide_number: slide.slide_number,
              title: "Chart missing axis labels/legend",
              description: "The chart has neither a legend nor labeled axes.",
              category: RuleCategory.Charts,
              severity: Severity.Warning,
              expected_value: "Labeled axes and legend",
              actual_value: "No legend and no axis titles",
              recommendation: "Add clear axis labels and a legend to the chart.",
              shape_id: chart.shape_id,
              highlight: chart.position,
            }),
          ),
        ];
      });
      return results.length ? results : [pass()];
    },
  },
  {
    id: "CHART_004",
    name: "Chart title must be bold",
    description: "Native chart titles must be Calibri Bold.",
    category: RuleCategory.Charts,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const results = slide.charts.flatMap((chart) => {
        if (!chart.is_native_chart || !chart.has_title) return [pass()];
        if (chart.title_bold !== false) return [pass()];
        return [
          fail(
            deterministicDefaults({
              rule_id: "CHART_004",
              slide_number: slide.slide_number,
              title: "Chart title not bold",
              description: "Chart titles must be Calibri Bold 14pt.",
              category: RuleCategory.Charts,
              severity: Severity.Warning,
              expected_value: "Bold",
              actual_value: "Not bold",
              recommendation: "Set the chart title to Calibri Bold 14pt.",
              shape_id: chart.shape_id,
              highlight: chart.position,
            }),
          ),
        ];
      });
      return results.length ? results : [pass()];
    },
  },
];

export function runChartRules(slide: SlideMetadata) {
  return chartRules.flatMap((rule) => rule.run(slide, {} as never));
}
