"use client";

// PhishGuard · Templates: library of simulated phishing emails with previews,
// red flags, teaching moments, and a full editor (create / edit / delete).

import { useState } from "react";
import {
  Eye,
  Flag,
  MailWarning,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { api, ApiError, apiErrorMessage } from "../api";
import type { Difficulty, PhishTemplate, TemplatePayload } from "../api";
import { useTemplates } from "../hooks";
import { DifficultyBadge, EmptyState, ErrorState, SectionTitle, SimulatedEmailBody } from "../shared";

const BODY_SHELL = `<div style="font-family: sans-serif; max-width: 540px; line-height: 1.5;">
  <p>Hi,</p>
  <p>Your mailbox quota is almost full. Verify your account within 24 hours to avoid interruption.</p>
  <p style="margin: 16px 0;">
    <a href="https://portal.acme-corp.test/verify?u={{participant}}"
       style="background:#16a34a;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">
      Verify mailbox now
    </a>
  </p>
  <p style="color:#888;font-size:12px;">IT Service Desk · This is a simulated phishing email for awareness training.</p>
</div>`;

export default function TemplatesView() {
  const { data, loading, error, refresh } = useTemplates();
  const [detail, setDetail] = useState<PhishTemplate | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<PhishTemplate | null>(null);

  const templates = data?.templates ?? [];

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Phishing template library"
        icon={MailWarning}
        description="Each simulated email ships with its red flags and a teaching moment shown after the landing-page decision."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setEditorOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            New Template
          </Button>
        }
      />

      {error && !data ? (
        <ErrorState message={error} onRetry={() => void refresh()} />
      ) : loading && !data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="space-y-3 rounded-xl p-4">
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/2 font-mono" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
              </div>
            </Card>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={MailWarning}
          title="No templates yet"
          hint="Create a simulated phishing email with sender, body and the red flags it teaches."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="flex flex-col rounded-xl p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-[11px]">
                  {t.category}
                </Badge>
                <DifficultyBadge difficulty={t.difficulty} />
                {t.isBuiltIn ? (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    built-in
                  </Badge>
                ) : null}
                {t.aiGenerated ? (
                  <Badge className="border border-violet-500/40 bg-violet-500/15 text-violet-400">
                    <Sparkles className="size-3" aria-hidden="true" />
                    AI
                  </Badge>
                ) : null}
              </div>
              <h3 className="mt-2 text-sm font-semibold">{t.name}</h3>
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{t.subject}</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {t.senderName} &lt;{t.senderEmail}&gt;
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-amber-400">
                  <Flag className="size-3" aria-hidden="true" />
                  {t.redFlags.length} red flags
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5">
                  used {t.usageCount}×
                </span>
              </div>
              <div className="mt-4 flex items-center gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => setDetail(t)}>
                  <Eye className="size-3.5" aria-hidden="true" />
                  Preview
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(t);
                    setEditorOpen(true);
                  }}
                >
                  <Pencil className="size-3.5" aria-hidden="true" />
                  Edit
                </Button>
                <DeleteTemplateButton template={t} onDeleted={() => void refresh()} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <TemplateDetailDialog template={detail} onClose={() => setDetail(null)} />

      {editorOpen ? (
        <TemplateEditorDialog
          key={editing?.id ?? "new"}
          open={editorOpen}
          template={editing}
          onClose={() => setEditorOpen(false)}
          onSaved={() => void refresh()}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------- detail dialog ------------------------------ */

function TemplateDetailDialog({
  template,
  onClose,
}: {
  template: PhishTemplate | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={template !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-xl"
        aria-describedby="tpl-detail-desc"
      >
        {template ? (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2 pr-6">
                <DialogTitle className="text-lg">{template.name}</DialogTitle>
                <Badge variant="secondary" className="text-[11px]">
                  {template.category}
                </Badge>
                <DifficultyBadge difficulty={template.difficulty} />
                {template.aiGenerated ? (
                  <Badge className="border border-violet-500/40 bg-violet-500/15 text-violet-400">
                    <Sparkles className="size-3" aria-hidden="true" />
                    AI
                  </Badge>
                ) : null}
              </div>
              <DialogDescription id="tpl-detail-desc">
                Subject: <span className="font-medium text-foreground">{template.subject}</span>
                <br />
                From {template.senderName} &lt;
                <span className="font-mono">{template.senderEmail}</span>&gt;
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="preview">
              <TabsList>
                <TabsTrigger value="preview">Email preview</TabsTrigger>
                <TabsTrigger value="flags">Red flags ({template.redFlags.length})</TabsTrigger>
                <TabsTrigger value="teaching">Teaching moment</TabsTrigger>
              </TabsList>

              <TabsContent value="preview" className="mt-3">
                <SimulatedEmailBody
                  bodyHtml={template.bodyHtml}
                  label="Simulated email body preview"
                  inert
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Preview is inert · links cannot be followed from here.
                </p>
              </TabsContent>

              <TabsContent value="flags" className="mt-3">
                {template.redFlags.length === 0 ? (
                  <EmptyState icon={Flag} title="No red flags listed" hint="Edit the template to document what gives this phish away." />
                ) : (
                  <ul className="space-y-2">
                    {template.redFlags.map((flag, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Flag className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden="true" />
                        <span>{flag}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="teaching" className="mt-3 space-y-3">
                <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 text-sm leading-relaxed">
                  {template.landingMessage}
                </div>
                <p className="text-xs text-muted-foreground">
                  When a participant clicks a simulated link, the click is intercepted and this
                  scenario-specific page opens. Coaching follows submission or reporting; practice input values never leave the browser.
                </p>
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------- editor form ------------------------------- */

function TemplateEditorDialog({
  open,
  template,
  onClose,
  onSaved,
}: {
  open: boolean;
  template: PhishTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [category, setCategory] = useState(template?.category ?? "");
  const [difficulty, setDifficulty] = useState<Difficulty>(template?.difficulty ?? "easy");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [senderName, setSenderName] = useState(template?.senderName ?? "");
  const [senderEmail, setSenderEmail] = useState(template?.senderEmail ?? "");
  const [bodyHtml, setBodyHtml] = useState(template?.bodyHtml ?? BODY_SHELL);
  const [landingMessage, setLandingMessage] = useState(template?.landingMessage ?? "");
  const [redFlags, setRedFlags] = useState<string[]>(template?.redFlags ?? [""]);
  const [violations, setViolations] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const isEdit = template !== null;

  const submit = async () => {
    setViolations([]);
    const payload: TemplatePayload = {
      name: name.trim(),
      category: category.trim(),
      difficulty,
      subject: subject.trim(),
      senderName: senderName.trim(),
      senderEmail: senderEmail.trim(),
      bodyHtml,
      landingMessage: landingMessage.trim(),
      redFlags: redFlags.map((f) => f.trim()).filter(Boolean),
    };
    const localErrors: string[] = [];
    if (!payload.name) localErrors.push("Template name is required.");
    if (!payload.category) localErrors.push("Category is required.");
    if (!payload.subject) localErrors.push("Subject line is required.");
    if (!payload.senderName) localErrors.push("Sender name is required.");
    if (!payload.senderEmail.includes("@")) localErrors.push("Sender email must be a valid address.");
    if (!payload.bodyHtml.trim()) localErrors.push("Email body HTML is required.");
    if (!payload.landingMessage.trim()) localErrors.push("Teaching moment message is required.");
    if (localErrors.length > 0) {
      setViolations(localErrors);
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await api<{ template: PhishTemplate }>(`/api/templates/${template.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success(`Template "${payload.name}" updated`);
      } else {
        await api<{ template: PhishTemplate }>("/api/templates", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success(`Template "${payload.name}" created`);
      }
      onClose();
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) setViolations(err.violations);
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-xl"
        aria-describedby="tpl-editor-desc"
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit template" : "New phishing template"}</DialogTitle>
          <DialogDescription id="tpl-editor-desc">
            Simulated emails only · the platform never sends real mail or collects credentials.
          </DialogDescription>
        </DialogHeader>

        {violations.length > 0 ? (
          <ul className="list-disc rounded-lg border border-destructive/50 bg-destructive/10 p-3 pl-6 text-xs text-red-400" role="alert">
            {violations.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Name</Label>
            <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="IT: Mailbox quota" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-category">Category</Label>
            <Input id="tpl-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="IT / Finance / HR" />
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
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-subject">Subject</Label>
            <Input id="tpl-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Action required: mailbox full" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-sender-name">Sender name</Label>
            <Input id="tpl-sender-name" value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="ACME IT Service Desk" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-sender-email">Sender email</Label>
            <Input id="tpl-sender-email" type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} placeholder="it-desk@acme-corp.test" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tpl-body">Email body HTML</Label>
          <Textarea
            id="tpl-body"
            rows={8}
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            className="font-mono text-xs"
            spellCheck={false}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tpl-landing">Teaching moment message</Label>
          <Textarea
            id="tpl-landing"
            rows={3}
            value={landingMessage}
            onChange={(e) => setLandingMessage(e.target.value)}
            placeholder="Shown after the participant confirms, reports or leaves the landing page · explain the trick and the safe behavior."
          />
        </div>

        <div className="space-y-2">
          <Label>Red flags</Label>
          {redFlags.map((flag, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                value={flag}
                onChange={(e) => {
                  const next = [...redFlags];
                  next[idx] = e.target.value;
                  setRedFlags(next);
                }}
                placeholder={`Red flag #${idx + 1} · e.g. creates false urgency`}
                aria-label={`Red flag ${idx + 1}`}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove red flag ${idx + 1}`}
                onClick={() => setRedFlags(redFlags.filter((_, i) => i !== idx))}
                disabled={redFlags.length === 1}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRedFlags([...redFlags, ""])}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Add red flag
          </Button>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------- delete button ------------------------------ */

function DeleteTemplateButton({
  template,
  onDeleted,
}: {
  template: PhishTemplate;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      await api<{ ok: boolean }>(`/api/templates/${template.id}`, { method: "DELETE" });
      toast.success(`Template "${template.name}" deleted`);
      onDeleted();
    } catch (err) {
      // e.g. 400 when the template is referenced by campaigns
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete template ${template.name}`}
          className="text-red-400 hover:text-red-300"
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete template?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{template.name}&rdquo; will be removed from the library. Templates already used
            by campaigns cannot be deleted and the server will explain why.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={() => void remove()}
            disabled={busy}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
