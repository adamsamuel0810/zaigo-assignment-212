import { Confidence, Finding, FindingSource } from "@/lib/types";

/**
 * Rules from different engines that describe the same underlying issue. When
 * both fire on a slide we keep only one (preferring the deterministic check).
 */
const CONCEPT_BY_RULE: Record<string, string> = {
  BULLET_005: "parallel-structure",
  AI_PARALLEL_GRAMMAR: "parallel-structure",
};

export function deduplicateFindings(findings: Finding[]): Finding[] {
  const seen = new Map<string, Finding>();

  for (const finding of findings) {
    const concept = CONCEPT_BY_RULE[finding.rule_id];
    const key = concept
      ? `concept:${concept}|${finding.slide_number}`
      : [
          finding.rule_id,
          finding.slide_number,
          finding.actual_value.slice(0, 100),
          finding.shape_id ?? "",
        ].join("|");

    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, finding);
      continue;
    }
    // Keep higher confidence; on a tie prefer the deterministic finding.
    const rank = (f: Finding) =>
      (f.confidence === Confidence.High ? 3 : f.confidence === Confidence.Medium ? 2 : 1) *
        10 +
      (f.source === FindingSource.Deterministic ? 1 : 0);
    if (rank(finding) > rank(existing)) {
      seen.set(key, finding);
    }
  }

  return [...seen.values()];
}

export function filterByConfidence(
  findings: Finding[],
  includeLow: boolean,
): Finding[] {
  if (includeLow) return findings;
  return findings.filter(
    (f) => f.confidence === Confidence.High || f.confidence === Confidence.Medium,
  );
}

export function sortFindings(findings: Finding[]): Finding[] {
  const severityOrder = { ERROR: 0, WARNING: 1, INFO: 2 };
  const confidenceOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };

  return [...findings].sort((a, b) => {
    const sev =
      severityOrder[a.severity] - severityOrder[b.severity];
    if (sev !== 0) return sev;
    const conf =
      confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
    if (conf !== 0) return conf;
    return a.slide_number - b.slide_number;
  });
}
