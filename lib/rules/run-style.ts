import { ParagraphMetadata, TextRunMetadata } from "@/lib/types";

/** True when the run has an explicitly set (non-inherited) font family. */
export function hasExplicitFontFamily(run: TextRunMetadata): boolean {
  return run.font_family != null && run.font_family.trim() !== "";
}

/** True when bold is explicitly set on the run (not inherited from theme). */
export function hasExplicitBold(run: TextRunMetadata): boolean {
  return run.bold !== null && run.bold !== undefined;
}

/** True when font size is explicitly set on the run. */
export function hasExplicitFontSize(run: TextRunMetadata): boolean {
  return run.font_size_pt != null && run.font_size_pt > 0;
}

/**
 * Only paragraphs that are actual bullet lists — not plain body text at level 0.
 */
export function getBulletParagraphs(slide: {
  texts: { paragraphs: ParagraphMetadata[] }[];
}): ParagraphMetadata[] {
  const paragraphs = slide.texts.flatMap((t) => t.paragraphs);
  return paragraphs.filter(
    (p) =>
      p.text.trim() &&
      (p.level > 0 || (p.bullet_char != null && p.bullet_char !== "auto")),
  );
}

export function isActualBulletParagraph(p: ParagraphMetadata): boolean {
  return (
    p.text.trim().length > 0 &&
    (p.level > 0 || (p.bullet_char != null && p.bullet_char !== "auto"))
  );
}
