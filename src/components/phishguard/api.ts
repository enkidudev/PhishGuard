// PhishGuard — typed API client layer.
// Every network call goes through `api<T>()` which parses JSON, throws a
// structured ApiError (with server `error` + `violations`) on non-OK responses.

export type CampaignStatus = "draft" | "running" | "completed" | "cancelled";
export type Difficulty = "easy" | "medium" | "hard";
export type TrackEventType = "OPEN" | "CLICK" | "LANDED" | "SUBMITTED" | "REPORT";

/* ----------------------------- /api/stats ----------------------------- */

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  delivered: number;
  opens: number;
  clicks: number;
  reports: number;
}

export interface DepartmentStats {
  department: string;
  participants: number;
  delivered: number;
  opens: number;
  clicks: number;
  reports: number;
  clickRate: number; // 0-100
  reportRate: number; // 0-100
}

export type EventType = "DELIVERED" | "OPEN" | "CLICK" | "LANDED" | "SUBMITTED" | "REPORT";

export interface StatsEvent {
  id: string;
  type: EventType;
  participant: string;
  campaign: string;
  template: string;
  createdAt: string;
}

/** One row of the campaign lifecycle funnel (delivered → reported). */
export type FunnelStageName =
  | "delivered"
  | "opened"
  | "clicked"
  | "landed"
  | "submitted"
  | "reported";

export interface FunnelPoint {
  stage: FunnelStageName;
  count: number;
}

export interface TimeToReportBucket {
  bucket: string; // "< 1h" | "1–6h" | "6–24h" | "1–3 days" | "> 3 days"
  count: number;
}

export interface RepeatClicker {
  name: string;
  department: string;
  clicks: number;
  submitted: number;
  reports: number;
}

export interface StatsCampaignSummary {
  id: string;
  name: string;
  status: CampaignStatus;
  participantCount: number;
  opens: number;
  clicks: number;
  reports: number;
  launchedAt: string | null;
}

export interface Stats {
  totals: {
    participants: number;
    consentedParticipants: number;
    campaigns: number;
    runningCampaigns: number;
    delivered: number;
    opens: number;
    clicks: number;
    landed: number;
    submitted: number;
    reports: number;
  };
  rates: {
    openRate: number; // 0-100
    clickRate: number; // 0-100
    reportRate: number; // 0-100
  };
  trainingCompletionRate: number; // 0-100
  resilienceScore: number; // 0-100
  funnel?: FunnelPoint[];
  trend: TrendPoint[];
  departments: DepartmentStats[];
  recentEvents: StatsEvent[];
  campaigns: StatsCampaignSummary[];
}

/* ---------------------------- /api/campaigns --------------------------- */

export interface CampaignTemplateRef {
  id: string;
  name: string;
  category: string;
  difficulty: Difficulty;
  senderName: string;
  senderEmail: string;
}

export interface CampaignListItem {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  retentionDays: number;
  createdAt: string;
  launchedAt: string | null;
  completedAt: string | null;
  template: CampaignTemplateRef;
  participantCount: number;
  delivered: number;
  opens: number;
  clicks: number;
  reports: number;
}

export interface CampaignParticipantRow {
  enrollmentId: string;
  participantId: string;
  name: string;
  email: string;
  department: string;
  consented: boolean;
  active: boolean;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  reportedAt: string | null;
}

export interface CampaignDetail extends CampaignListItem {
  participants: CampaignParticipantRow[];
}

export interface CreateCampaignPayload {
  name: string;
  description?: string;
  templateId: string;
  participantIds: string[];
  retentionDays?: number;
}

/* ---------------------------- /api/templates --------------------------- */

export interface PhishTemplate {
  id: string;
  name: string;
  category: string;
  difficulty: Difficulty;
  subject: string;
  senderName: string;
  senderEmail: string;
  bodyHtml: string;
  landingMessage: string;
  redFlags: string[];
  isBuiltIn: boolean;
  /** Produced by the AI Template Studio rather than authored by hand. */
  aiGenerated: boolean;
  createdAt: string;
  usageCount: number;
}

