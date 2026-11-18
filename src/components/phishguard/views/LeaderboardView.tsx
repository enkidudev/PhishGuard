"use client";

// PhishGuard · Leaderboard: gamified awareness standings. Individual scores
// reward reporting and safe behavior; department standings aggregate the same
// signals. Privacy note from the API is displayed verbatim.

import { motion } from "framer-motion";
import {
  Award,
  Crown,
  Info,
  MousePointerClick,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { useLeaderboard } from "../hooks";
import { EmptyState, ErrorState, initials, relativeTime, SectionTitle } from "../shared";
import type { LeaderboardIndividual } from "../api";

const PODIUM_STYLES = [
  // 1st · gold
  {
    wrap: "border-amber-500/40 bg-gradient-to-b from-amber-500/15 via-card to-card",
    icon: "border-amber-500/40 bg-amber-500/15 text-amber-400",
    rank: "text-amber-400",
    chip: "border-amber-500/40 bg-amber-500/15 text-amber-400",
  },
  // 2nd · silver
  {
    wrap: "border-zinc-400/40 bg-gradient-to-b from-zinc-400/15 via-card to-card",
    icon: "border-zinc-400/40 bg-zinc-400/15 text-zinc-300",
    rank: "text-zinc-300",
    chip: "border-zinc-400/40 bg-zinc-400/15 text-zinc-300",
  },
  // 3rd · bronze
  {
    wrap: "border-amber-700/40 bg-gradient-to-b from-amber-700/15 via-card to-card",
    icon: "border-amber-700/40 bg-amber-700/15 text-amber-500",
    rank: "text-amber-500",
    chip: "border-amber-700/40 bg-amber-700/15 text-amber-500",
  },
];

function scoreChipClass(score: number): string {
  if (score >= 80) return "border-emerald-500/40 bg-emerald-500/15 text-emerald-400";
  if (score >= 50) return "border-amber-500/40 bg-amber-500/15 text-amber-400";
  return "border-red-500/40 bg-red-500/15 text-red-400";
}

export default function LeaderboardView() {
  const { data, loading, error, refresh } = useLeaderboard();

  const individuals = data?.leaderboard.individuals ?? [];
  const departments = [...(data?.leaderboard.departments ?? [])].sort(
    (a, b) => b.avgScore - a.avgScore
  );
  const podium = individuals.slice(0, 3);
  const rest = individuals.slice(3);
  const maxAvg = Math.max(1, ...departments.map((d) => d.avgScore));

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Awareness leaderboard"
        icon={Trophy}
        description="Reporting phishes and completing training earns points · clickers and submitters lose them. The queue rewards the behaviors that stop real attacks."
        actions={
          data?.leaderboard.meta?.generatedAt ? (
            <span className="text-xs text-muted-foreground">
              updated {relativeTime(data.leaderboard.meta.generatedAt)}
            </span>
          ) : null
        }
      />

      {error && !data ? (
        <ErrorState message={error} onRetry={() => void refresh()} />
      ) : loading && !data ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-44 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : individuals.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No scores yet"
          hint="Scores appear once participants report phishes, complete training or get caught by simulations in the Test Inbox."
        />
      ) : (
        <>
          {/* ------------------------------ Podium ------------------------------ */}
          <div className="grid items-end gap-4 sm:grid-cols-3">
            {[1, 0, 2].map((podiumIndex, order) => {
              const person = podium[podiumIndex];
              if (!person) return <div key={order} aria-hidden="true" />;
              const style = PODIUM_STYLES[podiumIndex];
              const Icon = podiumIndex === 0 ? Crown : Trophy;
              return (
                <motion.div
                  key={person.participantId}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: order * 0.12, ease: "easeOut" }}
                >
                  <Card
                    className={cn(
                      "rounded-xl p-4 text-center sm:p-5",
                      style.wrap,
                      podiumIndex === 0 ? "sm:pb-7" : "sm:pb-5"
                    )}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <Icon className={cn("size-4", style.rank)} aria-hidden="true" />
                      <span className={cn("text-xs font-bold uppercase tracking-wide", style.rank)}>
                        {podiumIndex === 0 ? "1st" : podiumIndex === 1 ? "2nd" : "3rd"}
                      </span>
                    </div>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mx-auto mt-3 flex size-12 items-center justify-center rounded-full border text-base font-semibold",
                        style.icon
                      )}
                    >
                      {initials(person.name)}
                    </span>
                    <p className="mt-2 truncate text-sm font-semibold">{person.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{person.department}</p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums">{person.score}</p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      points
                    </p>
                    {person.badges.length > 0 ? (
                      <div className="mt-2 flex flex-wrap items-center justify-center gap-1">
                        {person.badges.slice(0, 3).map((b) => (
                          <Badge
                            key={b}
                            variant="outline"
                            className={cn("text-[9px]", style.chip)}
                          >
                            {b}
                          </Badge>
                        ))}
                        {person.badges.length > 3 ? (
                          <span className="text-[9px] text-muted-foreground">
                            +{person.badges.length - 3}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* --------------------------- Individuals --------------------------- */}
          <Card className="rounded-xl p-4 sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Award className="size-4 text-emerald-400" aria-hidden="true" />
                Individual standings
              </h2>
              <span className="text-xs text-muted-foreground">
                {individuals.length} participant{individuals.length === 1 ? "" : "s"} scored
              </span>
            </div>
            <div className="max-h-96 overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Delivered</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                    <TableHead className="text-right">Reports</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead>Badges</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {individuals.map((person, idx) => (
                    <IndividualRow key={person.participantId} person={person} rank={idx + 1} />
                  ))}
                  {rest.length === 0 && individuals.length <= 3 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-xs text-muted-foreground">
                        Everyone is on the podium · keep reporting to grow the standings.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* ------------------------ Department league ------------------------ */}
          <Card className="rounded-xl p-4 sm:p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4 text-emerald-400" aria-hidden="true" />
              Department league
            </h2>
            {departments.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No department standings yet"
                hint="Department averages appear once campaigns reach enrolled teams."
                className="mt-3 border-0 py-6"
              />
            ) : (
              <ol className="mt-3 space-y-3">
                {departments.map((dept, idx) => {
                  const barColor =
                    idx === 0
                      ? "bg-emerald-500"
                      : idx === 1
                        ? "bg-teal-400"
                        : idx === 2
                          ? "bg-amber-400"
                          : "bg-zinc-500";
                  return (
                    <li key={dept.department} className="space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-2 font-medium">
                          <span
                            className={cn(
                              "inline-flex size-5 items-center justify-center rounded-full border text-[10px] font-bold",
                              idx === 0
                                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                                : idx === 1
                                  ? "border-teal-500/40 bg-teal-500/15 text-teal-400"
                                  : idx === 2
                                    ? "border-amber-500/40 bg-amber-500/15 text-amber-400"
                                    : "border-zinc-500/40 bg-zinc-500/15 text-zinc-400"
                            )}
                          >
                            {idx + 1}
                          </span>
                          {dept.department}
                          <span className="font-normal text-muted-foreground">
                            ({dept.participants} participant{dept.participants === 1 ? "" : "s"})
                          </span>
                        </span>
                        <span className="flex items-center gap-3 tabular-nums text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <ShieldCheck className="size-3 text-emerald-400" aria-hidden="true" />
                            {dept.reports} reports
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MousePointerClick className="size-3 text-red-400" aria-hidden="true" />
                            {dept.clicks} clicks
                          </span>
                          <span className="font-semibold text-foreground">
                            avg {Math.round(dept.avgScore)}
                          </span>
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full transition-all", barColor)}
                          style={{
                            width: `${Math.max(2, (dept.avgScore / maxAvg) * 100)}%`,
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

          {/* --------------------------- How scoring --------------------------- */}
          <Card className="rounded-xl p-4 sm:p-6">
            <Accordion type="single" collapsible>
              <AccordionItem value="scoring" className="border-0">
                <AccordionTrigger className="text-sm font-semibold">
                  How scoring works
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Points
                    </p>
                    <ul className="mt-2 space-y-1.5 text-sm">
                      <li className="flex items-center gap-2">
                        <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/15 text-emerald-400">
                          +15
                        </Badge>
                        Reported a phish in the Test Inbox
                      </li>
                      <li className="flex items-center gap-2">
                        <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/15 text-emerald-400">
                          +8
                        </Badge>
                        Reported without submitting
                      </li>
                      <li className="flex items-center gap-2">
                        <Badge variant="outline" className="border-red-500/40 bg-red-500/15 text-red-400">
                          0
                        </Badge>
                        Clicked a simulated link
                      </li>
                      <li className="flex items-center gap-2">
                        <Badge variant="outline" className="border-red-500/40 bg-red-500/15 text-red-400">
                          −20
                        </Badge>
                        Confirmed a simulated request
                      </li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Badges
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Badges are awarded automatically as you report and train · for example a
                      first correct report, consistently reporting quickly, clean runs with no
                      clicks, and training milestones. They appear next to your name on the
                      podium and in the standings table.
                    </p>
                  </div>
                  {data?.leaderboard.meta?.scoringModel ? (
                    <p className="font-mono text-[11px] text-muted-foreground">
                      scoring model: {data.leaderboard.meta.scoringModel}
                    </p>
                  ) : null}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>

          {/* --------------------------- Privacy note --------------------------- */}
          {data?.privacyNote ? (
            <div
              role="note"
              className="flex items-start gap-2 rounded-xl border border-dashed border-border/70 p-4"
            >
              <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="text-xs leading-relaxed text-muted-foreground">{data.privacyNote}</p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/* ---------------------------- individual row ---------------------------- */

function IndividualRow({ person, rank }: { person: LeaderboardIndividual; rank: number }) {
  const podium = rank <= 3;
  return (
    <TableRow>
      <TableCell className="font-semibold tabular-nums">{rank}</TableCell>
      <TableCell>
        <span className="flex items-center gap-2">
          {podium ? (
            <Crown
              className={cn(
                "size-3.5",
                rank === 1 ? "text-amber-400" : rank === 2 ? "text-zinc-300" : "text-amber-500"
              )}
              aria-hidden="true"
            />
          ) : null}
          <span className="font-medium">{person.name}</span>
        </span>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{person.department}</TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">
        {person.delivered}
      </TableCell>
      <TableCell
        className={cn(
          "text-right tabular-nums",
          person.clicks > 0 ? "text-red-400" : "text-muted-foreground"
        )}
      >
        {person.clicks}
      </TableCell>
      <TableCell className="text-right tabular-nums text-emerald-400">
        {person.reports}
      </TableCell>
      <TableCell className="text-right">
        <Badge variant="outline" className={cn("tabular-nums", scoreChipClass(person.score))}>
          {person.score}
        </Badge>
      </TableCell>
      <TableCell>
        <span className="flex max-w-56 flex-wrap gap-1">
          {person.badges.length === 0 ? (
            <span className="text-xs text-muted-foreground">–</span>
          ) : (
            person.badges.map((b) => (
              <Badge key={b} variant="outline" className="text-[9px] text-muted-foreground">
                {b}
              </Badge>
            ))
          )}
        </span>
      </TableCell>
    </TableRow>
  );
}
