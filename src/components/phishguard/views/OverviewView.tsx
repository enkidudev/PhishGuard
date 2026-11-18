"use client";
import AssurancePanel from "../AssurancePanel";

// PhishGuard · Overview: security awareness command center with a live event
// stream (socket.io), system health strip and full lifecycle KPIs.

import { AnimatePresence, motion } from "framer-motion";
import {
  ExternalLink,
  Eye,
  Gauge,
  KeyRound,
  MailOpen,
  MousePointerClick,
  PlayCircle,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DepartmentRateChart, TrendChart } from "../charts";
import { useHealth, useLiveFeed, useStats, statsEventToLive } from "../hooks";
import type { LiveEvent, LiveFeedStatus } from "../hooks";
import {
  EmptyState,
  ErrorState,
  EVENT_META,
  KpiCard,
  MiniProgress,
  pct,
  resilienceLabel,
  relativeTime,
} from "../shared";
import type { ViewKey } from "../view-keys";

function LiveStatusPill({ status }: { status: LiveFeedStatus }) {
  if (status === "connected") {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
        </span>
        LIVE
      </span>
    );
  }
  if (status === "connecting") {
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-zinc-500/40 bg-zinc-500/10 px-2.5 py-1 text-[11px] font-medium text-zinc-400">
        <span className="size-2 animate-pulse rounded-full bg-zinc-400" aria-hidden="true" />
        CONNECTING
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-zinc-500/40 bg-zinc-500/10 px-2.5 py-1 text-[11px] font-medium text-zinc-400">
      <span className="size-2 rounded-full bg-zinc-500" aria-hidden="true" />
      OFFLINE
    </span>
  );
}

function StatusDot({ ok, label }: { ok: boolean | undefined; label: string }) {
  const unknown = ok === undefined;
  const dotClass = unknown
    ? "bg-zinc-400"
    : ok
      ? "bg-emerald-400"
      : "bg-red-400";
  const stateText = unknown ? "checking" : ok ? "operational" : "degraded";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex cursor-default items-center gap-1.5" aria-label={`${label}: ${stateText}`}>
          <span
            className={cn("size-1.5 rounded-full", dotClass, !unknown && ok && "animate-pulse")}
            aria-hidden="true"
          />
          <span className="text-[11px] text-muted-foreground">{label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {label}: {stateText}
      </TooltipContent>
    </Tooltip>
  );
}

/** One animated live-event row: icon, actor, verb, template, campaign, time. */
function LiveEventRow({ ev }: { ev: LiveEvent }) {
  const meta = EVENT_META[ev.type] ?? EVENT_META.DELIVERED;
  const Icon = meta.icon;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="flex items-start gap-3"
    >
      <span
        aria-hidden="true"
        className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border", meta.bg)}
      >
        <Icon className={cn("size-4", meta.className)} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          <span className="font-medium">{ev.participant}</span>
          {ev.department ? (
            <span className="text-muted-foreground"> · {ev.department}</span>
          ) : null}{" "}
          <span className="text-muted-foreground">{meta.verb}</span>
          {ev.template ? (
            <>
              {" "}
              <span className="font-medium">&ldquo;{ev.template}&rdquo;</span>
            </>
          ) : null}
          {ev.campaign ? <span className="text-muted-foreground"> in {ev.campaign}</span> : null}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{relativeTime(ev.createdAt)}</p>
      </div>
    </motion.li>
  );
}