export interface TemplatePayload {
  name: string;
  category: string;
  difficulty: Difficulty;
  subject: string;
  senderName: string;
  senderEmail: string;
  bodyHtml: string;
  landingMessage: string;
  redFlags: string[];
  /** Mark the template as AI-generated when saving an AI Studio draft. */
  aiGenerated?: boolean;
}

/* -------------------------- /api/participants -------------------------- */

export interface ParticipantStats {
  campaigns: number;
  delivered: number;
  opens: number;
  clicks: number;
  reports: number;
}

export interface Participant {
  id: string;
  name: string;
  email: string;
  department: string;
  consented: boolean;
  consentedAt: string | null;
  active: boolean;
  createdAt: string;
  stats: ParticipantStats;
}

/* ------------------------------ /api/inbox ----------------------------- */

export interface InboxTemplateInfo {
  id?: string;
  subject: string;
  senderName: string;
  senderEmail: string;
  bodyHtml: string;
  category: string;
  difficulty: Difficulty;
  redFlags: string[];
  aiGenerated?: boolean;
  /** Optional teaching-moment copy; may be enriched by the backend. */
  landingMessage?: string;
}

export interface InboxItem {
  enrollmentId: string;
  /** Template used by the campaign (when the backend surfaces it). */
  templateId?: string;
  campaignId: string;
  campaignName: string;
  deliveredAt: string;
  opened: boolean;
  clicked: boolean;
  reported: boolean;
  /** Simulated phishing page opened after a click (ISO string or null). */
  landedAt?: string | null;
  /** Simulated credentials entered on the phishing page — values are NEVER stored. */
  submittedAt?: string | null;
  template: InboxTemplateInfo;
}

export interface InboxResponse {
  participant: {
    id: string;
    name: string;
    email: string;
    department: string;
  };
  inbox: InboxItem[];
}

export interface TrackResponse {
  already: boolean;
  event?: unknown;
  enrollment: {
    id: string;
    openedAt: string | null;
    clickedAt: string | null;
    landedAt: string | null;
    submittedAt: string | null;
    reportedAt: string | null;
  };
  credentialsStored?: false;
  note?: string;
}

/* ----------------------------- /api/training ---------------------------- */

export interface TrainingModule {
  id: string;
  title: string;
  category: string;
  durationMin: number;
  summary: string;
  contentMd: string;
  redFlagTips: string[];
  completions: number;
}

export interface TrainingCompletion {
  participantId: string;
  participantName: string;
  moduleId: string;
  completedAt: string;
}

export interface TrainingResponse {
  attempts: { participantId: string; moduleId: string; phase: string; score: number; total: number; createdAt: string }[];
  recommendations: { participantId: string; moduleTitle: string; reason: string }[];
  modules: TrainingModule[];
  completions: TrainingCompletion[];
}

/* ------------------------------ /api/health ------------------------------ */

export interface HealthResponse {
  ok: boolean;
  checks: {
    database: boolean;
    liveFeed: boolean;
    ai: boolean;
  };
  uptimeSec: number;
  generatedAt: string;
}

/* ------------------------------- /api/ai --------------------------------- */

/** "ai" = real model output, "fallback" = deterministic heuristic result. */
export type AiSource = "ai" | "fallback";

export interface AiGeneratedTemplate {
  name: string;
  category: string;
  difficulty: Difficulty;
  subject: string;
  senderName: string;
  senderEmail: string;
  bodyHtml: string;
  landingMessage: string;
  redFlags: string[];
}

export interface GenerateTemplateResponse {
  template: AiGeneratedTemplate;
  rationale: string;
  source: AiSource;
  aiGenerated: boolean;
}

export type AiVerdict = "phishing" | "suspicious" | "likely_legitimate";
export type AiSeverity = "high" | "medium" | "low";

