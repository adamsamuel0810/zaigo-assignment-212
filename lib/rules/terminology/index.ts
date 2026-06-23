import {
  PresentationMetadata,
  RuleCategory,
  Severity,
  SlideMetadata,
} from "@/lib/types";
import { deterministicDefaults, fail, pass } from "@/lib/rules/helpers";
import { BaseRule } from "@/lib/types";

const CLIENT_SUFFIX =
  "Laboratories|Labs|Inc\\.?|Incorporated|Corp\\.?|Corporation|Company|Co\\.?|LLC|Ltd\\.?|Holdings|Group";

function slideTextSegments(slide: SlideMetadata): string[] {
  return [
    slide.title?.full_text ?? "",
    ...slide.texts.map((t) => t.full_text),
    ...slide.tables.flatMap((t) => t.cells.map((c) => c.text)),
  ].filter(Boolean);
}

/** Standalone "Key" / "Legend" labels used on a slide (e.g. "Key:"). */
function legendLabelsOnSlide(slide: SlideMetadata): Set<"Key" | "Legend"> {
  const labels = new Set<"Key" | "Legend">();
  for (const seg of slideTextSegments(slide)) {
    const m = seg.trim().match(/^(Key|Legend)\s*:?\s*$/i);
    if (m) labels.add(/key/i.test(m[1]) ? "Key" : "Legend");
  }
  return labels;
}

/** Ordered labels from a small key/legend swatch table on the slide. */
function keyLegendOrder(slide: SlideMetadata): string[] {
  for (const table of slide.tables) {
    if (table.rows >= 3 && table.cols >= 3) continue;
    const labels = table.cells
      .filter(
        (c) => c.text.trim() && !/^key:?$/i.test(c.text.trim()) && c.text.trim().length < 40,
      )
      .sort((a, b) => a.row - b.row || a.col - b.col)
      .map((c) => c.text.trim().toLowerCase());
    if (labels.length >= 2 && labels.length <= 10) return labels;
  }
  return [];
}

