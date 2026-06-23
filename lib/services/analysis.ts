import { v4 as uuidv4 } from "uuid";
import {
  Finding,
  PresentationAnalysis,
  PresentationMetadata,
  SlideAnalysis,
  SlideType,
} from "@/lib/types";
import { runDeterministicRules } from "@/lib/rules/engine";
import { runAiSemanticChecks } from "@/lib/openai/semantic-checks";
import {
  deduplicateFindings,
  filterByConfidence,
  sortFindings,
} from "@/lib/utils/deduplication";
import { parsePptx } from "@/lib/utils/parse-pptx";

export async function analyzeFromMetadata(
  metadata: PresentationMetadata,
  filename: string,
  options: { includeLowConfidence?: boolean; skipAi?: boolean } = {},
): Promise<PresentationAnalysis> {
  const id = uuidv4();
  const analyzedAt = new Date().toISOString();

  const deterministicFindings = runDeterministicRules(metadata);

  let aiFindings: Finding[] = [];
  if (!options.skipAi) {
    try {
      aiFindings = await runAiSemanticChecks(metadata);
    } catch {
      // Continue without AI findings
    }
  }

  const merged = deduplicateFindings([...deterministicFindings, ...aiFindings]);
  const filtered = filterByConfidence(merged, options.includeLowConfidence ?? false);
  const findings = sortFindings(filtered);

  const slides: SlideAnalysis[] = metadata.slides.map((slide) => {
    const slideFindings = findings.filter((f) => f.slide_number === slide.slide_number);
    return {
      slide_number: slide.slide_number,
      slide_type: slide.slide_type as SlideType,
      findings: slideFindings,
      accepted_count: 0,
      rejected_count: 0,
      pending_count: slideFindings.length,
    };
  });

  return {
    id,
    filename,
    analyzed_at: analyzedAt,
    slide_count: metadata.slide_count,
    slides,
    findings,
    metadata,
    progress: 100,
    status: "complete",
  };
}

export async function analyzePresentation(
  buffer: Buffer,
  filename: string,
  options: { includeLowConfidence?: boolean; skipAi?: boolean } = {},
): Promise<PresentationAnalysis> {
  const analyzedAt = new Date().toISOString();
  const id = uuidv4();

  let metadata: PresentationMetadata;
  try {
    metadata = await parsePptx(buffer, filename);
  } catch (error) {
    return {
      id,
      filename,
      analyzed_at: analyzedAt,
      slide_count: 0,
      slides: [],
      findings: [],
      metadata: {
        filename,
        slide_width_inches: 0,
        slide_height_inches: 0,
        slide_count: 0,
        slides: [],
      },
      progress: 0,
      status: "error",
      error: error instanceof Error ? error.message : "Failed to parse PPTX",
    };
  }

  return analyzeFromMetadata(metadata, filename, options);
}

