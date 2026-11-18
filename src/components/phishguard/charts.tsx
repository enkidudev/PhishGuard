"use client";

// PhishGuard · recharts wrappers with a consistent dark "security console" style.

import { format } from "date-fns";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import type { DepartmentStats, TimeToReportBucket, TrendPoint } from "./api";
import { resilienceLabel } from "./shared";

/* Palette: zinc / emerald / red / teal / amber · no blues or indigos. */
export const CHART_COLORS = {
  delivered: "#a1a1aa", // zinc-400
  opens: "#10b981", // emerald-500
  clicks: "#ef4444", // red-500
  reports: "#2dd4bf", // teal-400
  amber: "#fbbf24", // amber-400
  grid: "#27272a", // zinc-800
  tick: "#a1a1aa", // zinc-400
};

const TOOLTIP_STYLE = {
  backgroundColor: "#141614",
  border: "1px solid #27272a",
  borderRadius: 10,
  fontSize: 12,
  color: "#e4e4e7",
} as const;

const LEGEND_FORMATTER = (value: string) => (
  <span className="text-xs text-zinc-400">{value}</span>
);

const shortDay = (d: string) => {
  try {
    return format(new Date(`${d}T00:00:00`), "MMM d");
  } catch {
    return d;
  }
};

/* --------------------------- 14-day trend area --------------------------- */

export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="gradOpens" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.opens} stopOpacity={0.35} />
            <stop offset="95%" stopColor={CHART_COLORS.opens} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradClicks" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.clicks} stopOpacity={0.3} />
            <stop offset="95%" stopColor={CHART_COLORS.clicks} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradReports" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.reports} stopOpacity={0.3} />
            <stop offset="95%" stopColor={CHART_COLORS.reports} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradDelivered" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.delivered} stopOpacity={0.25} />
            <stop offset="95%" stopColor={CHART_COLORS.delivered} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDay}
          tick={{ fill: CHART_COLORS.tick, fontSize: 11 }}
          axisLine={{ stroke: CHART_COLORS.grid }}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          tick={{ fill: CHART_COLORS.tick, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={shortDay} />
        <Legend formatter={LEGEND_FORMATTER} iconType="circle" iconSize={8} />
        <Area
          type="monotone"
          dataKey="delivered"
          name="delivered"
          stroke={CHART_COLORS.delivered}
          fill="url(#gradDelivered)"
          strokeWidth={1.5}
        />
        <Area
          type="monotone"
          dataKey="opens"
          name="opens"
          stroke={CHART_COLORS.opens}
          fill="url(#gradOpens)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="clicks"
          name="clicks"
          stroke={CHART_COLORS.clicks}
          fill="url(#gradClicks)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="reports"
          name="reports"
          stroke={CHART_COLORS.reports}
          fill="url(#gradReports)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ---------------------- department rates (horizontal) --------------------- */

export function DepartmentRateChart({ data }: { data: DepartmentStats[] }) {
  const height = Math.max(160, data.length * 44 + 60);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fill: CHART_COLORS.tick, fontSize: 11 }}
          axisLine={{ stroke: CHART_COLORS.grid }}
          tickLine={false}
          unit="%"
        />
        <YAxis
          type="category"
          dataKey="department"
          width={110}
          tick={{ fill: CHART_COLORS.tick, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value: number | string, name: string) => [
            `${value}%`,
            name === "clickRate" ? "click rate" : "report rate",
          ]}
        />
        <Legend
          formatter={LEGEND_FORMATTER}
          iconType="circle"
          iconSize={8}
        />
        <Bar
          dataKey="clickRate"
          name="clickRate"
          fill={CHART_COLORS.clicks}
          radius={[0, 4, 4, 0]}
          barSize={10}
        />
        <Bar
          dataKey="reportRate"
          name="reportRate"
          fill={CHART_COLORS.opens}
          radius={[0, 4, 4, 0]}
          barSize={10}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ----------------------------- resilience gauge ---------------------------- */

export function ResilienceGauge({ score }: { score: number }) {
  const clamped = Math.min(100, Math.max(0, Math.round(score)));
  const label = resilienceLabel(clamped);
  return (
    <div className="relative mx-auto" aria-label={`Resilience score ${clamped} out of 100`}>
      <RadialBarChart
        width={220}
        height={150}
        cx="50%"
        cy="100%"
        innerRadius="85%"
        outerRadius="100%"
        data={[{ name: "score", value: clamped, fill: CHART_COLORS.opens }]}
        startAngle={180}
        endAngle={0}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
        <RadialBar background={{ fill: "#27272a" }} dataKey="value" cornerRadius={8} />
      </RadialBarChart>
      <div className="pointer-events-none absolute inset-x-0 bottom-1 flex flex-col items-center">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{clamped}</span>
        <span className={cn("text-xs font-medium", label.className)}>{label.label}</span>
      </div>
    </div>
  );
}

/* --------------------------- campaign funnel bars --------------------------- */

export interface FunnelStage {
  label: string;
  count: number;
  color: string;
  track: string;
}

export function FunnelBars({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <div className="space-y-3" role="list" aria-label="Campaign funnel">
      {stages.map((stage, idx) => {
        const prev = idx > 0 ? stages[idx - 1].count : null;
        const conversion =
          prev !== null && prev > 0 ? Math.round((stage.count / prev) * 100) : null;
        return (
          <div key={stage.label} role="listitem" className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground/90">{stage.label}</span>
              <span className="flex items-center gap-2 tabular-nums">
                <span className="text-muted-foreground">
                  {conversion !== null ? `${conversion}% of previous` : "baseline"}
                </span>
                <span className="font-semibold">{stage.count}</span>
              </span>
            </div>
            <div className={cn("h-2.5 w-full overflow-hidden rounded-full", stage.track)}>
              <div
                className={cn("h-full rounded-full transition-all", stage.color)}
                style={{ width: `${Math.max(2, (stage.count / max) * 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------- time-to-report bars --------------------------- */

/** How fast participants reported phishes after receiving them. */
export function TimeToReportChart({ data }: { data: TimeToReportBucket[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis
          dataKey="bucket"
          tick={{ fill: CHART_COLORS.tick, fontSize: 11 }}
          axisLine={{ stroke: CHART_COLORS.grid }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: CHART_COLORS.tick, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Bar
          dataKey="count"
          name="reports"
          fill={CHART_COLORS.reports}
          radius={[4, 4, 0, 0]}
          barSize={38}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------ risk gauge (AI) ------------------------------ */

/** Semicircular 0-100 risk gauge for the Phish Analyzer (high = red). */
export function RiskGauge({ score }: { score: number }) {
  const clamped = Math.min(100, Math.max(0, Math.round(score)));
  const color =
    clamped >= 70 ? CHART_COLORS.clicks : clamped >= 40 ? CHART_COLORS.amber : CHART_COLORS.opens;
  return (
    <div className="relative mx-auto" aria-label={`Risk score ${clamped} out of 100`}>
      <RadialBarChart
        width={220}
        height={150}
        cx="50%"
        cy="100%"
        innerRadius="85%"
        outerRadius="100%"
        data={[{ name: "risk", value: clamped, fill: color }]}
        startAngle={180}
        endAngle={0}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
        <RadialBar background={{ fill: "#27272a" }} dataKey="value" cornerRadius={8} />
      </RadialBarChart>
      <div className="pointer-events-none absolute inset-x-0 bottom-1 flex flex-col items-center">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{clamped}</span>
        <span className="text-xs font-medium text-muted-foreground">risk score</span>
      </div>
    </div>
  );
}
