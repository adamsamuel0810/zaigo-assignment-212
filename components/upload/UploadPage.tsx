"use client";

import { useCallback, useState } from "react";
import { Upload, Shield, GitPullRequest, Sparkles, FileType2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { AppHeader, FeatureCard } from "@/components/layout/AppHeader";

interface UploadPageProps {
  onUpload: (file: File, options: { skipAi: boolean }) => void;
  error?: string;
}

export function UploadPage({ onUpload, error }: UploadPageProps) {
  const [dragOver, setDragOver] = useState(false);
  const [skipAi, setSkipAi] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (file.name.endsWith(".pptx")) {
        setSelectedFile(file);
      }
    },
    [],
  );

  function handleSubmit() {
    if (selectedFile) {
      onUpload(selectedFile, { skipAi });
    }
  }

  return (
    <div className="app-canvas flex min-h-screen flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 lg:px-6 lg:py-14">
        {/* Hero */}
        <div className="mb-10 text-center lg:mb-14">
          <p className="animate-fade-in mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-[var(--accent)] shadow-[var(--shadow-xs)]">
            <Sparkles className="h-3.5 w-3.5" />
            Zaigo × ACME
          </p>
          <h2 className="animate-fade-in-up text-gradient text-4xl font-bold tracking-tight lg:text-5xl">
            Brand compliance review
          </h2>
          <p className="animate-fade-in-up mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[var(--muted)] [animation-delay:60ms]">
            Upload a client-facing presentation for automated review against ACME brand
            standards. Each finding is precise, explainable, and reviewable — like a pull
            request for slides.
          </p>
        </div>

        {/* Upload card */}
        <div className="animate-fade-in-up mx-auto max-w-2xl [animation-delay:120ms]">
          <div
            className={cn(
              "rounded-2xl border-2 border-dashed bg-white p-10 text-center shadow-[var(--shadow-md)] transition-all duration-300",
              dragOver
                ? "scale-[1.01] border-[var(--accent)] bg-[var(--accent-light)]/40 shadow-[var(--shadow-lg)]"
                : "border-[var(--border-strong)] hover:border-[var(--accent)]/60 hover:shadow-[var(--shadow-lg)]",
              selectedFile && "border-solid border-[var(--accent)]/40",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
          >
            <div className="brand-mark mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl">
              <Upload className="h-7 w-7 text-white" />
            </div>

            {selectedFile ? (
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5">
                  <FileType2 className="h-4 w-4 text-[var(--accent)]" />
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    {selectedFile.name}
                  </span>
                  <span className="text-xs text-[var(--muted)]">
                    ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="mt-2 text-xs text-[var(--muted)] hover:text-[var(--foreground)] hover:underline"
                >
                  Choose a different file
                </button>
              </div>
            ) : (
              <>
                <p className="text-base font-medium text-[var(--foreground)]">
                  Drop your presentation here
                </p>
                <p className="mt-1.5 text-sm text-[var(--muted)]">
                  PowerPoint (.pptx) · Max 50 MB
                </p>
                <label className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--foreground)] shadow-sm transition-colors hover:bg-[var(--surface)]">
                  Browse files
                  <input
                    type="file"
                    accept=".pptx"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                    }}
                  />
                </label>
              </>
            )}

            {selectedFile && (
              <button
                type="button"
                onClick={handleSubmit}
                className="brand-mark mt-4 w-full rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all hover:brightness-110 hover:shadow-[var(--shadow-lg)] active:scale-[0.99]"
              >
                Start compliance review
              </button>
            )}
          </div>

          <label className="mt-5 flex cursor-pointer items-center justify-center gap-2.5">
            <input
              type="checkbox"
              checked={skipAi}
              onChange={(e) => setSkipAi(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border-strong)] text-[var(--accent)] focus:ring-[var(--accent)]"
            />
            <span className="text-sm text-[var(--muted)]">
              Deterministic checks only{" "}
              <span className="text-[var(--muted-light)]">(skip AI semantic review)</span>
            </span>
          </label>

          {error && (
            <div className="mt-5 rounded-lg border border-red-200 bg-[var(--error-bg)] px-4 py-3 text-sm text-[var(--error)]">
              {error}
            </div>
          )}
        </div>

        {/* Features */}
        <div className="animate-fade-in-up mt-16 grid gap-5 sm:grid-cols-3 [animation-delay:200ms]">
          <FeatureCard
            icon={Shield}
            title="Deterministic validation"
            description="Fonts, colors, spacing, tables, and footers checked against exact ACME specifications."
          />
          <FeatureCard
            icon={Sparkles}
            title="Semantic review"
            description="AI evaluates writing quality, headline clarity, and terminology — only when confident."
          />
          <FeatureCard
            icon={GitPullRequest}
            title="Structured triage"
            description="Accept or reject each finding. Low-noise results designed for senior review workflows."
          />
        </div>
      </main>
    </div>
  );
}
