import type { CSSProperties } from "react";
import { ParagraphMetadata, TextMetadata, TextRunMetadata } from "@/lib/types";

export function toCssColor(hex?: string | null): string | undefined {
  if (!hex) return undefined;
  const h = hex.replace(/^#/, "");
  if (h.length === 6) return `#${h}`;
  if (h.length === 8) return `#${h.slice(2)}`;
  return hex.startsWith("#") ? hex : `#${hex}`;
}

export function posStyle(
  position: {
    left_inches: number;
    top_inches: number;
    width_inches: number;
    height_inches: number;
  },
  scale: number,
) {
  return {
    left: position.left_inches * scale,
    top: position.top_inches * scale,
    width: position.width_inches * scale,
    height: position.height_inches * scale,
  };
}

export function ParagraphBlock({
  paragraphs,
  defaultSize,
  scale,
  defaultFontFamily = "Calibri, Arial, sans-serif",
}: {
  paragraphs: ParagraphMetadata[];
  defaultSize: number;
  scale: number;
  defaultFontFamily?: string;
}) {
  return (
    <>
      {paragraphs.map((p, i) => {
        if (!p.text.trim() && !p.runs.some((r) => r.text.trim())) {
          return null;
        }
        return (
          <p
            key={i}
            style={{
              margin: 0,
              fontSize: defaultSize,
              lineHeight: p.line_spacing ?? 1.15,
              textAlign: (p.alignment as CSSProperties["textAlign"]) ?? "left",
              paddingLeft: (p.indent_inches ?? 0) * scale,
              marginBottom: p.space_after_pt
                ? (p.space_after_pt / 72) * scale
                : 0,
            }}
          >
            {p.bullet_char && (
              <span style={{ marginRight: 4 }}>{p.bullet_char}</span>
            )}
            {p.runs.map((run, j) => (
              <span
                key={j}
                style={{
                  fontWeight: run.bold ? "bold" : "normal",
                  fontStyle: run.italic ? "italic" : "normal",
                  color: toCssColor(run.color?.hex),
                  fontSize: runFontSizePx(run.font_size_pt, scale),
                  fontFamily: run.font_family ?? defaultFontFamily,
                  verticalAlign: run.superscript ? "super" : undefined,
                }}
              >
                {run.text}
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}

export function TextBoxLayer({
  text,
  scale,
  fontScale,
  overlay = false,
}: {
  text: TextMetadata;
  scale: number;
  fontScale: number;
  /** When true, render transparently on top of a slide PNG (fix preview). */
  overlay?: boolean;
}) {
  const fill = overlay ? undefined : toCssColor(text.fill_hex);
  const defaultPt = text.is_title ? 24 : 16;
  const defaultSize = runFontSizePx(defaultPt, scale, defaultPt);

  return (
    <div
      className="absolute overflow-hidden"
      style={{
        ...posStyle(text.position, scale),
        backgroundColor: fill,
        padding: fill ? 2 : 0,
      }}
    >
      <ParagraphBlock
        paragraphs={text.paragraphs}
        defaultSize={defaultSize}
        scale={scale}
      />
    </div>
  );
}

export function dominantRunStyle(text: TextMetadata): Partial<TextRunMetadata> {
  const runs = text.paragraphs
    .flatMap((p) => p.runs)
    .filter((r) => r.text.trim());
  if (runs.length === 0) return {};
  return runs.reduce((best, run) => {
    const size = run.font_size_pt ?? 0;
    const bestSize = best.font_size_pt ?? 0;
    return size >= bestSize ? run : best;
  }, runs[0]);
}

export function runFontSizePx(
  fontSizePt: number | null | undefined,
  scale: number,
  fallbackPt = 16,
): number {
  const pt = fontSizePt ?? fallbackPt;
  return Math.max(6, (pt / 72) * scale);
}
