import { PresentationMetadata } from "@/lib/types";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Parse a PPTX via the browser so the request carries the user's session
 * cookies (app auth + Vercel Deployment Protection). Server-side fetch from
 * /api/analyze cannot access those cookies and gets 401 HTML.
 */
export async function parsePptxInBrowser(
  file: File,
  signal?: AbortSignal,
): Promise<PresentationMetadata> {
  const file_base64 = await fileToBase64(file);

  const res = await fetch("/api/parse", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file_base64,
      filename: file.name,
      // Ask for rendered PNGs; the parser returns [] if no backend is
      // configured (e.g. no CONVERTAPI_SECRET on Vercel) — falls back to the
      // geometry-only placeholder preview.
      render_images: true,
    }),
    signal,
  });

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    if (res.status === 404) {
      throw new Error("PPTX_PARSE_UNAVAILABLE");
    }
    if (res.status === 401) {
      throw new Error(
        "PPTX parse was blocked (401). Check Vercel Deployment Protection settings.",
      );
    }
    throw new Error(
      `PPTX parse failed (${res.status}): ${text.slice(0, 120) || res.statusText}`,
    );
  }

  const data = (await res.json()) as PresentationMetadata & { error?: string };
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("PPTX_PARSE_UNAVAILABLE");
    }
    throw new Error(data.error ?? `PPTX parse failed (${res.status})`);
  }
  return data;
}
