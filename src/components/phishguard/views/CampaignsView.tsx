"use client";

// PhishGuard · Campaigns: list, detail dialog with lifecycle actions, and
// a 3-step new-campaign wizard (details → participants → review).

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  Clock,
  Crosshair,
  FlagTriangleRight,
  Globe,
  MailOpen,
  MousePointerClick,
  Play,
  Plus,
  Send,
  SquareCheck,
  Trash2,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { api, ApiError, apiErrorMessage, emailDomain } from "../api";
import type {
  CampaignDetail,
  CampaignListItem,
  CreateCampaignPayload,
  Participant,
  PhishTemplate,
} from "../api";
import { useCampaignDetail, useCampaigns, useParticipants, useTemplates } from "../hooks";
import {
  DifficultyBadge,
  EmptyState,
  ErrorState,
  EventStatusCell,
  SectionTitle,
  StatusBadge,
  ViolationsAlert,
  relativeTime,
  shortDateTime,
} from "../shared";

const METRIC_ICON =
  "flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[11px] text-muted-foreground";

export default function CampaignsView() {
  const { data, loading, error, refresh } = useCampaigns();
  const { data: templatesData } = useTemplates();
  const { data: participantsData } = useParticipants();
  const [filter, setFilter] = useState<string>("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const campaigns = data?.campaigns ?? [];
  const filtered = useMemo(
    () => (filter === "all" ? campaigns : campaigns.filter((c) => c.status === filter)),
    [campaigns, filter]
  );

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Simulation campaigns"
        icon={Crosshair}
        description="Authorized phishing simulations with explicit consent, allowlisted senders and automatic purge."
        actions={
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            New Campaign
          </Button>
        }
      />

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList aria-label="Filter campaigns by status">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="running">Running</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>
      </Tabs>

      {error && !data ? (
        <ErrorState message={error} onRetry={() => void refresh()} />
      ) : loading && !data ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="space-y-3 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-14" />
                <Skeleton className="h-5 w-14" />
                <Skeleton className="h-5 w-14" />
                <Skeleton className="h-5 w-14" />
              </div>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Crosshair}
          title={filter === "all" ? "No campaigns yet" : `No ${filter} campaigns`}
          hint="Create a campaign from an approved template, enroll consenting participants, then launch."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((c) => (
            <CampaignCard key={c.id} campaign={c} onOpen={() => setDetailId(c.id)} />
          ))}
        </div>
      )}

      <CampaignDetailDialog
        key={detailId ?? "none"}
        id={detailId}
        onClose={() => setDetailId(null)}
        onChanged={() => void refresh()}
      />

      {wizardOpen ? (
        <NewCampaignWizard
          open={wizardOpen}
          templates={templatesData?.templates ?? []}
          participants={participantsData?.participants.filter((p) => p.active) ?? []}
          onClose={() => setWizardOpen(false)}
          onCreated={() => void refresh()}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------ campaign card ------------------------------ */

function CampaignCard({
  campaign,
  onOpen,
}: {
  campaign: CampaignListItem;
  onOpen: () => void;
}) {
  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`Open campaign ${campaign.name}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="cursor-pointer rounded-xl p-4 transition-colors hover:border-emerald-500/40 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{campaign.name}</h3>
        <StatusBadge status={campaign.status} />
      </div>

      {campaign.description ? (
        <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{campaign.description}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary" className="text-[11px]">
          {campaign.template.category}
        </Badge>
        <DifficultyBadge difficulty={campaign.template.difficulty} />
        <span className="inline-flex items-center gap-1">
          <Send className="size-3" aria-hidden="true" />
          {campaign.template.name}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Users className="size-3.5" aria-hidden="true" />
          {campaign.participantCount} participants
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3.5" aria-hidden="true" />
          {campaign.launchedAt ? `launched ${relativeTime(campaign.launchedAt)}` : `created ${relativeTime(campaign.createdAt)}`}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="Campaign metrics">
        <span className={METRIC_ICON}>
          <Send className="size-3" aria-hidden="true" /> {campaign.delivered} delivered
        </span>
        <span className={cn(METRIC_ICON, "text-emerald-400 border-emerald-500/30 bg-emerald-500/10")}>
          <MailOpen className="size-3" aria-hidden="true" /> {campaign.opens} opens
        </span>
        <span className={cn(METRIC_ICON, "text-red-400 border-red-500/30 bg-red-500/10")}>
          <MousePointerClick className="size-3" aria-hidden="true" /> {campaign.clicks} clicks
        </span>
        <span className={cn(METRIC_ICON, "text-teal-400 border-teal-500/30 bg-teal-500/10")}>
          <FlagTriangleRight className="size-3" aria-hidden="true" /> {campaign.reports} reports
        </span>
      </div>
    </Card>
  );
}

/* ------------------------------ detail dialog ------------------------------ */

function CampaignDetailDialog({
  id,
  onClose,
  onChanged,
}: {
  id: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data, loading, error, refresh } = useCampaignDetail(id);
  const [busy, setBusy] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<{ message: string; violations: string[] } | null>(null);

  const patch = async (campaignId: string, action: "launch" | "complete" | "cancel") => {
    setBusy(action);
    setLaunchError(null);
    try {
      await api<{ campaign: CampaignDetail }>(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      toast.success(`Campaign ${action === "launch" ? "launched" : action === "complete" ? "completed" : "cancelled"}`);
      await refresh();
      onChanged();
    } catch (err) {
      if (err instanceof ApiError) {
        setLaunchError({ message: err.message, violations: err.violations });
      }
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };



  const remove = async (campaignId: string) => {
    setBusy("delete");
    try {
      await api<{ ok: boolean }>(`/api/campaigns/${campaignId}`, { method: "DELETE" });
      toast.success("Campaign deleted");
      onClose();
      onChanged();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const campaign = data;
  const consentedCount = campaign?.participants.filter((p) => p.consented).length ?? 0;

  return (
    <Dialog open={id !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-xl" aria-describedby="campaign-detail-desc">
        {loading && !campaign ? (
          <div className="space-y-4 py-4">
            <DialogTitle className="sr-only">Loading campaign</DialogTitle>
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : error && !campaign ? (
          <div className="py-4">
            <DialogTitle className="sr-only">Campaign error</DialogTitle>
            <ErrorState message={error} onRetry={() => void refresh()} />
          </div>
        ) : campaign ? (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2 pr-6">
                <DialogTitle className="text-lg">{campaign.name}</DialogTitle>
                <StatusBadge status={campaign.status} />
              </div>
              <DialogDescription id="campaign-detail-desc">
                {campaign.description || "No description provided."}
              </DialogDescription>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="text-[11px]">
                  {campaign.template.category}
                </Badge>
                <DifficultyBadge difficulty={campaign.template.difficulty} />
                <span>
                  Template <span className="font-medium text-foreground">{campaign.template.name}</span>
                </span>
                <span>·</span>
                <span>
                  {campaign.launchedAt
                    ? `Launched ${formatDistanceToNow(new Date(campaign.launchedAt), { addSuffix: true })}`
                    : `Created ${shortDateTime(campaign.createdAt)}`}
                </span>
                <span>·</span>
                <span>retention {campaign.retentionDays} days</span>
              </div>
            </DialogHeader>

            {/* Authorization panel */}
            <div className="grid gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 sm:grid-cols-3">
              <div className="flex items-center gap-2 text-xs">
                <UserCheck className="size-4 text-emerald-400" aria-hidden="true" />
                <div>
                  <p className="font-medium">Consent</p>
                  <p className="text-muted-foreground">
                    {consentedCount}/{campaign.participantCount} participants consented
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Globe className="size-4 text-teal-400" aria-hidden="true" />
                <div>
                  <p className="font-medium">Sender domain</p>
                  <p className="font-mono text-muted-foreground">{emailDomain(campaign.template.senderEmail)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Clock className="size-4 text-amber-400" aria-hidden="true" />
                <div>
                  <p className="font-medium">Retention</p>
                  <p className="text-muted-foreground">{campaign.retentionDays} days, then purged</p>
                </div>
              </div>
            </div>

            {launchError ? (
              <ViolationsAlert message={launchError.message} violations={launchError.violations} />
            ) : null}

            {/* Participants table */}
            <div>
              <h3 className="mb-2 text-sm font-semibold">
                Participants
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  simulated delivery · opens · clicks · reports
                </span>
              </h3>
              {campaign.participants.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No participants enrolled"
                  hint="This campaign was created without participants."
                />
              ) : (
                <div className="max-h-72 overflow-y-auto rounded-lg border">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow>
                        <TableHead>Participant</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Delivered</TableHead>
                        <TableHead>Opened</TableHead>
                        <TableHead>Clicked</TableHead>
                        <TableHead>Reported</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaign.participants.map((p) => (
                        <TableRow key={p.enrollmentId}>
                          <TableCell>
                            <div className="text-sm font-medium">{p.name}</div>
                            <div className="text-xs text-muted-foreground">{p.email}</div>
                          </TableCell>
                          <TableCell className="text-xs">{p.department}</TableCell>
                          <TableCell>
                            <EventStatusCell done={p.deliveredAt !== null} timestamp={p.deliveredAt} />
                          </TableCell>
                          <TableCell>
                            <EventStatusCell done={p.openedAt !== null} timestamp={p.openedAt} />
                          </TableCell>
                          <TableCell>
                            <EventStatusCell done={p.clickedAt !== null} variant="click" timestamp={p.clickedAt} />
                          </TableCell>
                          <TableCell>
                            <EventStatusCell done={p.reportedAt !== null} timestamp={p.reportedAt} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Actions */}
            <DialogFooter className="flex-wrap items-center gap-2 border-t pt-4 sm:justify-start">
              {campaign.status === "draft" ? (
                <Button onClick={() => void patch(campaign.id, "launch")} disabled={busy !== null}>
                  <Play className="size-4" aria-hidden="true" />
                  {busy === "launch" ? "Launching…" : "Launch"}
                </Button>
              ) : null}
              {campaign.status === "running" ? (
                <p className="rounded-lg border border-emerald-800 p-3 text-xs text-emerald-200">Use Test Inbox to record real demo decisions. Random activity generation is disabled.</p>
              ) : null}
              {campaign.status === "running" ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={busy !== null}>
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                      Complete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Complete this campaign?</AlertDialogTitle>
                      <AlertDialogDescription>
                        &ldquo;{campaign.name}&rdquo; will stop collecting simulated events and move
                        to the completed state. Existing data is kept until the retention window ends.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep running</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void patch(campaign.id, "complete")}>
                        Complete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
              {campaign.status === "draft" || campaign.status === "running" ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={busy !== null}>
                      <XCircle className="size-4" aria-hidden="true" />
                      Cancel
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel this campaign?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cancelling stops the simulation immediately. The campaign is kept for audit
                        purposes but can no longer be launched.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep campaign</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-white hover:bg-destructive/90"
                        onClick={() => void patch(campaign.id, "cancel")}
                      >
                        Cancel campaign
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
              {campaign.status === "draft" || campaign.status === "cancelled" ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="text-red-400 hover:text-red-300" disabled={busy !== null}>
                      <Trash2 className="size-4" aria-hidden="true" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete campaign permanently?</AlertDialogTitle>
                      <AlertDialogDescription>
                        &ldquo;{campaign.name}&rdquo; and its simulated event data will be removed.
                        This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-white hover:bg-destructive/90"
                        onClick={() => void remove(campaign.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------- new campaign wizard --------------------------- */

function NewCampaignWizard({
  open,
  templates,
  participants,
  onClose,
  onCreated,
}: {
  open: boolean;
  templates: PhishTemplate[];
  participants: Participant[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [retentionDays, setRetentionDays] = useState("90");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [violations, setViolations] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const template = templates.find((t) => t.id === templateId) ?? null;
  const consented = participants.filter((p) => p.consented);

  const toggle = (pid: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, pid] : prev.filter((x) => x !== pid)));
  };

  const next = () => {
    setViolations([]);
    setFormError(null);
    if (step === 1) {
      if (!name.trim()) return setFormError("Campaign name is required.");
      if (!templateId) return setFormError("Choose a phishing template to simulate.");
      setStep(2);
      return;
    }
    if (step === 2) {
      if (selectedIds.length === 0)
        return setFormError("Select at least one consenting participant.");
      setStep(3);
    }
  };

  const submit = async () => {
    setViolations([]);
    setFormError(null);
    setSubmitting(true);
    try {
      const payload: CreateCampaignPayload = {
        name: name.trim(),
        description: description.trim() || undefined,
        templateId,
        participantIds: selectedIds,
        retentionDays: Number.parseInt(retentionDays, 10) || undefined,
      };
      await api<{ campaign: CampaignDetail }>("/api/campaigns", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success(`Campaign "${name.trim()}" created as a draft`);
      onClose();
      onCreated();
    } catch (err) {
      if (err instanceof ApiError) setViolations(err.violations);
      toast.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const steps = ["Details", "Participants", "Review"];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-xl sm:max-w-2xl" aria-describedby="wizard-desc">
        <DialogHeader>
          <DialogTitle>New simulation campaign</DialogTitle>
          <DialogDescription id="wizard-desc">
            Three quick steps: describe the exercise, pick consenting participants, review &amp; create.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <ol className="flex items-center gap-2" aria-label="Wizard steps">
          {steps.map((label, idx) => {
            const n = idx + 1;
            const active = step === n;
            const done = step > n;
            return (
              <li key={label} className="flex items-center gap-2">
                <span
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                    active && "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
                    done && "border-emerald-500/40 bg-transparent text-emerald-400",
                    !active && !done && "border-border bg-muted/40 text-muted-foreground"
                  )}
                >
                  <span className="tabular-nums">{n}</span> {label}
                </span>
                {n < steps.length ? <span aria-hidden="true" className="h-px w-4 bg-border" /> : null}
              </li>
            );
          })}
        </ol>

        {formError ? <ViolationsAlert message={formError} /> : null}
        {violations.length > 0 ? <ViolationsAlert message="The server rejected this campaign" violations={violations} /> : null}

        {step === 1 ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="camp-name">Campaign name</Label>
              <Input
                id="camp-name"
                placeholder="Q3 Finance · Urgency wave"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="camp-desc">Description (optional)</Label>
              <Textarea
                id="camp-desc"
                rows={2}
                placeholder="What this wave tests and which behavior it targets."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phishing template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger className="w-full" aria-label="Phishing template">
                  <SelectValue placeholder="Select an approved template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} · {t.category} · {t.difficulty}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {template ? (
                <p className="text-xs text-muted-foreground">
                  {template.subject} · from {template.senderName} &lt;
                  <span className="font-mono">{template.senderEmail}</span>&gt;
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="camp-retention">Retention days</Label>
              <Input
                id="camp-retention"
                type="number"
                min={1}
                max={365}
                value={retentionDays}
                onChange={(e) => setRetentionDays(e.target.value)}
                className="w-40"
              />
              <p className="text-xs text-muted-foreground">
                Simulated event data is purged after this window (default 90).
              </p>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {selectedIds.length} of {consented.length} consenting participants selected
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedIds(consented.map((p) => p.id))}
                >
                  <SquareCheck className="size-3.5" aria-hidden="true" />
                  Select all consented
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
                  Clear
                </Button>
              </div>
            </div>
            {participants.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No active participants"
                hint="Add participants under Compliance → Consent first."
              />
            ) : (
              <div className="max-h-64 overflow-y-auto overscroll-contain rounded-lg border" role="region" aria-label="Campaign participants" tabIndex={0}>
                <ul className="divide-y divide-border/60">
                  {participants.map((p) => {
                    const checked = selectedIds.includes(p.id);
                    const row = (
                      <li
                        key={p.id}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5",
                          !p.consented && "opacity-60"
                        )}
                      >
                        <Checkbox
                          id={`wiz-${p.id}`}
                          checked={checked}
                          disabled={!p.consented}
                          onCheckedChange={(v) => toggle(p.id, v === true)}
                          aria-label={`Enroll ${p.name}`}
                        />
                        <label
                          htmlFor={`wiz-${p.id}`}
                          className="min-w-0 flex-1 cursor-pointer text-sm"
                        >
                          <span className="block break-words font-medium">{p.name}</span>
                          <span className="block break-all text-xs text-muted-foreground">{p.email}</span>
                          <span className="block text-xs text-muted-foreground sm:hidden">{p.department}</span>
                        </label>
                        <Badge variant="secondary" className="hidden shrink-0 text-[10px] sm:inline-flex">
                          {p.department}
                        </Badge>
                        {p.consented ? (
                          <Badge className="border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 text-[10px]">
                            consented
                          </Badge>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-400 text-[10px]">
                                No consent
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              Consent must be recorded before this person can be enrolled.
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </li>
                    );
                    return row;
                  })}
                </ul>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Only participants with recorded consent can be enrolled · enforced by the platform.
            </p>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Summary</p>
              <dl className="mt-2 space-y-2">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Campaign</dt>
                  <dd className="font-medium">{name || "–"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Template</dt>
                  <dd className="text-right">
                    {template ? (
                      <span className="inline-flex items-center gap-2">
                        {template.name}
                        <Badge variant="secondary" className="text-[10px]">{template.category}</Badge>
                        <DifficultyBadge difficulty={template.difficulty} />
                      </span>
                    ) : (
                      "–"
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Sender</dt>
                  <dd className="font-mono text-xs">{template?.senderEmail ?? "–"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Participants</dt>
                  <dd className="font-medium">{selectedIds.length}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Retention</dt>
                  <dd className="font-medium">{retentionDays} days</dd>
                </div>
              </dl>
            </div>
            <p className="text-xs text-muted-foreground">
              The campaign is created as a <span className="font-medium">draft</span>. Launch it from
              the campaign list once you are ready to begin the simulation.
            </p>
          </div>
        ) : null}

        <DialogFooter className="border-t pt-4">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep(step - 1)} disabled={submitting}>
              Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
          )}
          {step < 3 ? (
            <Button onClick={next}>Next</Button>
          ) : (
            <Button onClick={() => void submit()} disabled={submitting}>
              {submitting ? "Creating…" : "Create campaign"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
