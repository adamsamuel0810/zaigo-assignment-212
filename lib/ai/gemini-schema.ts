/**
 * Gemini responseSchema accepts a subset of OpenAPI 3.0 and rejects
 * additionalProperties (used by OpenAI strict JSON schema).
 */
export function toGeminiResponseSchema(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const { additionalProperties: _ignored, ...rest } = schema;
  const out: Record<string, unknown> = { ...rest };

  if (Array.isArray(out.properties)) {
    // not expected; guard only
  } else if (out.properties && typeof out.properties === "object") {
    const props: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      out.properties as Record<string, unknown>,
    )) {
      props[key] =
        value && typeof value === "object" && !Array.isArray(value)
          ? toGeminiResponseSchema(value as Record<string, unknown>)
          : value;
    }
    out.properties = props;
  }

  if (out.items && typeof out.items === "object" && !Array.isArray(out.items)) {
    out.items = toGeminiResponseSchema(out.items as Record<string, unknown>);
  }

  return out;
}
