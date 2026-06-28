import { estimateTitleLines } from "@/lib/rules/helpers";
import { SlideMetadata, TextMetadata } from "@/lib/types";

function titleFontSizePt(title: TextMetadata): number {
  for (const p of title.paragraphs) {
    for (const run of p.runs) {
      if (run.font_size_pt) return run.font_size_pt;
    }
  }
  return 24;
}

function maxCharsForLines(slide: SlideMetadata, lines: number): number {
  if (!slide.title) return 0;
  const width = slide.title.position.width_inches || 9;
  const fontSize = titleFontSizePt(slide.title);
  const charsPerLine = Math.max(1, width * 6.8 * (24 / fontSize));
  return Math.floor(charsPerLine * lines * 0.92);
}

export function rewriteTitleText(title: TextMetadata, newText: string): void {
  const templateRun = title.paragraphs[0]?.runs.find((r) => r.text.trim()) ??
    title.paragraphs[0]?.runs[0] ?? { text: "" };

  title.paragraphs = [
    {
      level: 0,
      text: newText,
      runs: [{ ...templateRun, text: newText }],
    },
  ];
  title.full_text = newText;
}

export function shortenTitleToLineLimit(
  slide: SlideMetadata,
  maxLines = 3,
): string | null {
  if (!slide.title) return null;
  const original = slide.title.full_text.trim();
  if (!original) return null;
  if (estimateTitleLines(slide) <= maxLines) return original;

  const maxChars = maxCharsForLines(slide, maxLines);
  if (maxChars <= 0) return null;

  const words = original.split(/\s+/);
  let candidate = original;

  while (candidate.length > maxChars && words.length > 1) {
    words.pop();
    candidate = `${words.join(" ").replace(/[.,;:]+$/, "")}…`;
  }

  if (candidate.length > maxChars) {
    candidate = `${original.slice(0, Math.max(1, maxChars - 1)).trim()}…`;
  }

  const probe: SlideMetadata = {
    ...slide,
    title: structuredClone(slide.title),
  };
  rewriteTitleText(probe.title!, candidate);

  if (estimateTitleLines(probe) > maxLines) {
    let trimmed = candidate;
    while (trimmed.length > 20 && estimateTitleLines(probe) > maxLines) {
      trimmed = `${trimmed.slice(0, -4).trim()}…`;
      rewriteTitleText(probe.title!, trimmed);
    }
    candidate = trimmed;
  }

  return candidate.trim() !== original.trim() ? candidate : null;
}

export function slideTextChanged(
  before: SlideMetadata,
  after: SlideMetadata,
): boolean {
  if ((before.title?.full_text ?? "") !== (after.title?.full_text ?? "")) {
    return true;
  }

  const beforeTexts = new Map(
    [...(before.title ? [before.title] : []), ...before.texts].map((t) => [
      t.shape_id,
      t.full_text,
    ]),
  );

  for (const text of after.texts) {
    if (beforeTexts.get(text.shape_id) !== text.full_text) return true;
  }

  return false;
}
