"use client";

import { Finding } from "@/lib/types";
import { FindingCard } from "@/components/findings/FindingCard";
import { ReviewSummary } from "@/components/findings/ReviewSummary";
import { ClipboardList } from "lucide-react";

interface FindingsPanelProps {
  findings: Finding[];
  /** Deck-wide findings, used for the accepted-issues summary. */
  allFindings: Finding[];
  selectedFindingId?: string;
  hoveredFindingId?: string;
  showLowConfidence: boolean;
  onToggleLowConfidence: () => void;
  onSelectFinding: (id: string) => void;
  onHoverFinding: (id: string | undefined) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onReset: (id: string) => void;
  onOpenReport: () => void;
}

export function FindingsPanel({
  findings,
  allFindings,
  selectedFindingId,
  hoveredFindingId,
  showLowConfidence,
  onToggleLowConfidence,
  onSelectFinding,
  onHoverFinding,
  onAccept,
  onReject,
  onReset,
  onOpenReport,
}: FindingsPanelProps) {
  const visible = showLowConfidence
    ? findings
    : findings.filter((f) => f.confidence !== "LOW");

  const pending = visible.filter((f) => !f.accepted && !f.rejected);
  const reviewed = visible.filter((f) => f.accepted || f.rejected);
  const lowCount = findings.filter((f) => f.confidence === "LOW").length;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-[var(--accent)]" />
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Findings</h3>
        </div>
        <div className="mt-2 flex gap-3 text-xs text-[var(--muted)]">
          <span>
            <strong className="font-semibold text-[var(--warning)]">{pending.length}</strong>{" "}
            pending
          </span>
          <span className="text-[var(--border-strong)]">·</span>
          <span>
            <strong className="font-semibold text-[var(--foreground)]">{reviewed.length}</strong>{" "}
            reviewed
          </span>
        </div>
        {lowCount > 0 && (
          <button
            type="button"
            onClick={onToggleLowConfidence}
            className="mt-2.5 text-xs font-medium text-[var(--accent)] hover:underline"
          >
            {showLowConfidence
              ? "Hide low-confidence recommendations"
              : `Show ${lowCount} recommendation${lowCount > 1 ? "s" : ""}`}
          </button>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-[var(--border)] px-6 py-10 text-center">
            <CheckCircle className="mb-3 h-10 w-10 text-[var(--success)]" />
            <p className="text-sm font-semibold text-[var(--foreground)]">No issues on this slide</p>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">
              This slide passes all active compliance checks.
            </p>
          </div>
        ) : (
          visible.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              selected={finding.id === selectedFindingId}
              hovered={finding.id === hoveredFindingId}
              onSelect={() => onSelectFinding(finding.id)}
              onHover={() => onHoverFinding(finding.id)}
              onHoverEnd={() => onHoverFinding(undefined)}
              onAccept={onAccept}
              onReject={onReject}
              onReset={onReset}
            />
          ))
        )}
      </div>

      <ReviewSummary allFindings={allFindings} onOpenReport={onOpenReport} />
    </div>
  );
}

function CheckCircle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 12l3 3 5-6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
