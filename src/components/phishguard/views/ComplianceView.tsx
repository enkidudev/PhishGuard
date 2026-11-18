"use client";

// PhishGuard · Compliance: built-in safeguards, consent management, sender
// domain allowlist, retention policy, and the administrative audit trail.

import { useState } from "react";
import { format } from "date-fns";
import {
  DatabaseBackup,
  Download,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  Shield,
  Trash2,
  UserPlus,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { api, apiErrorMessage, exportCsvUrl, purgeRetention } from "../api";
import type { Participant } from "../api";
import { useCompliance, useParticipants } from "../hooks";
import { EmptyState, ErrorState, SectionTitle, relativeTime, shortDateTime } from "../shared";

const SAFEGUARDS: { title: string; detail: string }[] = [
  {
    title: "No credential collection",
    detail:
      "Practice fields are browser-only, cleared on submit or exit, and never included in tracking. Use invented values, never real credentials.",
  },
  {
    title: "No real email delivery",
    detail: "All delivery is simulated in-platform; nothing ever reaches a real mail server.",
  },
  {
    title: "Explicit consent required",
    detail: "Participants must record consent before they can be enrolled in any campaign.",
  },
  {
    title: "Approved simulation domains",
    detail: "Campaign launches are rejected unless both sender and participant domains are approved.",
  },
  {
    title: "Retention with auto-purge",
    detail: "A sweep runs every minute while the service is running. Expired participation, events, training attempts and audit records are removed.",
  },
  {
    title: "Full audit trail",
    detail: "Campaign launches, consent changes and policy edits are logged with actor attribution. This is an application audit trail, not tamper-proof storage.",
  },
  {
    title: "Small-group suppression",
    detail: "Departments with fewer than 3 participants are hidden in analytics to protect privacy.",
  },
];

function auditBadgeClass(action: string): string {
  if (action === "CAMPAIGN_LAUNCHED" || action === "CONSENT_RECORDED")
    return "border-emerald-500/40 bg-emerald-500/15 text-emerald-400";
  if (action === "DOMAIN_APPROVED")
    return "border-teal-500/40 bg-teal-500/15 text-teal-400";
  if (action === "TEMPLATE_CREATED" || action === "RETENTION_POLICY")
    return "border-amber-500/40 bg-amber-500/15 text-amber-400";
  return "border-zinc-500/40 bg-zinc-500/15 text-zinc-400";
}

export default function ComplianceView() {
  const { data, loading, error, refresh } = useCompliance();
  const { data: participantsData, refresh: refreshParticipants } = useParticipants();
  const participants = participantsData?.participants ?? [];
  const participantById = new Map(participants.map((p) => [p.id, p]));

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Governance & compliance"
        icon={ShieldCheck}
        description="Everything in PhishGuard is bounded by explicit safeguards you can audit in real time."
      />

      {/* Built-in safeguards */}
      <Card className="rounded-xl p-4 sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <Shield className="size-4 text-emerald-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold">Built-in safeguards</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {SAFEGUARDS.map((s) => (
            <div key={s.title} className="flex items-start gap-2.5 rounded-lg border p-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">{s.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{s.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {error && !data ? (
        <ErrorState message={error} onRetry={() => void refresh()} />
      ) : loading && !data ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : data ? (
        <Tabs defaultValue="consent">
          <TabsList className="flex-wrap">
            <TabsTrigger value="consent">Consent</TabsTrigger>
            <TabsTrigger value="domains">Sender domains</TabsTrigger>
            <TabsTrigger value="retention">Retention</TabsTrigger>
            <TabsTrigger value="audit">Audit log</TabsTrigger>
          </TabsList>

          {/* ------------------------------- Consent ------------------------------- */}
          <TabsContent value="consent" className="mt-4 space-y-4">
            <ConsentTab
              consent={data.consent}
              participantById={participantById}
              onChanged={() => {
                void refresh();
                void refreshParticipants();
              }}
            />
          </TabsContent>

          {/* ------------------------------- Domains ------------------------------- */}
          <TabsContent value="domains" className="mt-4 space-y-4">
            <DomainsTab domains={data.domains} onChanged={() => void refresh()} />
          </TabsContent>

          {/* ------------------------------ Retention ------------------------------ */}
          <TabsContent value="retention" className="mt-4 space-y-4">
            <RetentionTab retention={data.retention} onChanged={() => void refresh()} />
          </TabsContent>

          {/* ------------------------------- Audit log ------------------------------ */}
          <TabsContent value="audit" className="mt-4 space-y-4">
            <Card className="rounded-xl p-4 sm:p-6">
              {data.audit.length === 0 ? (
                <EmptyState icon={Shield} title="No audit entries yet" hint="Administrative actions will appear here." />
              ) : (
                <div className="max-h-96 overflow-y-auto rounded-lg border">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Actor</TableHead>
                        <TableHead>Detail</TableHead>
                        <TableHead className="text-right">When</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.audit.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${auditBadgeClass(entry.action)}`}>
                              {entry.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{entry.actor}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{entry.detail}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {relativeTime(entry.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}

/* ------------------------------ consent tab ------------------------------ */

function ConsentTab({
  consent,
  participantById,
  onChanged,
}: {
  consent: { id: string; name: string; email: string; department: string; consented: boolean; consentedAt: string | null }[];
  participantById: Map<string, Participant>;
  onChanged: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const setConsent = async (id: string, consented: boolean) => {
    setPendingId(id);
    try {
      await api<{ participant: Participant }>(`/api/participants/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ consented }),
      });
      toast.success(consented ? "Consent recorded" : "Consent withdrawn");
      onChanged();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setPendingId(null);
    }
  };

  const toggleActive = async (p: Participant) => {
    try {
      await api<{ participant: Participant }>(`/api/participants/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !p.active }),
      });
      toast.success(`${p.name} ${p.active ? "deactivated" : "reactivated"}`);
      onChanged();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <Card className="rounded-xl p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Participant consent</h2>
          <p className="text-xs text-muted-foreground">
            Enrollment requires consent. Participants grant consent through their invitation. Withdrawal immediately blocks further interactions.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <UserPlus className="size-4" aria-hidden="true" />
          Add participant
        </Button>
      </div>

      {inviteUrl && <div className="mb-4 rounded-xl border border-emerald-700 bg-emerald-950/30 p-4"><p className="mb-2 text-sm font-medium">Private, single-use invitation · expires in 24 hours</p><p className="mb-2 text-xs text-muted-foreground">Open in a separate browser profile to demonstrate participant isolation. Share only with the intended authorized participant.</p><Input aria-label="Participant invitation" readOnly value={inviteUrl} onFocus={e=>e.target.select()}/></div>}
      {consent.length === 0 ? (
        <EmptyState icon={UserPlus} title="No participants yet" hint="Add your first participant to get started." />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Consent</TableHead>
                <TableHead>Recorded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consent.map((row) => {
                const full = participantById.get(row.id);
                return (
                  <TableRow key={row.id} className={full && !full.active ? "opacity-60" : ""}>
                    <TableCell>
                      <div className="text-sm font-medium">{row.name}</div>
                      {full && !full.active ? (
                        <Badge variant="outline" className="mt-1 text-[10px] text-muted-foreground">
                          deactivated
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.email}</TableCell>
                    <TableCell className="text-xs">{row.department}</TableCell>
                    <TableCell>
                      <Switch
                        checked={row.consented}
                        disabled={pendingId === row.id || !row.consented}
                        onCheckedChange={(v) => void setConsent(row.id, v)}
                        aria-label={`Consent for ${row.name}`}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.consented && row.consentedAt
                        ? format(new Date(row.consentedAt), "MMM d, yyyy")
                        : "–"}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${row.name}`}>
                            <MoreHorizontal className="size-4" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem disabled={!full?.active} onClick={async()=>{try{const r=await api<{url:string}>("/api/invitations",{method:"POST",body:JSON.stringify({participantId:row.id})});setInviteUrl(r.url);}catch(e){toast.error(apiErrorMessage(e));}}}>Create participant invitation</DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => full && void toggleActive(full)}
                            disabled={!full}
                          >
                            {full?.active ? "Deactivate participant" : "Reactivate participant"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {addOpen ? (
        <AddParticipantDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onSaved={onChanged}
        />
      ) : null}
    </Card>
  );
}

function AddParticipantDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [consented, setConsented] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim() || !email.trim() || !department.trim()) {
      toast.error("Name, email and department are required.");
      return;
    }
    setSaving(true);
    try {
      await api<{ participant: Participant }>("/api/participants", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          department: department.trim(),
          consented,
        }),
      });
      toast.success(`${name.trim()} added`);
      onClose();
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-xl" aria-describedby="add-participant-desc">
        <DialogHeader>
          <DialogTitle>Add participant</DialogTitle>
          <DialogDescription id="add-participant-desc">
            People are enrolled in simulations only after they record consent.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Full name</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Lee" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-email">Work email</Label>
            <Input
              id="p-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jordan.lee@acme-corp.test"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-dept">Department</Label>
            <Input id="p-dept" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Finance" />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="p-consent"
              checked={false} disabled
              onCheckedChange={(v) => setConsented(v === true)}
              aria-label="Consent recorded now"
            />
            <Label htmlFor="p-consent" className="text-sm font-normal">
              Participant will consent through their private invitation.
            </Label>
          </div>
        </div>
        <DialogFooter className="border-t pt-4">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? "Adding…" : "Add participant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ domains tab ------------------------------ */

