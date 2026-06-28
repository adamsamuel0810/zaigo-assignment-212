import { NextResponse } from "next/server";
import { aiNotConfiguredMessage, isAiConfigured } from "@/lib/ai/config";
import { Finding, SlideMetadata } from "@/lib/types";
import { canPreviewFix } from "@/lib/services/auto-fix";
import { resolveAutoFixPreview } from "@/lib/openai/auto-fix";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    if (!isAiConfigured()) {
      return NextResponse.json(
        { error: aiNotConfiguredMessage() },
        { status: 503 },
      );
    }

    const body = (await request.json()) as {
      finding?: Finding;
      slide?: SlideMetadata;
    };

    if (!body.finding || !body.slide) {
      return NextResponse.json(
        { error: "finding and slide are required" },
        { status: 400 },
      );
    }

    if (!canPreviewFix(body.finding.rule_id)) {
      return NextResponse.json(
        { error: "Preview is not supported for this rule" },
        { status: 400 },
      );
    }

    const result = await resolveAutoFixPreview(body.finding, body.slide);

    if (!result.fixable) {
      return NextResponse.json(
        {
          error: "Could not generate a fix preview for this finding",
          fixable: false,
          applied: [],
          slide: body.slide,
          source: result.source,
        },
        { status: 422 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Auto-fix failed",
      },
      { status: 500 },
    );
  }
}
