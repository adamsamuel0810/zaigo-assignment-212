"use client";

import { Loader2, FileSearch, ShieldCheck, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { ProgressBar } from "@/components/findings/ProgressBar";

interface AnalyzingPageProps {
  filename: string;
  onCancel?: () => void;
}

const STEPS = [
  { icon: FileSearch, label: "Extracting slide metadata" },
  { icon: ShieldCheck, label: "Running brand compliance rules" },
  { icon: Sparkles, label: "Performing semantic review" },
];

export function AnalyzingPage({ filename, onCancel }: AnalyzingPageProps) {
  return (
    <div className="app-canvas flex min-h-screen flex-col">
      <AppHeader
        title="Analyzing presentation"
        subtitle={filename}
        onBack={onCancel}
        backLabel="Cancel and go back"
      />

      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="animate-scale-in w-full max-w-lg rounded-2xl border border-[var(--border)] bg-white p-10 shadow-[var(--shadow-xl)]">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 animate-ping rounded-2xl bg-[var(--accent)]/15" />
              <div className="brand-mark relative flex h-16 w-16 items-center justify-center rounded-2xl">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
              Review in progress
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
              Your deck is being evaluated against ACME brand guidelines. This typically
              takes 30–90 seconds depending on slide count.
            </p>
          </div>

          <ProgressBar progress={65} label="Processing…" className="mb-8" />

          <ul className="space-y-3">
            {STEPS.map((step, i) => (
              <li
                key={step.label}
                className="animate-fade-in-up flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <step.icon
                  className={`h-4 w-4 shrink-0 ${
                    i === 0 ? "text-[var(--accent)]" : "text-[var(--muted-light)]"
                  }`}
                />
                <span
                  className={`text-sm ${
                    i === 0
                      ? "font-medium text-[var(--foreground)]"
                      : "text-[var(--muted)]"
                  }`}
                >
                  {step.label}
                </span>
                {i === 0 && (
                  <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-[var(--accent)]" />
                )}
              </li>
            ))}
          </ul>

          <p className="mt-6 text-center text-xs text-[var(--muted-light)]">
            {filename}
          </p>
        </div>
      </main>
    </div>
  );
}
