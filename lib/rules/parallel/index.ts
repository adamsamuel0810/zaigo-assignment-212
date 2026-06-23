import {
  BaseRule,
  ParagraphMetadata,
  RuleCategory,
  Severity,
  SlideMetadata,
  TextMetadata,
} from "@/lib/types";
import { deterministicDefaults, fail, isBodyContentText, pass } from "@/lib/rules/helpers";
import { Confidence } from "@/lib/types";

/**
 * Deterministic parallel-structure heuristic for bulleted lists.
 *
 * ACME requires "parallel grammatical structure within a list". A reliable,
 * low-false-positive signal for non-parallelism is the grammatical form that
 * each bullet *opens* with. We classify the first word of each bullet into a
 * small set of structural buckets and flag a list only when the openings are
 * clearly heterogeneous (3+ distinct buckets with no dominant form).
 *
 * Crucially, verb-led and noun-led openings both fall into the "other" bucket,
 * so consistent imperative lists ("Review… / Update… / Assess…") or consistent
 * noun lists ("Revenue… / Margins… / Costs…") never trigger. Only genuinely
 * mixed subjects (pronoun + quantifier + proper noun, etc.) do.
 */

const PRONOUNS = new Set([
  "we", "i", "you", "he", "she", "it", "they", "this", "these", "those",
  "our", "their", "its", "his", "her", "your", "my", "us", "them",
]);

const QUANTIFIERS = new Set([
  "none", "all", "each", "some", "many", "no", "every", "several", "most",
  "few", "both", "either", "neither", "any", "various", "numerous", "much",
]);

const ARTICLES = new Set(["the", "a", "an"]);

type OpeningBucket =
  | "pronoun"
  | "quantifier"
  | "article"
  | "gerund"
  | "other";

function firstWord(text: string): string {
  const cleaned = text.trim().replace(/^[^A-Za-z]+/, "");
  const match = cleaned.match(/^[A-Za-z'']+/);
  return match ? match[0] : "";
}

function classifyOpening(text: string): OpeningBucket | null {
  const word = firstWord(text);
  if (!word) return null;
  const lower = word.toLowerCase();
  if (PRONOUNS.has(lower)) return "pronoun";
  if (QUANTIFIERS.has(lower)) return "quantifier";
  if (ARTICLES.has(lower)) return "article";
  if (lower.length > 4 && lower.endsWith("ing")) return "gerund";
  return "other";
}

/** Non-empty paragraphs of a shape grouped by indentation level. */
function listGroups(shape: TextMetadata): ParagraphMetadata[][] {
  const byLevel = new Map<number, ParagraphMetadata[]>();
  for (const p of shape.paragraphs) {
    if (!p.text.trim()) continue;
    const level = p.level ?? 0;
    const group = byLevel.get(level) ?? [];
    group.push(p);
    byLevel.set(level, group);
  }
  return [...byLevel.values()];
}

function isNonParallel(paras: ParagraphMetadata[]): boolean {
  const buckets = paras
    .map((p) => classifyOpening(p.text))
    .filter((b): b is OpeningBucket => b !== null);
  if (buckets.length < 3) return false;

  const counts = new Map<OpeningBucket, number>();
  for (const b of buckets) counts.set(b, (counts.get(b) ?? 0) + 1);

  const distinct = counts.size;
  const maxShare = Math.max(...counts.values()) / buckets.length;

  return distinct >= 3 && maxShare < 0.6;
}

export const parallelRules: BaseRule[] = [
  {
    id: "BULLET_005",
    name: "Bullets must use parallel grammatical structure",
    description:
      "Bullets within a list should share a consistent grammatical structure.",
    category: RuleCategory.WritingStyle,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const bodyShapes = slide.texts.filter(isBodyContentText);

      for (const shape of bodyShapes) {
        for (const group of listGroups(shape)) {
          if (group.length < 3) continue;
          if (!isNonParallel(group)) continue;

          const openings = group
            .map((p) => firstWord(p.text))
            .filter(Boolean)
            .map((w) => `"${w}…"`)
            .join(", ");

          return [
            fail({
              ...deterministicDefaults({
                rule_id: "BULLET_005",
                slide_number: slide.slide_number,
                title: "Bullets lack parallel structure",
                description:
                  "Bullets in this list start with mixed grammatical forms, breaking parallel structure.",
                category: RuleCategory.WritingStyle,
                severity: Severity.Warning,
                expected_value: "Consistent grammatical structure across bullets",
                actual_value: `Mixed openings: ${openings}`,
                recommendation:
                  "Rewrite bullets so each follows the same grammatical pattern (e.g. all start with a verb or all with the same subject).",
                shape_id: shape.shape_id,
                highlight: shape.position,
              }),
              confidence: Confidence.Medium,
            }),
          ];
        }
      }
      return [pass()];
    },
  },
];

export function runParallelRules(slide: SlideMetadata) {
  return parallelRules.flatMap((rule) => rule.run(slide, {} as never));
}
