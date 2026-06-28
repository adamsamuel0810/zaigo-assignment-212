import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { ReactNode } from "react";

type StatusAlertVariant = "error" | "warning" | "info" | "success";

const VARIANT_STYLES: Record<
  StatusAlertVariant,
  { container: string; icon: string; title: string; body: string }
> = {
  error: {
    container: "border-red-200/80 bg-[var(--error-bg)]",
    icon: "text-[var(--error)]",
    title: "text-[var(--error)]",
    body: "text-red-900/85",
  },
  warning: {
    container: "border-amber-200/80 bg-[var(--warning-bg)]",
    icon: "text-[var(--warning)]",
    title: "text-[var(--warning)]",
    body: "text-amber-950/85",
  },
  info: {
    container: "border-[var(--border-strong)] bg-[var(--surface)]",
    icon: "text-[var(--accent)]",
    title: "text-[var(--foreground)]",
    body: "text-[var(--muted)]",
  },
  success: {
    container: "border-green-200/80 bg-[var(--success-bg)]",
    icon: "text-[var(--success)]",
    title: "text-[var(--success)]",
    body: "text-green-950/85",
  },
};

function StatusIcon({ variant }: { variant: StatusAlertVariant }) {
  const className = `mt-0.5 h-4 w-4 shrink-0 ${VARIANT_STYLES[variant].icon}`;
  if (variant === "info") {
    return <Info className={className} aria-hidden />;
  }
  if (variant === "error") {
    return <AlertCircle className={className} aria-hidden />;
  }
  return <AlertTriangle className={className} aria-hidden />;
}

interface StatusAlertProps {
  variant: StatusAlertVariant;
  title: string;
  children: ReactNode;
  className?: string;
}

export function StatusAlert({
  variant,
  title,
  children,
  className = "",
}: StatusAlertProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      role="alert"
      className={`flex gap-3 rounded-xl border px-4 py-3 ${styles.container} ${className}`}
    >
      <StatusIcon variant={variant} />
      <div className="min-w-0 space-y-1">
        <p className={`text-sm font-semibold leading-snug ${styles.title}`}>
          {title}
        </p>
        <p className={`text-sm leading-relaxed ${styles.body}`}>{children}</p>
      </div>
    </div>
  );
}
