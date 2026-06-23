"use client";

import { useState } from "react";
import { FileText, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { PresentationAnalysis } from "@/lib/types";
import { updateFindingStatus } from "@/lib/services/finding-actions";
import { SlideSidebar } from "@/components/slides/SlideSidebar";
import { SlidePreview } from "@/components/slides/SlidePreview";
import { FindingsPanel } from "@/components/findings/FindingsPanel";
import { FinalReportModal } from "@/components/findings/FinalReportModal";
import { AppHeader, StatPill } from "@/components/layout/AppHeader";

interface ReviewWorkspaceProps {
  initialAnalysis: PresentationAnalysis;
  onBack: () => void;
}

export function ReviewWorkspace({ initialAnalysis, onBack }: ReviewWorkspaceProps) {
  const router = useRouter();
  const [analysis, setAnalysis] = useState(initialAnalysis);
  const [selectedSlide, setSelectedSlide] = useState(1);
  const [selectedFindingId, setSelectedFindingId] = useState<string>();
  const [hoveredFindingId, setHoveredFindingId] = useState<string>();
  const [showLowConfidence, setShowLowConfidence] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const slideMeta = analysis.metadata.slides.find(
    (s) => s.slide_number === selectedSlide,
  );
  const slideAnalysis = analysis.slides.find(
    (s) => s.slide_number === selectedSlide,
  );

  function handleAccept(id: string) {
    setAnalysis((prev) => updateFindingStatus(prev, id, "accept"));
  }

  function handleReject(id: string) {
    setAnalysis((prev) => updateFindingStatus(prev, id, "reject"));
  }

  function handleReset(id: string) {
    setAnalysis((prev) => updateFindingStatus(prev, id, "reset"));
  }

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
  }

  const totalPending = analysis.findings.filter(
    (f) => !f.accepted && !f.rejected,
  ).length;
  const totalAccepted = analysis.findings.filter((f) => f.accepted).length;
  const slidesWithIssues = analysis.slides.filter((s) =>
    s.findings.some((f) => !f.accepted && !f.rejected),
  ).length;

  const issueCount = slideAnalysis?.findings.filter((f) => !f.rejected).length ?? 0;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--background)]">
      <AppHeader
        title={analysis.filename}
        subtitle="Compliance review"
        onBack={onBack}
        backLabel="Upload new deck"
        actions={
          <>
            <div className="hidden items-center gap-2 md:flex">
              <StatPill label="Slides" value={analysis.slide_count} />
              <StatPill
                label="Pending"
                value={totalPending}
                variant={totalPending > 0 ? "warning" : "success"}
              />
              <StatPill label="Accepted" value={totalAccepted} variant="success" />
            </div>
            <button
              type="button"
              onClick={() => setShowReport(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--accent-dark)]"
            >
              <FileText className="h-3.5 w-3.5" />
              Final report
              {totalAccepted > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white/25 px-1 text-[10px] font-bold tabular-nums">
                  {totalAccepted}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </>
        }
      />

      {/* Sub-header stats on mobile */}
      <div className="flex gap-2 border-b border-[var(--border)] bg-white px-4 py-2 md:hidden">
        <StatPill label="Pending" value={totalPending} variant="warning" />
        <StatPill label="Flagged slides" value={slidesWithIssues} />
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex h-full w-60 shrink-0 flex-col">
          <SlideSidebar
            slides={analysis.slides}
            selectedSlide={selectedSlide}
            onSelectSlide={(n) => {
              setSelectedSlide(n);
              setSelectedFindingId(undefined);
              setHoveredFindingId(undefined);
            }}
          />
        </div>

        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-white px-4 py-2.5">
            <p className="text-xs font-medium text-[var(--muted)]">
              Slide {selectedSlide} of {analysis.slide_count}
              {slideMeta && (
                <span className="ml-2 capitalize text-[var(--muted-light)]">
                  · {slideMeta.slide_type}
                </span>
              )}
            </p>
            {issueCount > 0 && (
              <p className="text-xs font-medium text-[var(--warning)]">
                {issueCount} flagged
              </p>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-hidden p-3 lg:p-4">
            {slideMeta && (
              <SlidePreview
                slide={slideMeta}
                slideWidth={analysis.metadata.slide_width_inches}
                slideHeight={analysis.metadata.slide_height_inches}
                findings={slideAnalysis?.findings ?? []}
                selectedFindingId={selectedFindingId}
                hoveredFindingId={hoveredFindingId}
                slideImage={
                  analysis.metadata.slide_images?.[selectedSlide - 1]
                }
              />
            )}
          </div>
        </div>

        <div className="flex h-full w-[400px] shrink-0 flex-col border-l border-[var(--border)] bg-white">
          <FindingsPanel
            findings={slideAnalysis?.findings ?? []}
            allFindings={analysis.findings}
            selectedFindingId={selectedFindingId}
            hoveredFindingId={hoveredFindingId}
            showLowConfidence={showLowConfidence}
            onToggleLowConfidence={() => setShowLowConfidence((v) => !v)}
            onSelectFinding={setSelectedFindingId}
            onHoverFinding={setHoveredFindingId}
            onAccept={handleAccept}
            onReject={handleReject}
            onReset={handleReset}
            onOpenReport={() => setShowReport(true)}
          />
        </div>
      </div>

      {showReport && (
        <FinalReportModal
          filename={analysis.filename}
          allFindings={analysis.findings}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}
