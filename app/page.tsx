"use client";

import { useState, useRef } from "react";
import { UploadPage } from "@/components/upload/UploadPage";
import { AnalyzingPage } from "@/components/upload/AnalyzingPage";
import { ReviewWorkspace } from "@/components/review/ReviewWorkspace";
import { PresentationAnalysis } from "@/lib/types";

type AppView = "upload" | "analyzing" | "review";

export default function HomePage() {
  const [view, setView] = useState<AppView>("upload");
  const [analysis, setAnalysis] = useState<PresentationAnalysis | null>(null);
  const [error, setError] = useState<string>();
  const [uploadingFile, setUploadingFile] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);

  async function handleUpload(file: File, options: { skipAi: boolean }) {
    setError(undefined);
    setUploadingFile(file.name);
    setView("analyzing");

    const controller = new AbortController();
    abortRef.current = controller;

    const formData = new FormData();
    formData.append("file", file);
    if (options.skipAi) formData.append("skipAi", "true");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      const contentType = res.headers.get("content-type") ?? "";
      let data: PresentationAnalysis & { error?: string; status?: string };

      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        if (res.status === 504) {
          throw new Error(
            "Analysis timed out. Try enabling “Skip AI checks” or use a smaller deck.",
          );
        }
        throw new Error(text.slice(0, 200) || `Request failed (${res.status})`);
      }

      if (!res.ok) {
        setError(data.error ?? "Analysis failed");
        setView("upload");
        return;
      }

      if (data.status === "error") {
        setError(data.error ?? "Failed to parse presentation");
        setView("upload");
        return;
      }

      setAnalysis(data as PresentationAnalysis);
      setView("review");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        setView("upload");
        return;
      }
      setError(e instanceof Error ? e.message : "Network error");
      setView("upload");
    } finally {
      abortRef.current = null;
    }
  }

  function handleCancelAnalyzing() {
    abortRef.current?.abort();
    setView("upload");
    setUploadingFile("");
  }

  function handleBackToUpload() {
    setAnalysis(null);
    setView("upload");
    setError(undefined);
  }

  if (view === "analyzing") {
    return (
      <AnalyzingPage filename={uploadingFile} onCancel={handleCancelAnalyzing} />
    );
  }

  if (view === "review" && analysis) {
    return (
      <ReviewWorkspace initialAnalysis={analysis} onBack={handleBackToUpload} />
    );
  }

  return <UploadPage onUpload={handleUpload} error={error} />;
}
