import { NextResponse } from "next/server";

export const maxDuration = 60;

function getSecret(): string | undefined {
  return process.env.CONVERTAPI_SECRET ?? process.env.CONVERTAPI_TOKEN;
}

/**
 * ConvertAPI names slide 1 `deck.png` and slides 2..N `deck-2.png` … `deck-N.png`.
 * Sorting by full FileName puts `deck.png` after `deck-2.png` (`.` > `-`), which
 * rotates every preview by one slide on Vercel.
 */
function slideIndexFromFileName(fileName: string): number {
  const match = fileName.match(/-(\d+)\.[^.]+$/i);
  if (match) return Number.parseInt(match[1], 10);
  return 1;
}

function sortConvertApiSlideFiles<T extends { FileName?: string }>(files: T[]): T[] {
  return [...files].sort(
    (a, b) =>
      slideIndexFromFileName(a.FileName ?? "") -
      slideIndexFromFileName(b.FileName ?? ""),
  );
}

/**
 * Render PPTX slides to PNG via ConvertAPI.
 * Accepts multipart FormData (preferred) or JSON { file_base64, filename }.
 */
export async function POST(request: Request) {
  const secret = getSecret();
  if (!secret) {
    return NextResponse.json({
      slide_images: [],
      render_backend: "none",
      render_error: "CONVERTAPI_SECRET not configured in Vercel env vars",
    });
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let fileBytes: Buffer;
    let filename: string;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "file is required" }, { status: 400 });
      }
      fileBytes = Buffer.from(await file.arrayBuffer());
      filename = file.name || "deck.pptx";
    } else {
      const body = (await request.json()) as {
        file_base64?: string;
        filename?: string;
      };
      if (!body.file_base64) {
        return NextResponse.json({ error: "file_base64 is required" }, { status: 400 });
      }
      fileBytes = Buffer.from(body.file_base64, "base64");
      filename = body.filename ?? "deck.pptx";
    }

    if (fileBytes.length > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds 50MB limit" }, { status: 413 });
    }

    const convertForm = new FormData();
    convertForm.append(
      "File",
      new Blob([new Uint8Array(fileBytes)], {
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      }),
      filename.endsWith(".pptx") ? filename : `${filename}.pptx`,
    );
    convertForm.append("StoreFile", "true");
    convertForm.append("ImageResolution", "150");

    const convertUrl = `https://v2.convertapi.com/convert/pptx/to/png?Secret=${encodeURIComponent(secret)}`;

    const res = await fetch(convertUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
      },
      body: convertForm,
      signal: AbortSignal.timeout(55_000),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 400);
      return NextResponse.json({
        slide_images: [],
        render_backend: "convertapi",
        render_error: `ConvertAPI HTTP ${res.status}: ${detail}`,
      });
    }

    const data = (await res.json()) as {
      Files?: Array<{ FileName?: string; Url?: string; FileData?: string }>;
    };

    const files = sortConvertApiSlideFiles(data.Files ?? []);

    const slide_images = files
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
