import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ensureProfile, fetchGroupData, fetchGroups, fetchPendingInvites, type Job, type Profile, type Score } from "@/lib/data";
import { scoreJob } from "@/lib/scoring.functions";
import { notifyApplied, notifyInvite, notifyNewJob } from "@/lib/notify.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, RefreshCw, Plus, UserPlus, Check, SkipForward, Undo2, Bell, Users, Mail, Sparkles, Copy } from "lucide-react";
import { ReminderModePicker } from "@/components/ReminderModePicker";
import { improveBullets, type BulletTip } from "@/lib/bullets.functions";
import { importJobFromLink } from "@/lib/import-job.functions";

type Filters = { q: string; status: "all" | "todo" | "applied" | "skipped"; minMatch: number; sort: "newest" | "oldest" | "match" | "company" | "role" | "friends" };
const DEFAULT_FILTERS: Filters = { q: "", status: "all", minMatch: 0, sort: "newest" };

function FilterBar({ f, setF }: { f: Filters; setF: (f: Filters) => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border-2 border-foreground bg-card p-3">
      <Input className="w-56" placeholder="Search company or role…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
      <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as Filters["status"] })}>
        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any status</SelectItem>
          <SelectItem value="todo">To apply</SelectItem>
          <SelectItem value="applied">Applied</SelectItem>
          <SelectItem value="skipped">Skipped</SelectItem>
        </SelectContent>
      </Select>
      <Select value={String(f.minMatch)} onValueChange={(v) => setF({ ...f, minMatch: Number(v) })}>
        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="0">Any match</SelectItem>
          <SelectItem value="50">50%+ match</SelectItem>
          <SelectItem value="75">75%+ match</SelectItem>
          <SelectItem value="90">90%+ match</SelectItem>
        </SelectContent>
      </Select>
      <Select value={f.sort} onValueChange={(v) => setF({ ...f, sort: v as Filters["sort"] })}>
        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest posted</SelectItem>
          <SelectItem value="oldest">Oldest posted</SelectItem>
          <SelectItem value="match">Best match</SelectItem>
          <SelectItem value="friends">Most friends applied</SelectItem>
          <SelectItem value="company">Company A–Z</SelectItem>
          <SelectItem value="role">Role A–Z</SelectItem>
        </SelectContent>
      </Select>
      {JSON.stringify(f) !== JSON.stringify(DEFAULT_FILTERS) && (
        <Button size="sm" variant="ghost" onClick={() => setF(DEFAULT_FILTERS)}>Reset</Button>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/board")({
  head: () => ({
    meta: [
      { title: "Your board — Crew Board" },
      { name: "description", content: "Jobs to apply to, your match scores, and who in your crew applied." },
      { property: "og:title", content: "Your board — Crew Board" },
      { property: "og:description", content: "Jobs to apply to, your match scores, and who in your crew applied." },
    ],
  }),
  component: Board,
});

