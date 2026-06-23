import { fileToBase64 } from "@/lib/utils/file-to-base64";

export interface RenderSlidesResult {
  slide_images: string[];
  render_backend?: string;
  render_error?: string | null;
}

/**
 * Request pixel-accurate slide PNGs from /api/render-slides (ConvertAPI on Vercel).
 * Returns an empty list when CONVERTAPI_SECRET is not configured — the UI falls
 * back to the HTML metadata renderer.
 */
export async function renderSlidesInBrowser(
  file: File,
  signal?: AbortSignal,
): Promise<RenderSlidesResult> {
  const file_base64 = await fileToBase64(file);

  const res = await fetch("/api/render-slides", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_base64, filename: file.name }),
    signal,
  });

  if (!res.ok) {
    return { slide_images: [], render_error: `Render failed (${res.status})` };
  }

  return res.json() as Promise<RenderSlidesResult>;
}
