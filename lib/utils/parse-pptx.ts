import { spawn } from "child_process";
import path from "path";
import { PresentationMetadata } from "@/lib/types";

const ON_VERCEL = Boolean(process.env.VERCEL);

export async function parsePptx(
  buffer: Buffer,
  filename: string,
): Promise<PresentationMetadata> {
  const base64 = buffer.toString("base64");

  const parseUrl =
    process.env.PARSE_API_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}/api/parse`
      : null);

  if (parseUrl) {
    const res = await fetch(parseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_base64: base64,
        filename,
        // LibreOffice/PowerPoint are unavailable on Vercel — skip PNG rendering.
        render_images: !ON_VERCEL,
      }),
    });

    if (res.ok) {
      return (await res.json()) as PresentationMetadata;
    }

    const body = await res.text();
    let detail = body.slice(0, 200);
    try {
      const parsed = JSON.parse(body) as { error?: string };
      if (parsed.error) detail = parsed.error;
    } catch {
      // plain-text / HTML gateway response
    }
    throw new Error(
      `PPTX parse failed (${res.status}): ${detail || res.statusText}`,
    );
  }

  if (ON_VERCEL) {
    throw new Error("PPTX parser is not configured (missing PARSE_API_URL).");
  }

  return parsePptxLocal(buffer, filename);
}

async function parsePptxLocal(
  buffer: Buffer,
  filename: string,
): Promise<PresentationMetadata> {
  const fs = await import("fs/promises");
  const os = await import("os");
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "acme-pptx-"));
  const tmpFile = path.join(tmpDir, filename);
  await fs.writeFile(tmpFile, buffer);

  const cliPath = path.join(process.cwd(), "python", "services", "parse_cli.py");

  return new Promise((resolve, reject) => {
    const proc = spawn("python", [cliPath, tmpFile], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONPATH: process.cwd() },
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    proc.on("close", async (code) => {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      if (code !== 0) {
        reject(new Error(stderr || `Python parser exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as PresentationMetadata);
      } catch (e) {
        reject(new Error(`Failed to parse Python output: ${e}`));
      }
    });
  });
}