function Board() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const email = user.email ?? "";

  const profileQ = useQuery({ queryKey: ["profile", user.id], queryFn: () => ensureProfile(user.id, email) });
  const groupsQ = useQuery({ queryKey: ["groups", user.id], queryFn: () => fetchGroups(user.id) });
  const invitesQ = useQuery({ queryKey: ["myInvites", email], queryFn: () => fetchPendingInvites(email) });
  const [groupId, setGroupId] = useState<string | null>(null);

  useEffect(() => {
    const gs = groupsQ.data;
    if (!gs) return;
    if (!groupId || !gs.find((g) => g.id === groupId)) setGroupId(gs[0]?.id ?? null);
  }, [groupsQ.data, groupId]);

  useEffect(() => {
    const token = localStorage.getItem("crew-pending-join");
    if (!token) return;
    localStorage.removeItem("crew-pending-join");
    (async () => {
      const { data, error } = await supabase.rpc("join_by_token", { _token: token });
      if (error) { toast.error(error.message); return; }
      await qc.invalidateQueries();
      setGroupId(data as string);
      toast.success("You joined the group!");
    })();
  }, [qc]);

  const profile = profileQ.data;
  if (profile && !profile.onboarded) return <Onboarding profile={profile} />;


  async function acceptInvite(id: string) {
    const { data, error } = await supabase.rpc("accept_invite", { _invite: id });
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries();
    setGroupId(data as string);
    toast.success("You joined the group!");
  }

  async function newGroup() {
    const name = prompt("Group name?");
    if (!name?.trim()) return;
    const { data, error } = await supabase.from("groups").insert({ name: name.trim(), created_by: user.id }).select("id").single();
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["groups"] });
    setGroupId(data.id);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b-2 border-foreground bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/" className="font-display text-xl font-bold">Crew Board</Link>
          {groupsQ.data && groupsQ.data.length > 0 && (
            <Select value={groupId ?? ""} onValueChange={setGroupId}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Pick a group" /></SelectTrigger>
              <SelectContent>
                {groupsQ.data.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button variant="ghost" size="sm" onClick={newGroup}><Plus className="size-4" /> New group</Button>
          <div className="ml-auto flex items-center gap-2">
            {profile && <ReminderModePicker profile={profile} />}
            {groupId && <Link to="/groups/$groupId" params={{ groupId }}><Button variant="ghost" size="sm"><Users className="size-4" /> Manage group</Button></Link>}
            <Link to="/settings"><Button variant="ghost" size="sm"><Mail className="size-4" /> Emails</Button></Link>
            <Link to="/resume"><Button variant="outline" size="sm">My resume</Button></Link>
            <Button variant="ghost" size="sm" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); }}>Sign out</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {(invitesQ.data ?? []).map((inv) => (
          <div key={inv.id} className="mb-4 flex items-center justify-between rounded-xl border-2 border-foreground bg-accent p-4">
            <span className="font-medium">You've been invited to join a group.</span>
            <Button size="sm" onClick={() => acceptInvite(inv.id)}>Accept</Button>
          </div>
        ))}
        {groupsQ.data && groupsQ.data.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-foreground p-10 text-center">
            <h2 className="font-display text-2xl font-bold">No group yet</h2>
            <p className="mt-2 text-muted-foreground">Create one and invite up to 14 friends, or accept an invite above.</p>
            <Button className="mt-4" onClick={newGroup}>Create a group</Button>
          </div>
        )}
        {groupId && profile && <GroupView key={groupId} groupId={groupId} profile={profile} userId={user.id} />}
      </main>
    </div>
  );
}

