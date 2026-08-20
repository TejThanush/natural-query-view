import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { IncidentStatus, Severity } from "@/lib/noc-types";

const severityBadge = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[0.6875rem] uppercase tracking-[0.12em]",
  {
    variants: {
      tone: {
        critical: "border-critical/40 bg-critical-muted text-critical",
        major: "border-warning/40 bg-warning-muted text-warning",
        minor: "border-info/40 bg-info-muted text-info",
        info: "border-border bg-muted text-muted-foreground",
        success: "border-success/40 bg-success-muted text-success",
        primary: "border-primary/40 bg-primary/10 text-primary",
      },
    },
    defaultVariants: { tone: "info" },
  },
);

export type Tone = NonNullable<VariantProps<typeof severityBadge>["tone"]>;

export const severityTone: Record<Severity, Tone> = {
  critical: "critical",
  major: "major",
  minor: "minor",
  info: "info",
};

export const statusTone: Record<IncidentStatus, Tone> = {
  new: "critical",
  triaged: "major",
  healing: "primary",
  resolved: "success",
};

export function Pill({
  tone,
  className,
  children,
  dot,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
  dot?: boolean;
}) {
  return (
    <span className={cn(severityBadge({ tone }), className)}>
      {dot ? <span className="pulse-dot size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
