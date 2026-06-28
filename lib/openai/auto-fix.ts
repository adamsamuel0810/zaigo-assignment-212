import { z } from "zod";
import { generateStructuredJson } from "@/lib/ai/generate-json";
import { estimateTitleLines, isBodyContentText } from "@/lib/rules/helpers";
import { Finding, SlideMetadata, TextMetadata } from "@/lib/types";
import type { AutoFixResult } from "@/lib/services/auto-fix";
import {
  applyAutoFix,
  canAutoFix,
  needsAiPreview,
} from "@/lib/services/auto-fix";
import {
  rewriteTitleText,
  shortenTitleToLineLimit,
  slideTextChanged,
} from "@/lib/utils/title-fix";

const AiFixResponseSchema = z.object({
  bullet_rewrites: z
    .array(
      z.object({
        shape_id: z.string(),
        bullets: z.array(z.string()),
      }),
    )
    .optional(),
  title_text: z.string().optional(),
  text_rewrites: z
    .array(
      z.object({
        shape_id: z.string(),
        new_text: z.string(),
      }),
    )
    .optional(),
  applied_summary: z.array(z.string()),
});

export type AiFixResponse = z.infer<typeof AiFixResponseSchema>;

const AI_FIX_JSON_SCHEMA = {
  type: "object",
  properties: {
    bullet_rewrites: {
      type: "array",
      items: {
        type: "object",
        properties: {
          shape_id: { type: "string" },
          bullets: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["shape_id", "bullets"],
        additionalProperties: false,
      },
    },
    title_text: { type: "string" },
    text_rewrites: {
      type: "array",
      items: {
        type: "object",
        properties: {
          shape_id: { type: "string" },
          new_text: { type: "string" },
        },
        required: ["shape_id", "new_text"],
        additionalProperties: false,
      },
    },
    applied_summary: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["applied_summary"],
  additionalProperties: false,
} as const;

const AI_FIX_SYSTEM_PROMPT = `You fix ACME executive compensation slide copy. Preserve facts, numbers, and client names.
Only change text needed to resolve the issue. Do not invent data.

For TITLE_004 (title exceeds three lines):
- MUST return title_text with a shorter rewrite of the title
- Keep the same meaning; remove filler and tighten phrasing
- Target at most 3 lines when displayed at 24pt in the title box
- Do NOT repeat the issue description in applied_summary

For parallel bullet structure (BULLET_005 / PARALLEL_GRAMMAR):
- Rewrite bullets so openings share the same grammatical pattern
- Prefer consistent verb-led imperatives OR consistent "We" subject
- Return the SAME number of bullets as provided

For headline issues: rewrite the title as a clear takeaway, max 3 lines worth of text.

For terminology: apply consistent ACME terms (%ile not Percentile, Target not TGT).

Return bullet_rewrites with shape_id matching the input. Include 1-3 applied_summary strings describing what changed (not the rule name).`;

function cloneSlide(slide: SlideMetadata): SlideMetadata {
  return structuredClone(slide);
}

function listParagraphs(shape: TextMetadata) {
  return shape.paragraphs.filter((p) => p.text.trim());
}

function setParagraphText(
  paragraphs: SlideMetadata["texts"][0]["paragraphs"],
  index: number,
  newText: string,
): void {
  const para = paragraphs[index];
  if (!para) return;
  para.text = newText;
  if (para.runs.length === 0) {
    para.runs = [{ text: newText }];
    return;
  }
  para.runs[0].text = newText;
  for (let i = 1; i < para.runs.length; i++) {
    para.runs[i].text = "";
  }
}

function syncShapeFullText(shape: TextMetadata): void {
  shape.full_text = shape.paragraphs.map((p) => p.text).join("\n");
}

function buildSlideFixContext(finding: Finding, slide: SlideMetadata): string {
  const lines: string[] = [
    `Rule: ${finding.rule_id}`,
    `Issue: ${finding.title}`,
    `Description: ${finding.description}`,
    `Expected: ${finding.expected_value}`,
    `Actual: ${finding.actual_value}`,
    `Recommendation: ${finding.recommendation}`,
    "",
    `Slide ${slide.slide_number} (${slide.slide_type})`,
    `Title: ${slide.title?.full_text ?? "(none)"}`,
  ];

  const shapes =
    finding.shape_id != null
      ? slide.texts.filter((t) => t.shape_id === finding.shape_id)
      : slide.texts.filter(isBodyContentText);

  for (const shape of shapes) {
    const bullets = listParagraphs(shape);
    if (bullets.length === 0) continue;
    lines.push("");
    lines.push(`Text shape ${shape.shape_id} (${shape.shape_name}):`);
    bullets.forEach((p, i) => {
      lines.push(`  Bullet ${i + 1}: ${p.text}`);
    });
  }

  if (finding.rule_id.includes("HEADLINE") || finding.rule_id === "TITLE_004") {
    lines.push("");
    lines.push(`Current title text: ${slide.title?.full_text ?? ""}`);
    if (finding.rule_id === "TITLE_004") {
      lines.push(`Title line count: ${finding.actual_value}`);
      lines.push(
        "Rewrite title_text so the title fits within 3 lines. Return title_text in your JSON response.",
      );
    }
  }

  return lines.join("\n");
}

export async function generateAiFix(
  finding: Finding,
  slide: SlideMetadata,
): Promise<AiFixResponse> {
  const context = buildSlideFixContext(finding, slide);

  const raw = await generateStructuredJson<unknown>({
    system: AI_FIX_SYSTEM_PROMPT,
    user: `Fix this finding:\n\n${context}`,
    schema: AI_FIX_JSON_SCHEMA,
    schemaName: "acme_auto_fix",
    temperature: 0.2,
    timeoutMs: 150_000,
    maxRetries: 1,
    singleModel: true,
  });

  return AiFixResponseSchema.parse(raw);
}

export function applyAiFixResponse(
  slide: SlideMetadata,
  ai: AiFixResponse,
  finding?: Finding,
): AutoFixResult {
  const fixed = cloneSlide(slide);
  const applied = ai.applied_summary.filter(
    (summary) =>
      !summary.startsWith("TITLE_004:") &&
      !summary.startsWith("BULLET_005:") &&
      summary.trim().length > 0,
  );

  if (ai.title_text?.trim() && fixed.title) {
    rewriteTitleText(fixed.title, ai.title_text.trim());
    if (!applied.length) applied.push("Rewrote slide title");
  }

  for (const rewrite of ai.text_rewrites ?? []) {
    const shape =
      fixed.texts.find((t) => t.shape_id === rewrite.shape_id) ??
      (fixed.title?.shape_id === rewrite.shape_id ? fixed.title : null);
    if (!shape) continue;
    setParagraphText(shape.paragraphs, 0, rewrite.new_text);
    syncShapeFullText(shape);
    if (!applied.some((s) => s.toLowerCase().includes("text"))) {
      applied.push("Rewrote slide text");
    }
  }

  for (const rewrite of ai.bullet_rewrites ?? []) {
    const shape = fixed.texts.find((t) => t.shape_id === rewrite.shape_id);
    if (!shape) continue;

    const paras = listParagraphs(shape);
    const count = Math.min(paras.length, rewrite.bullets.length);
    for (let i = 0; i < count; i++) {
      const paraIndex = shape.paragraphs.indexOf(paras[i]);
      if (paraIndex >= 0) {
        setParagraphText(shape.paragraphs, paraIndex, rewrite.bullets[i]);
      }
    }
    syncShapeFullText(shape);
    if (!applied.some((s) => s.includes("parallel") || s.includes("bullet"))) {
      applied.push(`Rewrote ${count} bullet(s) for parallel structure`);
    }
  }

  const changed = slideTextChanged(slide, fixed);
  const titleOk =
    finding?.rule_id !== "TITLE_004" || estimateTitleLines(fixed) <= 3;

  return {
    slide: fixed,
    fixable: changed && titleOk && applied.length > 0,
    applied: changed && titleOk ? applied : [],
  };
}

function applyTitle004Fallback(slide: SlideMetadata): AutoFixResult | null {
  const shortened = shortenTitleToLineLimit(slide, 3);
  if (!shortened || !slide.title) return null;

  const fixed = cloneSlide(slide);
  rewriteTitleText(fixed.title!, shortened);

  if (!slideTextChanged(slide, fixed) || estimateTitleLines(fixed) > 3) {
    return null;
  }

  return {
    slide: fixed,
    fixable: true,
    applied: ["Shortened title to fit within three lines"],
  };
}

export async function resolveAutoFixPreview(
  finding: Finding,
  slide: SlideMetadata,
): Promise<AutoFixResult & { source: "deterministic" | "ai" | "hybrid" }> {
  const deterministic = canAutoFix(finding.rule_id)
    ? applyAutoFix(slide, finding)
    : { slide, fixable: false, applied: [] as string[] };

  const needsAi = needsAiPreview(finding.rule_id);

  if (deterministic.fixable && !needsAi) {
    return { ...deterministic, source: "deterministic" };
  }

  let aiResult: AutoFixResult;
  try {
    const ai = await generateAiFix(finding, slide);
    aiResult = applyAiFixResponse(
      deterministic.fixable ? deterministic.slide : slide,
      ai,
      finding,
    );
  } catch (error) {
    if (finding.rule_id === "TITLE_004") {
      const fallback = applyTitle004Fallback(slide);
      if (fallback?.fixable) {
        return { ...fallback, source: "ai" };
      }
    }
    throw error;
  }

  if (
    finding.rule_id === "TITLE_004" &&
    (!aiResult.fixable || estimateTitleLines(aiResult.slide) > 3)
  ) {
    const fallback = applyTitle004Fallback(slide);
    if (fallback?.fixable) {
      return { ...fallback, source: aiResult.fixable ? "hybrid" : "ai" };
    }
  }

  if (!aiResult.fixable && deterministic.fixable) {
    return { ...deterministic, source: "deterministic" };
  }

  if (deterministic.fixable && aiResult.fixable) {
    return {
      ...aiResult,
      applied: [...deterministic.applied, ...aiResult.applied],
      source: "hybrid",
    };
  }

  return { ...aiResult, source: "ai" };
}