function GroupView({ groupId, profile, userId }: { groupId: string; profile: Profile; userId: string }) {
  const qc = useQueryClient();
  const notifyApp = useServerFn(notifyApplied);
  const q = useQuery({ queryKey: ["group", groupId], queryFn: () => fetchGroupData(groupId, userId) });
  const [posting, setPosting] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [openJob, setOpenJob] = useState<Job | null>(null);
  const score = useServerFn(scoreJob);
  const [scoring, setScoring] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const attempted = useRef<Set<string>>(new Set());

  const d = q.data;
  const names = useMemo(() => new Map((d?.profiles ?? []).map((p) => [p.id, p.display_name || p.email])), [d]);
  const scoreMap = useMemo(() => new Map((d?.scores ?? []).map((s) => [s.job_id, s])), [d]);

  async function runScore(jobId: string) {
    setScoring((s) => new Set(s).add(jobId));
    const r = await score({ data: { jobId } });
    setScoring((s) => { const n = new Set(s); n.delete(jobId); return n; });
    if ("error" in r && r.error) { toast.error(r.error); return; }
    qc.invalidateQueries({ queryKey: ["group", groupId] });
  }

  // Auto-score new jobs for me (one at a time)
  useEffect(() => {
    if (!d || !profile.resume.trim()) return;
    const next = d.jobs.find((j) => !scoreMap.has(j.id) && !attempted.current.has(j.id));
    if (next && scoring.size === 0) { attempted.current.add(next.id); runScore(next.id); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, scoreMap, scoring.size, profile.resume]);

  if (!d) return <p className="text-muted-foreground">Loading…</p>;

  const myStatus = (jobId: string) => d.applications.find((a) => a.job_id === jobId && a.user_id === userId)?.status;
  const appliedBy = (jobId: string) => d.applications.filter((a) => a.job_id === jobId && a.status === "applied").map((a) => a.user_id);

  async function setStatus(jobId: string, status: "applied" | "skipped" | null) {
    if (status === null) await supabase.from("applications").delete().eq("job_id", jobId).eq("user_id", userId);
    else {
      await supabase.from("applications").upsert({ job_id: jobId, user_id: userId, status, updated_at: new Date().toISOString() });
      if (status === "applied") notifyApp({ data: { id: jobId } }).catch(() => {});
    }
    qc.invalidateQueries({ queryKey: ["group", groupId] });
  }

  const needle = filters.q.trim().toLowerCase();
  const filtered = d.jobs.filter((j) => {
    if (needle && !`${j.company} ${j.role}`.toLowerCase().includes(needle)) return false;
    const s = myStatus(j.id);
    if (filters.status === "todo" && s) return false;
    if (filters.status === "applied" && s !== "applied") return false;
    if (filters.status === "skipped" && s !== "skipped") return false;
    if (filters.minMatch > 0 && (scoreMap.get(j.id)?.score ?? -1) < filters.minMatch) return false;
    return true;
  }).sort((a, b) => {
    switch (filters.sort) {
      case "oldest": return a.created_at.localeCompare(b.created_at);
      case "match": return (scoreMap.get(b.id)?.score ?? -1) - (scoreMap.get(a.id)?.score ?? -1);
      case "friends": return appliedBy(b.id).length - appliedBy(a.id).length;
      case "company": return a.company.localeCompare(b.company);
      case "role": return a.role.localeCompare(b.role);
      default: return b.created_at.localeCompare(a.created_at);
    }
  });
  const toApply = filtered.filter((j) => !myStatus(j.id));
  const applied = filtered.filter((j) => myStatus(j.id) === "applied");
  const skipped = filtered.filter((j) => myStatus(j.id) === "skipped");
  const groupSorted = filtered;
  const seats = d.memberIds.length + d.pendingInvites.length;

  const card = (j: Job) => (
    <JobCard
      key={j.id}
      job={j}
      score={scoreMap.get(j.id)}
      scoring={scoring.has(j.id)}
      hasResume={!!profile.resume.trim()}
      status={myStatus(j.id)}
      appliedNames={appliedBy(j.id).filter((u) => u !== userId).map((u) => names.get(u) ?? "someone")}
      onOpen={() => setOpenJob(j)}
      onStatus={(s) => setStatus(j.id, s)}
      onRegrade={() => runScore(j.id)}
    />
  );

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button onClick={() => setPosting(true)}><Plus className="size-4" /> Post a job</Button>
        <Button variant="outline" onClick={() => setInviting(true)} disabled={seats >= 15}>
          <UserPlus className="size-4" /> Invite ({seats}/15)
        </Button>
        {!profile.resume.trim() && (
          <Link to="/resume" className="text-sm underline">Add your resume to get match scores →</Link>
        )}
      </div>

      <FilterBar f={filters} setF={setFilters} />
      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">My board</TabsTrigger>
          <TabsTrigger value="group">Group board</TabsTrigger>
        </TabsList>
        <TabsContent value="mine" className="mt-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Column title={`To apply (${toApply.length})`}>{toApply.map(card)}</Column>
            <Column title={`Applied (${applied.length})`}>{applied.map(card)}</Column>
          </div>
          {skipped.length > 0 && (filters.status === "skipped" || filters.status === "all") && (
            <div className="mt-6"><Column title={`Skipped (${skipped.length})`}>{skipped.map(card)}</Column></div>
          )}
        </TabsContent>
        <TabsContent value="group" className="mt-4">
          <div className="space-y-3">
            {groupSorted.length === 0 && <p className="text-muted-foreground">{d.jobs.length ? "No jobs match these filters." : "No jobs yet — post the first one!"}</p>}
            {groupSorted.map((j) => {
              const who = appliedBy(j.id);
              const mine = myStatus(j.id);
              return (
                <div key={j.id} className="flex flex-wrap items-center gap-4 rounded-xl border-2 border-foreground bg-card p-4">
                  <button className="min-w-0 flex-1 text-left" onClick={() => setOpenJob(j)}>
                    <div className="font-display text-lg font-bold">{j.role}</div>
                    <div className="text-sm text-muted-foreground">{j.company} · posted by {names.get(j.posted_by) ?? "someone"}</div>
                  </button>
                  <div className="flex flex-wrap gap-1.5">
                    {who.length === 0 && <span className="text-sm text-muted-foreground">No one yet</span>}
                    {who.map((u) => (
                      <span key={u} className="rounded-full bg-success px-2.5 py-0.5 text-xs font-semibold text-success-foreground">
                        ✓ {u === userId ? "You" : names.get(u)}
                      </span>
                    ))}
                  </div>
                  {!mine && who.length > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">
                      <Bell className="size-3" /> Your turn!
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      <PostJobDialog open={posting} onOpenChange={setPosting} groupId={groupId} userId={userId} />
      <InviteDialog open={inviting} onOpenChange={setInviting} groupId={groupId} userId={userId} pending={d.pendingInvites} />
      <JobDialog
        job={openJob}
        onClose={() => setOpenJob(null)}
        score={openJob ? scoreMap.get(openJob.id) : undefined}
        scoring={openJob ? scoring.has(openJob.id) : false}
        onRegrade={() => openJob && runScore(openJob.id)}
      />
    </>
  );
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  const arr = Array.isArray(children) ? children : [children];
  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-bold">{title}</h2>
      <div className="space-y-3">{arr.length ? children : <p className="text-sm text-muted-foreground">Nothing here.</p>}</div>
    </section>
  );
}

export function ScoreBadge({ score, scoring }: { score?: Score | undefined; scoring?: boolean | undefined }) {
  if (scoring) return <span className="rounded-lg border-2 border-foreground px-2 py-1 text-xs font-bold">Scoring…</span>;
  if (!score) return <span className="rounded-lg border-2 border-dashed border-muted-foreground px-2 py-1 text-xs text-muted-foreground">No score</span>;
  const tone = score.score >= 75 ? "bg-success text-success-foreground" : score.score >= 50 ? "bg-accent text-accent-foreground" : "bg-destructive text-destructive-foreground";
  return <span className={`rounded-lg border-2 border-foreground px-2 py-1 font-display text-sm font-bold ${tone}`}>{score.score}%</span>;
}

function JobCard(props: {
  job: Job; score?: Score | undefined; scoring: boolean; hasResume: boolean; status?: "applied" | "skipped" | undefined;
  appliedNames: string[]; onOpen: () => void; onStatus: (s: "applied" | "skipped" | null) => void; onRegrade: () => void;
}) {
  const { job, status } = props;
  return (
    <div className="rounded-xl border-2 border-foreground bg-card p-4 shadow-[var(--shadow-pop)]">
      <div className="flex items-start justify-between gap-3">
        <button onClick={props.onOpen} className="min-w-0 text-left">
          <div className="font-display text-lg font-bold leading-tight">{job.role}</div>
          <div className="text-sm text-muted-foreground">{job.company}</div>
        </button>
        <ScoreBadge score={props.score} scoring={props.scoring} />
      </div>
      {props.appliedNames.length > 0 && (
        <p className="mt-2 text-sm"><span className="font-semibold">Applied:</span> {props.appliedNames.join(", ")}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {!status && <Button size="sm" onClick={() => props.onStatus("applied")}><Check className="size-4" /> I applied</Button>}
        {!status && <Button size="sm" variant="ghost" onClick={() => props.onStatus("skipped")}><SkipForward className="size-4" /> Skip</Button>}
        {status && <Button size="sm" variant="ghost" onClick={() => props.onStatus(null)}><Undo2 className="size-4" /> Undo</Button>}
        {props.hasResume && (
          <Button size="sm" variant="outline" onClick={props.onRegrade} disabled={props.scoring}>
            <RefreshCw className={`size-4 ${props.scoring ? "animate-spin" : ""}`} /> Re-grade
          </Button>
        )}
        {job.link && (
          <a href={job.link} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost"><ExternalLink className="size-4" /> Open</Button></a>
        )}
      </div>
    </div>
  );
}

function JobDialog({ job, onClose, score, scoring, onRegrade }: { job: Job | null; onClose: () => void; score?: Score | undefined; scoring: boolean; onRegrade: () => void }) {
  return (
    <Dialog open={!!job} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        {job && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">{job.role} · {job.company}</DialogTitle>
            </DialogHeader>
            <ScoreDetails score={score} scoring={scoring} onRegrade={onRegrade} />
            <BulletImprover key={job.id} jobId={job.id} />
            {job.notes && <p className="rounded-lg bg-muted p-3 text-sm">{job.notes}</p>}
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{job.description}</div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

const PRIORITY_TONE = { high: "bg-primary text-primary-foreground", medium: "bg-accent text-accent-foreground", low: "bg-muted text-muted-foreground" };

function BulletImprover({ jobId }: { jobId: string }) {
  const run = useServerFn(improveBullets);
  const [busy, setBusy] = useState(false);
  const [tips, setTips] = useState<BulletTip[] | null>(null);
  const [custom, setCustom] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  async function go() {
    setBusy(true);
    const r = await run({ data: { jobId, resume: custom.trim() || null } });
    setBusy(false);
    if ("error" in r && r.error) { toast.error(r.error); return; }
    if ("bullets" in r) setTips(r.bullets);
  }
  return (
    <div className="rounded-xl border-2 border-foreground p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">ATS bullet improvements</span>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setShowCustom((s) => !s)}>{showCustom ? "Use my saved resume" : "Paste a different resume"}</Button>
          <Button size="sm" onClick={go} disabled={busy}><Sparkles className={`size-4 ${busy ? "animate-pulse" : ""}`} /> {busy ? "Writing…" : tips ? "Regenerate" : "Improve my bullets"}</Button>
        </div>
      </div>
      {showCustom && <Textarea className="mt-3" rows={5} placeholder="Paste the resume to tailor for this job…" value={custom} onChange={(e) => setCustom(e.target.value)} />}
      {tips && (
        <ol className="mt-3 space-y-3 text-sm">
          {tips.map((t, i) => (
            <li key={i} className="rounded-lg bg-muted/50 p-3">
              <div className="mb-1 flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${PRIORITY_TONE[t.priority]}`}>{t.priority}</span>
                <span className="text-xs text-muted-foreground">{t.why}</span>
                <button className="ml-auto text-muted-foreground hover:text-foreground" aria-label="Copy bullet"
                  onClick={() => { navigator.clipboard.writeText(t.improved); toast.success("Copied"); }}><Copy className="size-4" /></button>
              </div>
              {t.original && <p className="text-muted-foreground line-through">{t.original}</p>}
              <p className="font-medium">{t.improved}</p>
              {t.keywords.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{t.keywords.map((k) => <span key={k} className="rounded-md bg-success/20 px-1.5 py-0.5 text-xs">{k}</span>)}</div>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function ScoreDetails({ score, scoring, onRegrade }: { score?: Score | undefined; scoring: boolean; onRegrade: () => void }) {
  return (
    <div className="rounded-xl border-2 border-foreground p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ScoreBadge score={score} scoring={scoring} />
          <span className="font-semibold">ATS match</span>
        </div>
        <Button size="sm" variant="outline" onClick={onRegrade} disabled={scoring}>
          <RefreshCw className={`size-4 ${scoring ? "animate-spin" : ""}`} /> Re-grade
        </Button>
      </div>
      {score && (
        <div className="mt-3 space-y-3 text-sm">
          {score.suggestions.length > 0 && (
            <ul className="list-disc space-y-1 pl-5">{score.suggestions.map((s) => <li key={s}>{s}</li>)}</ul>
          )}
          <KeywordRow label="Missing" items={score.missing} cls="bg-destructive/15 text-foreground" />
          <KeywordRow label="Matched" items={score.matched} cls="bg-success/20 text-foreground" />
        </div>
      )}
    </div>
  );
}

function KeywordRow({ label, items, cls }: { label: string; items: string[]; cls: string }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1.5">{items.map((k) => <span key={k} className={`rounded-md px-2 py-0.5 text-xs ${cls}`}>{k}</span>)}</div>
    </div>
  );
}

function PostJobDialog({ open, onOpenChange, groupId, userId }: { open: boolean; onOpenChange: (o: boolean) => void; groupId: string; userId: string }) {
  const qc = useQueryClient();
  const notifyJob = useServerFn(notifyNewJob);
  const [f, setF] = useState({ company: "", role: "", description: "", link: "", notes: "" });
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data: created, error } = await supabase.from("jobs").insert({
      group_id: groupId, posted_by: userId, company: f.company.trim(), role: f.role.trim(),
      description: f.description.trim(), link: f.link.trim() || null, notes: f.notes.trim() || null,
    }).select("id").single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    notifyJob({ data: { id: created.id } }).catch(() => {});
    toast.success("Job posted to the group!");
    setF({ company: "", role: "", description: "", link: "", notes: "" });
    onOpenChange(false);
    qc.invalidateQueries({ queryKey: ["group", groupId] });
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const importJob = useServerFn(importJobFromLink);
  const [fetching, setFetching] = useState(false);
  async function fetchFromLink(url: string) {
    if (!/^https?:\/\//.test(url.trim())) return;
    setFetching(true);
    const r = await importJob({ data: { url: url.trim() } });
    setFetching(false);
    if ("error" in r && r.error) { toast.error(r.error); return; }
    if ("ok" in r) {
      setF((cur) => ({ ...cur, link: url.trim(), company: r.company || cur.company, role: r.role || cur.role, description: r.description || cur.description }));
      toast.success("Job details filled in — check and post!");
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-2xl">Post a job</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label>Job link</Label>
            <div className="flex gap-2">
              <Input type="url" placeholder="Paste the job link — we'll fill in the rest" value={f.link} onChange={set("link")}
                onPaste={(e) => { const t = e.clipboardData.getData("text"); setTimeout(() => fetchFromLink(t), 0); }} />
              <Button type="button" variant="outline" disabled={fetching || !f.link} onClick={() => fetchFromLink(f.link)}>
                <Sparkles className={`size-4 ${fetching ? "animate-pulse" : ""}`} /> {fetching ? "Reading…" : "Fill"}
              </Button>
            </div>
            {fetching && <p className="text-xs text-muted-foreground">Reading the job post… this takes a few seconds.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Company</Label><Input required value={f.company} onChange={set("company")} /></div>
            <div className="space-y-1"><Label>Role</Label><Input required value={f.role} onChange={set("role")} /></div>
          </div>
          <div className="space-y-1"><Label>Job description</Label><Textarea required rows={8} placeholder="Filled in from the link, or paste the full JD…" value={f.description} onChange={set("description")} /></div>
          <div className="space-y-1"><Label>Notes (optional)</Label><Input value={f.notes} onChange={set("notes")} /></div>
          <Button className="w-full" disabled={busy}>Post & notify group</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InviteDialog({ open, onOpenChange, groupId, userId, pending }: { open: boolean; onOpenChange: (o: boolean) => void; groupId: string; userId: string; pending: { id: string; email: string }[] }) {
  const qc = useQueryClient();
  const sendInvite = useServerFn(notifyInvite);
  const [email, setEmail] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { data: inv, error } = await supabase.from("invites").insert({ group_id: groupId, email: email.trim().toLowerCase(), invited_by: userId }).select("id").single();
    if (inv) sendInvite({ data: { id: inv.id } }).catch(() => {});
    if (error) { toast.error(error.message.includes("duplicate") ? "Already invited." : error.message); return; }
    toast.success("Invite added — they'll see it when they sign in with that email.");
    setEmail("");
    qc.invalidateQueries({ queryKey: ["group", groupId] });
  }
  async function revoke(id: string) {
    await supabase.from("invites").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["group", groupId] });
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display text-2xl">Invite a friend</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="flex gap-2">
          <Input type="email" required placeholder="friend@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button>Invite</Button>
        </form>
        {pending.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase text-muted-foreground">Pending</div>
            {pending.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span>{p.email}</span>
                <button className="text-muted-foreground underline" onClick={() => revoke(p.id)}>Remove</button>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Groups hold up to 15 people, including pending invites.</p>
      </DialogContent>
    </Dialog>
  );
}

function Onboarding({ profile }: { profile: Profile }) {
  const qc = useQueryClient();
  const [name, setName] = useState(profile.display_name);
  const [resume, setResume] = useState(profile.resume);
  const [mode, setMode] = useState<Profile["reminder_mode"]>(profile.reminder_mode);
  async function save() {
    const { error } = await supabase.from("profiles").update({ display_name: name.trim() || profile.email, resume, reminder_mode: mode, onboarded: true }).eq("id", profile.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["profile"] });
  }
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-xl space-y-5 rounded-2xl border-2 border-foreground bg-card p-8 shadow-[var(--shadow-pop)]">
        <h1 className="font-display text-3xl font-bold">Set up your profile</h1>
        <div className="space-y-1"><Label>Your name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1"><Label>Your resume (paste text)</Label><Textarea rows={8} value={resume} onChange={(e) => setResume(e.target.value)} placeholder="Paste your primary resume — used for ATS match scores." /></div>
        <div className="space-y-2">
          <Label>How much nudging do you want?</Label>
          <ModeOptions value={mode} onChange={setMode} />
        </div>
        <Button className="w-full" onClick={save}>Let's go</Button>
      </div>
    </div>
  );
}

export const MODES: { id: Profile["reminder_mode"]; title: string; desc: string }[] = [
  { id: "easy", title: "Easy", desc: "A digest of new jobs 2–3 times a day." },
  { id: "medium", title: "Medium", desc: "An email for every new job posted." },
  { id: "hard", title: "Hard", desc: "Every new job + each time a friend applies before you." },
];

export function ModeOptions({ value, onChange }: { value: Profile["reminder_mode"]; onChange: (m: Profile["reminder_mode"]) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {MODES.map((m) => (
        <button key={m.id} type="button" onClick={() => onChange(m.id)}
          className={`rounded-xl border-2 p-3 text-left transition ${value === m.id ? "border-foreground bg-primary text-primary-foreground" : "border-border hover:border-foreground"}`}>
          <div className="font-display font-bold">{m.title}</div>
          <div className="text-xs opacity-80">{m.desc}</div>
        </button>
      ))}
    </div>
  );
}
