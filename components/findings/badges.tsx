import { cn } from "@/lib/utils/cn";
import { Confidence, Severity } from "@/lib/types";

const severityStyles: Record<Severity, string> = {
  ERROR: "bg-[var(--error-bg)] text-[var(--error)] border-red-200",
  WARNING: "bg-[var(--warning-bg)] text-[var(--warning)] border-amber-200",
  INFO: "bg-blue-50 text-blue-700 border-blue-200",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        severityStyles[severity],
      )}
    >
      {severity}
    </span>
  );
}

const confidenceStyles: Record<Confidence, string> = {
  HIGH: "text-[var(--success)]",
  MEDIUM: "text-[var(--warning)]",
  LOW: "text-[var(--muted-light)]",
};

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return (
    <span className={cn("text-[10px] font-semibold uppercase tracking-wide", confidenceStyles[confidence])}>
      {confidence}
    </span>
  );
}
