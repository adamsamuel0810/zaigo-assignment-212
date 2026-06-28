import OpenAI from "openai";
import {
  GoogleGenerativeAI,
  type Schema,
} from "@google/generative-ai";
import {
  aiNotConfiguredMessage,
  getAiProviderConfig,
} from "@/lib/ai/config";
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
}

const GEMINI_MAX_RETRIES = 2;

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

async function generateWithGeminiModel(
  apiKey: string,
  modelName: string,
  options: GenerateStructuredJsonOptions,
): Promise<string> {
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

  const result = await model.generateContent(options.user);
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

  const models = resolveGeminiModelCandidates(config.model);
  let lastError: unknown;

  for (const modelName of models) {
    for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
      try {
        return await generateWithGeminiModel(apiKey, modelName, options);
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);

        if (!isGeminiQuotaError(message)) {
          throw new Error(formatGeminiError(error));
        }

        if (attempt < GEMINI_MAX_RETRIES) {
          await sleep(parseGeminiRetryDelayMs(message));
          continue;
        }

        break;
      }
    }
  }

  throw new Error(formatGeminiError(lastError));
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
