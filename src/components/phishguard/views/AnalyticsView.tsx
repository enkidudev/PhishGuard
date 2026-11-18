"use client";

// PhishGuard · Analytics: resilience gauge, trend, department rates, campaign
// funnel + table, and a printable sample awareness report.

import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  EyeOff,
  Gauge,
  Hourglass,
  Lock,
  Printer,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  DepartmentRateChart,
  FunnelBars,
  ResilienceGauge,
  TimeToReportChart,
  TrendChart,
} from "../charts";
import type { FunnelStage } from "../charts";
import { generateReportSummary, apiErrorMessage } from "../api";
import type { AiReportSummary, AiSource, FunnelPoint } from "../api";
import { useAnalyticsReport } from "../hooks";
import {
  EmptyState,
  ErrorState,
  StatusBadge,
  pct,
  vulnerabilityClasses,
  SectionTitle,
} from "../shared";

export default function AnalyticsView() {
  const { data, loading, error, refresh } = useAnalyticsReport();
  const [suppressSmall, setSuppressSmall] = useState(true);

  // AI executive narrative state
  const [summary, setSummary] = useState<AiReportSummary | null>(null);
  const [summarySource, setSummarySource] = useState<AiSource | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  const departments = data?.departments ?? [];
  const visibleDepartments = suppressSmall
    ? departments.filter((d) => d.participants >= 3)
    : departments;
  const hiddenDepartments = suppressSmall
    ? departments.filter((d) => d.participants < 3)
    : [];

  const overall = data?.overall;

  const generateNarrative = async () => {
    if (!data) return;
    setSummarizing(true);
    try {
      const res = await generateReportSummary(data);
      setSummary(res.summary);
      setSummarySource(res.source);
      toast.success("Executive narrative generated");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSummarizing(false);
    }
  };

  const funnelStages = useMemo<FunnelStage[]>(() => {
    const meta: Record<FunnelPoint["stage"], { label: string; color: string }> = {
      delivered: { label: "Delivered", color: "bg-zinc-400" },
      opened: { label: "Opened", color: "bg-emerald-500" },
      clicked: { label: "Clicked", color: "bg-red-500" },
      landed: { label: "Landed", color: "bg-amber-500" },
      submitted: { label: "Submitted", color: "bg-red-700" },
      reported: { label: "Reported", color: "bg-teal-400" },
    };
    if (data?.funnel?.length) {
      return data.funnel
        .filter((f) => meta[f.stage])
        .map((f) => ({
          label: meta[f.stage].label,
          count: f.count,
          color: meta[f.stage].color,
          track: "bg-muted",
        }));
    }
    if (!overall) return [];
    // Fallback while the backend upgrade rolls out: derive later stages.
    return (
      [
        ["delivered", overall.delivered],
        ["opened", overall.opens],
        ["clicked", overall.clicks],
        ["landed", overall.stageCounts?.landed ?? null],
        ["submitted", overall.stageCounts?.submitted ?? null],
        ["reported", overall.reports],
      ] as [FunnelPoint["stage"], number | null][]
    )
      .filter(([, count]) => count !== null)
      .map(([stage, count]) => ({
        label: meta[stage].label,
        count: count as number,
        color: meta[stage].color,
        track: "bg-muted",
      }));
  }, [data, overall]);

  const handlePrint = () => {
    document.body.classList.add("printing-report");
    window.print();
    window.setTimeout(() => document.body.classList.remove("printing-report"), 400);
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Analytics & reporting"
        icon={BarChart3}
        description="Aggregate simulated behavior across campaigns and departments · named participant outcomes are excluded from this report."
      />

      {error && !data ? (
        <ErrorState message={error} onRetry={() => void refresh()} />
      ) : loading && !data ? (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full rounded-xl" />
          <div className="grid gap-4 xl:grid-cols-3">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl xl:col-span-2" />
          </div>
          <Skeleton className="h-[280px] rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : !data ? (
        <EmptyState icon={BarChart3} title="No analytics yet" hint="Launch campaigns to generate metrics." />
      ) : (
        <>
          {/* ============ Section 1: interactive analytics (hidden in report print) ============ */}
          <div className="print-hide-when-printing space-y-4">
            {/* Privacy controls */}
            <Card className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Switch
                  id="suppress-small"
                  checked={suppressSmall}
                  onCheckedChange={setSuppressSmall}
                  aria-label="Suppress small groups"
                />
                <Label htmlFor="suppress-small" className="text-sm">
                  Suppress small groups (&lt;3 participants)
                </Label>
              </div>
              {hiddenDepartments.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2" aria-live="polite">
                  {hiddenDepartments.map((d) => (
                    <Badge
                      key={d.department}
                      variant="outline"
                      className="border-amber-500/40 bg-amber-500/10 text-amber-400"
                    >
                      <EyeOff className="size-3" aria-hidden="true" />
                      {d.department} · hidden for privacy ({d.participants})
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {departments.length} departments in scope
                </span>
              )}
            </Card>

            {/* Gauge + funnel */}
            <div className="grid gap-4 xl:grid-cols-3">
              <Card className="rounded-xl p-4 sm:p-6">
                <div className="mb-2 flex items-center gap-2">
                  <Gauge className="size-4 text-emerald-400" aria-hidden="true" />
                  <h2 className="text-sm font-semibold">Resilience score</h2>
                </div>
                <ResilienceGauge score={overall?.resilienceScore ?? 0} />
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  40% click resilience + 40% reporting + 20% training completion
                </p>
              </Card>
              <Card className="rounded-xl p-4 sm:p-6 xl:col-span-2">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Campaign funnel</h2>
                  <span className="text-xs text-muted-foreground">
                    delivered → opened → clicked → landed → submitted → reported
                  </span>
                </div>
                <FunnelBars stages={funnelStages} />
              </Card>
            </div>

            {/* Time to report + repeat clickers */}
            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="rounded-xl p-4 sm:p-6">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <Hourglass className="size-4 text-teal-400" aria-hidden="true" />
                    Time to report
                  </h2>
                  <span className="text-xs text-muted-foreground">receipt → report</span>
                </div>
                {(data.timeToReport?.length ?? 0) === 0 ? (
                  <EmptyState
                    icon={Hourglass}
                    title="No reporting speed data yet"
                    hint="Buckets appear once participants report simulated phishes."
                    className="border-0 py-8"
                  />
                ) : (
                  <>
                    <TimeToReportChart data={data.timeToReport ?? []} />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Faster reporting blunts real attacks · celebrate teams in the left buckets.
                    </p>
                  </>
                )}
              </Card>

              <Card className="rounded-xl p-4 sm:p-6">
                <div className="mb-1 flex items-center gap-2">
                  <Lock className="size-4 text-amber-400" aria-hidden="true" />
                  <h2 className="text-sm font-semibold">Repeat clickers · coaching queue</h2>
                </div>
                {(data.repeatClickers?.length ?? 0) === 0 ? (
                  <EmptyState
                    icon={CheckCircle2}
                    title="No repeat clickers"
                    hint="Participants who clicked more than once across campaigns would appear here for targeted coaching."
                    className="border-0 py-8"
                  />
                ) : (
                  <div className="max-h-64 overflow-y-auto rounded-lg border">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-card">
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead className="text-right">Clicks</TableHead>
                          <TableHead className="text-right">Submitted</TableHead>
                          <TableHead className="text-right">Reports</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(data.repeatClickers ?? []).map((rc, i) => (
                          <TableRow key={`${rc.name}-${i}`}>
                            <TableCell className="font-medium">{rc.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {rc.department}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-red-400">
                              {rc.clicks}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {rc.submitted}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-emerald-400">
                              {rc.reports}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  {data.repeatClickersNote ??
                    "Multiple clicks across campaigns are a strong coaching signal, not a blame list."}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Privacy: this queue uses aggregate event counts only · no message content, no
                  keystrokes and no credentials are ever captured.
                </p>
              </Card>
            </div>

            {/* AI executive narrative (violet = AI feature) */}
            <Card className="rounded-xl border-violet-500/25 p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="flex size-9 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/15 text-violet-300"
                  >
                    <Sparkles className="size-4" />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold">AI executive narrative</h2>
                    <p className="text-xs text-muted-foreground">
                      Turns the report into a leadership-ready story · risks, wins and next steps.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => void generateNarrative()}
                  disabled={summarizing || !data}
                  className="border border-violet-500/40 bg-violet-500/15 text-violet-300 hover:bg-violet-500/25"
                >
                  <Sparkles className="size-4" aria-hidden="true" />
                  {summarizing ? "Drafting narrative…" : "Generate executive narrative"}
                </Button>
              </div>

              {summarizing ? (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-violet-300">
                    <Sparkles className="size-3.5 animate-pulse" aria-hidden="true" />
                    AI is reading the tables and drafting the story…
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="grid gap-3 pt-2 sm:grid-cols-3">
                    <Skeleton className="h-24 rounded-lg" />
                    <Skeleton className="h-24 rounded-lg" />
                    <Skeleton className="h-24 rounded-lg" />
                  </div>
                </div>
              ) : summary ? (
                <div className="mt-4 space-y-4">
                  {summarySource === "fallback" ? (
                    <div
                      role="status"
                      className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-300"
                    >
                      <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
                      Heuristic mode (AI unavailable) · rules-based narrative below.
                    </div>
                  ) : null}
                  <p className="text-sm font-medium leading-relaxed">
                    {summary.executiveSummary}
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {summary.narrative}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border p-3">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                        <TriangleAlert className="size-3.5" aria-hidden="true" />
                        Key risks
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {summary.keyRisks.map((r, i) => (
                          <li key={i} className="text-xs leading-relaxed text-muted-foreground">
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        Wins
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {summary.wins.map((w, i) => (
                          <li key={i} className="text-xs leading-relaxed text-muted-foreground">
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-teal-400">
                        <ArrowRight className="size-3.5" aria-hidden="true" />
                        Next steps
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {summary.nextSteps.map((s, i) => (
                          <li key={i} className="text-xs leading-relaxed text-muted-foreground">
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    AI-generated · verify numbers against the tables before publishing.
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  Uses the live report JSON already fetched on this page · no data leaves the
                  platform.
                </p>
              )}
            </Card>

            {/* Trend */}
            <Card className="rounded-xl p-4 sm:p-6">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">14-day activity trend</h2>
                <span className="text-xs text-muted-foreground">delivered · opens · clicks · reports</span>
              </div>
              {data.trend.length === 0 ? (
                <EmptyState icon={BarChart3} title="No trend data" />
              ) : (
                <TrendChart data={data.trend} />
              )}
            </Card>

            {/* Department chart */}
            <Card className="rounded-xl p-4 sm:p-6">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Department click vs report rates</h2>
                <span className="text-xs text-muted-foreground">
                  {suppressSmall ? "small groups suppressed" : "all departments shown"}
                </span>
              </div>
              {visibleDepartments.length === 0 ? (
                <EmptyState
                  icon={EyeOff}
                  title="All departments suppressed"
                  hint="Every department has fewer than 3 participants. Turn off suppression to view aggregated data."
                />
              ) : (
                <DepartmentRateChart data={visibleDepartments} />
              )}
            </Card>

            {/* Campaign performance table */}
            <Card className="rounded-xl p-4 sm:p-6">
              <h2 className="mb-3 text-sm font-semibold">Campaign performance</h2>
              {data.campaigns.length === 0 ? (
                <EmptyState icon={BarChart3} title="No campaigns yet" />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Participants</TableHead>
                        <TableHead className="text-right">Opens</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                        <TableHead className="text-right">Reports</TableHead>
                        <TableHead className="text-right">Click rate</TableHead>
                        <TableHead className="text-right">Report rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.campaigns.map((c) => (
                        <TableRow key={c.name}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell>
                            <StatusBadge status={c.status} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{c.participantCount}</TableCell>
                          <TableCell className="text-right tabular-nums">{c.opens}</TableCell>
                          <TableCell className="text-right tabular-nums">{c.clicks}</TableCell>
                          <TableCell className="text-right tabular-nums">{c.reports}</TableCell>
                          <TableCell
                            className={`text-right tabular-nums ${c.clickRate > 30 ? "font-semibold text-red-400" : ""}`}
                          >
                            {pct(c.clickRate)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-teal-300">
                            {pct(c.reportRate)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </div>

          {/* ============ Section 2: printable awareness report ============ */}
          <div className="space-y-3">
            <div className="flex items-center justify-between no-print">
              <p className="text-sm text-muted-foreground">
                Quarterly-style document generated from live simulated data.
              </p>
              <Button onClick={handlePrint}>
                <Printer className="size-4" aria-hidden="true" />
                Print / Save PDF
              </Button>
            </div>

            <Card className="print-report rounded-xl p-6 sm:p-8">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 border-b pb-5">
                <div className="flex items-center gap-3">
                  <img src="/logo.png" alt="PhishGuard logo" className="h-10 w-10 rounded-lg" />
                  <div>
                    <h2 className="text-lg font-bold tracking-tight">
                      Phishing Simulation · Awareness Report
                    </h2>
                    <p className="print-muted text-xs text-muted-foreground">
                      PhishGuard Security Awareness Program · ACME Corp
                    </p>
                  </div>
                </div>
                <p className="print-muted text-xs text-muted-foreground">
                  Generated {format(new Date(data.generatedAt), "MMM d, yyyy · HH:mm")}
                </p>
              </div>

              {/* Executive summary */}
              <section className="mt-5">
                <h3 className="text-sm font-bold uppercase tracking-wide">Executive summary</h3>
                <p className="print-muted mt-2 text-sm leading-relaxed">
                  During this reporting period, {overall?.participants ?? 0} employees were enrolled
                  in authorized phishing simulations, of whom {overall?.consentedParticipants ?? 0}{" "}
                  provided explicit consent before enrollment. A total of{" "}
                  {overall?.delivered ?? 0} simulated phishing emails were delivered;{" "}
                  {overall?.opens ?? 0} were opened ({pct(overall?.openRate)}),{" "}
                  {overall?.clicks ?? 0} simulated links were clicked ({pct(overall?.clickRate)}),
                  and {overall?.reports ?? 0} suspicious emails were correctly reported (
                  {pct(overall?.reportRate)}). The organization&apos;s resilience score stands at{" "}
                  {overall?.resilienceScore ?? 0}/100 with a training completion rate of{" "}
                  {pct(overall?.trainingCompletionRate)} across{" "}
                  {overall?.trainingCompletions ?? 0} module completions.
                </p>
              </section>

              {/* Metric grid */}
              <section className="mt-6">
                <h3 className="text-sm font-bold uppercase tracking-wide">Key metrics</h3>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {[
                    { label: "Delivered", value: String(overall?.delivered ?? 0) },
                    { label: "Opens", value: `${overall?.opens ?? 0} (${pct(overall?.openRate)})` },
                    { label: "Clicks", value: `${overall?.clicks ?? 0} (${pct(overall?.clickRate)})` },
                    { label: "Reports", value: `${overall?.reports ?? 0} (${pct(overall?.reportRate)})` },
                    { label: "Resilience", value: `${overall?.resilienceScore ?? 0}/100` },
                    { label: "Training", value: pct(overall?.trainingCompletionRate) },
                  ].map((m) => (
                    <div key={m.label} className="rounded-lg border p-3">
                      <p className="print-muted text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {m.label}
                      </p>
                      <p className="mt-1 text-base font-semibold tabular-nums">{m.value}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Campaign table */}
              <section className="mt-6">
                <h3 className="text-sm font-bold uppercase tracking-wide">Campaign results</h3>
                <div className="mt-3 overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Participants</TableHead>
                        <TableHead className="text-right">Opens</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                        <TableHead className="text-right">Reports</TableHead>
                        <TableHead className="text-right">Click rate</TableHead>
                        <TableHead className="text-right">Report rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.campaigns.map((c) => (
                        <TableRow key={c.name}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell>
                            <StatusBadge status={c.status} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{c.participantCount}</TableCell>
                          <TableCell className="text-right tabular-nums">{c.opens}</TableCell>
                          <TableCell className="text-right tabular-nums">{c.clicks}</TableCell>
                          <TableCell className="text-right tabular-nums">{c.reports}</TableCell>
                          <TableCell className="text-right tabular-nums">{pct(c.clickRate)}</TableCell>
                          <TableCell className="text-right tabular-nums">{pct(c.reportRate)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>

              {/* Department table */}
              <section className="mt-6">
                <h3 className="text-sm font-bold uppercase tracking-wide">
                  Department breakdown
                </h3>
                <p className="print-muted mt-1 text-xs text-muted-foreground">
                  {suppressSmall
                    ? "Small groups (<3 participants) are suppressed to protect individual privacy."
                    : "All departments shown (suppression disabled for this view)."}
                </p>
                {data.topRiskyDepartment ? (
                  <p className="print-muted mt-1 text-xs text-muted-foreground">
                    Highest exposure: {" "}
                    <span className="font-semibold text-red-400">
                      {data.topRiskyDepartment}
                    </span>
                  </p>
                ) : null}
                <div className="mt-3 overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Department</TableHead>
                        <TableHead className="text-right">Participants</TableHead>
                        <TableHead className="text-right">Delivered</TableHead>
                        <TableHead className="text-right">Click rate</TableHead>
                        <TableHead className="text-right">Report rate</TableHead>
                        <TableHead className="text-right">Vulnerability index</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleDepartments.map((d) => (
                        <TableRow
                          key={d.department}
                          className={
                            data.topRiskyDepartment === d.department
                              ? "bg-red-500/5 [&>td]:font-medium"
                              : undefined
                          }
                        >
                          <TableCell className="font-medium">
                            <span className="flex items-center gap-2">
                              {d.department}
                              {data.topRiskyDepartment === d.department ? (
                                <Badge
                                  variant="outline"
                                  className="border-red-500/40 bg-red-500/15 text-[10px] text-red-400"
                                >
                                  top risk
                                </Badge>
                              ) : null}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{d.participants}</TableCell>
                          <TableCell className="text-right tabular-nums">{d.delivered}</TableCell>
                          <TableCell className="text-right tabular-nums">{pct(d.clickRate)}</TableCell>
                          <TableCell className="text-right tabular-nums">{pct(d.reportRate)}</TableCell>
                          <TableCell className="text-right">
                            {typeof d.vulnerabilityIndex === "number" ? (
                              <Badge
                                variant="outline"
                                className={vulnerabilityClasses(d.vulnerabilityIndex)}
                              >
                                {Math.round(d.vulnerabilityIndex)}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">–</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {visibleDepartments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="print-muted text-center text-xs text-muted-foreground">
                            All departments suppressed for privacy in this configuration.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
                <p className="print-muted mt-2 text-[11px] text-muted-foreground">
                  Vulnerability index (0-100) blends click rate and non-reporting · higher
                  means more coaching attention recommended.
                </p>
              </section>

              {/* Top red flags */}
              <section className="mt-6">
                <h3 className="text-sm font-bold uppercase tracking-wide">
                  Top red flags observed
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {data.topRedFlags.length === 0 ? (
                    <p className="print-muted text-xs text-muted-foreground">No red flag data yet.</p>
                  ) : (
                    data.topRedFlags.map((rf) => (
                      <span
                        key={rf.flag}
                        className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs"
                      >
                        {rf.flag}
                        <span className="rounded-full bg-amber-500/20 px-1.5 text-[10px] font-semibold">
                          {rf.count}
                        </span>
                      </span>
                    ))
                  )}
                </div>
              </section>

              {/* Recommendations */}
              <section className="mt-6">
                <h3 className="text-sm font-bold uppercase tracking-wide">Recommendations</h3>
                <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
                  {data.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ol>
              </section>

              {/* Privacy & data handling */}
              <section className="mt-6 border-t pt-5">
                <h3 className="text-sm font-bold uppercase tracking-wide">
                  Privacy &amp; data handling
                </h3>
                <ul className="mt-2 space-y-1.5 text-sm">
                  <li className="flex items-center gap-2">
                    {data.privacy.credentialCollection ? (
                      <TriangleAlert className="size-4 text-amber-500" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="size-4 text-emerald-500" aria-hidden="true" />
                    )}
                    Simulated pages {data.privacy.credentialCollection ? "may" : "never"} request
                    credentials · no passwords are collected or stored.
                  </li>
                  <li className="flex items-center gap-2">
                    {data.privacy.realEmailDelivery ? (
                      <TriangleAlert className="size-4 text-amber-500" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="size-4 text-emerald-500" aria-hidden="true" />
                    )}
                    No real emails are delivered · all simulation traffic stays inside PhishGuard.
                  </li>
                  <li className="flex items-center gap-2">
                    {data.privacy.individualScoresAnonymous ? (
                      <CheckCircle2 className="size-4 text-emerald-500" aria-hidden="true" />
                    ) : (
                      <TriangleAlert className="size-4 text-amber-500" aria-hidden="true" />
                    )}
                    This report omits named individual outcomes. Small departments are suppressed on the server.
                  </li>
                  <li className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-emerald-500" aria-hidden="true" />
                    Simulated event data is retained for {data.privacy.defaultRetentionDays} days
                    with auto-purge {data.privacy.autoPurge ? "enabled" : "disabled"}.
                  </li>
                </ul>
                <p className="print-muted mt-3 text-[11px] text-muted-foreground">
                  This report was produced by PhishGuard for authorized awareness purposes only.
                  All engagement events are simulated and never leave the platform.
                </p>
              </section>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
