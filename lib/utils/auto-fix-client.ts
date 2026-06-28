import { AutoFixResult } from "@/lib/services/auto-fix";
import { Finding, SlideMetadata } from "@/lib/types";
import { humanizeError } from "@/lib/utils/user-facing-errors";
import { friendlyHttpError, readJsonResponse } from "@/lib/utils/api-response";

export type AutoFixPreviewResult = AutoFixResult & {
  source?: "deterministic" | "ai" | "hybrid";
  error?: string;
};

export async function fetchAutoFixPreview(
  finding: Finding,
  slide: SlideMetadata,
  signal?: AbortSignal,
): Promise<AutoFixPreviewResult> {
  let res: Response;
  try {
    res = await fetch("/api/auto-fix", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ finding, slide }),
      signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Auto-fix preview was cancelled.");
    }
    throw new Error(
      e instanceof Error ? e.message : "Network error during auto-fix preview.",
    );
  }

  let data: AutoFixPreviewResult & { error?: string };
  try {
    data = await readJsonResponse<AutoFixPreviewResult & { error?: string }>(
      res,
    );
  } catch (e) {
    if (e instanceof Error) {
      throw e;
    }
    throw new Error(friendlyHttpError(res.status, ""));
  }

  if (!res.ok) {
    const raw = data.error ?? friendlyHttpError(res.status, data.error ?? "");
    throw new Error(humanizeError(raw, "auto-fix").message);
  }

  return data;
}
