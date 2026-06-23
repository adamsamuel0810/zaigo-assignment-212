import { PresentationAnalysis } from "@/lib/types";

export function updateFindingStatus(
  analysis: PresentationAnalysis,
  findingId: string,
  action: "accept" | "reject" | "reset",
): PresentationAnalysis {
  const findings = analysis.findings.map((f) => {
    if (f.id !== findingId) return f;
    if (action === "accept") return { ...f, accepted: true, rejected: false };
    if (action === "reject") return { ...f, rejected: true, accepted: false };
    return { ...f, accepted: false, rejected: false };
  });

  const slides = analysis.slides.map((slide) => {
    const slideFindings = findings.filter((f) => f.slide_number === slide.slide_number);
    return {
      ...slide,
      findings: slideFindings,
      accepted_count: slideFindings.filter((f) => f.accepted).length,
      rejected_count: slideFindings.filter((f) => f.rejected).length,
      pending_count: slideFindings.filter((f) => !f.accepted && !f.rejected).length,
    };
  });

  return { ...analysis, findings, slides };
}
