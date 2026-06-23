"use client";

import { useState } from "react";
import { Check, Copy, Printer, X } from "lucide-react";
import { Finding } from "@/lib/types";
import {
  CATEGORY_IMPROVEMENT,
  buildFinalReport,
  buildReportText,
} from "@/lib/services/report";
import { SeverityBadge } from "@/components/findings/badges";

interface FinalReportModalProps {
  filename: string;
  allFindings: Finding[];
  onClose: () => void;
}

export function FinalReportModal({
  filename,
  allFindings,
  onClose,
}: FinalReportModalProps) {
  const report = buildFinalReport(filename, allFindings);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildReportText(report));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const usedCategories = report.byCategory.map((c) => c.category);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="no-print flex items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              Final compliance report
            </h2>
            <p className="text-xs text-[var(--muted)]">{filename}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-white px-3 py-2 text-xs font-semibold text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-[var(--success)]" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--accent-dark)]"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / Save PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg border border-[var(--border-strong)] bg-white p-2 text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable report body */}
        <div id="final-report" className="overflow-y-auto px-6 py-6">
          <header className="mb-6 border-b border-[var(--border)] pb-4">
            <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
              Brand Compliance — Final Report
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {filename} · Generated {report.generated_at}
            </p>
          </header>

          {report.total === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] px-6 py-10 text-center">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                No accepted issues yet
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">
                Accept findings in the review panel to include them in this
                report.
              </p>
            </div>
          ) : (
            <>
              {/* Executive summary */}
              <section className="mb-6">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted-light)]">
                  Executive summary
                </h2>
                <p className="text-sm leading-relaxed text-[var(--foreground)]">
                  This review confirmed <strong>{report.total}</strong> brand
                  compliance issue{report.total === 1 ? "" : "s"} across{" "}
                  <strong>{report.slidesAffected}</strong> slide
                  {report.slidesAffected === 1 ? "" : "s"} —{" "}
                  <strong>{report.errors}</strong> error
                  {report.errors === 1 ? "" : "s"} and{" "}
                  <strong>{report.warnings}</strong> warning
                  {report.warnings === 1 ? "" : "s"}. Address the items below to
                  bring the deck in line with the ACME brand guidelines.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {report.byCategory.map((c) => (
                    <span
                      key={c.category}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--foreground)]"
                    >
                      {c.category}
                      <span className="font-semibold text-[var(--muted)]">
                        {c.count}
                      </span>
                    </span>
                  ))}
                </div>
              </section>

              {/* How to improve */}
              <section className="mb-6">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted-light)]">
                  How to improve
                </h2>
                <ul className="space-y-2">
                  {usedCategories.map((category) => (
                    <li
                      key={category}
                      className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm leading-relaxed text-[var(--foreground)]"
                    >
                      <span className="font-semibold">{category}: </span>
                      {CATEGORY_IMPROVEMENT[category]}
                    </li>
                  ))}
                </ul>
              </section>

              {/* Detailed issues & fixes */}
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted-light)]">
                  Issues &amp; fixes
                </h2>
                <div className="space-y-5">
                  {report.groups.map((group) => (
                    <div key={group.slide_number}>
                      <h3 className="mb-2 text-sm font-bold text-[var(--foreground)]">
                        Slide {group.slide_number}
                      </h3>
                      <div className="space-y-2.5">
                        {group.findings.map((f) => (
                          <div
                            key={f.id}
                            className="rounded-lg border border-[var(--border)] p-3"
                          >
                            <div className="mb-1.5 flex items-center gap-2">
                              <SeverityBadge severity={f.severity} />
                              <span className="text-sm font-semibold text-[var(--foreground)]">
                                {f.title}
                              </span>
                              <span className="ml-auto font-mono text-[10px] text-[var(--muted-light)]">
                                {f.rule_id}
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed text-[var(--muted)]">
                              <span className="font-medium text-[var(--foreground)]">
                                Expected:
                              </span>{" "}
                              {f.expected_value}
                              {" · "}
                              <span className="font-medium text-[var(--error)]">
                                Found:
                              </span>{" "}
                              {f.actual_value}
                            </p>
                            {f.recommendation && (
                              <p className="mt-1.5 text-xs leading-relaxed text-[var(--foreground)]">
                                <span className="font-semibold text-[var(--success)]">
                                  Fix:{" "}
                                </span>
                                {f.recommendation}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
