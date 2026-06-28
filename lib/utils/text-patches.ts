import { SlideMetadata, TextMetadata } from "@/lib/types";

export interface ApplyTextPatch {
  slide_number: number;
  shape_id: string;
  paragraphs: string[];
}

function collectTextShapes(slide: SlideMetadata): TextMetadata[] {
  const shapes: TextMetadata[] = [];
  if (slide.title) shapes.push(slide.title);
  shapes.push(...slide.texts);
  if (slide.confidentiality) shapes.push(slide.confidentiality);
  return shapes;
}

function paragraphTexts(shape: TextMetadata): string[] {
  const nonEmpty = shape.paragraphs.filter((p) => p.text.trim());
  if (nonEmpty.length > 0) {
    return nonEmpty.map((p) => p.text);
  }
  const full = shape.full_text.trim();
  return full ? [full] : [];
}

/** Diff original vs AI-fixed slide metadata into PPTX writer patches. */
export function buildTextPatches(
  slideNumber: number,
  original: SlideMetadata,
  fixed: SlideMetadata,
): ApplyTextPatch[] {
  const patches: ApplyTextPatch[] = [];
  const fixedById = new Map(
    collectTextShapes(fixed).map((shape) => [shape.shape_id, shape]),
  );

  for (const orig of collectTextShapes(original)) {
    const next = fixedById.get(orig.shape_id);
    if (!next) continue;
    if (orig.full_text.trim() === next.full_text.trim()) continue;

    patches.push({
      slide_number: slideNumber,
      shape_id: orig.shape_id,
      paragraphs: paragraphTexts(next),
    });
  }

  return patches;
}

export function mergeTextPatches(
  patches: ApplyTextPatch[],
): ApplyTextPatch[] {
  const byKey = new Map<string, ApplyTextPatch>();
  for (const patch of patches) {
    byKey.set(`${patch.slide_number}:${patch.shape_id}`, patch);
  }
  return [...byKey.values()];
}
