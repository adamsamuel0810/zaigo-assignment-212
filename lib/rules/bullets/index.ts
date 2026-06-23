import { RuleCategory, Severity, SlideMetadata } from "@/lib/types";
import { BULLET_FONT_SIZE_PT, fontMatchesCalibri } from "@/lib/rules/constants";
import {
  deterministicDefaults,
  fail,
  getMainBulletParagraphs,
  isMainBodyText,
  pass,
} from "@/lib/rules/helpers";
import {
  hasExplicitFontFamily,
  hasExplicitFontSize,
  isActualBulletParagraph,
} from "@/lib/rules/run-style";
import { BaseRule } from "@/lib/types";

const LEVEL1_BULLETS = new Set(["∎", "▪", "■", "•"]);

/**
 * Accepted bullet glyphs per level (0-indexed levels, matching python-pptx).
 *  - level 1 (index 1): dashes / en-dashes / em-dashes
 *  - level 2 (index 2): three-D top-lighted rightwards arrowhead (Alt-10146)
 *  - levels 3–4 (index 3–4): black circles
 */
const LEVEL_BULLETS: Record<number, Set<string>> = {
  1: new Set(["-", "–", "—", "--"]),
  2: new Set(["➢", "➤", "►", "▶"]),
  3: new Set(["●", "•", "∙", "·"]),
  4: new Set(["●", "•", "∙", "·"]),
};

const LEVEL_BULLET_LABEL: Record<number, string> = {
  1: "dash (-)",
  2: "arrowhead (➢)",
  3: "black circle (●)",
  4: "black circle (●)",
};

/** Expected left indentation per bullet level (inches), per ACME guidelines. */
const EXPECTED_INDENT_IN: Record<number, number> = {
  1: 0.4, // Level 2 bullets
  2: 0.6, // Level 3 bullets
  3: 0.6, // Levels 4–5 bullets
  4: 0.6,
};
const INDENT_TOLERANCE_IN = 0.1;

/** Line spacing (multiple) above which we consider it more than single. */
const MAX_SINGLE_LINE_SPACING = 1.15;

/** Expected spacing after a level-1 bullet (pt) and the tolerance we allow. */
const LEVEL1_SPACE_AFTER_PT = 6;
const SPACE_AFTER_TOLERANCE_PT = 3;

