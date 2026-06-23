"use client";

import { useState } from "react";
import { ChevronDown, FileCheck2, FileText } from "lucide-react";
import { Finding, Severity } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

interface ReviewSummaryProps {
  /** Deck-wide findings (all slides). */
  allFindings: Finding[];
  onOpenReport: () => void;
}

/**
 * Footer panel that sums every accepted issue across the whole deck and
 * summarizes the presentation's compliance state.
 */
export function ReviewSummary({ allFindings, onOpenReport }: ReviewSummaryProps) {
  const [open, setOpen] = useState(true);

  const accepted = allFindings.filter((f) => f.accepted);
  const errors = accepted.filter((f) => f.severity === Severity.Error).length;
  const warnings = accepted.filter((f) => f.severity === Severity.Warning).length;
  const slidesAffected = new Set(accepted.map((f) => f.slide_number)).size;

  const byCategory = accepted.reduce<Record<string, number>>((acc, f) => {
    acc[f.category] = (acc[f.category] ?? 0) + 1;
    return acc;
  }, {});
  const categories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  return (
    <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-5 py-3 text-left"
      >
        <FileCheck2 className="h-4 w-4 text-[var(--success)]" />
        <span className="text-sm font-semibold text-[var(--foreground)]">
          Accepted issues summary
        </span>
        <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--success)] px-1.5 text-[11px] font-bold text-white">
          {accepted.length}
        </span>
        <ChevronDown
          className={cn(
            "ml-auto h-4 w-4 text-[var(--muted)] transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="px-5 pb-4">
          {accepted.length === 0 ? (
            <p className="text-xs leading-relaxed text-[var(--muted)]">
              No issues accepted yet. Click <strong>Accept</strong> on a finding
              to add it to the deck&apos;s summary.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <SummaryStat label="Errors" value={errors} tone="error" />
                <SummaryStat label="Warnings" value={warnings} tone="warning" />
                <SummaryStat label="Slides" value={slidesAffected} tone="muted" />
              </div>

              <div className="mt-3 space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-light)]">
                  By category
                </p>
                {categories.map(([category, count]) => (
                  <div
                    key={category}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-[var(--foreground)]">{category}</span>
                    <span className="font-semibold text-[var(--muted)]">
                      {count}
                    </span>
                  </div>
                ))}
              </div>

              <p className="mt-3 rounded-lg border border-green-200 bg-[var(--success-bg)] px-3 py-2 text-xs leading-relaxed text-[var(--foreground)]">
                <strong>{accepted.length}</strong> confirmed issue
                {accepted.length === 1 ? "" : "s"} across{" "}
                <strong>{slidesAffected}</strong> slide
                {slidesAffected === 1 ? "" : "s"} ({errors} error
                {errors === 1 ? "" : "s"}, {warnings} warning
                {warnings === 1 ? "" : "s"}) ready for the final report.
              </p>

              <button
                type="button"
                onClick={onOpenReport}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--accent-dark)]"
              >
                <FileText className="h-3.5 w-3.5" />
                Generate final report
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "error" | "warning" | "muted";
}) {
  const toneClass =
    tone === "error"
      ? "text-[var(--error)]"
      : tone === "warning"
        ? "text-[var(--warning)]"
        : "text-[var(--foreground)]";
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-2 text-center">
      <p className={cn("text-lg font-bold leading-none", toneClass)}>{value}</p>
      <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-[var(--muted-light)]">
        {label}
      </p>
    </div>
  );
}
