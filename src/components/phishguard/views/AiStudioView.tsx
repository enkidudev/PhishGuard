"use client";

// PhishGuard · AI Studio: violet-accented AI tooling for the simulation team.
// Tab 1 drafts a realistic (fictional) lure from a plain scenario; Tab 2
// analyzes any suspicious email content and returns an explainable risk
// dashboard. Both tabs degrade gracefully to heuristic mode when the AI
// backend is unavailable.

import { trainingCatalog } from "@/lib/training-catalog";
import { useState } from "react";
import {
  CheckCircle2,
  FlaskConical,
  ListChecks,
  MailWarning,
  RefreshCw,
  Save,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  aiSeverityClasses,
  DifficultyBadge,
  EmptyState,
  initials,
  SectionTitle,
  SimulatedEmailBody,
} from "../shared";
import {
  analyzePhishContent,
  apiErrorMessage,
  createTemplate,
  generateAiTemplate,
} from "../api";
import type {
  AiAnalysis,
  AiGeneratedTemplate,
  AiSource,
  AiVerdict,
  Difficulty,
} from "../api";

const DIFFICULTY_HINTS: Record<Difficulty, string> = {
  easy: "Obvious bait · generic greeting, mismatched sender, visible urgency.",
  medium: "Plausible pretext with a couple of subtle tells (display-name spoof, odd link).",
  hard: "Convincing spear-phish · familiar context, near-perfect sender, one hidden tell.",
};

const SAMPLE_PHISH = `URGENT: Your mailbox will be deactivated in 24 hours

Dear employee,

Our system detected unusual activity in your account. You must verify your
credentials immediately or your mailbox will be permanently disabled.

Verify now: http://acme-portal-secure.verify-account.xyz/login

Regards,
IT Support Team
(This link expires in 24 hours)`;

const SAMPLE_LEGIT = `Hi Alex,

Quick heads-up: the Q3 finance review moved to Thursday 14:00 in Room 4B.
Agenda and the draft deck are already on the shared drive under
/Finance/2025/Q3/review · no action needed before the meeting.

Thanks,
Priya (Finance Ops)`;

function verdictMeta(verdict: AiVerdict): { label: string; className: string } {
  if (verdict === "phishing") {
    return { label: "Phishing", className: "border-red-500/40 bg-red-500/15 text-red-400" };
  }
  if (verdict === "suspicious") {
    return { label: "Suspicious", className: "border-amber-500/40 bg-amber-500/15 text-amber-400" };
  }
  return {
    label: "Likely legitimate",
    className: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
  };
}

