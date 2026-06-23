import { NextResponse } from "next/server";

export const maxDuration = 60;

/**
 * Render PPTX slides to PNG via ConvertAPI (Node.js).
 * Separated from /api/parse so metadata parsing stays fast and rendering
 * gets its own 60s budget on Vercel.
 */
export async function POST(request: Request) {
  const secret =
    process.env.CONVERTAPI_SECRET ?? process.env.CONVERTAPI_TOKEN;
  if (!secret) {
    return NextResponse.json({
      slide_images: [],
      render_backend: "none",
      render_error: "CONVERTAPI_SECRET not configured",
    });
  }

  try {
    const body = (await request.json()) as {
      file_base64?: string;
      filename?: string;
    };

    if (!body.file_base64) {
      return NextResponse.json({ error: "file_base64 is required" }, { status: 400 });
    }

    const res = await fetch("https://v2.convertapi.com/convert/pptx/to/png", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        Parameters: [
          {
            Name: "File",
            FileValue: {
              Name: body.filename ?? "deck.pptx",
              Data: body.file_base64,
            },
          },
          { Name: "StoreFile", Value: true },
          { Name: "ImageResolution", Value: 150 },
        ],
      }),
      signal: AbortSignal.timeout(55_000),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      return NextResponse.json({
        slide_images: [],
        render_backend: "convertapi",
        render_error: `ConvertAPI HTTP ${res.status}: ${detail}`,
      });
    }

    const data = (await res.json()) as {
      Files?: Array<{ Url?: string; FileData?: string }>;
    };

    const slide_images = (data.Files ?? [])
      .map((f) => f.Url ?? f.FileData)
      .filter((v): v is string => Boolean(v));

    return NextResponse.json({
      slide_images,
      render_backend: "convertapi",
      render_error: slide_images.length ? null : "ConvertAPI returned no images",
    });
  } catch (error) {
    return NextResponse.json({
      slide_images: [],
      render_backend: "convertapi",
      render_error: error instanceof Error ? error.message : "Render failed",
    });
  }
}