export default function OverviewView({ onNavigate }: { onNavigate: (v: ViewKey) => void }) {
  const { data, loading, error, refresh } = useStats();
  const { data: health } = useHealth();
  const { events: liveEvents, status: feedStatus } = useLiveFeed();

  const totals = data?.totals;
  const rates = data?.rates;
  const score = data?.resilienceScore ?? 0;
  const scoreMeta = resilienceLabel(score);
  const running = (data?.campaigns ?? []).filter((c) => c.status === "running");

  // Prefer the socket stream; fall back to the stats snapshot when offline.
  const shownEvents: LiveEvent[] =
    liveEvents.length > 0
      ? liveEvents
      : (data?.recentEvents ?? []).map(statsEventToLive);

  if (error && !data) return <ErrorState message={error} onRetry={() => void refresh()} />;

  return (
    <div className="space-y-6">
      <AssurancePanel onNavigate={onNavigate} />
      {/* Greeting strip */}
      <Card className="rounded-xl border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-card to-card p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Security Awareness Command Center
            </h1>
            <div className="mt-1 text-sm text-muted-foreground">
              {loading && !data ? (
                <Skeleton className="h-4 w-72" />
              ) : (
                <>
                  {totals?.runningCampaigns ?? 0} campaign
                  {(totals?.runningCampaigns ?? 0) === 1 ? "" : "s"} running · resilience score{" "}
                  <span className={scoreMeta.className}>{" "}{score}/100</span> ·{" "}
                  {totals?.participants ?? 0} participants (
                  {totals?.consentedParticipants ?? 0} consented)
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <span className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Simulation only · no real emails sent
            </span>
            {/* System status strip */}
            <div className="flex items-center gap-3 rounded-full border border-border/60 bg-card/60 px-3 py-1">
              <StatusDot ok={health?.checks.database} label="Database" />
              <StatusDot ok={health?.checks.liveFeed} label="Live feed" />
              <StatusDot ok={health?.ok} label={health?.checks.ai ? "External AI configured" : "Local coaching"} />
            </div>
          </div>
        </div>
      </Card>

      {/* KPI row */}
      {loading && !data ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <Card key={i} className="space-y-3 rounded-xl p-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-24" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
          <KpiCard
            label="Emails delivered"
            value={String(totals?.delivered ?? 0)}
            icon={Send}
            iconClassName="border-zinc-500/30 bg-zinc-500/15 text-zinc-300"
            caption={`${totals?.campaigns ?? 0} campaigns total`}
          />
          <KpiCard
            label="Open rate"
            value={pct(rates?.openRate)}
            icon={MailOpen}
            iconClassName="border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
            caption={`${totals?.opens ?? 0} opens recorded`}
          />
          <KpiCard
            label="Click rate"
            value={pct(rates?.clickRate)}
            icon={MousePointerClick}
            iconClassName="border-red-500/30 bg-red-500/15 text-red-400"
            valueClassName={
              (rates?.clickRate ?? 0) > 25 ? "text-red-400" : "text-emerald-400"
            }
            caption={`${totals?.clicks ?? 0} clicks recorded`}
          />
          <KpiCard
            label="Landings"
            value={String(totals?.landed ?? 0)}
            icon={ExternalLink}
            iconClassName="border-amber-500/30 bg-amber-500/15 text-amber-400"
            caption="simulated pages opened"
          />
          <KpiCard
            label="Credential entries"
            value={String(totals?.submitted ?? 0)}
            icon={KeyRound}
            iconClassName="border-red-500/30 bg-red-500/15 text-red-400"
            valueClassName={(totals?.submitted ?? 0) > 0 ? "text-red-400" : "text-emerald-400"}
            caption="values never stored"
          />
          <KpiCard
            label="Report rate"
            value={pct(rates?.reportRate)}
            icon={ShieldCheck}
            iconClassName="border-teal-500/30 bg-teal-500/15 text-teal-400"
            valueClassName="text-teal-300"
            caption={`${totals?.reports ?? 0} phishes reported`}
          />
          <KpiCard
            label="Resilience score"
            value={`${score}`}
            icon={Gauge}
            iconClassName="border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
            valueClassName={scoreMeta.className}
            caption={scoreMeta.label}
          >
            <div className="mt-2" aria-hidden="true">
              <MiniProgress value={score} label="0 → 100" />
            </div>
          </KpiCard>
        </div>
      )}

      {/* Charts + right column */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card className="rounded-xl p-4 sm:p-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">14-day activity trend</h2>
              <span className="text-xs text-muted-foreground">delivered · opens · clicks · reports</span>
            </div>
            {loading && !data ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (data?.trend.length ?? 0) === 0 ? (
              <EmptyState icon={Eye} title="No activity yet" hint="Launch a campaign to start collecting simulated engagement events." />
            ) : (
              <TrendChart data={data?.trend ?? []} />
            )}
          </Card>

          <Card className="rounded-xl p-4 sm:p-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Department risk breakdown</h2>
              <span className="text-xs text-muted-foreground">click rate vs report rate</span>
            </div>
            {loading && !data ? (
              <Skeleton className="h-56 w-full" />
            ) : (data?.departments.length ?? 0) === 0 ? (
              <EmptyState icon={Eye} title="No department data" hint="Departments appear once campaigns reach enrolled participants." />
            ) : (
              <DepartmentRateChart data={data?.departments ?? []} />
            )}
          </Card>
        </div>

        <div className="space-y-4">
          {/* Live activity feed */}
          <Card className="rounded-xl p-4 sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Live activity</h2>
              <LiveStatusPill status={feedStatus} />
            </div>
            {shownEvents.length === 0 ? (
              <EmptyState
                icon={PlayCircle}
                title="No events yet"
                hint="Deliveries, opens, clicks, landings, submissions and reports stream in here once a campaign launches."
              />
            ) : (
              <ul
                aria-label="Live simulated events"
                aria-live="polite"
                className="max-h-96 space-y-3 overflow-y-auto pr-1"
              >
                <AnimatePresence initial={false}>
                  {shownEvents.slice(0, 30).map((ev) => (
                    <LiveEventRow key={ev.id} ev={ev} />
                  ))}
                </AnimatePresence>
              </ul>
            )}
            {shownEvents.length > 0 ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                {liveEvents.length > 0
                  ? "Streaming from the live feed · newest first."
                  : "Showing the latest snapshot (feed offline)."}
              </p>
            ) : null}
          </Card>

          {/* Running campaigns */}
          <Card className="rounded-xl p-4 sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Running campaigns</h2>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("campaigns")}>
                View all
              </Button>
            </div>
            {loading && !data ? (
              <div className="space-y-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : running.length === 0 ? (
              <EmptyState
                icon={PlayCircle}
                title="No campaigns running"
                hint="Launch a draft campaign to start a new simulation wave."
              />
            ) : (
              <ul className="space-y-4">
                {running.map((c) => (
                  <li key={c.id} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => onNavigate("campaigns")}
                      >
                        View
                      </Button>
                    </div>
                    <MiniProgress
                      value={
                        c.participantCount > 0
                          ? (c.opens / c.participantCount) * 100
                          : 0
                      }
                      label={`${c.opens}/${c.participantCount} opened · ${c.clicks} clicks · ${c.reports} reports`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Resilience explainer */}
          <Card className="rounded-xl border-dashed p-4 sm:p-6">
            <div className="flex items-center gap-2">
              <Gauge className="size-4 text-emerald-400" aria-hidden="true" />
              <h2 className="text-sm font-semibold">How the Resilience Score works</h2>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              One number for organizational phishing resilience, blended from three signals:
            </p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="font-semibold text-red-400">40%</span> click resilience · employees
                who did <span className="italic">not</span> click simulated links
              </li>
              <li className="flex items-center gap-2">
                <span className="font-semibold text-emerald-400">40%</span> reporting · phishes
                reported through the Report Phish action
              </li>
              <li className="flex items-center gap-2">
                <span className="font-semibold text-teal-400">20%</span> training completion –
                awareness modules finished by enrolled staff
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
