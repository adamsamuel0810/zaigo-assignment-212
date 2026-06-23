import OpenAI from "openai";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import {
  Confidence,
  Finding,
  FindingSource,
  PresentationMetadata,
  RuleCategory,
  Severity,
  SlideMetadata,
  SlideType,
} from "@/lib/types";

const AiFindingSchema = z.object({
  finding_type: z.enum([
    "NO_FINDING",
    "HEADLINE_QUALITY",
    "PARALLEL_GRAMMAR",
    "TERMINOLOGY",
    "SLIDE_DENSITY",
    "SEMANTIC_CONSISTENCY",
  ]),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  reason: z.string(),
  recommendation: z.string(),
  severity: z.enum(["ERROR", "WARNING", "INFO"]),
  slide_number: z.number().optional(),
});

const AiBatchResponseSchema = z.object({
  findings: z.array(AiFindingSchema),
});

const BATCH_SIZE = 8;

function slideContext(slide: SlideMetadata): string {
  const bullets = slide.texts.flatMap((t) =>
    t.paragraphs.map((p) => `  L${p.level}: ${p.text}`),
  );
  return [
    `Slide ${slide.slide_number} (${slide.slide_type})`,
    `Title: ${slide.title?.full_text ?? "(none)"}`,
    bullets.length ? `Bullets:\n${bullets.join("\n")}` : "",
    slide.tables.length ? `Tables: ${slide.tables.length}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function mapAiFinding(
  raw: z.infer<typeof AiFindingSchema>,
  slideNumber: number,
): Finding | null {
  if (raw.finding_type === "NO_FINDING") return null;
  if (raw.confidence === "LOW") return null;

  const categoryMap: Record<string, RuleCategory> = {
    HEADLINE_QUALITY: RuleCategory.WritingStyle,
    PARALLEL_GRAMMAR: RuleCategory.WritingStyle,
    TERMINOLOGY: RuleCategory.Terminology,
    SLIDE_DENSITY: RuleCategory.WritingStyle,
    SEMANTIC_CONSISTENCY: RuleCategory.WritingStyle,
  };

  const titleMap: Record<string, string> = {
    HEADLINE_QUALITY: "Headline may be topic-only, not a takeaway",
    PARALLEL_GRAMMAR: "Bullets lack parallel grammatical structure",
    TERMINOLOGY: "Terminology inconsistency detected",
    SLIDE_DENSITY: "Slide may be too dense",
    SEMANTIC_CONSISTENCY: "Semantic inconsistency across elements",
  };

  return {
    id: uuidv4(),
    rule_id: `AI_${raw.finding_type}`,
    slide_number: raw.slide_number ?? slideNumber,
    title: titleMap[raw.finding_type] ?? "Writing style issue",
    description: raw.reason,
    category: categoryMap[raw.finding_type] ?? RuleCategory.WritingStyle,
    severity: raw.severity as Severity,
    confidence: raw.confidence as Confidence,
    expected_value: "ACME writing standards",
    actual_value: raw.reason.slice(0, 200),
    recommendation: raw.recommendation,
    accepted: false,
    rejected: false,
    source: FindingSource.Ai,
  };
}

export async function runAiSemanticChecks(
  deck: PresentationMetadata,
): Promise<Finding[]> {
  if (!process.env.OPENAI_API_KEY) {
    return [];
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const contentSlides = deck.slides.filter(
    (s) => s.slide_type === SlideType.Content && (s.title || s.texts.length > 0),
  );

  const allFindings: Finding[] = [];

  for (let i = 0; i < contentSlides.length; i += BATCH_SIZE) {
    const batch = contentSlides.slice(i, i + BATCH_SIZE);
    const context = batch.map(slideContext).join("\n\n---\n\n");

    try {
      const response = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0.1,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "acme_semantic_review",
            strict: true,
            schema: {
              type: "object",
              properties: {
                findings: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      finding_type: {
                        type: "string",
                        enum: [
                          "NO_FINDING",
                          "HEADLINE_QUALITY",
                          "PARALLEL_GRAMMAR",
                          "TERMINOLOGY",
                          "SLIDE_DENSITY",
                          "SEMANTIC_CONSISTENCY",
                        ],
                      },
                      confidence: {
                        type: "string",
                        enum: ["HIGH", "MEDIUM", "LOW"],
                      },
                      reason: { type: "string" },
                      recommendation: { type: "string" },
                      severity: {
                        type: "string",
                        enum: ["ERROR", "WARNING", "INFO"],
                      },
                      slide_number: { type: "number" },
                    },
                    required: [
                      "finding_type",
                      "confidence",
                      "reason",
                      "recommendation",
                      "severity",
                      "slide_number",
                    ],
                    additionalProperties: false,
                  },
                },
              },
              required: ["findings"],
              additionalProperties: false,
            },
          },
        },
        messages: [
          {
            role: "system",
            content: `You are an ACME executive compensation presentation reviewer.
Only flag clear violations of writing style guidelines:
- Headlines must state takeaways, not just topics
- Bullet lists must use parallel grammatical structure
- Terminology must be consistent (e.g. client name, key vs legend)
- Slides should not be overcrowded

CRITICAL: False positives are worse than missing findings.
If uncertain, return finding_type NO_FINDING.
Only return HIGH or MEDIUM confidence when clearly violated.
Never comment on fonts, colors, or sizes — those are handled separately.
Return at most one finding per slide in the batch.`,
          },
          {
            role: "user",
            content: `Review these slides:\n\n${context}`,
          },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) continue;

      const parsed = AiBatchResponseSchema.parse(JSON.parse(content));
      for (const raw of parsed.findings) {
        const slideNum = raw.slide_number ?? batch[0]?.slide_number ?? 1;
        const finding = mapAiFinding(raw, slideNum);
        if (finding) allFindings.push(finding);
      }
    } catch {
      // Continue if AI fails for a batch
    }
  }

  // Deck-level terminology consistency check
  try {
    const clientNames = new Set<string>();
    deck.slides.forEach((s) => {
      s.tables.forEach((t) => {
        t.cells.forEach((c) => {
          const m = c.text.match(/\b(Goofy|Pluto\w*)\b/i);
          if (m) clientNames.add(m[0]);
        });
      });
    });
    if (clientNames.size > 1) {
      allFindings.push({
        id: uuidv4(),
        rule_id: "AI_TERMINOLOGY_DECK",
        slide_number: 1,
        title: "Inconsistent client naming across deck",
        description: `Multiple client name variants found: ${[...clientNames].join(", ")}`,
        category: RuleCategory.Terminology,
        severity: Severity.Warning,
        confidence: Confidence.High,
        expected_value: "Consistent client name throughout",
        actual_value: [...clientNames].join(", "),
        recommendation: "Standardize client name across all slides.",
        accepted: false,
        rejected: false,
        source: FindingSource.Ai,
      });
    }
  } catch {
    // ignore
  }

  return allFindings;
}