export const bulletRules: BaseRule[] = [
  {
    id: "BULLET_001",
    name: "Primary bullets must be 16pt",
    description: "Level 1 bullets must be Calibri 16pt.",
    category: RuleCategory.Bullets,
    severity: Severity.Error,
    run(slide: SlideMetadata) {
      const bullets = getMainBulletParagraphs(slide);
      if (bullets.length === 0) return [pass()];

      const wrong = bullets.flatMap((p) =>
        p.runs.filter(
          (r) =>
            r.text.trim() &&
            hasExplicitFontSize(r) &&
            r.font_size_pt != null &&
            Math.abs(r.font_size_pt - BULLET_FONT_SIZE_PT) > 0.5,
        ),
      );
      if (wrong.length === 0) return [pass()];
      return [
        fail(
          deterministicDefaults({
            rule_id: "BULLET_001",
            slide_number: slide.slide_number,
            title: "Bullet font size incorrect",
            description: "Primary bullets must be 16pt.",
            category: RuleCategory.Bullets,
            severity: Severity.Error,
            expected_value: "16pt",
            actual_value: wrong.map((r) => `${r.font_size_pt}pt`).join(", "),
            recommendation: "Set bullet text to Calibri 16pt.",
          }),
        ),
      ];
    },
  },
  {
    id: "BULLET_002",
    name: "Bullet punctuation should not exist",
    description: "Bullet text should not end with punctuation.",
    category: RuleCategory.Bullets,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const bullets = getMainBulletParagraphs(slide);
      const offenders = bullets.filter(
        (p) => p.text.trim() && /[.!?:;]$/.test(p.text.trim()),
      );
      if (offenders.length === 0) return [pass()];
      return [
        fail(
          deterministicDefaults({
            rule_id: "BULLET_002",
            slide_number: slide.slide_number,
            title: "Bullet ends with punctuation",
            description: "Bullet lines should not end with punctuation.",
            category: RuleCategory.Bullets,
            severity: Severity.Warning,
            expected_value: "No ending punctuation",
            actual_value: offenders.map((p) => p.text.trim().slice(0, 60)).join("; "),
            recommendation: "Remove trailing punctuation from bullet text.",
          }),
        ),
      ];
    },
  },
  {
    id: "BULLET_003",
    name: "Level 1 bullet symbol",
    description: "Level 1 bullets should use square bullets (∎ or ▪).",
    category: RuleCategory.Bullets,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const level1 = slide.texts
        .filter(isMainBodyText)
        .flatMap((t) =>
          t.paragraphs.filter((p) => isActualBulletParagraph(p) && p.level === 0),
        );
      const wrong = level1.filter(
        (p) => p.bullet_char && !LEVEL1_BULLETS.has(p.bullet_char) && p.bullet_char !== "-",
      );
      if (wrong.length === 0) return [pass()];
      return [
        fail(
          deterministicDefaults({
            rule_id: "BULLET_003",
            slide_number: slide.slide_number,
            title: "Incorrect level 1 bullet symbol",
            description: "Level 1 bullets should use square bullets.",
            category: RuleCategory.Bullets,
            severity: Severity.Warning,
            expected_value: "∎ or ▪",
            actual_value: wrong.map((p) => p.bullet_char ?? "unknown").join(", "),
            recommendation: "Use square bullets for level 1 lists.",
          }),
        ),
      ];
    },
  },
  {
    id: "BULLET_004",
    name: "Bullet font must be Calibri",
    description: "Bullet text must use Calibri body font.",
    category: RuleCategory.Bullets,
    severity: Severity.Error,
    run(slide: SlideMetadata) {
      const bullets = getMainBulletParagraphs(slide);
      if (bullets.length === 0) return [pass()];

      const wrong = bullets.flatMap((p) =>
        p.runs.filter(
          (r) => r.text.trim() && hasExplicitFontFamily(r) && !fontMatchesCalibri(r.font_family),
        ),
      );
      if (wrong.length === 0) return [pass()];
      return [
        fail(
          deterministicDefaults({
            rule_id: "BULLET_004",
            slide_number: slide.slide_number,
            title: "Bullet font not Calibri",
            description: "Bullet text must use Calibri.",
            category: RuleCategory.Bullets,
            severity: Severity.Error,
            expected_value: "Calibri",
            actual_value: wrong.map((r) => r.font_family ?? "unknown").join(", "),
            recommendation: "Set bullet font to Calibri Body.",
          }),
        ),
      ];
    },
  },
  {
    id: "BULLET_006",
    name: "Bullet indentation must match levels",
    description: "Level 2 bullets indent 0.4\"; level 3+ bullets indent 0.6\".",
    category: RuleCategory.Bullets,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const bullets = getMainBulletParagraphs(slide);
      const offenders = bullets.filter((p) => {
        const expected = EXPECTED_INDENT_IN[p.level];
        if (expected == null) return false; // level 0 not specified
        if (p.indent_inches == null) return false; // only explicit values
        return Math.abs(p.indent_inches - expected) > INDENT_TOLERANCE_IN;
      });
      if (offenders.length === 0) return [pass()];
      return [
        fail(
          deterministicDefaults({
            rule_id: "BULLET_006",
            slide_number: slide.slide_number,
            title: "Bullet indentation incorrect",
            description:
              "Sub-bullets do not match the standard indentation (L2 0.4\", L3+ 0.6\").",
            category: RuleCategory.Bullets,
            severity: Severity.Warning,
            expected_value: "L2 0.4\", L3+ 0.6\"",
            actual_value: offenders
              .map((p) => `L${p.level + 1} ${p.indent_inches}\"`)
              .join(", "),
            recommendation: "Set sub-bullet indentation to the standard values.",
          }),
        ),
      ];
    },
  },
  {
    id: "BULLET_007",
    name: "Bullets must use single line spacing",
    description: "Bullet text must use single line spacing.",
    category: RuleCategory.Bullets,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const bullets = getMainBulletParagraphs(slide);
      const offenders = bullets.filter(
        (p) =>
          p.line_spacing != null && p.line_spacing > MAX_SINGLE_LINE_SPACING,
      );
      if (offenders.length === 0) return [pass()];
      return [
        fail(
          deterministicDefaults({
            rule_id: "BULLET_007",
            slide_number: slide.slide_number,
            title: "Bullet line spacing not single",
            description: "Bullet text should use single line spacing.",
            category: RuleCategory.Bullets,
            severity: Severity.Warning,
            expected_value: "Single (1.0)",
            actual_value: [...new Set(offenders.map((p) => `${p.line_spacing}×`))].join(
              ", ",
            ),
            recommendation: "Set bullet line spacing to single.",
          }),
        ),
      ];
    },
  },
  {
    id: "BULLET_008",
    name: "Level 1 bullets need 6pt spacing",
    description: "Spacing between level 1 bullets should be 6pt.",
    category: RuleCategory.Bullets,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const level1 = getMainBulletParagraphs(slide).filter((p) => p.level === 0);
      // Need at least two level-1 bullets for "spacing between" to apply.
      if (level1.length < 2) return [pass()];
      const offenders = level1.filter(
        (p) =>
          p.space_after_pt != null &&
          Math.abs(p.space_after_pt - LEVEL1_SPACE_AFTER_PT) >
            SPACE_AFTER_TOLERANCE_PT,
      );
      if (offenders.length === 0) return [pass()];
      return [
        fail(
          deterministicDefaults({
            rule_id: "BULLET_008",
            slide_number: slide.slide_number,
            title: "Level 1 bullet spacing incorrect",
            description: "Level 1 bullets should have 6pt spacing between them.",
            category: RuleCategory.Bullets,
            severity: Severity.Warning,
            expected_value: "6pt after each level 1 bullet",
            actual_value: [
              ...new Set(offenders.map((p) => `${p.space_after_pt}pt`)),
            ].join(", "),
            recommendation: "Set 6pt spacing after level 1 bullets.",
          }),
        ),
      ];
    },
  },
  {
    id: "BULLET_009",
    name: "Sub-bullet symbols must match level",
    description:
      "Level 2 uses dashes, level 3 arrowheads, levels 4–5 black circles.",
    category: RuleCategory.Bullets,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const offenders = getMainBulletParagraphs(slide).filter((p) => {
        const allowed = LEVEL_BULLETS[p.level];
        if (!allowed) return false; // level 0 handled by BULLET_003
        if (!p.bullet_char || p.bullet_char === "auto") return false; // explicit only
        return !allowed.has(p.bullet_char);
      });
      if (offenders.length === 0) return [pass()];
      return [
        fail(
          deterministicDefaults({
            rule_id: "BULLET_009",
            slide_number: slide.slide_number,
            title: "Sub-bullet symbol incorrect",
            description:
              "A sub-bullet uses a symbol that does not match its level's standard.",
            category: RuleCategory.Bullets,
            severity: Severity.Warning,
            expected_value: [
              ...new Set(offenders.map((p) => LEVEL_BULLET_LABEL[p.level])),
            ].join(", "),
            actual_value: [
              ...new Set(
                offenders.map((p) => `L${p.level + 1} "${p.bullet_char}"`),
              ),
            ].join(", "),
            recommendation:
              "Use dashes (L2), arrowheads (L3), and black circles (L4–5).",
          }),
        ),
      ];
    },
  },
  {
    id: "BULLET_010",
    name: "Bullets must be left-aligned",
    description: "Bullet text must be left-aligned per ACME guidelines.",
    category: RuleCategory.Bullets,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const offenders = getMainBulletParagraphs(slide).filter(
        (p) =>
          p.alignment != null &&
          p.alignment !== "LEFT" &&
          p.alignment !== "JUSTIFY_LOW" &&
          p.alignment !== "DISTRIBUTE",
      );
      // Only flag clearly center/right/justified bullets.
      const flagged = offenders.filter((p) =>
        ["CENTER", "RIGHT", "JUSTIFY"].includes(p.alignment as string),
      );
      if (flagged.length === 0) return [pass()];
      return [
        fail(
          deterministicDefaults({
            rule_id: "BULLET_010",
            slide_number: slide.slide_number,
            title: "Bullets not left-aligned",
            description: "Bullet paragraphs should be left-aligned.",
            category: RuleCategory.Bullets,
            severity: Severity.Warning,
            expected_value: "Left-aligned",
            actual_value: [
              ...new Set(flagged.map((p) => (p.alignment ?? "").toLowerCase())),
            ].join(", "),
            recommendation: "Set bullet paragraph alignment to left.",
          }),
        ),
      ];
    },
  },
  {
    id: "BULLET_011",
    name: "Sub-bullets need 0 pt spacing",
    description: "Level 2+ bullets should have 0 pt spacing between them.",
    category: RuleCategory.Bullets,
    severity: Severity.Warning,
    run(slide: SlideMetadata) {
      const subBullets = getMainBulletParagraphs(slide).filter((p) => p.level > 0);
      const offenders = subBullets.filter(
        (p) => p.space_after_pt != null && p.space_after_pt > 2,
      );
      if (offenders.length === 0) return [pass()];
      return [
        fail(
          deterministicDefaults({
            rule_id: "BULLET_011",
            slide_number: slide.slide_number,
            title: "Sub-bullet spacing should be 0 pt",
            description: "Level 2+ bullets should have 0 pt spacing after them.",
            category: RuleCategory.Bullets,
            severity: Severity.Warning,
            expected_value: "0 pt after sub-bullets",
            actual_value: [
              ...new Set(offenders.map((p) => `${p.space_after_pt}pt`)),
            ].join(", "),
            recommendation: "Set spacing after level 2+ bullets to 0 pt.",
          }),
        ),
      ];
    },
  },
  {
    id: "BULLET_012",
    name: "Bullet indentation inconsistent with deck",
    description: "Sub-bullet indentation should match the standard used across the deck.",
    category: RuleCategory.Bullets,
    severity: Severity.Warning,
    run(slide: SlideMetadata, deck) {
      if (!deck?.slides) return [pass()];
      const modal = new Map<number, number>();
      const counts = new Map<number, Map<string, number>>();
      for (const s of deck.slides) {
        for (const p of getMainBulletParagraphs(s)) {
          if (p.level === 0 || p.indent_inches == null) continue;
          const key = p.indent_inches.toFixed(2);
          const levelMap = counts.get(p.level) ?? new Map();
          levelMap.set(key, (levelMap.get(key) ?? 0) + 1);
          counts.set(p.level, levelMap);
        }
      }
      for (const [level, levelMap] of counts) {
        const top = [...levelMap.entries()].sort((a, b) => b[1] - a[1])[0];
        if (top && top[1] >= 3) modal.set(level, parseFloat(top[0]));
      }
      if (modal.size === 0) return [pass()];

      const offenders = getMainBulletParagraphs(slide).filter((p) => {
        const expected = modal.get(p.level);
        if (expected == null || p.indent_inches == null) return false;
        return Math.abs(p.indent_inches - expected) > 0.15;
      });
      if (offenders.length === 0) return [pass()];
      return [
        fail(
          deterministicDefaults({
            rule_id: "BULLET_012",
            slide_number: slide.slide_number,
            title: "Bullet indentation differs from deck standard",
            description:
              "Sub-bullet indentation on this slide does not match the modal value used across the deck.",
            category: RuleCategory.Bullets,
            severity: Severity.Warning,
            expected_value: [...modal.entries()]
              .map(([l, v]) => `L${l + 1} ${v}"`)
              .join(", "),
            actual_value: offenders
              .map((p) => `L${p.level + 1} ${p.indent_inches}"`)
              .join(", "),
            recommendation: "Align sub-bullet indentation with the rest of the deck.",
          }),
        ),
      ];
    },
  },
];

export function runBulletRules(slide: SlideMetadata, deck?: { slides?: SlideMetadata[] }) {
  return bulletRules.flatMap((rule) => rule.run(slide, deck as never));
}
