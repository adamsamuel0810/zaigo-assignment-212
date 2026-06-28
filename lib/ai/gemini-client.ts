/** Default free-tier model (gemini-2.0-flash free quota is often 0). */
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";

/** Tried in order when the primary model hits quota / rate limits. */
export const GEMINI_MODEL_FALLBACKS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
] as const;

export function resolveGeminiModelCandidates(primary?: string): string[] {
  const first = primary?.trim() || DEFAULT_GEMINI_MODEL;
  return [...new Set([first, ...GEMINI_MODEL_FALLBACKS])];
}

export function isGeminiQuotaError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("429") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("resource exhausted")
  );
}

export function parseGeminiRetryDelayMs(message: string): number {
  const retryIn = message.match(/retry in ([\d.]+)s/i);
  if (retryIn) {
    return Math.ceil(Number(retryIn[1]) * 1000);
  }
  const retryDelay = message.match(/"retryDelay"\s*:\s*"(\d+)s"/i);
  if (retryDelay) {
    return Number(retryDelay[1]) * 1000;
  }
  return 2000;
}

export function formatGeminiError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (!isGeminiQuotaError(message)) {
    return message;
  }

  return [
    "Gemini free-tier quota exceeded for this model.",
    "Set GEMINI_MODEL=gemini-2.5-flash-lite in .env.local (gemini-2.0-flash often has zero free quota).",
    "Wait a minute and retry, or check usage at https://aistudio.google.com/",
    "Details:",
    message.split("\n")[0],
  ].join(" ");
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
