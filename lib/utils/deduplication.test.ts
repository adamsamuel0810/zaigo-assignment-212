import { describe, expect, it } from "vitest";
import { deduplicateFindings, filterByConfidence } from "@/lib/utils/deduplication";
import {
  Confidence,
  Finding,
  FindingSource,
  RuleCategory,
  Severity,
} from "@/lib/types";

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: overrides.id ?? "1",
    rule_id: overrides.rule_id ?? "TEST_001",
    slide_number: overrides.slide_number ?? 1,
    title: overrides.title ?? "Test",
    description: overrides.description ?? "Test description",
    category: overrides.category ?? RuleCategory.Title,
    severity: overrides.severity ?? Severity.Error,
    confidence: overrides.confidence ?? Confidence.High,
    expected_value: overrides.expected_value ?? "expected",
    actual_value: overrides.actual_value ?? "actual",
    recommendation: overrides.recommendation ?? "fix it",
    accepted: false,
    rejected: false,
    source: FindingSource.Deterministic,
    ...overrides,
  };
}

describe("deduplicateFindings", () => {
  it("removes duplicate findings by rule and slide", () => {
    const findings = [
      makeFinding({ id: "a", rule_id: "TITLE_001", slide_number: 1 }),
      makeFinding({ id: "b", rule_id: "TITLE_001", slide_number: 1 }),
    ];
    expect(deduplicateFindings(findings)).toHaveLength(1);
  });

  it("keeps higher confidence duplicate", () => {
    const findings = [
      makeFinding({
        id: "a",
        rule_id: "TITLE_001",
        confidence: Confidence.Medium,
      }),
      makeFinding({
        id: "b",
        rule_id: "TITLE_001",
        confidence: Confidence.High,
      }),
    ];
    const result = deduplicateFindings(findings);
    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe(Confidence.High);
  });
});

describe("filterByConfidence", () => {
  it("hides low confidence by default", () => {
    const findings = [
      makeFinding({ confidence: Confidence.High }),
      makeFinding({ id: "2", confidence: Confidence.Low }),
    ];
    expect(filterByConfidence(findings, false)).toHaveLength(1);
    expect(filterByConfidence(findings, true)).toHaveLength(2);
  });
});
