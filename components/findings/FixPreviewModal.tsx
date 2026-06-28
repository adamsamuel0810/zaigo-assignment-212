"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, Sparkles, X } from "lucide-react";
import { Finding, SlideMetadata } from "@/lib/types";
import {
  applyAutoFix,
  canAutoFix,
  needsAiPreview,
  type AutoFixResult,
} from "@/lib/services/auto-fix";
import { fetchAutoFixPreview } from "@/lib/utils/auto-fix-client";
import { downloadFixedPptx } from "@/lib/utils/apply-fixes-client";
import { SlidePreview } from "@/components/slides/SlidePreview";
import { SeverityBadge } from "@/components/findings/badges";

interface FixPreviewModalProps {
  finding: Finding;
  slide: SlideMetadata;
  slideWidth: number;
  slideHeight: number;
  slideImage?: string;
  uploadFile?: File | null;
  onClose: () => void;
}

export function FixPreviewModal({
  finding,
  slide,
  slideWidth,
  slideHeight,
  slideImage,
  uploadFile,
  onClose,
}: FixPreviewModalProps) {
  const [fixResult, setFixResult] = useState<AutoFixResult | null>(null);
  const [fixSource, setFixSource] = useState<"deterministic" | "ai" | "hybrid">(
    "deterministic",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        if (canAutoFix(finding.rule_id) && !needsAiPreview(finding.rule_id)) {
          const local = applyAutoFix(slide, finding);
          if (!cancelled) {
            setFixResult(local);
            setFixSource("deterministic");
          }
          return;
        }

        const remote = await fetchAutoFixPreview(finding, slide);
        if (!cancelled) {
          setFixResult(remote);
          setFixSource(remote.source ?? "ai");
        }
      } catch (e) {
        if (cancelled) return;
        const message =
          e instanceof Error ? e.message : "Auto-fix preview failed";
        setError(message);

        if (canAutoFix(finding.rule_id)) {
          const fallback = applyAutoFix(slide, finding);
          if (fallback.fixable) {
            setFixResult(fallback);
            setFixSource("deterministic");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [finding, slide]);

  const applied = fixResult?.applied ?? [];
  const fixedSlide = fixResult?.slide ?? slide;
  const canDownloadFix =
    Boolean(uploadFile) && finding.accepted && canAutoFix(finding.rule_id);

  async function handleDownloadFix() {
    if (!uploadFile) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadFixedPptx(uploadFile, [finding]);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-2 sm:p-3 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fix-preview-title"
    >
      <div
        className="flex h-[96vh] w-[98vw] max-w-[1800px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[var(--accent)]" />
            <div>
              <h2
                id="fix-preview-title"
                className="text-base font-semibold text-[var(--foreground)]"
              >
                Auto-fix preview
              </h2>
              <p className="text-xs text-[var(--muted)]">
                Slide {finding.slide_number} · {finding.rule_id}
                {fixSource !== "deterministic" && !loading && (
                  <span className="ml-1.5 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                    AI-assisted
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg border border-[var(--border-strong)] bg-white p-2 text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(260px,300px)_1fr]">
          <aside className="max-h-[32vh] overflow-y-auto border-b border-[var(--border)] p-4 lg:max-h-none lg:border-b-0 lg:border-r lg:p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <SeverityBadge severity={finding.severity} />
              <span className="font-mono text-[10px] text-[var(--muted-light)]">
                {finding.rule_id}
              </span>
            </div>

            <h3 className="text-sm font-semibold leading-snug text-[var(--foreground)]">
              {finding.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              {finding.description}
            </p>

            <div className="mt-4 space-y-2 rounded-lg bg-[var(--surface)] p-3 text-xs">
              <div className="grid grid-cols-[72px_1fr] gap-1.5">
                <span className="font-medium text-[var(--muted)]">
                  Expected
                </span>
                <span className="text-[var(--foreground)]">
                  {finding.expected_value}
                </span>
              </div>
              <div className="grid grid-cols-[72px_1fr] gap-1.5">
                <span className="font-medium text-[var(--muted)]">Actual</span>
                <span className="font-medium text-[var(--error)]">
                  {finding.actual_value}
                </span>
              </div>
            </div>

            {finding.recommendation && (
              <p className="mt-3 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs leading-relaxed text-[var(--foreground)]">
                <span className="font-semibold text-[var(--success)]">
                  Fix:{" "}
                </span>
                {finding.recommendation}
              </p>
            )}

            {loading && (
              <div className="mt-4 flex items-center gap-2 text-xs text-[var(--accent)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                {needsAiPreview(finding.rule_id)
                  ? "Generating AI fix preview…"
                  : "Applying fix…"}
              </div>
            )}

            {error && !loading && (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {error}
              </p>
            )}

            {!loading && applied.length > 0 && (
              <div className="mt-4 rounded-lg border border-green-200 bg-[var(--success-bg)] px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--success)]">
                  Applied in preview
                </p>
                <ul className="mt-1.5 space-y-1 text-xs text-[var(--foreground)]">
                  {applied.map((change) => (
                    <li key={change}>• {change}</li>
                  ))}
                </ul>
              </div>
            )}

            {!loading && !error && applied.length === 0 && (
              <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
                Could not generate a preview for this finding. Apply the
                recommendation manually in PowerPoint.
              </p>
            )}

            <p className="mt-4 text-[10px] leading-relaxed text-[var(--muted-light)]">
              Preview shows highlighted changes on the slide image. Download
              applies fixes to the real PPTX with correct fonts and styling.
            </p>

            {canDownloadFix && !loading && (
              <button
                type="button"
                onClick={() => void handleDownloadFix()}
                disabled={downloading}
                className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--success)] px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-green-800 disabled:opacity-60"
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download fixed PPTX
              </button>
            )}

            {downloadError && (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {downloadError}
              </p>
            )}
          </aside>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 lg:p-4">
            <div className="mb-2 grid shrink-0 grid-cols-2 gap-3 text-center text-xs font-semibold uppercase tracking-wide text-[var(--muted-light)]">
              <span>Current slide</span>
              <span className="text-[var(--success)]">After auto-fix</span>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
              <div className="flex min-h-[280px] flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 md:min-h-0">
                <SlidePreview
                  slide={slide}
                  slideWidth={slideWidth}
                  slideHeight={slideHeight}
                  findings={[]}
                  slideImage={slideImage}
                />
              </div>

              <div className="flex min-h-[280px] flex-1 flex-col overflow-hidden rounded-xl border-2 border-green-200 bg-green-50/30 p-2 md:min-h-0">
                {loading ? (
                  <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin text-[var(--accent)]" />
                    Building preview…
                  </div>
                ) : (
                  <SlidePreview
                    slide={fixedSlide}
                    slideWidth={slideWidth}
                    slideHeight={slideHeight}
                    findings={[]}
                    slideImage={slideImage}
                    fixOverlay={
                      slideImage && fixResult?.fixable
                        ? { original: slide, fixed: fixedSlide }
                        : undefined
                    }
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