function DomainsTab({
  domains,
  onChanged,
}: {
  domains: { id: string; domain: string; approvedBy: string; createdAt: string }[];
  onChanged: () => void;
}) {
  const [domain, setDomain] = useState("");
  const [approvedBy, setApprovedBy] = useState("security.admin@acme-corp.test");
  const [busy, setBusy] = useState(false);

  const addDomain = async () => {
    const d = domain.trim().toLowerCase();
    if (!d || !d.includes(".")) {
      toast.error("Enter a valid domain, e.g. portal.acme-corp.test");
      return;
    }
    setBusy(true);
    try {
      await api<{ domain: unknown }>("/api/compliance/domains", {
        method: "POST",
        body: JSON.stringify({ domain: d, approvedBy: approvedBy.trim() }),
      });
      toast.success(`Domain ${d} approved`);
      setDomain("");
      onChanged();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string, d: string) => {
    try {
      await api<{ ok: boolean }>(`/api/compliance/domains/${id}`, { method: "DELETE" });
      toast.success(`Domain ${d} revoked`);
      onChanged();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card className="rounded-xl p-4 sm:p-6">
        <h2 className="text-sm font-semibold">Approved sender domains</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Campaign launches are rejected when the template sender domain is not on this allowlist.
        </p>
        {domains.length === 0 ? (
          <EmptyState icon={Shield} title="No approved domains" hint="Approve a sender domain to allow launches." className="mt-3" />
        ) : (
          <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
            {domains.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm font-medium">{d.domain}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    approved by <span className="font-mono">{d.approvedBy}</span> ·{" "}
                    {format(new Date(d.createdAt), "MMM d, yyyy")}
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-red-400 hover:text-red-300">
                      Revoke
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Revoke {d.domain}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Campaigns using templates from this domain can no longer be launched.
                        Existing campaigns are unaffected.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-white hover:bg-destructive/90"
                        onClick={() => void revoke(d.id, d.domain)}
                      >
                        Revoke domain
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="h-fit rounded-xl p-4 sm:p-6">
        <h2 className="text-sm font-semibold">Approve a domain</h2>
        <div className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="dom-domain">Domain</Label>
            <Input
              id="dom-domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="portal.acme-corp.test"
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dom-approver">Approved by</Label>
            <Input
              id="dom-approver"
              value={approvedBy}
              onChange={(e) => setApprovedBy(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
          <Button className="w-full" onClick={() => void addDomain()} disabled={busy}>
            <Plus className="size-4" aria-hidden="true" />
            {busy ? "Approving…" : "Approve domain"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ----------------------------- retention tab ----------------------------- */

function RetentionTab({
  retention,
  onChanged,
}: {
  retention: {
    defaultRetentionDays: number;
    autoPurge: boolean;
    totalEvents: number;
    oldestEventAt: string | null;
  };
  onChanged: () => void;
}) {
  const [days, setDays] = useState(String(retention.defaultRetentionDays));
  const [autoPurge, setAutoPurge] = useState(retention.autoPurge);
  const [saving, setSaving] = useState(false);
  const [purging, setPurging] = useState(false);

  const oldestAgeDays = retention.oldestEventAt
    ? Math.max(
        0,
        Math.floor((Date.now() - new Date(retention.oldestEventAt).getTime()) / 86_400_000)
      )
    : null;

  const save = async () => {
    const n = Number.parseInt(days, 10);
    if (!Number.isFinite(n) || n < 1 || n > 365) {
      toast.error("Retention must be between 1 and 365 days.");
      return;
    }
    setSaving(true);
    try {
      await api<{ retention: unknown }>("/api/compliance/retention", {
        method: "PATCH",
        body: JSON.stringify({ defaultRetentionDays: n, autoPurge }),
      });
      toast.success("Retention policy saved");
      onChanged();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const runPurge = async () => {
    setPurging(true);
    try {
      const res = await purgeRetention();
      toast.success(`${res.purged} event${res.purged === 1 ? "" : "s"} removed`, {
        description: `Cutoff ${shortDateTime(res.cutoffAt)} · auto-purge ${res.autoPurge ? "enabled" : "disabled"}`,
      });
      onChanged();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="space-y-4">
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="rounded-xl p-4 sm:p-6">
        <h2 className="text-sm font-semibold">Retention policy</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Applies to simulated events (deliveries, opens, clicks, reports) across all campaigns.
        </p>
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ret-days">Default retention (days)</Label>
            <Input
              id="ret-days"
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="ret-purge"
              checked={autoPurge}
              onCheckedChange={setAutoPurge}
              aria-label="Auto purge"
            />
            <Label htmlFor="ret-purge" className="text-sm font-normal">
              Auto-purge events after the retention window
            </Label>
          </div>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save policy"}
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="rounded-xl p-4 sm:p-6">
          <h2 className="text-sm font-semibold">Current data footprint</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tracked simulated events</dt>
              <dd className="font-semibold tabular-nums">{retention.totalEvents}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Oldest event age</dt>
              <dd className="font-semibold tabular-nums">
                {oldestAgeDays === null ? "no events yet" : `${oldestAgeDays} days`}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Auto-purge</dt>
              <dd className={autoPurge ? "font-semibold text-emerald-400" : "font-semibold text-amber-400"}>
                {autoPurge ? "enabled" : "disabled"}
              </dd>
            </div>
          </dl>
        </Card>
        <div
          role="note"
          className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4"
        >
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-red-400" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-red-200/90">
            Events older than the retention window are permanently purged. This cannot be undone –
            exports should be taken before reducing the window.
          </p>
        </div>
      </div>
    </div>

    <Card className="rounded-xl p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <DatabaseBackup className="size-4 text-teal-400" aria-hidden="true" />
        <h2 className="text-sm font-semibold">Data export &amp; retention purge</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Take the audit trail with you (CSV download), or trigger the retention purge ahead of
        schedule. Exports include consent, delivery and reporting events only · never credential
        values (there are none to include).
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["participants", "events", "campaigns"] as const).map((entity) => (
          <a key={entity} href={exportCsvUrl(entity)} download={`${entity}.csv`}>
            <Button variant="outline" size="sm">
              <Download className="size-3.5" aria-hidden="true" />
              Export {entity}
            </Button>
          </a>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
          Running the purge removes every simulated event older than the current retention window
          ({retention.defaultRetentionDays} days) immediately.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={purging}>
              <Trash2 className="size-4" aria-hidden="true" />
              {purging ? "Purging…" : "Run retention purge now"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Run retention purge now?</AlertDialogTitle>
              <AlertDialogDescription>
                All simulated events older than {retention.defaultRetentionDays} days will be
                permanently deleted. This cannot be undone · export first if you need the history.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => void runPurge()}
                disabled={purging}
              >
                Purge now
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Card>
    </div>
  );
}
