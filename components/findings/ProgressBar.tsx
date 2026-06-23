"use client";

import { cn } from "@/lib/utils/cn";

interface ProgressBarProps {
  progress: number;
  label?: string;
  className?: string;
}

export function ProgressBar({ progress, label, className }: ProgressBarProps) {
  return (
    <div className={cn("w-full", className)}>
      {label && (
        <div className="mb-2 flex justify-between text-xs">
          <span className="font-medium text-[var(--muted)]">{label}</span>
          <span className="font-semibold tabular-nums text-[var(--accent)]">
            {Math.round(progress)}%
          </span>
        </div>
      )}
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-all duration-500 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
}
