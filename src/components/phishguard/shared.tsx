"use client";

// PhishGuard · shared presentational building blocks used across views.

import { format, formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  Eye,
  ExternalLink,
  FlagTriangleRight,
  KeyRound,
  MailOpen,
  MousePointerClick,
  RefreshCw,
  Send,
  ShieldCheck,
  TriangleAlert,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { CampaignStatus, Difficulty, EventType, StatsEvent } from "./api";

/* ------------------------------ helpers ------------------------------ */

/** "3 min ago" style relative time, or em-dash when missing. */
export function relativeTime(date?: string | null): string {
  if (!date) return "–";
  try {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "–";
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "–";
  }
}

/** Short absolute timestamp (e.g. "Jun 4, 14:22"). */
export function shortDateTime(date?: string | null): string {
  if (!date) return "–";
  try {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "–";
    return format(d, "MMM d, HH:mm");
  } catch {
    return "–";
  }
}

/** Format a 0-100 rate as a rounded percentage string. */
export function pct(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return `${Math.round(value)}%`;
}

/** Resilience score interpretation label. */
export function resilienceLabel(score: number): { label: string; className: string } {
  if (score < 50) return { label: "High risk", className: "text-red-400" };
  if (score < 70) return { label: "Improving", className: "text-amber-400" };
  return { label: "Strong", className: "text-emerald-400" };
}

/** Initials for avatar circles. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Icon, color and verb metadata for every simulated event type · shared by
 * the Overview live feed, stage dots and any event list. */
export const EVENT_META: Record<
  EventType,
  { icon: LucideIcon; className: string; bg: string; verb: string }
> = {
  DELIVERED: {
    icon: Send,
    className: "text-zinc-400",
    bg: "bg-zinc-500/15 border-zinc-500/30",
    verb: "received",
  },
  OPEN: {
    icon: Eye,
    className: "text-emerald-400",
    bg: "bg-emerald-500/15 border-emerald-500/30",
    verb: "opened",
  },
  CLICK: {
    icon: MousePointerClick,
    className: "text-red-400",
    bg: "bg-red-500/15 border-red-500/30",
    verb: "clicked the link in",
  },
  LANDED: {
    icon: ExternalLink,
    className: "text-amber-400",
    bg: "bg-amber-500/15 border-amber-500/30",
    verb: "landed on the simulated page in",
  },
  SUBMITTED: {
    icon: KeyRound,
    className: "text-red-300",
    bg: "bg-red-500/25 border-red-500/40",
    verb: "confirmed the simulated request in",
  },
  REPORT: {
    icon: ShieldCheck,
    className: "text-emerald-300",
    bg: "bg-emerald-500/20 border-emerald-500/40",
    verb: "reported",
  },
};

/* ------------------------- lifecycle stage dots ------------------------- */

export const STAGE_SEQUENCE = [
  { key: "delivered", label: "delivered", icon: Send, className: "text-zinc-300" },
  { key: "opened", label: "opened", icon: Eye, className: "text-emerald-400" },
  { key: "clicked", label: "clicked", icon: MousePointerClick, className: "text-red-400" },
  { key: "landed", label: "landed", icon: ExternalLink, className: "text-amber-400" },
  { key: "submitted", label: "submitted", icon: KeyRound, className: "text-red-300" },
  { key: "reported", label: "reported", icon: ShieldCheck, className: "text-emerald-300" },
] as const satisfies ReadonlyArray<{
  key: "delivered" | "opened" | "clicked" | "landed" | "submitted" | "reported";
  label: string;
  icon: LucideIcon;
  className: string;
}>;

export interface StageFlags {
  opened: boolean;
  clicked: boolean;
  landed: boolean;
  submitted: boolean;
  reported: boolean;
}

/** Tiny icon sequence showing the phishing lifecycle for one email row. */
export function StageDots({ stage }: { stage: StageFlags }) {
  const reached: Record<(typeof STAGE_SEQUENCE)[number]["key"], boolean> = {
    delivered: true,
    opened: stage.opened,
    clicked: stage.clicked,
    landed: stage.landed,
    submitted: stage.submitted,
    reported: stage.reported,
  };
  return (
    <span
      className="flex items-center gap-0.5"
      role="img"
      aria-label={
        `lifecycle · delivered, ${["opened", "clicked", "landed", "submitted", "reported"]
          .filter((k) => reached[k as keyof StageFlags])
          .join(", ") || "no activity yet"
      }`
    }
  >
    {STAGE_SEQUENCE.map((s, i) => {
      const Icon = s.icon;
      const on = reached[s.key];
      return (
        <span key={s.key} className="flex items-center">
          {i > 0 ? (
            <span
              aria-hidden="true"
              className={cn("h-px w-1", on ? "bg-border" : "bg-border/40")}
            />
          ) : null}
          <Icon
            aria-hidden="true"
            className={cn("size-3", on ? s.className : "text-muted-foreground/30")}
          />
        </span>
      );
    })}
  </span>
  );
}

/* --------------------- simulated email body rendering -------------------- */

/**
 * Renders a simulated email body (template bodyHtml) inside the white
 * "mail client" surface used everywhere previews appear.
 *
 * - Pass `onLinkClick` to intercept anchor clicks (Test Inbox lifecycle).
 * - Pass `inert` (or nothing) for read-only previews · links are disabled.
 */
export function SimulatedEmailBody({
  bodyHtml,
  onLinkClick,
  inert,
  label,
  className,
}: {
  bodyHtml: string;
  onLinkClick?: () => void;
  inert?: boolean;
  label?: string;
  className?: string;
}) {
  const interactive = !!onLinkClick && !inert;
  const document = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'none'; form-action 'none'; base-uri 'none'"><style>body{font:14px/1.6 Arial,sans-serif;color:#172b24;padding:12px;overflow-wrap:anywhere}a{color:#047857;${interactive ? "cursor:pointer;text-decoration:underline" : "pointer-events:none"}}table{max-width:100%}</style></head><body>${bodyHtml}</body></html>`;
  return (
    <div className={cn("space-y-2", className)}>
      <iframe
        title={label ?? "Simulated email body"}
        sandbox={interactive ? "allow-same-origin" : ""}
        referrerPolicy="no-referrer"
        srcDoc={document}
        className="h-72 w-full rounded-lg border bg-white"
        onLoad={event => {
          if (!interactive) return;
          const frame = event.currentTarget.contentDocument;
          if (!frame) return;
          for (const anchor of frame.querySelectorAll("a")) {
            anchor.onclick = click => {
              click.preventDefault();
              if (anchor.getAttribute("href") === "#") onLinkClick?.();
            };
            anchor.onauxclick = click => click.preventDefault();
          }
        }}
      />
    </div>
  );
}

/* --------------------------- severity helpers --------------------------- */

/** Chip classes for a 0-100 vulnerability index (higher = worse). */
export function vulnerabilityClasses(v: number): string {
  if (v >= 70) return "border-red-500/40 bg-red-500/15 text-red-400";
  if (v >= 45) return "border-amber-500/40 bg-amber-500/15 text-amber-400";
  return "border-emerald-500/40 bg-emerald-500/15 text-emerald-400";
}

/** Chip classes for an AI analysis severity. */
export function aiSeverityClasses(severity: "high" | "medium" | "low"): string {
  if (severity === "high") return "border-red-500/40 bg-red-500/15 text-red-400";
  if (severity === "medium") return "border-amber-500/40 bg-amber-500/15 text-amber-400";
  return "border-zinc-500/40 bg-zinc-500/15 text-zinc-300";
}

/* --------------------------- shared components --------------------------- */

export function KpiCard({
  label,
  value,
  icon: Icon,
  iconClassName,
  caption,
  valueClassName,
  children,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  iconClassName?: string;
  caption?: string;
  valueClassName?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p
            className={cn(
              "mt-1.5 text-2xl font-semibold tracking-tight tabular-nums",
              valueClassName
            )}
          >
            {value}
          </p>
          {caption ? (
            <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
          ) : null}
        </div>
        <span
          aria-hidden="true"
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg border",
            iconClassName ?? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
      {children}
    </Card>
  );
}

export function StatusBadge({ status }: { status: CampaignStatus }) {
  if (status === "running") {
    return (
      <Badge className="border border-emerald-500/40 bg-emerald-500/15 text-emerald-400">
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
        </span>
        running
      </Badge>
    );
  }
  if (status === "completed") {
    return (
      <Badge className="border border-teal-500/40 bg-teal-500/15 text-teal-400">
        completed
      </Badge>
    );
  }
  if (status === "cancelled") {
    return (
      <Badge
        variant="outline"
        className="border-red-500/40 bg-red-500/10 text-red-400"
      >
        cancelled
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-zinc-500/40 bg-zinc-500/10 text-zinc-400">
      draft
    </Badge>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  if (difficulty === "easy") {
    return (
      <Badge className="border border-emerald-500/40 bg-emerald-500/15 text-emerald-400">
        easy
      </Badge>
    );
  }
  if (difficulty === "medium") {
    return (
      <Badge className="border border-amber-500/40 bg-amber-500/15 text-amber-400">
        medium
      </Badge>
    );
  }
  return (
    <Badge className="border border-red-500/40 bg-red-500/15 text-red-400">
      hard
    </Badge>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
  className,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 px-6 py-10 text-center",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-10 items-center justify-center rounded-full border border-border bg-muted/50 text-muted-foreground"
      >
        <Icon className="size-5" />
      </span>
      <p className="text-sm font-medium">{title}</p>
      {hint ? <p className="max-w-sm text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function SectionTitle({
  title,
  description,
  icon: Icon,
  actions,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {Icon ? (
          <span
            aria-hidden="true"
            className="mt-0.5 flex size-9 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
          >
            <Icon className="size-4" />
          </span>
        ) : null}
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Destructive alert listing validation violations from the API. */
export function ViolationsAlert({
  message,
  violations,
}: {
  message: string;
  violations?: string[];
}) {
  const list = violations ?? [];
  return (
    <Alert variant="destructive" role="alert">
      <TriangleAlert />
      <AlertTitle>{message || "Request rejected"}</AlertTitle>
      <AlertDescription>
        {list.length > 0 ? (
          <ul className="list-disc pl-4 text-xs">
            {list.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

/** Full-view error state with a retry button. */
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card className="flex flex-col items-start gap-3 rounded-xl p-4">
      <Alert variant="destructive" role="alert">
        <TriangleAlert />
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="size-4" aria-hidden="true" />
        Retry
      </Button>
    </Card>
  );
}

/* ------------------------------ skeletons ------------------------------ */

export function SkeletonCards({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="space-y-3 rounded-xl p-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-16" />
          </div>
        </Card>
      ))}
    </div>
  );
}

/* --------------------- small inline status indicators -------------------- */

export function EventStatusCell({
  done,
  variant = "check",
  timestamp,
}: {
  done: boolean;
  variant?: "check" | "click";
  timestamp?: string | null;
}) {
  if (!done) {
    return (
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <CircleIcon />
        <span className="text-[11px]">–</span>
      </span>
    );
  }
  const isClick = variant === "click";
  return (
    <span className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1.5">
        {isClick ? (
          <XCircle aria-label="clicked" className="size-4 text-red-400" />
        ) : (
          <CheckCircle2 aria-label="yes" className="size-4 text-emerald-400" />
        )}
        <span className="text-[11px] text-muted-foreground">{shortDateTime(timestamp)}</span>
      </span>
    </span>
  );
}

function CircleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

/** Small labelled progress bar used in "running campaigns" cards. */
export function MiniProgress({
  value,
  label,
  indicatorClassName,
}: {
  value: number;
  label: string;
  /** Full static class, e.g. "[&_[data-slot=progress-indicator]]:bg-teal-400". */
  indicatorClassName?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{pct(value)}</span>
      </div>
      <Progress
        value={Math.min(100, Math.max(0, value))}
        className={cn("h-1.5", indicatorClassName)}
      />
    </div>
  );
}