export interface AiAnalysisFlag {
  title: string;
  severity: AiSeverity;
  explanation: string;
}

export interface AiAnalysis {
  riskScore: number; // 0-100
  verdict: AiVerdict;
  confidence: number; // 0-100
  summary: string;
  flags: AiAnalysisFlag[];
  recommendations: string[];
  disclaimer: string;
}

export interface AnalyzeResponse {
  analysis: AiAnalysis;
  source: AiSource;
}

export type CoachAction = "open" | "click" | "submit" | "report";

export interface AiCoach {
  headline: string;
  message: string;
  microQuiz: {
    question: string;
    options: string[];
    answerIndex: number;
  };
}

export interface CoachResponse {
  coach: AiCoach;
  source: AiSource;
  aiGenerated: boolean;
  cached?: boolean;
}

export interface AiReportSummary {
  executiveSummary: string;
  narrative: string;
  keyRisks: string[];
  wins: string[];
  nextSteps: string[];
}

export interface ReportSummaryResponse {
  summary: AiReportSummary;
  source: AiSource;
}

/* ---------------------------- /api/leaderboard ---------------------------- */

export interface LeaderboardIndividual {
  participantId: string;
  name: string;
  department: string;
  delivered: number;
  clicks: number;
  submitted: number;
  reports: number;
  score: number;
  badges: string[];
}

export interface LeaderboardDepartment {
  department: string;
  participants: number;
  reports: number;
  clicks: number;
  submitted: number;
  score: number;
  avgScore: number;
}

export interface LeaderboardResponse {
  leaderboard: {
    individuals: LeaderboardIndividual[];
    departments: LeaderboardDepartment[];
    meta: {
      scoringModel: string;
      generatedAt: string;
    };
  };
  privacyNote: string;
}

/* ---------------------------- /api/compliance --------------------------- */

export interface ConsentRow {
  id: string;
  name: string;
  email: string;
  department: string;
  consented: boolean;
  consentedAt: string | null;
}

export interface ApprovedDomain {
  id: string;
  domain: string;
  approvedBy: string;
  createdAt: string;
}

export interface RetentionPolicy {
  defaultRetentionDays: number;
  autoPurge: boolean;
  totalEvents: number;
  oldestEventAt: string | null;
}

export interface PurgeResponse {
  purged: number;
  cutoffAt: string;
  autoPurge: boolean;
}

export interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  detail: string;
  createdAt: string;
}

export interface ComplianceResponse {
  consent: ConsentRow[];
  domains: ApprovedDomain[];
  retention: RetentionPolicy;
  audit: AuditEntry[];
}

/* ------------------------- /api/analytics/report ------------------------ */

export interface ReportOverall {
  participants: number;
  consentedParticipants: number;
  delivered: number;
  opens: number;
  clicks: number;
  reports: number;
  openRate: number;
  clickRate: number;
  reportRate: number;
  resilienceScore: number;
  trainingCompletionRate: number;
  trainingCompletions: number;
  /** Later-stage counts (may lag behind the base fields while upgrading). */
  stageCounts?: {
    landed: number;
    submitted: number;
  };
}

/** Report department rows extend the stats rows with a vulnerability index. */
export interface ReportDepartmentStats extends DepartmentStats {
  /** 0-100 composite of click/submit exposure; higher = more vulnerable. */
  vulnerabilityIndex: number;
}

export interface ReportCampaign {
  name: string;
  status: CampaignStatus;
  launchedAt: string | null;
  completedAt: string | null;
  participantCount: number;
  delivered: number;
  opens: number;
  clicks: number;
  reports: number;
  clickRate: number;
  reportRate: number;
}

export interface ReportPrivacy {
  credentialCollection: boolean;
  realEmailDelivery: boolean;
  individualScoresAnonymous: boolean;
  defaultRetentionDays: number;
  autoPurge: boolean;
}

