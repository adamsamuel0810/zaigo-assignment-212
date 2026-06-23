import { spawn } from "child_process";
import path from "path";
import { PresentationMetadata } from "@/lib/types";

export async function parsePptx(
  buffer: Buffer,
  filename: string,
): Promise<PresentationMetadata> {
  const base64 = buffer.toString("base64");

  // Try Vercel Python serverless function
  const parseUrl =
    process.env.PARSE_API_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}/api/parse`
      : null);

  if (parseUrl) {
    try {
      const res = await fetch(parseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_base64: base64, filename, render_images: true }),
      });
      if (res.ok) {
        return (await res.json()) as PresentationMetadata;
      }
    } catch {
      // fall through to local CLI
    }
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
