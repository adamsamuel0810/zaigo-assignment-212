"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Invalid email or password. Please try again.");
    }
    setLoading(false);
  }

  return (
    <div className="app-canvas flex min-h-screen">
      {/* Brand panel */}
      <div
        className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 text-white lg:flex"
        style={{ background: "var(--accent-gradient)" }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
            backgroundSize: "26px 26px",
          }}
        />
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl"
          aria-hidden
        />
        <div className="relative">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <span className="text-xl font-bold">A</span>
          </div>
          <h1 className="mt-10 text-4xl font-bold tracking-tight">
            ACME Brand Compliance
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/85">
            Automated presentation review for executive compensation deliverables.
            Precise findings. Senior-ready workflow.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-white/80">
            {[
              "Deterministic brand-guideline checks",
              "Explainable, reviewable findings",
              "One-click final compliance report",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path
                      d="M13 4.5L6.5 11 3 7.5"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/55">
          Powered by Zaigo · Confidential client materials
        </p>
      </div>

      {/* Login form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="animate-fade-in-up w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="brand-mark mb-4 flex h-10 w-10 items-center justify-center rounded-xl">
              <span className="text-sm font-bold text-white">A</span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight">ACME Brand Compliance</h1>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Sign in
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Enter your access credentials to continue.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-[var(--foreground)]"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-strong)] bg-white px-3.5 py-2.5 text-sm shadow-sm transition-colors placeholder:text-[var(--muted-light)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                placeholder="you@acme.com"
                autoComplete="email"
                required
                autoFocus
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-[var(--foreground)]"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-strong)] bg-white px-3.5 py-2.5 text-sm shadow-sm transition-colors placeholder:text-[var(--muted-light)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-200 bg-[var(--error-bg)] px-3.5 py-2.5 text-sm text-[var(--error)]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="brand-mark w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 hover:shadow-[var(--shadow-lg)] active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Continue"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
