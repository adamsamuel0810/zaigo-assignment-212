import { Finding, SlideMetadata } from "@/lib/types";
import { canAutoFix } from "@/lib/services/auto-fix";
import { fileToBase64 } from "@/lib/utils/file-to-base64";
import {
  ApplyTextPatch,
  buildTextPatches,
  mergeTextPatches,
} from "@/lib/utils/text-patches";

export interface ApplyFixesResult {
  applied_count: number;
  skipped_count: number;
}

export interface DownloadFixedPptxOptions {
  /** Original slide metadata before preview fix (required for AI-assisted download). */
  originalSlide?: SlideMetadata;
  /** Fixed slide metadata from preview (required for AI-assisted download). */
  fixedSlide?: SlideMetadata;
  /** Extra text patches (e.g. when downloading multiple AI fixes). */
  textPatches?: ApplyTextPatch[];
}

/**
 * Apply accepted auto-fixes to a PPTX via the Python writer and trigger download.
 * For AI-assisted preview fixes, pass originalSlide + fixedSlide so text patches
 * from the Gemini preview are written into the PPTX.
 */
export async function downloadFixedPptx(
  file: File,
  findings: Finding[],
  options: DownloadFixedPptxOptions = {},
  signal?: AbortSignal,
): Promise<ApplyFixesResult> {
  const deterministic = findings.filter(
    (f) => f.accepted && canAutoFix(f.rule_id),
  );

  const textPatches = [...(options.textPatches ?? [])];
  if (options.originalSlide && options.fixedSlide && findings[0]) {
    textPatches.push(
      ...buildTextPatches(
        findings[0].slide_number,
        options.originalSlide,
        options.fixedSlide,
      ),
    );
  }

  const mergedPatches = mergeTextPatches(textPatches);

  if (deterministic.length === 0 && mergedPatches.length === 0) {
    throw new Error(
      "No accepted fixes to apply. Accept a finding and preview an AI fix first, or accept a deterministic fix.",
    );
  }

  const file_base64 = await fileToBase64(file);

  const res = await fetch("/api/apply-fixes", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file_base64,
      filename: file.name,
      findings: deterministic.map((f) => ({
        rule_id: f.rule_id,
        slide_number: f.slide_number,
        actual_value: f.actual_value,
        expected_value: f.expected_value,
        shape_id: f.shape_id ?? null,
      })),
      text_patches: mergedPatches,
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text();
    let detail = text.slice(0, 200);
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) detail = parsed.error;
    } catch {
      if (text.includes("<!DOCTYPE") || text.includes("<html")) {
        detail =
          "Apply-fixes API returned HTML. On Vercel, set VERCEL_AUTOMATION_BYPASS_SECRET and redeploy.";
      }
    }
    throw new Error(detail || `Apply fixes failed (${res.status})`);
  }

  const data = (await res.json()) as {
    file_base64: string;
    filename: string;
    applied_count?: number;
    skipped_count?: number;
    error?: string;
  };

  if (data.error) {
    throw new Error(data.error);
  }

  const bytes = Uint8Array.from(atob(data.file_base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = data.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  return {
    applied_count:
      data.applied_count ?? deterministic.length + mergedPatches.length,
    skipped_count: data.skipped_count ?? 0,
  };
}
