"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Finding, SlideMetadata } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { resolveFindingHighlights } from "@/lib/utils/finding-highlight";
import { HtmlSlideFallback } from "@/components/slides/HtmlSlideFallback";
import { FixOverlayLayer } from "@/components/slides/FixOverlayLayer";

interface SlidePreviewProps {
  slide: SlideMetadata;
  slideWidth: number;
  slideHeight: number;
  findings: Finding[];
  selectedFindingId?: string;
  hoveredFindingId?: string;
  /** Either a base64 PNG (local render) or an https URL (ConvertAPI on Vercel). */
  slideImage?: string;
  isRendering?: boolean;
  /** When set with slideImage, patches only changed regions on top of the PNG. */
  fixOverlay?: {
    original: SlideMetadata;
    fixed: SlideMetadata;
  };
}

interface Dimensions {
  width: number;
  height: number;
}

type HighlightState = "hovered" | "selected" | "dimmed";

interface RenderHighlight {
  key: string;
  position: import("@/lib/types").PositionMetadata;
  state: HighlightState;
  label: string;
}

function HighlightBox({
  position,
  scale,
  state,
  label,
}: {
  position: import("@/lib/types").PositionMetadata;
  scale: number;
  state: HighlightState;
  label: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute z-10 rounded-sm border-2 transition-all duration-200",
        state === "hovered" &&
          "z-20 border-[var(--error)] bg-red-500/25 shadow-[0_0_0_4px_rgba(185,28,28,0.3)] animate-pulse",
        state === "selected" &&
          "z-15 border-[var(--error)] bg-red-500/20 shadow-[0_0_0_3px_rgba(185,28,28,0.25)]",
        state === "dimmed" && "border-amber-400/50 bg-amber-500/8 opacity-50",
      )}
      style={{
        left: position.left_inches * scale,
        top: position.top_inches * scale,
        width: Math.max(position.width_inches * scale, 12),
        height: Math.max(position.height_inches * scale, 10),
      }}
    >
      {(state === "hovered" || state === "selected") && (
        <div
          className={cn(
            "absolute left-0 z-30 max-w-[min(240px,90vw)] whitespace-normal rounded-md px-2 py-1 text-[10px] font-semibold leading-tight text-white shadow-lg",
            state === "hovered" ? "bg-[var(--error)]" : "bg-[var(--accent)]",
            position.top_inches * scale < 28 ? "top-full mt-1" : "-top-8",
          )}
        >
          {label}
        </div>
      )}
    </div>
  );
}

function fitSlideDimensions(
  container: Dimensions,
  slideAspect: number,
): Dimensions {
  if (container.width <= 0 || container.height <= 0) {
    return { width: 0, height: 0 };
  }

  let width = container.width;
  let height = width * slideAspect;

  if (height > container.height) {
    height = container.height;
    width = height / slideAspect;
  }

  return { width, height };
}

export function SlidePreview({
  slide,
  slideWidth,
  slideHeight,
  findings,
  selectedFindingId,
  hoveredFindingId,
  slideImage,
  isRendering,
  fixOverlay,
}: SlidePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [container, setContainer] = useState<Dimensions>({
    width: 0,
    height: 0,
  });

  const slideAspect = slideHeight / slideWidth;
  const focusedId = hoveredFindingId ?? selectedFindingId;
  const useImagePreview = Boolean(slideImage);
  const useFixOverlay = Boolean(slideImage && fixOverlay);
  const imageSrc = slideImage
    ? slideImage.startsWith("http")
      ? slideImage
      : `data:image/png;base64,${slideImage}`
    : undefined;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      if (width > 0 && height > 0) setContainer({ width, height });
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { width: displayWidth, height: displayHeight } = fitSlideDimensions(
    container,
    slideAspect,
  );

  const scale = displayWidth > 0 ? displayWidth / slideWidth : 0;
  const fontScale = displayWidth > 0 ? displayWidth / 720 : 1;

  const visibleFindings = findings.filter((f) => !f.rejected);

  const highlights = useMemo(() => {
    if (!focusedId) return [];

    const items: RenderHighlight[] = [];

    for (const finding of visibleFindings) {
      const regions = resolveFindingHighlights(
        slide,
        finding,
        slideWidth,
        slideHeight,
      );

      let state: HighlightState = "dimmed";
      if (finding.id === hoveredFindingId) state = "hovered";
      else if (finding.id === selectedFindingId && !hoveredFindingId) {
        state = "selected";
      } else if (finding.id !== focusedId) {
        state = "dimmed";
      } else {
        state = "hovered";
      }

      regions.forEach((region, index) => {
        items.push({
          key: `${finding.id}-${index}`,
          position: region.position,
          state: finding.id !== focusedId ? "dimmed" : state,
          label: region.label,
        });
      });
    }

    return items;
  }, [
    visibleFindings,
    slide,
    slideWidth,
    slideHeight,
    focusedId,
    hoveredFindingId,
    selectedFindingId,
  ]);

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full min-h-0 min-w-0 items-center justify-center"
    >
      {displayWidth > 0 && displayHeight > 0 && (
        <div className="relative flex flex-col items-center">
          {isRendering && (
            <p className="mb-2 text-center text-[10px] text-[var(--accent)]">
              Rendering slide previews…
            </p>
          )}

          <div
            className={cn(
              "relative overflow-hidden rounded-xl border bg-white shadow-lg ring-1 ring-black/5",
              focusedId ? "border-[var(--error)]/30" : "border-[var(--border)]",
            )}
            style={{ width: displayWidth, height: displayHeight }}
          >
            {useImagePreview ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageSrc}
                  alt={`Slide ${slide.slide_number}`}
                  className="absolute inset-0 h-full w-full object-fill"
                  draggable={false}
                />
                {useFixOverlay && fixOverlay && (
                  <FixOverlayLayer
                    original={fixOverlay.original}
                    fixed={fixOverlay.fixed}
                    scale={scale}
                    fontScale={fontScale}
                  />
                )}
              </>
            ) : (
              <HtmlSlideFallback
                slide={slide}
                scale={scale}
                fontScale={fontScale}
              />
            )}

            {highlights.map((h) => (
              <HighlightBox
                key={h.key}
                position={h.position}
                scale={scale}
                state={h.state}
                label={h.label}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
