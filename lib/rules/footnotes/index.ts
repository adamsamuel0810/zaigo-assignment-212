import {
  BaseRule,
  PresentationMetadata,
  RuleCategory,
  Severity,
  SlideMetadata,
  TextMetadata,
} from "@/lib/types";
import { FOOTNOTE_FONT_SIZE_PT, fontMatchesCalibri } from "@/lib/rules/constants";
import { deterministicDefaults, fail, pass } from "@/lib/rules/helpers";

/**
 * A footnote begins with a numeric or symbol marker, e.g. "(1) …", "1. …",
 * "* …". We deliberately do NOT match "Source …" / "Note …" text: chart source
 * notes are a separate 9pt element handled by CHART_002, so keeping the marker
 * strict avoids both false positives and double-flagging.
 */
const FOOTNOTE_MARKER = /^\s*(\(\d+\)|\d+[.)]|[*†‡])\s+\S/;

/** Fraction of slide height below which a text box is considered "bottom area". */
const BOTTOM_REGION_FRACTION = 0.6;

function isFootnoteText(text: TextMetadata, slideHeight: number): boolean {
  if (!text.full_text.trim()) return false;
  if (slideHeight > 0 && text.position.top_inches < slideHeight * BOTTOM_REGION_FRACTION) {
    return false;
  }
  return FOOTNOTE_MARKER.test(text.full_text);
}

export const footnoteRules: BaseRule[] = [
  {
    id: "FOOTNOTE_001",
    name: "Footnotes must be Calibri italic 10pt",
    description: "Slide footnotes must be Calibri (Body) italic at 10pt.",
    category: RuleCategory.Footnotes,
    severity: Severity.Warning,
    run(slide: SlideMetadata, deck: PresentationMetadata) {
      const slideHeight = deck?.slide_height_inches ?? 0;
      const footnotes = slide.texts.filter((t) => isFootnoteText(t, slideHeight));
      if (footnotes.length === 0) return [pass()];

      const issues: string[] = [];
      let offendingShape: string | undefined;

      for (const fn of footnotes) {
        const runs = fn.paragraphs.flatMap((p) => p.runs).filter((r) => r.text.trim());
        const notItalic = runs.some((r) => r.italic === false);
        const wrongSize = runs.filter(
          (r) =>
            r.font_size_pt != null &&
            Math.abs(r.font_size_pt - FOOTNOTE_FONT_SIZE_PT) > 0.5,
        );
        const wrongFont = runs.some(
          (r) => r.font_family && !fontMatchesCalibri(r.font_family),
        );

        if (notItalic || wrongSize.length > 0 || wrongFont) {
          offendingShape = offendingShape ?? fn.shape_id;
          if (notItalic) issues.push("not italic");
          if (wrongSize.length > 0) {
            issues.push(...wrongSize.map((r) => `${r.font_size_pt}pt`));
          }
          if (wrongFont) issues.push("non-Calibri font");
        }
      }

      if (issues.length === 0) return [pass()];
      const offender = slide.texts.find((t) => t.shape_id === offendingShape);
      return [
        fail(
          deterministicDefaults({
            rule_id: "FOOTNOTE_001",
            slide_number: slide.slide_number,
            title: "Footnote formatting incorrect",
            description: "Footnotes must be Calibri italic 10pt.",
            category: RuleCategory.Footnotes,
            severity: Severity.Warning,
            expected_value: "Calibri italic 10pt",
            actual_value: [...new Set(issues)].join(", "),
            recommendation: "Format footnotes as Calibri (Body) italic 10pt.",
            shape_id: offendingShape,
            highlight: offender?.position,
          }),
        ),
      ];
    },
  },
];

/** Footnote symbol markers we recognize (besides plain numbers). */
const FOOTNOTE_SYMBOLS = new Set(["*", "†", "‡", "§"]);

/** Leading marker token of a footnote entry line, e.g. "(1)", "2.", "* ". */
function footnoteEntryToken(text: string): string | null {
  const m = /^\s*(?:\((\d+)\)|(\d+)[.)]|([*†‡§]))/.exec(text);
  if (!m) return null;
  return (m[1] ?? m[2] ?? m[3]) || null;
}

/** Superscript marker tokens used within a run (digits or footnote symbols). */
function superscriptTokens(runText: string): string[] {
  const tokens: string[] = [];
  for (const num of runText.match(/\d+/g) ?? []) tokens.push(num);
  for (const ch of runText) if (FOOTNOTE_SYMBOLS.has(ch)) tokens.push(ch);
  return tokens;
}