export const terminologyRules: BaseRule[] = [
  {
    id: "TERM_001",
    name: 'Spell out "Target" not "TGT"',
    description: 'Do not abbreviate "Target" as "TGT".',
    category: RuleCategory.Terminology,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const allText = [
        slide.title?.full_text ?? "",
        ...slide.texts.map((t) => t.full_text),
        ...slide.tables.flatMap((t) => t.cells.map((c) => c.text)),
      ].join(" ");
      if (/\bTGT\b/.test(allText)) {
        return [
          fail(
            deterministicDefaults({
              rule_id: "TERM_001",
              slide_number: slide.slide_number,
              title: 'Use "Target" not "TGT"',
              description: 'ACME guidelines require spelling out "Target".',
              category: RuleCategory.Terminology,
              severity: Severity.Warning,
              expected_value: "Target",
              actual_value: "TGT",
              recommendation: 'Replace "TGT" with "Target".',
            }),
          ),
        ];
      }
      return [pass()];
    },
  },
  {
    id: "TERM_002",
    name: 'Use "Company" not "Company Name"',
    description: 'Table columns should use "Company" not "Company Name".',
    category: RuleCategory.Terminology,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const results = slide.tables.flatMap((table) => {
        // Header labels can sit in any of the top header rows (headers are
        // sometimes multi-row), so scan the first three rows.
        const headers = table.cells.filter((c) => c.row <= 2);
        const wrong = headers.filter((c) =>
          /^company\s*name$/i.test(c.text.trim().replace(/\s+/g, " ")),
        );
        if (wrong.length === 0) return [pass()];
        return [
          fail(
            deterministicDefaults({
              rule_id: "TERM_002",
              slide_number: slide.slide_number,
              title: 'Use "Company" not "Company Name"',
              description: "Column header should be labeled Company.",
              category: RuleCategory.Terminology,
              severity: Severity.Warning,
              expected_value: "Company",
              actual_value: "Company Name",
              recommendation: 'Rename column to "Company".',
              shape_id: table.shape_id,
              highlight: table.position,
            }),
          ),
        ];
      });
      return results.length ? results : [pass()];
    },
  },
  {
    id: "TERM_003",
    name: "Consistent client name",
    description:
      "The client name must be used consistently (no full legal-entity variants).",
    category: RuleCategory.Terminology,
    severity: Severity.Warning,
    run(slide: SlideMetadata, deck: PresentationMetadata) {
      if (!deck?.slides) return [pass()];

      const variantRe = new RegExp(`\\b(Goofy|Pluto\\w*)\\s+(${CLIENT_SUFFIX})\\b`, "g");
      const bareRe = /\b(Goofy|Pluto\w*)\b(?!\s+(?:Laboratories|Labs|Inc|Incorporated|Corp|Corporation|Company|Co|LLC|Ltd|Holdings|Group)\b)/;

      const deckText = deck.slides
        .flatMap(slideTextSegments)
        .join(" \n ");
      const usesBare = bareRe.test(deckText);
      if (!usesBare) return [pass()];

      const variants = new Set<string>();
      for (const seg of slideTextSegments(slide)) {
        for (const m of seg.matchAll(variantRe)) variants.add(m[0].trim());
      }
      if (variants.size === 0) return [pass()];

      return [
        fail(
          deterministicDefaults({
            rule_id: "TERM_003",
            slide_number: slide.slide_number,
            title: "Inconsistent client name",
            description:
              "A full legal-entity client name is used here while the rest of the deck uses the short name.",
            category: RuleCategory.Terminology,
            severity: Severity.Warning,
            expected_value: "Consistent short client name (e.g. \"Goofy\")",
            actual_value: [...variants].join(", "),
            recommendation: "Use the short client name consistently across the deck.",
          }),
        ),
      ];
    },
  },
  {
    id: "TERM_004",
    name: 'Consistent "Key" vs "Legend" labeling',
    description: "Swatch boxes must be labeled consistently across the deck.",
    category: RuleCategory.Terminology,
    severity: Severity.Warning,
    run(slide: SlideMetadata, deck: PresentationMetadata) {
      if (!deck?.slides) return [pass()];

      let keyCount = 0;
      let legendCount = 0;
      for (const s of deck.slides) {
        const labels = legendLabelsOnSlide(s);
        if (labels.has("Key")) keyCount += 1;
        if (labels.has("Legend")) legendCount += 1;
      }
      if (keyCount === 0 || legendCount === 0) return [pass()];

      const majority = keyCount >= legendCount ? "Key" : "Legend";
      const minority = majority === "Key" ? "Legend" : "Key";

      const labels = legendLabelsOnSlide(slide);
      if (!labels.has(minority)) return [pass()];

      return [
        fail(
          deterministicDefaults({
            rule_id: "TERM_004",
            slide_number: slide.slide_number,
            title: `Inconsistent label: "${minority}" vs "${majority}"`,
            description: `This slide labels the swatch box "${minority}" while the deck mostly uses "${majority}".`,
            category: RuleCategory.Terminology,
            severity: Severity.Warning,
            expected_value: `"${majority}" (used on ${Math.max(keyCount, legendCount)} slides)`,
            actual_value: `"${minority}"`,
            recommendation: `Rename "${minority}" to "${majority}" for consistency.`,
          }),
        ),
      ];
    },
  },
  {
    id: "TERM_005",
    name: "Key/Legend item order inconsistent",
    description: "Key/legend items should appear in the same order across slides.",
    category: RuleCategory.Terminology,
    severity: Severity.Warning,
    run(slide: SlideMetadata, deck: PresentationMetadata) {
      if (!deck?.slides) return [pass()];

      const orders = deck.slides
        .map((s) => ({ slide: s.slide_number, order: keyLegendOrder(s) }))
        .filter((x) => x.order.length >= 2);

      if (orders.length < 2) return [pass()];

      const counts = new Map<string, number>();
      for (const { order } of orders) {
        const key = order.join("|");
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const [modalKey] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      const modalOrder = modalKey.split("|");
      if (counts.get(modalKey)! < 2) return [pass()];

      const current = keyLegendOrder(slide);
      if (current.length < 2) return [pass()];
      if (current.join("|") === modalKey) return [pass()];

      // Same items but different order?
      const modalSet = new Set(modalOrder);
      const sameItems =
        current.length === modalOrder.length &&
        current.every((item) => modalSet.has(item));
      if (!sameItems) return [pass()];

      return [
        fail(
          deterministicDefaults({
            rule_id: "TERM_005",
            slide_number: slide.slide_number,
            title: "Key/Legend items in different order",
            description:
              "The key/legend items on this slide are in a different order than on most other slides.",
            category: RuleCategory.Terminology,
            severity: Severity.Warning,
            expected_value: modalOrder.join(" → "),
            actual_value: current.join(" → "),
            recommendation: "Reorder key/legend items to match the standard used across the deck.",
          }),
        ),
      ];
    },
  },
];

export function runTerminologyRules(
  slide: SlideMetadata,
  deck: PresentationMetadata,
) {
  return terminologyRules.flatMap((rule) => rule.run(slide, deck));
}
