import { SlideMetadata } from "@/lib/types";
import {
  ApplyTextPatch,
  buildTextPatches,
  mergeTextPatches,
} from "@/lib/utils/text-patches";

export interface SavedAiFix {
  findingId: string;
  slideNumber: number;
  ruleId: string;
  title: string;
  originalSlide: SlideMetadata;
  fixedSlide: SlideMetadata;
  applied: string[];
  savedAt: number;
}

export function patchesFromSavedFix(saved: SavedAiFix): ApplyTextPatch[] {
  return buildTextPatches(
    saved.slideNumber,
    saved.originalSlide,
    saved.fixedSlide,
  );
}

export function collectSavedTextPatches(
  savedFixes: Iterable<SavedAiFix>,
): ApplyTextPatch[] {
  return mergeTextPatches(
    [...savedFixes].flatMap((saved) => patchesFromSavedFix(saved)),
  );
}

export function isAiAssistedFinding(ruleId: string): boolean {
  return (
    ruleId.startsWith("AI_") ||
    ruleId === "BULLET_005" ||
    ruleId === "TITLE_004" ||
    ruleId === "FOOTER_001" ||
    ruleId === "ANNOT_001"
  );
}
