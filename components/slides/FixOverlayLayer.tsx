"use client";

import { useMemo } from "react";
import { SlideMetadata } from "@/lib/types";
import { getFixOverlayPatches } from "@/lib/utils/fix-overlay";
import {
  TextBoxLayer,
  posStyle,
  toCssColor,
} from "@/components/slides/slide-render-utils";
import { tableCellFontSizePx } from "@/lib/utils/slide-geometry";
import type { CSSProperties } from "react";

interface FixOverlayLayerProps {
  original: SlideMetadata;
  fixed: SlideMetadata;
  scale: number;
  fontScale: number;
}

export function FixOverlayLayer({
  original,
  fixed,
  scale,
  fontScale,
}: FixOverlayLayerProps) {
  const patches = useMemo(
    () => getFixOverlayPatches(original, fixed),
    [original, fixed],
  );

  if (patches.length === 0) return null;

  return (
    <>
      {patches.map((patch) => {
        if (patch.type === "text") {
          return (
            <div
              key={patch.id}
              className="pointer-events-none absolute inset-0 z-10"
            >
              <div
                className="absolute"
                style={{
                  ...posStyle(patch.text.position, scale),
                  backgroundColor: patch.maskColor,
                }}
              />
              <TextBoxLayer
                text={patch.text}
                scale={scale}
                fontScale={fontScale * patch.fontScaleMultiplier}
              />
            </div>
          );
        }

        if (patch.type === "cell") {
          return (
            <div
              key={patch.id}
              className="pointer-events-none absolute inset-0 z-10"
            >
              <div
                className="absolute"
                style={{
                  ...posStyle(patch.maskPosition, scale),
                  backgroundColor: patch.maskColor,
                }}
              />
              <div
                className="absolute overflow-hidden"
                style={{
                  ...posStyle(patch.position, scale),
                  backgroundColor: patch.maskColor,
                  color: toCssColor(patch.fontColorHex),
                  fontFamily: "Calibri, Arial, sans-serif",
                  fontWeight: patch.bold ? "bold" : "normal",
                  fontSize: tableCellFontSizePx(patch.fontSizePt, scale),
                  textAlign:
                    (patch.alignment as CSSProperties["textAlign"]) ?? "left",
                  padding: "1px 2px",
                  lineHeight: 1.2,
                  whiteSpace: "nowrap",
                  boxSizing: "border-box",
                }}
              >
                {patch.text}
              </div>
            </div>
          );
        }

        return (
          <div
            key={patch.id}
            className="pointer-events-none absolute z-10"
            style={{
              ...posStyle(patch.position, scale),
              backgroundColor: toCssColor(patch.color),
            }}
          />
        );
      })}
    </>
  );
}
