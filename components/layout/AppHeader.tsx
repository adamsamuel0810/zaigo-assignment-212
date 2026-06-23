import { cn } from "@/lib/utils/cn";
import { LucideIcon } from "lucide-react";
import Link from "next/link";

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
}

export function AppHeader({
  title = "ACME Brand Compliance",
  subtitle = "Executive presentation review",
  backHref,
  backLabel = "Back to upload",
  onBack,
  actions,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-white/80 shadow-[var(--shadow-xs)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-4 px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-4">
          {(backHref || onBack) && (
            <>
              {onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                >
                  <ChevronBack />
                  {backLabel}
                </button>
              ) : (
                <Link
                  href={backHref!}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                >
                  <ChevronBack />
                  {backLabel}
                </Link>
              )}
              <div className="hidden h-6 w-px bg-[var(--border)] sm:block" />
            </>
          )}

          <div className="flex min-w-0 items-center gap-3">
            <div className="brand-mark flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
              <span className="text-sm font-bold tracking-tight text-white">A</span>
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold tracking-tight text-[var(--foreground)]">
                {title}
              </h1>
              {subtitle && (
                <p className="truncate text-xs text-[var(--muted)]">{subtitle}</p>
              )}
            </div>
          </div>
        </div>

        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

function ChevronBack() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M10 12L6 8l4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StatPill({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: string | number;
  variant?: "default" | "warning" | "success" | "error";
}) {
  const styles = {
    default: "bg-[var(--surface)] text-[var(--foreground)] border-[var(--border)]",
    warning: "bg-[var(--warning-bg)] text-[var(--warning)] border-amber-200",
    success: "bg-[var(--success-bg)] text-[var(--success)] border-green-200",
    error: "bg-[var(--error-bg)] text-[var(--error)] border-red-200",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
        styles[variant],
      )}
    >
      <span className="font-medium text-[var(--muted)]">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="elevate group rounded-2xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-sm)]">
      <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-light)] ring-1 ring-inset ring-[var(--accent)]/10 transition-colors group-hover:bg-[var(--accent)]">
        <Icon className="h-5 w-5 text-[var(--accent)] transition-colors group-hover:text-white" />
      </div>
      <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{description}</p>
    </div>
  );
}