export default function AiStudioView() {
  return (
    <div className="space-y-6">
      <SectionTitle
        title="AI Studio"
        icon={Sparkles}
        description="Create internal awareness exercises and screen suspicious messages for warning signs."
        actions={
          <Badge className="border border-violet-500/40 bg-violet-500/15 text-violet-400">
            <Sparkles className="size-3" aria-hidden="true" />
            AI feature
          </Badge>
        }
      />

      <Tabs defaultValue="generator">
        <TabsList>
          <TabsTrigger value="generator" className="gap-1.5">
            <FlaskConical className="size-3.5" aria-hidden="true" />
            Template Generator
          </TabsTrigger>
          <TabsTrigger value="analyzer" className="gap-1.5">
            <ShieldAlert className="size-3.5" aria-hidden="true" />
            Phish Analyzer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generator" className="mt-4">
          <TemplateGeneratorTab />
        </TabsContent>

        <TabsContent value="analyzer" className="mt-4">
          <PhishAnalyzerTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* --------------------------- template generator --------------------------- */

function TemplateGeneratorTab() {
  const [scenario, setScenario] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [category, setCategory] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{
    template: AiGeneratedTemplate;
    rationale: string;
    source: AiSource;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const generate = async () => {
    if (!scenario.trim()) {
      toast.error("Describe a scenario first · even one sentence is enough.");
      return;
    }
    setGenerating(true);
    try {
      const res = await generateAiTemplate({
        scenario: scenario.trim(),
        difficulty,
        category: category.trim() || undefined,
      });
      setResult({ template: res.template, rationale: res.rationale, source: res.source });
      toast.success(
        res.source === "ai" ? "Lure drafted by AI" : "Training draft ready"
      );
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  const saveToTemplates = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const t = result.template;
      await createTemplate({
        name: t.name,
        category: t.category,
        difficulty: t.difficulty,
        subject: t.subject,
        senderName: t.senderName,
        senderEmail: t.senderEmail,
        bodyHtml: t.bodyHtml,
        landingMessage: t.landingMessage,
        redFlags: t.redFlags,
        aiGenerated: result.source === "ai",
      });
      toast.success(`Template "${t.name}" saved to the library · open Templates to review it.`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
      {/* Form */}
      <Card className="h-fit rounded-xl p-4 sm:p-6">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ai-scenario">Scenario</Label>
            <div className="flex flex-wrap gap-2">
              {trainingCatalog.map(entry => (
                <Button key={entry.id} size="sm" variant={scenario === entry.name ? "default" : "outline"} onClick={() => setScenario(entry.name)}>
                  {entry.name}
                </Button>
              ))}
            </div>
            <Textarea
              id="ai-scenario"
              rows={4}
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              placeholder="e.g. A summer vacation ticket award"
            />
            <p className="text-[11px] text-muted-foreground">
              Choose a preset or describe one of the supported exercise types. Drafts run locally.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Difficulty</Label>
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
              <SelectTrigger className="w-full" aria-label="Difficulty">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">easy</SelectItem>
                <SelectItem value="medium">medium</SelectItem>
                <SelectItem value="hard">hard</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">{DIFFICULTY_HINTS[difficulty]}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ai-category">Category (optional)</Label>
            <Input
              id="ai-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="IT / Finance / HR"
            />
          </div>

          <Button
            className="w-full border border-violet-500/40 bg-violet-500/15 text-violet-300 hover:bg-violet-500/25"
            onClick={() => void generate()}
            disabled={generating}
          >
            <Sparkles className="size-4" aria-hidden="true" />
            {generating ? "Preparing draft…" : "Generate training draft"}
          </Button>

          <div
            role="note"
            className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-300"
          >
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            All lures are fictional and reviewed before campaigns run. Nothing generated here is
            ever sent to a real mail server.
          </div>
        </div>
      </Card>

      {/* Result */}
      <div>
        {generating ? (
          <Card className="space-y-3 rounded-xl p-4 sm:p-6">
            <div className="flex items-center gap-2 text-xs font-medium text-violet-300">
              <Sparkles className="size-3.5 animate-pulse" aria-hidden="true" />
              Preparing draft…
            </div>
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </Card>
        ) : result ? (
          <Card className="rounded-xl p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-[11px]">
                  {result.template.category}
                </Badge>
                <DifficultyBadge difficulty={result.template.difficulty} />
                <Badge className="border border-violet-500/40 bg-violet-500/15 text-violet-400">
                  <Sparkles className="size-3" aria-hidden="true" />
                  {result.source === "ai" ? "AI draft" : "heuristic draft"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void generate()}
                  disabled={generating}
                >
                  <RefreshCw className="size-3.5" aria-hidden="true" />
                  Regenerate
                </Button>
                <Button
                  size="sm"
                  onClick={() => void saveToTemplates()}
                  disabled={saving}
                  className="border border-violet-500/40 bg-violet-500/15 text-violet-300 hover:bg-violet-500/25"
                >
                  <Save className="size-3.5" aria-hidden="true" />
                  {saving ? "Saving…" : "Save to Templates"}
                </Button>
              </div>
            </div>

            {/* Sender / subject block */}
            <div className="mt-4 flex items-start gap-3 border-b pb-3">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/15 text-sm font-semibold text-violet-300"
              >
                {initials(result.template.senderName)}
              </span>
              <div className="min-w-0">
                <p className="text-sm">
                  <span className="font-semibold">{result.template.senderName}</span>{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    &lt;{result.template.senderEmail}&gt;
                  </span>
                </p>
                <p className="mt-0.5 font-semibold">{result.template.subject}</p>
              </div>
            </div>

            {/* Rendered preview */}
            <div className="mt-4">
              <SimulatedEmailBody
                bodyHtml={result.template.bodyHtml}
                inert
                label="AI-drafted email preview (inert)"
              />
            </div>

            {/* Teaching moment */}
            {result.template.landingMessage ? (
              <div className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 text-sm leading-relaxed">
                {result.template.landingMessage}
              </div>
            ) : null}

            {/* Red flags */}
            {result.template.redFlags.length > 0 ? (
              <div className="mt-4">
                <p className="text-sm font-semibold">Warning signs covered by this exercise</p>
                <ul className="mt-2 space-y-1.5">
                  {result.template.redFlags.map((flag, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden="true" />
                      <span>{flag}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Rationale */}
            <div className="mt-4 rounded-lg border border-violet-500/25 bg-violet-500/5 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-violet-300">
                <Sparkles className="size-3" aria-hidden="true" />
                Why this design
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {result.rationale}
              </p>
            </div>
          </Card>
        ) : (
          <EmptyState
            icon={FlaskConical}
            title="No draft yet"
            hint="Describe a scenario and press Generate training draft. The draft appears here with its red flags and rationale."
          />
        )}
      </div>
    </div>
  );
}

/* ----------------------------- phish analyzer ----------------------------- */

function PhishAnalyzerTab() {
  const [content, setContent] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<{ analysis: AiAnalysis; source: AiSource } | null>(null);

  const analyze = async () => {
    if (!content.trim()) {
      toast.error("Paste the suspicious email content first.");
      return;
    }
    setAnalyzing(true);
    try {
      const res = await analyzePhishContent(content.trim());
      setResult({ analysis: res.analysis, source: res.source });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
      {/* Input */}
      <Card className="h-fit rounded-xl p-4 sm:p-6">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="phish-content">Suspicious email content</Label>
            <Textarea
              id="phish-content"
              rows={10}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste any suspicious email · headers, subject, body text and links all help the analysis."
              className="font-mono text-xs"
              spellCheck={false}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Try a sample:</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setContent(SAMPLE_PHISH)}
            >
              urgent phish
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setContent(SAMPLE_LEGIT)}
            >
              routine email
            </Button>
          </div>

          <Button
            className="w-full border border-violet-500/40 bg-violet-500/15 text-violet-300 hover:bg-violet-500/25"
            onClick={() => void analyze()}
            disabled={analyzing}
          >
            <ShieldAlert className="size-4" aria-hidden="true" />
            {analyzing ? "Analyzing…" : "Analyze"}
          </Button>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            The local scan checks message text without opening links. If external AI is enabled, the pasted text may be sent to the configured provider.
          </p>
        </div>
      </Card>

      {/* Dashboard */}
      <div>
        {analyzing ? (
          <Card className="space-y-3 rounded-xl p-4 sm:p-6">
            <div className="flex items-center gap-2 text-xs font-medium text-violet-300">
              <ShieldAlert className="size-3.5 animate-pulse" aria-hidden="true" />
              Scanning for phishing indicators…
            </div>
            <Skeleton className="mx-auto h-[150px] w-[220px]" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-16 w-full" />
          </Card>
        ) : result ? (
          <Card className="rounded-xl p-4 sm:p-6">
            {result.source === "fallback" ? (
              <div
                role="status"
                className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-300"
              >
                <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
                Heuristic mode (AI unavailable) · rules-based assessment below.
              </div>
            ) : null}

            <div className="grid gap-6 sm:grid-cols-[220px_1fr]">
              <RiskMeter score={result.analysis.riskScore} />
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Verdict
                  </span>
                  <Badge className={verdictMeta(result.analysis.verdict).className}>
                    {verdictMeta(result.analysis.verdict).label}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Confidence</span>
                    <span className="font-medium tabular-nums">
                      {Math.round(result.analysis.confidence)}%
                    </span>
                  </div>
                  <Progress
                    value={Math.min(100, Math.max(0, result.analysis.confidence))}
                    className="h-1.5 [&_[data-slot=progress-indicator]]:bg-violet-400"
                    aria-label={`Analysis confidence ${Math.round(result.analysis.confidence)}%`}
                  />
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {result.analysis.summary}
                </p>
              </div>
            </div>

            {/* Flags */}
            {result.analysis.flags.length > 0 ? (
              <div className="mt-6">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <TriangleAlert className="size-4 text-amber-400" aria-hidden="true" />
                  Detected indicators
                </p>
                <ul className="mt-2 space-y-2">
                  {result.analysis.flags.map((flag, i) => (
                    <li key={i} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">{flag.title}</p>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px]", aiSeverityClasses(flag.severity))}
                        >
                          {flag.severity}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {flag.explanation}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Recommendations */}
            {result.analysis.recommendations.length > 0 ? (
              <div className="mt-6">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <ListChecks className="size-4 text-emerald-400" aria-hidden="true" />
                  Recommended actions
                </p>
                <ul className="mt-2 space-y-1.5">
                  {result.analysis.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden="true" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="mt-6 border-t pt-3 text-[11px] leading-relaxed text-muted-foreground">
              {result.analysis.disclaimer}
            </p>
          </Card>
        ) : (
          <EmptyState
            icon={MailWarning}
            title="Nothing analyzed yet"
            hint="Paste a suspicious email or pick a sample, then press Analyze for an explainable risk assessment."
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------- risk meter ------------------------------- */

function RiskMeter({ score }: { score: number }) {
  const clamped = Math.min(100, Math.max(0, Math.round(score)));
  const tone =
    clamped >= 70
      ? "text-red-400"
      : clamped >= 40
        ? "text-amber-400"
        : "text-emerald-400";
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="150" height="90" viewBox="0 0 150 90" aria-hidden="true">
          {/* track */}
          <path
            d="M 15 85 A 60 60 0 0 1 135 85"
            fill="none"
            stroke="#27272a"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* value arc */}
          <path
            d="M 15 85 A 60 60 0 0 1 135 85"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${(clamped / 100) * 188.5} 188.5`}
            className={cn("transition-all duration-700", tone)}
          />
        </svg>
        <span
          aria-label={`Risk score ${clamped} out of 100`}
          className={cn(
            "absolute inset-x-0 bottom-0 text-center text-2xl font-semibold tabular-nums",
            tone
          )}
        >
          {clamped}
        </span>
      </div>
      <p className="mt-1 text-xs font-medium text-muted-foreground">risk score (0-100)</p>
    </div>
  );
}
