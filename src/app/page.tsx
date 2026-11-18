"use client";

// PhishGuard · app shell: sticky header, desktop sidebar, mobile pill nav,
// view switching and the simulation-only footer.

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ChartColumnBig,
  Crosshair,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  MailWarning,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import AnalyticsView from "@/components/phishguard/views/AnalyticsView";
import AiStudioView from "@/components/phishguard/views/AiStudioView";
import CampaignsView from "@/components/phishguard/views/CampaignsView";
import ComplianceView from "@/components/phishguard/views/ComplianceView";
import LeaderboardView from "@/components/phishguard/views/LeaderboardView";
import OverviewView from "@/components/phishguard/views/OverviewView";
import TemplatesView from "@/components/phishguard/views/TemplatesView";
import TestInboxView from "@/components/phishguard/views/TestInboxView";
import TrainingView from "@/components/phishguard/views/TrainingView";
import { SessionGate, SessionBar, useIdentity } from "@/components/phishguard/SessionGate";
import type { ViewKey } from "@/components/phishguard/view-keys";

const NAV_ITEMS: { key: ViewKey; label: string; icon: LucideIcon }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "campaigns", label: "Campaigns", icon: Crosshair },
  { key: "templates", label: "Templates", icon: MailWarning },
  { key: "ai-studio", label: "AI Studio", icon: Sparkles },
  { key: "inbox", label: "Test Inbox", icon: Inbox },
  { key: "training", label: "Training", icon: GraduationCap },
  { key: "leaderboard", label: "Leaderboard", icon: Trophy },
  { key: "analytics", label: "Analytics", icon: ChartColumnBig },
  { key: "compliance", label: "Compliance", icon: ShieldCheck },
];

export default function Home() { return <SessionGate><Workspace /></SessionGate>; }

function Workspace() {
  const identity = useIdentity();
  const navItems = identity.role === "admin" ? NAV_ITEMS : NAV_ITEMS.filter(i => ["inbox", "training"].includes(i.key));
  const [view, setView] = useState<ViewKey>(identity.role === "admin" ? "overview" : "inbox");

  return (
    <div className="dark flex min-h-screen flex-col bg-background text-foreground">
      {/* ------------------------------- Header ------------------------------- */}
      <header className="no-print sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/logo.png"
              alt="PhishGuard logo"
              width={36}
              height={36}
              className="h-9 w-9 rounded-lg"
              priority
            />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-base font-semibold tracking-tight">PhishGuard</p>
              <p className="hidden text-[11px] text-muted-foreground sm:block">
                Phishing Simulation &amp; Awareness Platform
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-amber-500/50 bg-amber-500/10 text-amber-400"
            >
              <ShieldAlert className="size-3" aria-hidden="true" />
              AUTHORIZED USE ONLY
            </Badge>
            <Badge className="hidden border border-sky-500/40 bg-sky-500/15 text-sky-400 sm:inline-flex">
              DEMO DATA
            </Badge>
          </div>
        </div>
      </header>

      {/* --------------------------- Mobile pill nav --------------------------- */}
      <nav
        aria-label="Primary (mobile)"
        className="no-print border-b border-border/60 lg:hidden"
      >
        <div className="flex gap-1.5 overflow-x-auto px-3 py-2">
          {navItems.map((item) => {
            const active = view === item.key;
            const Icon = item.icon;
            return (
              <Button
                key={item.key}
                variant="ghost"
                size="sm"
                onClick={() => setView(item.key)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 gap-1.5 rounded-full px-3 text-xs",
                  active && "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {item.label}
              </Button>
            );
          })}
        </div>
      </nav>

      {/* --------------------------- Desktop sidebar --------------------------- */}
      <aside
        aria-label="Primary"
        className="no-print fixed bottom-0 left-0 top-16 hidden w-60 flex-col border-r border-border/60 bg-sidebar/60 lg:flex"
      >
        <nav className="flex flex-col gap-1 p-3">
          {navItems.map((item) => {
            const active = view === item.key;
            const Icon = item.icon;
            return (
              <Button
                key={item.key}
                variant="ghost"
                onClick={() => setView(item.key)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "justify-start gap-3 border-l-2 px-3 text-sm",
                  active
                    ? "border-primary bg-accent font-medium text-accent-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon
                  className={cn("size-4", active && "text-sky-400")}
                  aria-hidden="true"
                />
                {item.label}
              </Button>
            );
          })}
        </nav>
        <div className="mt-auto p-4">
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Authorized security awareness exercise. All events are simulated in-platform.
          </p>
        </div>
      </aside>

      {/* ------------------------------ Main area ------------------------------ */}
      <div className="flex flex-1 flex-col lg:ml-60">
        <SessionBar />
        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
            <motion.div
              key={view}
              initial={{ opacity: 0.98, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {view === "overview" ? <OverviewView onNavigate={setView} /> : null}
              {view === "campaigns" ? <CampaignsView /> : null}
              {view === "templates" ? <TemplatesView /> : null}
              {view === "ai-studio" ? <AiStudioView /> : null}
              {view === "inbox" ? <TestInboxView onNavigate={setView} /> : null}
              {view === "training" ? <TrainingView /> : null}
              {view === "leaderboard" ? <LeaderboardView /> : null}
              {view === "analytics" ? <AnalyticsView /> : null}
              {view === "compliance" ? <ComplianceView /> : null}
            </motion.div>
          </div>
        </main>

        {/* ------------------------------ Footer ------------------------------ */}
        <footer className="mt-auto border-t border-border/60 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 no-print sm:px-6">
          <p className="mx-auto max-w-[1400px] text-xs leading-relaxed text-muted-foreground">
            Simulation only · no real credentials are collected · No real emails are sent ·
            Retention runs while the service is running · PhishGuard © 2026
          </p>
        </footer>
      </div>
    </div>
  );
}
