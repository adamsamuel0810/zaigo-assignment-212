import OpenAI from "openai";
import { GoogleGenerativeAI, type Schema } from "@google/generative-ai";
import { aiNotConfiguredMessage, getAiProviderConfig } from "@/lib/ai/config";
import {
  formatGeminiError,
  isGeminiQuotaError,
  parseGeminiRetryDelayMs,
  resolveGeminiModelCandidates,
  sleep,
} from "@/lib/ai/gemini-client";
import { toGeminiResponseSchema } from "@/lib/ai/gemini-schema";

export interface GenerateStructuredJsonOptions {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  schemaName?: string;
  temperature?: number;
  /** Max wall-clock time for Gemini attempts (ms). */
  timeoutMs?: number;
  /** Per-model retry count on 429/503 (default 2). */
  maxRetries?: number;
  /** Use only the configured model — skip fallbacks (faster for auto-fix). */
  singleModel?: boolean;
}

const DEFAULT_GEMINI_MAX_RETRIES = 2;
const DEFAULT_GEMINI_TIMEOUT_MS = 55_000;

function geminiModelsForRequest(
  primary: string,
  singleModel?: boolean,
): string[] {
  if (singleModel) {
    return [primary.trim() || resolveGeminiModelCandidates()[0]];
  }
  return resolveGeminiModelCandidates(primary);
}

async function generateWithGeminiModel(
  apiKey: string,
  modelName: string,
  options: GenerateStructuredJsonOptions,
  deadlineMs: number,
): Promise<string> {
  const remaining = deadlineMs - Date.now();
  if (remaining <= 0) {
    throw new Error("GEMINI_TIMEOUT");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiSchema = toGeminiResponseSchema(options.schema);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: options.system,
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      responseMimeType: "application/json",
      responseSchema: geminiSchema as unknown as Schema,
    },
  });

  const result = await Promise.race([
    model.generateContent(options.user),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("GEMINI_TIMEOUT")), remaining);
    }),
  ]);

  const text = result.response.text()?.trim();
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }
  return text;
}

async function generateWithGemini(
  config: { model: string },
  options: GenerateStructuredJsonOptions,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_GEMINI_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_GEMINI_MAX_RETRIES;
  const deadlineMs = Date.now() + timeoutMs;
  const models = geminiModelsForRequest(config.model, options.singleModel);
  let lastError: unknown;

  for (const modelName of models) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (Date.now() >= deadlineMs) {
        throw new Error(
          "Gemini took too long to respond. Wait a moment and try preview again.",
        );
      }

      try {
        return await generateWithGeminiModel(
          apiKey,
          modelName,
          options,
          deadlineMs,
        );
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);

        if (message === "GEMINI_TIMEOUT") {
          throw new Error(
            "Gemini took too long to respond. Wait a moment and try preview again.",
          );
        }

        if (!isGeminiQuotaError(message)) {
          throw new Error(formatGeminiError(error));
        }

        if (attempt < maxRetries) {
          const waitMs = Math.min(
            parseGeminiRetryDelayMs(message),
            Math.max(0, deadlineMs - Date.now() - 500),
          );
          if (waitMs > 0) {
            await sleep(waitMs);
          }
          continue;
        }

        break;
      }
    }
  }

  throw new Error(formatGeminiError(lastError));
}

async function generateWithOpenAi(
  config: { model: string },
  options: GenerateStructuredJsonOptions,
): Promise<string> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: config.model,
    temperature: options.temperature ?? 0.2,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: options.schemaName ?? "structured_response",
        strict: true,
        schema: options.schema,
      },
    },
    messages: [
      { role: "system", content: options.system },
      { role: "user", content: options.user },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty response");
  }
  return content;
}

export async function generateStructuredJson<T>(
  options: GenerateStructuredJsonOptions,
): Promise<T> {
  const config = getAiProviderConfig();
  if (!config) {
    throw new Error(aiNotConfiguredMessage());
  }

  const content =
    config.provider === "gemini"
      ? await generateWithGemini(config, options)
      : await generateWithOpenAi(config, options);

  return JSON.parse(content) as T;
}