footnoteRules.push({
  id: "FOOTNOTE_002",
  name: "Footnote markers must have a matching entry",
  description:
    "Every superscript footnote marker must have a matching footnote entry on the slide.",
  category: RuleCategory.Footnotes,
  severity: Severity.Warning,
  run(slide: SlideMetadata) {
    // Collect superscript markers used anywhere in slide text.
    const markers = new Set<string>();
    for (const text of slide.texts) {
      for (const para of text.paragraphs) {
        for (const run of para.runs) {
          if (run.superscript === true && run.text.trim()) {
            for (const tok of superscriptTokens(run.text)) markers.add(tok);
          }
        }
      }
    }
    if (markers.size === 0) return [pass()];

    // Collect footnote entry markers. We scan every text line (not just the
    // bottom band): a present entry — even if repositioned or overlapping the
    // footer — should satisfy its marker. This biases toward NOT flagging,
    // keeping the rule free of false orphans.
    const entries = new Set<string>();
    for (const text of slide.texts) {
      for (const line of text.full_text.split(/\r?\n/)) {
        const tok = footnoteEntryToken(line);
        if (tok) entries.add(tok);
      }
    }
    // Only evaluate when the slide actually uses *labeled* footnote entries.
    // If footnotes are present-but-unlabeled (or absent entirely), we don't
    // hard-flag — that avoids false positives on decks whose footnote text is
    // not prefixed with its marker. We flag the clear case: labeled entries
    // exist, but a specific marker number is missing from them.
    if (entries.size === 0) return [pass()];

    const orphaned = [...markers].filter((m) => !entries.has(m));
    if (orphaned.length === 0) return [pass()];
    return [
      fail(
        deterministicDefaults({
          rule_id: "FOOTNOTE_002",
          slide_number: slide.slide_number,
          title: "Footnote marker without matching entry",
          description:
            "A superscript footnote marker has no matching footnote at the bottom of the slide.",
          category: RuleCategory.Footnotes,
          severity: Severity.Warning,
          expected_value: "Matching footnote entry for every marker",
          actual_value: `Unmatched marker(s): ${orphaned.join(", ")}`,
          recommendation:
            "Add a footnote entry for each marker, or remove the orphaned marker.",
        }),
      ),
    ];
  },
});

footnoteRules.push({
  id: "FOOTNOTE_003",
  name: "Footnote markers need bottom entries",
  description:
    "Slides with footnote markers must include matching footnote text at the bottom.",
  category: RuleCategory.Footnotes,
  severity: Severity.Warning,
  run(slide: SlideMetadata, deck: PresentationMetadata) {
    const slideHeight = deck?.slide_height_inches ?? 7.5;
    const markers = new Set<string>();

    for (const text of slide.texts) {
      for (const para of text.paragraphs) {
        for (const run of para.runs) {
          if (run.superscript === true && run.text.trim()) {
            for (const tok of superscriptTokens(run.text)) markers.add(tok);
          }
        }
      }
      for (const m of text.full_text.matchAll(/\((\d+)\)/g)) {
        markers.add(m[1]);
      }
    }
    if (markers.size === 0) return [pass()];

    const entries = new Set<string>();
    for (const text of slide.texts) {
      for (const line of text.full_text.split(/\r?\n/)) {
        const tok = footnoteEntryToken(line);
        if (tok) entries.add(tok);
      }
    }
    const orphaned = [...markers].filter((m) => !entries.has(m));
    if (orphaned.length === 0) return [pass()];

    let bottomLines = 0;
    for (const text of slide.texts) {
      if (text.position.top_inches < slideHeight * 0.55) continue;
      if (/confidential|proprietary|privacy/i.test(text.full_text)) continue;
      if (/^\s*\d+\s*$/.test(text.full_text.trim())) continue;
      for (const line of text.full_text.split(/\r?\n/)) {
        if (line.trim().length >= 15) bottomLines += 1;
      }
    }
    if (bottomLines >= orphaned.length) return [pass()];

    return [
      fail(
        deterministicDefaults({
          rule_id: "FOOTNOTE_003",
          slide_number: slide.slide_number,
          title: "Footnote markers without bottom entries",
          description:
            "Footnote markers are used but there are not enough footnote lines at the bottom of the slide.",
          category: RuleCategory.Footnotes,
          severity: Severity.Warning,
          expected_value: `${orphaned.length} footnote entry line(s) at bottom`,
          actual_value: `${bottomLines} line(s) found; markers: ${orphaned.join(", ")}`,
          recommendation:
            "Add a labeled footnote entry at the bottom for each marker used on the slide.",
        }),
      ),
    ];
  },
});

export function runFootnoteRules(slide: SlideMetadata, deck: PresentationMetadata) {
  return footnoteRules.flatMap((rule) => rule.run(slide, deck));
}
