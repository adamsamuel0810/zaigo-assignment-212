"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileText, LogOut, RefreshCw, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { Finding, PresentationAnalysis } from "@/lib/types";
import { updateFindingStatus } from "@/lib/services/finding-actions";
import { canAutoFix } from "@/lib/services/auto-fix";
import { downloadFixedPptx } from "@/lib/utils/apply-fixes-client";
import {
  collectSavedTextPatches,
  type SavedAiFix,
} from "@/lib/utils/saved-ai-fixes";
import { renderSlidesInBrowser } from "@/lib/utils/render-slides-client";
import { humanizeError } from "@/lib/utils/user-facing-errors";
import { SlideSidebar } from "@/components/slides/SlideSidebar";
import { SlidePreview } from "@/components/slides/SlidePreview";
import { FindingsPanel } from "@/components/findings/FindingsPanel";
import { FinalReportModal } from "@/components/findings/FinalReportModal";
import { FixPreviewModal } from "@/components/findings/FixPreviewModal";
import { AppHeader, StatPill } from "@/components/layout/AppHeader";
import { StatusAlert } from "@/components/ui/StatusAlert";

interface ReviewWorkspaceProps {
  initialAnalysis: PresentationAnalysis;
  uploadFile?: File | null;
  renderError?: string | null;
  onSlideImagesReady?: (images: string[]) => void;
  onBack: () => void;
}

