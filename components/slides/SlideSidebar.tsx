"use client";

import { cn } from "@/lib/utils/cn";
import { SlideAnalysis } from "@/lib/types";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface SlideSidebarProps {
  slides: SlideAnalysis[];
  selectedSlide: number;
  onSelectSlide: (n: number) => void;
}

export function SlideSidebar({
  slides,
  selectedSlide,
  onSelectSlide,
}: SlideSidebarProps) {
  const flaggedCount = slides.filter((s) =>
    s.findings.some((f) => !f.accepted && !f.rejected),
  ).length;

  return (
    <div className="flex h-full flex-col border-r border-[var(--border)] bg-white">
      <div className="border-b border-[var(--border)] px-4 py-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Slides
        </h2>
        <p className="mt-1 text-sm text-[var(--foreground)]">
          <span className="font-semibold tabular-nums">{slides.length}</span>
          <span className="text-[var(--muted)]"> total · </span>
          <span className="font-semibold tabular-nums text-[var(--warning)]">
            {flaggedCount}
          </span>
          <span className="text-[var(--muted)]"> flagged</span>
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {slides.map((slide) => {
          const pending = slide.findings.filter(
            (f) => !f.accepted && !f.rejected,
          ).length;
          const isSelected = slide.slide_number === selectedSlide;

          return (
            <button
              key={slide.slide_number}
              type="button"
              onClick={() => onSelectSlide(slide.slide_number)}
              className={cn(
                "mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-all",
                isSelected
                  ? "bg-[var(--accent-light)] font-medium text-[var(--accent-dark)] shadow-[var(--shadow-xs)] ring-1 ring-inset ring-[var(--accent)]/15"
                  : "text-[var(--foreground)] hover:bg-[var(--surface)]",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums",
                  isSelected
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--surface)] text-[var(--muted)]",
                )}
              >
                {slide.slide_number}
              </span>
              <span className="flex-1 truncate">
                {pending > 0 ? "Needs review" : "Clear"}
              </span>
              {pending > 0 ? (
                <span className="flex items-center gap-1 rounded-full bg-[var(--warning-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--warning)]">
                  <AlertCircle className="h-3 w-3" />
                  {pending}
                </span>
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--success)]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
