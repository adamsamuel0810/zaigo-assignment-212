import { NextResponse } from "next/server";
import {
  analyzeFromMetadata,
  analyzePresentation,
} from "@/lib/services/analysis";
import { PresentationMetadata } from "@/lib/types";

/** Hobby plan caps at 60s; keep within limit to avoid 504 gateway timeouts. */
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        metadata?: PresentationMetadata;
        filename?: string;
        includeLow?: boolean;
        skipAi?: boolean;
      };

      if (!body.metadata || !body.filename) {
        return NextResponse.json(
          { error: "metadata and filename are required" },
          { status: 400 },
        );
      }

      const analysis = await analyzeFromMetadata(body.metadata, body.filename, {
        includeLowConfidence: body.includeLow === true,
        skipAi: body.skipAi === true,
      });

      return NextResponse.json(analysis);
    }

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
