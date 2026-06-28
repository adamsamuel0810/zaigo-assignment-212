import { AutoFixResult } from "@/lib/services/auto-fix";
import { Finding, SlideMetadata } from "@/lib/types";

export type AutoFixPreviewResult = AutoFixResult & {
  source?: "deterministic" | "ai" | "hybrid";
  error?: string;
};

export async function fetchAutoFixPreview(
  finding: Finding,
  slide: SlideMetadata,
  signal?: AbortSignal,
): Promise<AutoFixPreviewResult> {
  const res = await fetch("/api/auto-fix", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ finding, slide }),
    signal,
  });

  const data = (await res.json()) as AutoFixPreviewResult & { error?: string };

  if (!res.ok) {
    throw new Error(data.error ?? `Auto-fix preview failed (${res.status})`);
  }

  return data;
}
