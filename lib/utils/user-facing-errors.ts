export type ErrorContext =
  | "auto-fix"
  | "upload"
  | "download"
  | "preview"
  | "general";

export type UserFacingError = {
  title: string;
  message: string;
  variant: "error" | "warning" | "info";
};

function stripTechnicalNoise(raw: string): string {
  return raw
    .replace(/\[GoogleGenerativeAI Error\]:?\s*/gi, "")
    .replace(/Error fetching from https?:\/\/[^\s]+:?\s*/gi, "")
    .replace(/\[\d{3}\s+[^\]]+\]\s*/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function lastMeaningfulSentence(text: string): string {
  const cleaned = stripTechnicalNoise(text);
  if (!cleaned) return "";

  const parts = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts[parts.length - 1] ?? cleaned;
}

export function humanizeError(
  raw: string,
  context: ErrorContext = "general",
): UserFacingError {
  const lower = raw.toLowerCase();
  const cleaned = stripTechnicalNoise(raw);

  if (
    lower.includes("user location is not supported") ||
    lower.includes("not available in your country")
  ) {
    return {
      title: "AI service unavailable in this region",
      message:
        "Google Gemini cannot be reached from your current location. AI-assisted previews are unavailable. Apply the recommendation manually in PowerPoint, or retry from a supported region.",
      variant: "warning",
    };
  }

  if (
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("429") ||
    lower.includes("resource exhausted") ||
    lower.includes("too many requests")
  ) {
    return {
      title: "AI capacity limit reached",
      message:
        "Gemini free-tier quota is temporarily exhausted. Wait a minute and try again, or switch to a lighter model such as gemini-2.5-flash-lite.",
      variant: "warning",
    };
  }

  if (
    lower.includes("timed out") ||
    lower.includes("too long") ||
    lower.includes("function_invocation_timeout") ||
    lower.includes("gateway timeout") ||
    lower.includes("504")
  ) {
    return {
      title: "Preview timed out",
      message:
        "The AI fix preview took longer than the server allows. Wait a moment and try again, or apply the recommendation manually.",
      variant: "warning",
    };
  }

  if (
    lower.includes("gemini_api_key") ||
    lower.includes("ai is not configured") ||
    lower.includes("not configured")
  ) {
    return {
      title: "AI preview not configured",
      message:
        "Set GEMINI_API_KEY in your environment to enable AI-assisted fix previews. Deterministic fixes remain available where supported.",
      variant: "info",
    };
  }

  if (
    lower.includes("network") ||
    lower.includes("failed to fetch") ||
    lower.includes("fetch failed")
  ) {
    return {
      title: "Connection issue",
      message:
        "We could not reach the server. Check your connection and try again.",
      variant: "error",
    };
  }

  if (lower.includes("unauthorized") || lower.includes("401")) {
    return {
      title: "Session expired",
      message: "Please sign in again to continue.",
      variant: "warning",
    };
  }

  if (lower.includes("cancelled") || lower.includes("canceled")) {
    return {
      title: "Preview cancelled",
      message: "The fix preview was interrupted before it completed.",
      variant: "info",
    };
  }

  if (lower.includes("convertapi")) {
    return {
      title: "Slide preview unavailable",
      message:
        "Pixel-accurate slide previews require CONVERTAPI_SECRET in your deployment environment.",
      variant: "info",
    };
  }

  const contextTitles: Record<ErrorContext, string> = {
    "auto-fix": "Fix preview unavailable",
    upload: "Upload could not be processed",
    download: "Download failed",
    preview: "Preview unavailable",
    general: "Something went wrong",
  };

  const sentence = lastMeaningfulSentence(cleaned || raw);
  const message =
    sentence.length > 0 && sentence.length <= 220
      ? sentence.endsWith(".")
        ? sentence
        : `${sentence}.`
      : "An unexpected error occurred. Please try again in a moment.";

  return {
    title: contextTitles[context],
    message,
    variant: "error",
  };
}
