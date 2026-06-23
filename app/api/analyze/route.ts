import { NextResponse } from "next/server";
import { analyzePresentation } from "@/lib/services/analysis";

/** Hobby plan caps at 60s; keep within limit to avoid 504 gateway timeouts. */
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const includeLow = formData.get("includeLow") === "true";
    const skipAi = formData.get("skipAi") === "true";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!file.name.endsWith(".pptx")) {
      return NextResponse.json(
        { error: "Only .pptx files are supported" },
        { status: 400 },
      );
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File exceeds 50MB limit" },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const analysis = await analyzePresentation(buffer, file.name, {
      includeLowConfidence: includeLow,
      skipAi,
    });

    return NextResponse.json(analysis);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Analysis failed",
      },
      { status: 500 },
    );
  }
}
