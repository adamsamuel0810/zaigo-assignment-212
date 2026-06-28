import { describe, expect, it } from "vitest";
import { toGeminiResponseSchema } from "@/lib/ai/gemini-schema";

describe("toGeminiResponseSchema", () => {
  it("removes additionalProperties at all nesting levels", () => {
    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string" },
            },
            required: ["id"],
          },
        },
      },
      required: ["items"],
    };

    const gemini = toGeminiResponseSchema(schema);

    expect(gemini).not.toHaveProperty("additionalProperties");
    expect(
      (gemini.properties as Record<string, unknown>).items,
    ).toMatchObject({
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    });
    expect(
      (
        (
          (gemini.properties as Record<string, unknown>).items as Record<
            string,
            unknown
          >
        ).items as Record<string, unknown>
      ).additionalProperties,
    ).toBeUndefined();
  });
});
