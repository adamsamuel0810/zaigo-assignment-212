import { Finding, RuleCategory, Severity } from "@/lib/types";

/**
 * General, brand-guideline-based improvement guidance per rule category. The
 * per-finding `recommendation` covers the specific fix; this gives the broader
 * "how to improve" method that frames those fixes.
 */
export const CATEGORY_IMPROVEMENT: Record<RuleCategory, string> = {
  [RuleCategory.Title]:
    "Apply the master title style — Calibri Bold 24pt, bottom-aligned in its default position — and keep titles to at most three lines with no ending punctuation.",
  [RuleCategory.Footer]:
    "Restore the confidentiality statement from the slide master on every slide (Calibri 8pt) and keep it in its standard position, clear of any other content.",
  [RuleCategory.Bullets]:
    "Use the standard bullet style with consistent sizing and parallel grammatical structure (start every bullet with the same part of speech).",
  [RuleCategory.Tables]:
    "Use the ACME table palette (header #006EBE, white/#F2F2F2 zebra body, yellow stats rows, green client rows) and a single consistent font size across the whole table.",
  [RuleCategory.Charts]:
    "Give every chart a clear title and a source note directly beneath it, with labeled axes and scales.",
  [RuleCategory.Colors]:
    "Restrict all fills and text to the approved ACME color palette; replace any off-brand colors with their nearest palette equivalent.",
  [RuleCategory.Spacing]:
    "Align elements to the standard slide margins and keep spacing even and consistent between repeated elements.",
  [RuleCategory.Shapes]:
    "Use approved shape styles and keep alignment, sizing, and spacing consistent across the deck.",
  [RuleCategory.WritingStyle]:
    "Tighten copy for clarity and a consistent, professional voice across slides.",
  [RuleCategory.Terminology]:
    "Use approved ACME terminology consistently across the deck (e.g., “%ile” not “Percentile”, “Company” not “Company Name”, “Executive” not “Incumbent”).",
  [RuleCategory.Footnotes]:
    "Format footnotes and sources as Calibri italic (slide footnotes 10pt, chart source notes 9pt) and place them at the bottom of the slide.",
};

export interface ReportSlideGroup {
  slide_number: number;
  findings: Finding[];
}

export interface FinalReport {
  filename: string;
  generated_at: string;
  total: number;
  errors: number;
  warnings: number;
  slidesAffected: number;
  byCategory: { category: RuleCategory; count: number }[];
  groups: ReportSlideGroup[];
}

/** Build the structured final report from the deck's accepted findings. */
export function buildFinalReport(
  filename: string,
  allFindings: Finding[],
): FinalReport {
  const accepted = allFindings.filter((f) => f.accepted);

  const groupsMap = new Map<number, Finding[]>();
  for (const f of accepted) {
    const list = groupsMap.get(f.slide_number) ?? [];
    list.push(f);
    groupsMap.set(f.slide_number, list);
  }
  const groups: ReportSlideGroup[] = [...groupsMap.entries()]
    .map(([slide_number, findings]) => ({ slide_number, findings }))
    .sort((a, b) => a.slide_number - b.slide_number);

  const categoryCounts = new Map<RuleCategory, number>();
  for (const f of accepted) {
    categoryCounts.set(f.category, (categoryCounts.get(f.category) ?? 0) + 1);
  }

  return {
    filename,
    generated_at: new Date().toLocaleString(),
    total: accepted.length,
    errors: accepted.filter((f) => f.severity === Severity.Error).length,
    warnings: accepted.filter((f) => f.severity === Severity.Warning).length,
    slidesAffected: groups.length,
    byCategory: [...categoryCounts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    groups,
  };
}

/** Plain-text (Markdown) rendering of the report, for copy / export. */
export function buildReportText(report: FinalReport): string {
  const lines: string[] = [];
  lines.push(`# Brand Compliance — Final Report`);
  lines.push(`File: ${report.filename}`);
  lines.push(`Generated: ${report.generated_at}`);
  lines.push("");
  lines.push(`## Summary`);
  lines.push(
    `${report.total} confirmed issue${report.total === 1 ? "" : "s"} across ${report.slidesAffected} slide${report.slidesAffected === 1 ? "" : "s"} (${report.errors} error${report.errors === 1 ? "" : "s"}, ${report.warnings} warning${report.warnings === 1 ? "" : "s"}).`,
  );
  if (report.byCategory.length > 0) {
    lines.push("");
    lines.push(`By category:`);
    for (const c of report.byCategory) {
      lines.push(`- ${c.category}: ${c.count}`);
    }
  }

  const usedCategories = new Set(report.byCategory.map((c) => c.category));
  if (usedCategories.size > 0) {
    lines.push("");
    lines.push(`## How to improve`);
    for (const category of usedCategories) {
      lines.push(`- ${category}: ${CATEGORY_IMPROVEMENT[category]}`);
    }
  }

  lines.push("");
  lines.push(`## Issues & fixes`);
  for (const group of report.groups) {
    lines.push("");
    lines.push(`### Slide ${group.slide_number}`);
    for (const f of group.findings) {
      lines.push(`- [${f.severity}] ${f.title}`);
      if (f.expected_value || f.actual_value) {
        lines.push(`    Expected: ${f.expected_value} | Found: ${f.actual_value}`);
      }
      if (f.recommendation) {
        lines.push(`    Fix: ${f.recommendation}`);
      }
    }
  }

  return lines.join("\n");
}
