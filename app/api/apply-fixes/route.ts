import { spawn } from "child_process";
import path from "path";
import { NextResponse } from "next/server";

export const maxDuration = 60;

interface ApplyFixesPayload {
  file_base64: string;
  filename: string;
  findings: unknown[];
  text_patches?: unknown[];
}

async function applyFixesLocal(payload: ApplyFixesPayload): Promise<Record<string, unknown>> {
  const cliPath = path.join(
    process.cwd(),
    "python",
    "services",
    "apply_fixes_cli.py",
  );

  return new Promise((resolve, reject) => {
    const proc = spawn("python", [cliPath], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONPATH: process.cwd() },
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Python exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as Record<string, unknown>);
      } catch {
        reject(new Error(`Invalid Python output: ${stdout.slice(0, 200)}`));
      }
    });

    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  });
}

async function applyFixesViaVercelPython(
  payload: ApplyFixesPayload,
  request: Request,
): Promise<Record<string, unknown>> {
  const base =
    process.env.APPLY_FIXES_API_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : null);

  if (!base) {
    throw new Error("Apply-fixes Python endpoint is not configured.");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypass) {
    headers["x-vercel-protection-bypass"] = bypass;
  }
  const cookie = request.headers.get("cookie");
  if (cookie) {
    headers.cookie = cookie;
  }

  const res = await fetch(`${base}/api/pptx_apply_fixes`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(55_000),
  });

  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    if (text.includes("<!DOCTYPE") || text.includes("<html")) {
      throw new Error(
        "Apply-fixes Python endpoint returned HTML instead of JSON. On Vercel, set VERCEL_AUTOMATION_BYPASS_SECRET (Project Settings → Deployment Protection → Protection Bypass for Automation) and redeploy.",
      );
    }
    throw new Error(
      `Apply fixes failed (${res.status}): ${text.slice(0, 200) || res.statusText}`,
    );
  }

  if (!res.ok) {
    throw new Error(String(data.error ?? `Apply fixes failed (${res.status})`));
  }

  return data;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ApplyFixesPayload;

    const data = process.env.VERCEL
      ? await applyFixesViaVercelPython(payload, request)
      : await applyFixesLocal(payload);

    if (data.error) {
      return NextResponse.json(
        { error: String(data.error) },
        { status: 400 },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Apply fixes failed",
      },
      { status: 500 },
    );
  }
}
