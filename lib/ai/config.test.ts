import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  getAiProviderConfig,
  isAiConfigured,
} from "@/lib/ai/config";

describe("ai config", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.AI_PROVIDER;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_MODEL;
    delete process.env.OPENAI_MODEL;
  });

  afterEach(() => {
    process.env = env;
  });

  it("returns null when no keys are set", () => {
    expect(isAiConfigured()).toBe(false);
    expect(getAiProviderConfig()).toBeNull();
  });

  it("prefers Gemini when only GEMINI_API_KEY is set", () => {
    process.env.GEMINI_API_KEY = "test-key";
    expect(getAiProviderConfig()).toEqual({
      provider: "gemini",
      model: "gemini-2.5-flash-lite",
    });
  });

  it("uses OpenAI when only OPENAI_API_KEY is set", () => {
    process.env.OPENAI_API_KEY = "test-key";
    expect(getAiProviderConfig()).toEqual({
      provider: "openai",
      model: "gpt-4o-mini",
    });
  });

  it("prefers Gemini when both keys are set and no AI_PROVIDER", () => {
    process.env.GEMINI_API_KEY = "gemini";
    process.env.OPENAI_API_KEY = "openai";
    expect(getAiProviderConfig()?.provider).toBe("gemini");
  });

  it("honors AI_PROVIDER=openai when both keys exist", () => {
    process.env.AI_PROVIDER = "openai";
    process.env.GEMINI_API_KEY = "gemini";
    process.env.OPENAI_API_KEY = "openai";
    expect(getAiProviderConfig()).toEqual({
      provider: "openai",
      model: "gpt-4o-mini",
    });
  });
});
