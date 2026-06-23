"use client";

import { Check, RotateCcw, X } from "lucide-react";
import { Finding } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { ConfidenceBadge, SeverityBadge } from "@/components/findings/badges";

interface FindingCardProps {
  finding: Finding;
  selected?: boolean;
  hovered?: boolean;
  onSelect?: () => void;
  onHover?: () => void;
  onHoverEnd?: () => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onReset: (id: string) => void;
}

export function FindingCard({
  finding,
  selected,
  hovered,
  onSelect,
  onHover,
  onHoverEnd,
  onAccept,
  onReject,
  onReset,
}: FindingCardProps) {
  return (
    <div
      className={cn(
        "animate-fade-in rounded-xl border p-4 transition-all duration-200",
        finding.accepted && "border-green-200 bg-[var(--success-bg)]",
        finding.rejected && "border-[var(--border)] bg-[var(--surface)] opacity-55",
        !finding.accepted &&
          !finding.rejected &&
          "border-[var(--border)] bg-white shadow-sm",
        hovered &&
          !finding.accepted &&
          !finding.rejected &&
          "border-[var(--error)] bg-red-50/50 shadow-md ring-2 ring-[var(--error)]/20",
        selected &&
          !hovered &&
          !finding.accepted &&
          !finding.rejected &&
          "border-[var(--accent)] ring-2 ring-[var(--accent)]/15",
        !hovered &&
          !selected &&
          !finding.accepted &&
          !finding.rejected &&
          "hover:shadow-md",
      )}
      onClick={onSelect}
      onMouseEnter={onHover}
      onMouseLeave={onHoverEnd}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect?.()}
    >
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <SeverityBadge severity={finding.severity} />
        <ConfidenceBadge confidence={finding.confidence} />
        {finding.source === "ai" && (
          <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
            AI
          </span>
        )}
        <span className="ml-auto font-mono text-[10px] text-[var(--muted-light)]">
          {finding.rule_id}
        </span>
      </div>

      <h4 className="text-sm font-semibold leading-snug text-[var(--foreground)]">
        {finding.title}
      </h4>
      {hovered && !finding.accepted && !finding.rejected && (
        <p className="mt-1 text-[10px] font-medium text-[var(--error)]">
          ↖ Highlighted on slide
        </p>
      )}
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
        {finding.description}
      </p>

      <div className="mt-3 space-y-2 rounded-lg bg-[var(--surface)] p-3 text-xs">
        <div className="grid grid-cols-[72px_1fr] gap-1.5">
          <span className="font-medium text-[var(--muted)]">Expected</span>
          <span className="text-[var(--foreground)]">{finding.expected_value}</span>
        </div>
        <div className="grid grid-cols-[72px_1fr] gap-1.5">
          <span className="font-medium text-[var(--muted)]">Actual</span>
          <span className="font-medium text-[var(--error)]">{finding.actual_value}</span>
        </div>
      </div>

      {finding.recommendation && (
        <p className="mt-3 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs leading-relaxed text-[var(--foreground)]">
          <span className="font-semibold">Recommendation: </span>
          {finding.recommendation}
        </p>
      )}

      {!finding.accepted && !finding.rejected && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAccept(finding.id);
            }}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--success)] px-3 py-2 text-xs font-semibold text-white shadow-[var(--shadow-xs)] transition-all hover:bg-green-800 hover:shadow-[var(--shadow-sm)] active:scale-[0.98]"
          >
            <Check className="h-3.5 w-3.5" />
            Accept
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReject(finding.id);
            }}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-white px-3 py-2 text-xs font-semibold text-[var(--muted)] transition-colors hover:bg-[var(--surface)]"
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </button>
        </div>
      )}

      {(finding.accepted || finding.rejected) && (
        <div className="mt-3 flex items-center justify-between gap-2">
          {finding.accepted ? (
            <p className="text-xs font-semibold text-[var(--success)]">
              ✓ Accepted for final report
            </p>
          ) : (
            <p className="text-xs font-medium text-[var(--muted)]">
              Dismissed as false positive
            </p>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReset(finding.id);
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--border-strong)] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
            title="Undo and review again"
          >
            <RotateCcw className="h-3 w-3" />
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
