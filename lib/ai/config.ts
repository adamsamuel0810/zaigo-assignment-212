import { DEFAULT_GEMINI_MODEL } from "@/lib/ai/gemini-client";

export type AiProvider = "openai" | "gemini";

export interface AiProviderConfig {
  provider: AiProvider;
  model: string;
}

function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function hasOpenAiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function isAiConfigured(): boolean {
  return hasGeminiKey() || hasOpenAiKey();
}

export function getAiProviderConfig(): AiProviderConfig | null {
  const explicit = process.env.AI_PROVIDER?.trim().toLowerCase();

  if (explicit === "gemini") {
    if (!hasGeminiKey()) return null;
    return {
      provider: "gemini",
      model: process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
    };
  }

  if (explicit === "openai") {
    if (!hasOpenAiKey()) return null;
    return {
      provider: "openai",
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    };
  }

  if (hasGeminiKey()) {
    return {
      provider: "gemini",
      model: process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
    };
  }

  if (hasOpenAiKey()) {
    return {
      provider: "openai",
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    };
  }

  return null;
}

export function aiNotConfiguredMessage(): string {
  return "No AI provider configured. Set GEMINI_API_KEY (free at https://aistudio.google.com/apikey) or OPENAI_API_KEY in .env.local and restart the dev server.";
}