export function ReviewWorkspace({
  initialAnalysis,
  uploadFile,
  renderError: initialRenderError,
  onSlideImagesReady,
  onBack,
}: ReviewWorkspaceProps) {
  const router = useRouter();
  const [analysis, setAnalysis] = useState(initialAnalysis);
  const [selectedSlide, setSelectedSlide] = useState(1);
  const [selectedFindingId, setSelectedFindingId] = useState<string>();
  const [hoveredFindingId, setHoveredFindingId] = useState<string>();
  const [showLowConfidence, setShowLowConfidence] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [fixPreviewFinding, setFixPreviewFinding] = useState<Finding | null>(
    null,
  );
  const [renderingSlides, setRenderingSlides] = useState(false);
  const [renderError, setRenderError] = useState(initialRenderError ?? null);
  const [downloadingFixed, setDownloadingFixed] = useState(false);
  const [downloadFixedError, setDownloadFixedError] = useState<string | null>(
    null,
  );
  const [savedAiFixes, setSavedAiFixes] = useState<Record<string, SavedAiFix>>(
    {},
  );

  const hasSlideImages = Boolean(analysis.metadata.slide_images?.length);
  const renderPreviewAlert = useMemo(() => {
    if (!renderError || renderingSlides) return null;
    return humanizeError(renderError, "preview");
  }, [renderError, renderingSlides]);

  useEffect(() => {
    if (!uploadFile || hasSlideImages) return;

    let cancelled = false;
    setRenderingSlides(true);

    renderSlidesInBrowser(uploadFile)
      .then((res) => {
        if (cancelled) return;
        if (res.slide_images.length > 0) {
          setAnalysis((prev) => ({
            ...prev,
            metadata: { ...prev.metadata, slide_images: res.slide_images },
          }));
          onSlideImagesReady?.(res.slide_images);
          setRenderError(null);
        } else if (res.render_error) {
          setRenderError(res.render_error);
        }
      })
      .finally(() => {
        if (!cancelled) setRenderingSlides(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- retry only when images missing
  }, [uploadFile, hasSlideImages]);

  async function handleRetryRender() {
    if (!uploadFile) return;
    setRenderingSlides(true);
    setRenderError(null);
    try {
      const res = await renderSlidesInBrowser(uploadFile);
      if (res.slide_images.length > 0) {
        setAnalysis((prev) => ({
          ...prev,
          metadata: { ...prev.metadata, slide_images: res.slide_images },
        }));
        onSlideImagesReady?.(res.slide_images);
      } else {
        setRenderError(res.render_error ?? "Render returned no images");
      }
    } finally {
      setRenderingSlides(false);
    }
  }

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
    setSavedAiFixes((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function handleReset(id: string) {
    setAnalysis((prev) => updateFindingStatus(prev, id, "reset"));
    setSavedAiFixes((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function handleSaveAiFix(saved: SavedAiFix) {
    setSavedAiFixes((prev) => ({ ...prev, [saved.findingId]: saved }));
  }

  function handlePreviewFix(finding: Finding) {
    setFixPreviewFinding(finding);
    setSelectedSlide(finding.slide_number);
  }

  const fixPreviewSlideMeta = fixPreviewFinding
    ? analysis.metadata.slides.find(
        (s) => s.slide_number === fixPreviewFinding.slide_number,
      )
    : undefined;

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

  const issueCount =
    slideAnalysis?.findings.filter((f) => !f.rejected).length ?? 0;

  const acceptedFixableCount = analysis.findings.filter(
    (f) => f.accepted && canAutoFix(f.rule_id),
  ).length;
  const savedAiFixCount = Object.keys(savedAiFixes).length;
  const downloadFixCount = acceptedFixableCount + savedAiFixCount;

  async function handleDownloadAllFixes() {
    if (!uploadFile) return;
    setDownloadingFixed(true);
    setDownloadFixedError(null);
    try {
      await downloadFixedPptx(uploadFile, analysis.findings, {
        textPatches: collectSavedTextPatches(Object.values(savedAiFixes)),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Download failed";
      setDownloadFixedError(message);
      throw e;
    } finally {
      setDownloadingFixed(false);
    }
  }

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
              <StatPill
                label="Accepted"
                value={totalAccepted}
                variant="success"
              />
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
            {uploadFile && downloadFixCount > 0 && (
              <button
                type="button"
                onClick={() => void handleDownloadAllFixes()}
                disabled={downloadingFixed}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--success)] bg-[var(--success-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--success)] transition-colors hover:bg-green-100 disabled:opacity-60"
                title="Download PPTX with all saved AI fixes and accepted deterministic fixes"
              >
                {downloadingFixed ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Fixed PPTX
                <span className="tabular-nums">({downloadFixCount})</span>
              </button>
            )}
            {savedAiFixCount > 0 && (
              <span className="hidden items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700 md:inline-flex">
                <Save className="h-3 w-3" />
                {savedAiFixCount} saved AI fix
                {savedAiFixCount === 1 ? "" : "es"}
              </span>
            )}
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

      {downloadFixedError && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          {downloadFixedError}
        </div>
      )}

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
            {!hasSlideImages && (renderingSlides || renderPreviewAlert) && (
              <div className="mb-3">
                {renderingSlides ? (
                  <StatusAlert variant="info" title="Rendering slide previews">
                    Building pixel-accurate previews for side-by-side review.
                  </StatusAlert>
                ) : renderPreviewAlert ? (
                  <div className="space-y-2">
                    <StatusAlert
                      variant={renderPreviewAlert.variant}
                      title={renderPreviewAlert.title}
                    >
                      {renderPreviewAlert.message}
                    </StatusAlert>
                    {uploadFile && (
                      <button
                        type="button"
                        onClick={handleRetryRender}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface)]"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Retry preview render
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            )}
            {slideMeta && (
              <SlidePreview
                slide={slideMeta}
                slideWidth={analysis.metadata.slide_width_inches}
                slideHeight={analysis.metadata.slide_height_inches}
                findings={slideAnalysis?.findings ?? []}
                selectedFindingId={selectedFindingId}
                hoveredFindingId={hoveredFindingId}
                slideImage={analysis.metadata.slide_images?.[selectedSlide - 1]}
                isRendering={renderingSlides && !hasSlideImages}
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
            onPreviewFix={handlePreviewFix}
            savedFindingIds={new Set(Object.keys(savedAiFixes))}
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

      {fixPreviewFinding && fixPreviewSlideMeta && (
        <FixPreviewModal
          finding={fixPreviewFinding}
          slide={fixPreviewSlideMeta}
          slideWidth={analysis.metadata.slide_width_inches}
          slideHeight={analysis.metadata.slide_height_inches}
          slideImage={
            analysis.metadata.slide_images?.[fixPreviewFinding.slide_number - 1]
          }
          uploadFile={uploadFile}
          isSaved={Boolean(savedAiFixes[fixPreviewFinding.id])}
          savedFix={savedAiFixes[fixPreviewFinding.id] ?? null}
          savedFixCount={savedAiFixCount}
          onSaveFix={handleSaveAiFix}
          onDownloadAllFixes={handleDownloadAllFixes}
          onClose={() => setFixPreviewFinding(null)}
        />
      )}
    </div>
  );
}