export interface AnalyticsReport {
  generatedAt: string;
  overall: ReportOverall;
  trend: TrendPoint[];
  campaigns: ReportCampaign[];
  departments: ReportDepartmentStats[];
  funnel?: FunnelPoint[];
  timeToReport?: TimeToReportBucket[];
  repeatClickers?: RepeatClicker[];
  repeatClickersNote?: string;
  topRiskyDepartment?: string;
  topRedFlags: { flag: string; count: number }[];
  recommendations: string[];
  privacy: ReportPrivacy;
}

/* ------------------------------- client -------------------------------- */

export class ApiError extends Error {
  status: number;
  violations: string[];

  constructor(status: number, message: string, violations: string[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.violations = violations;
  }
}

/** Human-friendly message for toasts: error text + joined violations. */
export function apiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const base = err.message || `Request failed (${err.status})`;
    if (err.violations.length > 0) {
      return `${base} — ${err.violations.join("; ")}`;
    }
    return base;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Typed fetch helper for the PhishGuard API. Relative paths only. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      cache: "no-store",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(0, "Network error — could not reach the PhishGuard API.");
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON body is fine for empty responses
  }

  if (!res.ok) {
    const body = (data ?? {}) as { error?: string; violations?: string[] };
    throw new ApiError(
      res.status,
      body.error ?? `Request failed (${res.status})`,
      Array.isArray(body.violations) ? body.violations : []
    );
  }

  return data as T;
}

/** Extract domain from an email address, or "unknown". */
export function emailDomain(email: string): string {
  const idx = email.lastIndexOf("@");
  return idx >= 0 ? email.slice(idx + 1).toLowerCase() : "unknown";
}

/* --------------------------- typed API helpers --------------------------- */

/** Record a simulated lifecycle event (OPEN / CLICK / LANDED / SUBMITTED / REPORT). */
export async function trackEvent(
  enrollmentId: string,
  type: TrackEventType,
  note?: string
): Promise<TrackResponse> {
  // Privacy guarantee: SUBMITTED never carries credential fields — the
  // simulated page clears its inputs locally and only reports that the
  // submission happened.
  return api<TrackResponse>("/api/track", {
    method: "POST",
    body: JSON.stringify(note ? { enrollmentId, type, note } : { enrollmentId, type }),
  });
}

/** Create a phishing template (pass aiGenerated: true for AI Studio drafts). */
export async function createTemplate(
  payload: TemplatePayload
): Promise<{ template: PhishTemplate }> {
  return api<{ template: PhishTemplate }>("/api/templates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** POST /api/ai/template — generate a simulated lure from a scenario. */
export async function generateAiTemplate(input: {
  scenario: string;
  difficulty: Difficulty;
  category?: string;
}): Promise<GenerateTemplateResponse> {
  return api<GenerateTemplateResponse>("/api/ai/template", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** POST /api/ai/analyze — heuristic/AI risk assessment of suspicious content. */
export async function analyzePhishContent(content: string): Promise<AnalyzeResponse> {
  return api<AnalyzeResponse>("/api/ai/analyze", {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

/** POST /api/ai/coach — contextual coaching moment (fails gracefully client-side). */
export async function fetchAiCoach(input: {
  action: CoachAction;
  templateId: string;
  participantName?: string;
}): Promise<CoachResponse> {
  return api<CoachResponse>("/api/ai/coach", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** POST /api/ai/report-summary — executive narrative for an AnalyticsReport. */
export async function generateReportSummary(report: AnalyticsReport): Promise<ReportSummaryResponse> {
  return api<ReportSummaryResponse>("/api/ai/report-summary", {
    method: "POST",
    body: JSON.stringify({ report }),
  });
}

/** POST /api/compliance/purge — run the retention purge immediately. */
export async function purgeRetention(): Promise<PurgeResponse> {
  return api<PurgeResponse>("/api/compliance/purge", { method: "POST" });
}

/** Build a CSV export URL for the Compliance view (relative path only). */
export function exportCsvUrl(entity: "participants" | "events" | "campaigns"): string {
  return `/api/export?entity=${entity}`;
}
