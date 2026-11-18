"use client";

import { catalogExercises } from "@/lib/catalog-exercises";
import { findCatalogExercise } from "@/lib/training-catalog";

// Controlled landing decisions are recorded without accepting user-entered data.

import { ScenarioLanding } from "../ScenarioLanding";
import { scenarioFor } from "@/lib/landing-scenarios";
import { useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  FlagTriangleRight,
  GraduationCap,
  Inbox as InboxIcon,
  KeyRound,
  MailOpen,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import {
  apiErrorMessage,
  fetchAiCoach,
  trackEvent,
} from "../api";
import type {
  AiCoach,
  AiSource,
  InboxItem,
  Participant,
  TrackEventType,
  TrackResponse,
} from "../api";
import { useInbox, useParticipants } from "../hooks";
import {
  EmptyState,
  ErrorState,
  initials,
  relativeTime,
  SectionTitle,
  shortDateTime,
  SimulatedEmailBody,
  StageDots,
  type StageFlags,
} from "../shared";
import type { ViewKey } from "../view-keys";

/** Local coaching payload · microQuiz is optional because the client-side
 * fallback (template.landingMessage) has no quiz to offer. */
interface CoachCardData {
  headline: string;
  message: string;
  microQuiz: AiCoach["microQuiz"] | null;
}

export default function TestInboxView({
  onNavigate,
}: {
  onNavigate: (v: ViewKey) => void;
}) {
  const { data: participantsData, loading: pLoading, error: pError, refresh: refreshParticipants } = useParticipants();
  const actors = useMemo<Participant[]>(
    () =>
      (participantsData?.participants ?? []).filter((p) => p.active && p.consented),
    [participantsData]
  );
  const [pickedParticipantId, setPickedParticipantId] = useState<string | null>(null);
  const participantId = pickedParticipantId ?? actors[0]?.id ?? "";
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Optimistic stage overlay · keeps dots accurate across refreshes and with
  // backends that do not yet surface landedAt/submittedAt on inbox rows.
  const [localStage, setLocalStage] = useState<Record<string, Partial<StageFlags>>>({});
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set()); // local-only delete

  // Simulated phishing page dialog state.
  const actionLock = useRef(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [fakeOpen, setFakeOpen] = useState(false);
  const [fakeStage, setFakeStage] = useState<"login" | "result">("login");
  const [fakeItem, setFakeItem] = useState<InboxItem | null>(null);
  const [resultKind, setResultKind] = useState<"submitted" | "reported" | null>(null);



  // AI coach state for the educational interstitial.
  const coachRequest = useRef(0);
  const [coach, setCoach] = useState<CoachCardData | null>(null);
  const [coachSource, setCoachSource] = useState<AiSource | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);

  const { data, loading, error, refresh } = useInbox(participantId || null);
  const inbox = useMemo(
    () => (data?.inbox ?? []).filter((i) => !hiddenIds.has(i.enrollmentId)),
    [data, hiddenIds]
  );
  const selected = inbox.find((i) => i.enrollmentId === selectedId) ?? null;

  const mergeStage = (id: string, patch: Partial<StageFlags>) =>
    setLocalStage((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const stageFor = (item: InboxItem): StageFlags => {
    const local = localStage[item.enrollmentId] ?? {};
    return {
      opened: item.opened || !!local.opened,
      clicked: item.clicked || !!local.clicked,
      landed: item.landedAt != null || !!local.landed,
      submitted: item.submittedAt != null || !!local.submitted,
      reported: item.reported || !!local.reported,
    };
  };

  /** Fire-and-forget lifecycle tracking (server dedups repeats). */
  const doTrack = async (
    enrollmentId: string,
    type: TrackEventType
  ): Promise<TrackResponse | null> => {
    try {
      const result = await trackEvent(enrollmentId, type);
      const e = result.enrollment;
      if (e) mergeStage(enrollmentId, { opened: !!e.openedAt, clicked: !!e.clickedAt, landed: !!e.landedAt, submitted: !!e.submittedAt, reported: !!e.reportedAt });
      return result;
    } catch (err) {
      toast.error(apiErrorMessage(err));
      return null;
    }
  };

  /** AI coaching moment; degrades to template.landingMessage on failure. */
  const loadCoach = async (item: InboxItem, action: "submit" | "report" | "click") => {
    const requestId = ++coachRequest.current;
    setCoachLoading(true);
    setCoach(null);
    setCoachSource(null);
    try {
      const res = await fetchAiCoach({
        action,
        templateId: item.templateId ?? item.template.id ?? item.campaignId,

      });
      if (requestId !== coachRequest.current) return;
      setCoach({
        headline: res.coach.headline,
        message: res.coach.message,
        microQuiz: res.coach.microQuiz ?? null,
      });
      setCoachSource(res.source);
    } catch {
      if (requestId !== coachRequest.current) return;
      // Graceful fallback using data the frontend already has.
      setCoach({
        headline: action === "report" ? "Why reporting works" : "What just happened",
        message:
          item.template.landingMessage ||
          "This was a simulated phishing email built for authorized awareness training. Pausing to verify the sender before acting is exactly the right reflex.",
        microQuiz: {question: "What is the safest next step for an unexpected request?", options: ["Continue because the page looks familiar", "Verify through a known, independent channel", "Forward it to everyone"], answerIndex: 1},
      });
      setCoachSource("fallback");
    } finally {
      if (requestId === coachRequest.current) setCoachLoading(false);
    }
  };

  const openEmail = (item: InboxItem) => {
    setSelectedId(item.enrollmentId);
    const stage = stageFor(item);
    if (!stage.opened) {

      void doTrack(item.enrollmentId, "OPEN").then(() => void refresh());
    }
  };

  /** The phishing click · stage 1 of the multi-stage flow. */
  const clickLink = async (item: InboxItem) => {
    if (actionLock.current) return;
    actionLock.current = true; setActionBusy(true);
    const recorded = await doTrack(item.enrollmentId, "LANDED");
    actionLock.current = false; setActionBusy(false);
    if (!recorded) return;
    setFakeItem(item);
    const outcome = recorded.enrollment?.reportedAt ? "reported" : recorded.enrollment?.submittedAt ? "submitted" : null;
    setFakeStage(outcome ? "result" : "login");
    setResultKind(outcome);
    setFakeOpen(true);
    if (outcome) void loadCoach(item, outcome === "reported" ? "report" : "submit");
    void refresh();
  };

  /** Stage 4: confirm a fictional request; only the decision is recorded. */
  const openedCatalogExercise = fakeItem && findCatalogExercise(fakeItem.template.subject, fakeItem.template.id);
  const openedExercise = openedCatalogExercise && catalogExercises[openedCatalogExercise.id];

  const submitFake = async () => {
    if (!fakeItem || actionLock.current) return false;
    actionLock.current = true; setActionBusy(true);
    const recorded = await doTrack(fakeItem.enrollmentId, "SUBMITTED");
    actionLock.current = false; setActionBusy(false);
    if (!recorded) return false;


    setFakeStage("result");
    setResultKind("submitted");

    void refresh();
    void loadCoach(fakeItem, "submit");
    return true;
  };

  /** Closing is navigation only: no outcome, submission or report is recorded. */
  const closeFake = () => {
    if (actionLock.current) return;
    coachRequest.current++;
    setCoachLoading(false);
    setFakeOpen(false);
    setFakeItem(null);
    setFakeStage("login");
    setResultKind(null);
    setCoach(null);
    setCoachSource(null);


    void refresh();
  };

  const reportPhish = async () => {
    if (!selected || stageFor(selected).submitted || actionLock.current) return;
    actionLock.current = true; setActionBusy(true);
    const res = await doTrack(selected.enrollmentId, "REPORT");
    actionLock.current = false; setActionBusy(false);
    if (!res) return;

    if (res.already) {
      toast.info("You already reported this phish · great instincts!");
    } else {
      toast.success("Phish reported · nice catch!");
    }
    setFakeItem(selected); setFakeStage("result"); setResultKind("reported"); setFakeOpen(true); void loadCoach(selected, "report");
    void refresh();
  };

  /** Local-only delete: hides the row for this session, nothing is erased. */
  const deleteEmail = (item: InboxItem) => {
    setHiddenIds((prev) => new Set(prev).add(item.enrollmentId));
    if (selectedId === item.enrollmentId) setSelectedId(null);
    toast.info("Message hidden from the simulated inbox (session only).");
  };

  const isPartial = (item: InboxItem) => {
    const stage = stageFor(item);
    return (
      stage.clicked &&
      stage.landed &&
      !stage.submitted &&
      !stage.reported &&
      item.landedAt != null
    );
  };

  const brand = fakeItem ? scenarioFor(fakeItem.template) : null;

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Practice inbox"
        icon={InboxIcon}
        description="Review your messages, inspect requests and decide what to trust."
      />

      {/* Controlled environment banner */}
      <div
        role="note"
        className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4"
      >
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-400" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-emerald-300">
            CONTROLLED TEST ENVIRONMENT
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            This inbox lives entirely inside PhishGuard. Nothing is sent to real mail
            servers and the simulated page never transmits or stores dummy data.
          </p>
        </div>
      </div>

      {/* Acting as */}
      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="inbox-actor" className="text-sm text-muted-foreground">
          Acting as
        </Label>
        <Select value={participantId} onValueChange={(v) => { setPickedParticipantId(v); setSelectedId(null); }}>
          <SelectTrigger id="inbox-actor" className="w-full sm:w-[300px]" aria-label="Acting participant">
            <SelectValue placeholder={pLoading ? "Loading participants…" : "Select participant"} />
          </SelectTrigger>
          <SelectContent>
            {actors.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} · {p.department}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {pError ? (
          <Button variant="outline" size="sm" onClick={() => void refreshParticipants()}>
            Retry
          </Button>
        ) : null}
      </div>

      {error && !data ? (
        <ErrorState message={error} onRetry={() => void refresh()} />
      ) : !participantId ? (
        <EmptyState
          icon={InboxIcon}
          title="No consenting participants"
          hint="Record consent for at least one participant under Compliance → Consent to use the test inbox."
        />
      ) : loading && !data ? (
        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <Skeleton className="h-[520px] rounded-xl" />
          <Skeleton className="hidden h-[520px] rounded-xl md:block" />
        </div>
      ) : inbox.length === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title="Inbox is empty"
          hint="This participant has not been enrolled in a delivered campaign yet. Launch a campaign with them enrolled, then come back."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* ------------------------- Email list ------------------------- */}
          <Card className="rounded-xl p-2">
            <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Simulated inbox · {inbox.length} message{inbox.length === 1 ? "" : "s"}
            </p>
            <ul aria-label="Simulated inbox messages" className="max-h-[520px] overflow-y-auto pr-1">
              {inbox.map((item) => {
                const stage = stageFor(item);
                const partial = isPartial(item);
                return (
                  <li key={item.enrollmentId}>
                    <button
                      type="button"
                      onClick={() => openEmail(item)}
                      aria-current={selectedId === item.enrollmentId ? "true" : undefined}
                      className={cn(
                        "w-full rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        selectedId === item.enrollmentId && "bg-accent"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium">
                          {item.template.senderName}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {relativeTime(item.deliveredAt)}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "mt-0.5 truncate text-sm",
                          stage.opened ? "text-foreground/80" : "font-semibold"
                        )}
                      >
                        {!stage.opened ? (
                          <span
                            aria-hidden="true"
                            className="mr-1.5 inline-block size-1.5 rounded-full bg-emerald-400 align-middle"
                          />
                        ) : null}
                        {item.template.subject}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <Badge variant="secondary" className="max-w-32 truncate text-[9px]">
                          {item.campaignName}
                        </Badge>
                        <span className="flex items-center gap-1.5" aria-label="message status">
                          {partial ? (
                            <span
                              className="inline-block size-2 rounded-full bg-amber-400"
                              title="Link opened, no action confirmed"
                              aria-label="Link opened, no action confirmed"
                            />
                          ) : null}
                          <StageDots stage={stage} />
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="px-2 pb-1 pt-1.5 text-[10px] leading-relaxed text-muted-foreground">
              Lifecycle: delivered → opened → clicked → landed → submitted → reported
            </p>
          </Card>

          {/* ------------------------ Reading pane ------------------------ */}
          <Card className="min-w-0 rounded-xl p-4 sm:p-6">
            {selected ? (
              <div className="space-y-4">
                {/* Reported lock strip */}
                {stageFor(selected).reported ? (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300">
                    <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
                    Reported as phishing · locked in for the exercise. Nice instinct.
                  </div>
                ) : null}

                {/* Header */}
                <div className="flex items-start gap-3 border-b pb-4">
                  <span
                    aria-hidden="true"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/15 text-sm font-semibold text-emerald-400"
                  >
                    {initials(selected.template.senderName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-semibold">{selected.template.senderName}</span>{" "}
                      <span className="break-all font-mono text-xs text-muted-foreground">
                        &lt;{selected.template.senderEmail}&gt;
                      </span>
                    </p>
                    <p className="mt-0.5 text-lg font-semibold leading-snug">
                      {selected.template.subject}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{shortDateTime(selected.deliveredAt)}</span>
                      <Badge variant="outline" className="text-[10px]">
                        to you
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {selected.template.category}
                      </Badge>

                      <Badge variant="outline" className="text-[10px]">
                        {selected.campaignName}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Body · clicks intercepted */}
                <SimulatedEmailBody
                  bodyHtml={selected.template.bodyHtml}
                  key={selected.enrollmentId}
                  onLinkClick={() => void clickLink(selected)}
                  label="Simulated email body (links are intercepted)"
                />

                {/* Status + actions */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Lifecycle</span>
                    <StageDots stage={stageFor(selected)} />
                    {isPartial(selected) ? (
                      <Badge className="border border-amber-500/40 bg-amber-500/15 text-amber-400">
                        Link opened, no action confirmed
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="destructive"
                      onClick={() => void reportPhish()}
                      disabled={actionBusy || stageFor(selected).reported || stageFor(selected).submitted}
                    >
                      <FlagTriangleRight className="size-4" aria-hidden="true" />
                      {stageFor(selected).reported ? "Reported" : stageFor(selected).submitted ? "Outcome recorded" : "Report Phish"}
                    </Button>
                    <Button variant="outline" disabled={actionBusy} onClick={() => clickLink(selected)}>
                      <ExternalLink className="size-4" aria-hidden="true" />
                      Open link
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => deleteEmail(selected)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      Delete
                    </Button>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Links inside the simulated email are intercepted · opening one is a safe,
                    trackable teaching moment.
                  </p>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={MailOpen}
                title="Select a message"
                hint="Pick an email on the left to read it. Links inside are intercepted · clicking one is a safe, trackable teaching moment."
                className="border-0"
              />
            )}
          </Card>
        </div>
      )}

      {/* ------------------- Simulated phishing page dialog ------------------- */}
      <Dialog open={fakeOpen} onOpenChange={(o) => { if (!o) closeFake(); }}>
        <DialogContent
          onInteractOutside={event => event.preventDefault()}
          className="flex h-[94dvh] max-h-[94dvh] max-w-[1100px] flex-col gap-0 overflow-hidden rounded-xl p-0"
          aria-describedby="fake-page-desc"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{fakeStage === "login" ? brand?.brand : "Assessment feedback"}</DialogTitle>
            <DialogDescription id="fake-page-desc">
              Review the request and choose whether to continue or report it.
            </DialogDescription>
          </DialogHeader>

          {fakeStage === "login" ? (
            fakeItem && <ScenarioLanding key={fakeItem.enrollmentId} item={fakeItem} busy={actionBusy} onSubmit={submitFake} onExit={closeFake} onReport={async () => {
              if (actionLock.current) return;
              actionLock.current=true; setActionBusy(true);
              const result=await doTrack(fakeItem.enrollmentId,"REPORT");
              actionLock.current=false; setActionBusy(false);
              if (!result) return;
              setFakeStage("result"); setResultKind("reported");
              void loadCoach(fakeItem,"report"); void refresh();
            }}/>
          ) : (
            /* --------------------- Educational interstitial --------------------- */
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={resultKind ?? "result"}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="space-y-4"
                >
                  {resultKind === "submitted" ? (
                    <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-5 text-center">
                      <KeyRound className="mx-auto size-10 text-red-400" aria-hidden="true" />
                      <p className="mt-2 text-lg font-semibold text-red-300">
                        This was a phishing assessment
                      </p>
                      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-red-200/70">
                        You opened the link and confirmed the request. Only those actions were recorded. Reporting is closed for this exercise. In a real attack, a similar request could lead to credential theft or an unauthorized action.
                      </p>
                      {openedExercise?.kind === "download" && (
                        <a className="mt-3 inline-block text-sm text-sky-300 underline" href="/training/demo.txt" download="demo.txt">
                          Download demo.txt again
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5 text-center">
                      <ShieldCheck className="mx-auto size-10 text-emerald-400" aria-hidden="true" />
                      <p className="mt-2 text-lg font-semibold text-emerald-300">
                        Good instincts · you reported this phish
                      </p>
                      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-emerald-200/70">
                        Reporting is the single strongest defense for the whole organization. This
                        simulated page is safe · it only confirms what you already spotted.
                      </p>
                    </div>
                  )}

                  {/* What gave it away */}
                  {fakeItem ? (
                    <div>
                      <p className="text-sm font-semibold">What gave it away</p>
                      <ul className="mt-2 space-y-1.5">
                        {fakeItem.template.redFlags.map((flag, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden="true" />
                            <span>{flag}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {/* AI coach card (violet = AI feature) */}
                  {coachLoading ? (
                    <div className="space-y-2 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
                      <div className="flex items-center gap-2 text-xs font-medium text-violet-300">
                        <Sparkles className="size-3.5" aria-hidden="true" />
                        Preparing your coaching and quick check…
                      </div>
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                  ) : coach ? (
                    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-violet-300">
                          <Sparkles className="size-3.5" aria-hidden="true" />
                          Awareness coach
                        </span>
                        {coachSource === "fallback" ? (
                          <Badge variant="outline" className="border-zinc-500/40 bg-zinc-500/10 text-[10px] text-zinc-400">
                            local coaching
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm font-semibold">{coach.headline}</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {coach.message}
                      </p>
                      {coach.microQuiz ? <CoachMicroQuiz key={`${fakeItem?.enrollmentId}-${resultKind}`} quiz={coach.microQuiz} /> : null}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        closeFake();
                        onNavigate("training");
                      }}
                    >
                      <GraduationCap className="size-4" aria-hidden="true" />
                      Browse training modules
                    </Button>
                    <Button onClick={closeFake}>
                      <InboxIcon className="size-4" aria-hidden="true" />
                      Back to inbox
                    </Button>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------ micro quiz ------------------------------ */

function CoachMicroQuiz({
  quiz,
}: {
  quiz: { question: string; options: string[]; answerIndex: number };
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [graded, setGraded] = useState(false);
  const correct = picked !== null && Number(picked) === quiz.answerIndex;

  return (
    <div className="mt-3 rounded-lg border bg-card/60 p-3">
      <p className="text-sm font-medium">{quiz.question}</p>
      <RadioGroup
        value={picked ?? ""}
        onValueChange={setPicked}
        className="mt-2"
        disabled={graded}
      >
        {quiz.options.map((opt, i) => (
          <Label
            key={i}
            htmlFor={`coach-quiz-opt-${i}`}
            className={cn(
              "flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-sm font-normal transition-colors hover:bg-accent/50",
              graded && i === quiz.answerIndex && "border-emerald-500/40 bg-emerald-500/10",
              graded && picked === String(i) && !correct && "border-red-500/40 bg-red-500/10"
            )}
          >
            <RadioGroupItem id={`coach-quiz-opt-${i}`} value={String(i)} className="mt-0.5" />
            <span>{opt}</span>
          </Label>
        ))}
      </RadioGroup>
      {!graded ? (
        <Button
          size="sm"
          className="mt-2"
          disabled={picked === null}
          onClick={() => {
            setGraded(true);
            if (Number(picked) === quiz.answerIndex) {
              toast.success("Correct · good instinct.");
            } else {
              toast.error("Not quite · the correct answer is highlighted below.");
            }
          }}
        >
          Check answer
        </Button>
      ) : (
        <p
          className={cn(
            "mt-2 text-xs font-medium",
            correct ? "text-emerald-400" : "text-red-400"
          )}
          role="status"
        >
          {correct
            ? "Correct · you spotted it."
            : `Not quite · the correct answer is: "${quiz.options[quiz.answerIndex]}"`}
        </p>
      )}
    </div>
  );
}
