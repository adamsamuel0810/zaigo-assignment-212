/**
 * Parse fetch responses safely — Vercel timeouts return plain text, not JSON.
 */
export async function readJsonResponse<T>(
  res: Response,
): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json() as Promise<T>;
  }

  const text = (await res.text()).trim();
  throw new Error(friendlyHttpError(res.status, text));
}

export function friendlyHttpError(status: number, body: string): string {
  const lower = body.toLowerCase();

  if (
    status === 504 ||
    lower.includes("function_invocation_timeout") ||
    lower.includes("gateway timeout")
  ) {
    return (
      "AI fix preview timed out (server limit ~3 minutes). Gemini may be slow or retrying. " +
      "Wait a minute and try again, or use Skip AI checks on upload and retry preview later."
    );
  }

  if (body.includes("<!DOCTYPE") || body.includes("<html")) {
    return `Request failed (${status}). The server returned an error page instead of data. Try again in a moment.`;
  }

  if (lower.includes("an error occurred with your deployment")) {
    return friendlyHttpError(504, "FUNCTION_INVOCATION_TIMEOUT");
  }

  if (body.startsWith("{")) {
    try {
      const parsed = JSON.parse(body) as { error?: string };
      if (parsed.error) return parsed.error;
    } catch {
      // fall through
    }
  }

  if (body.length > 0 && body.length < 300) {
    return body;
  }

  return `Request failed (${status}). Please try again.`;
}

export function throwIfNotOk<T extends { error?: string }>(
  res: Response,
  data: T,
  fallback: string,
): void {
  if (!res.ok) {
    throw new Error(data.error ?? friendlyHttpError(res.status, fallback));
  }
}
