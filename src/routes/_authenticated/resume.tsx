import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ensureProfile, fetchGroups, type SavedResume } from "@/lib/data";
import { scoreJob } from "@/lib/scoring.functions";
import { deleteResumeVersion, updateResumeVersion } from "@/lib/resumes.functions";
import { Button, buttonVariants } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { RefreshCw, Save, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/resume")({
  head: () => ({
    meta: [
      { title: "My resume — Crew Board" },
      { name: "description", content: "Edit your resume and re-grade your ATS match for every job." },
      { property: "og:title", content: "My resume — Crew Board" },
      { property: "og:description", content: "Edit your resume and re-grade your ATS match for every job." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://buddy-job-board.lovable.app/resume" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://buddy-job-board.lovable.app/resume" }],
  }),
  component: ResumePage,
});

function ResumePage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const profileQ = useQuery({ queryKey: ["profile", user.id], queryFn: () => ensureProfile(user.id, user.email ?? "") });
  const savedQ = useQuery({
    queryKey: ["saved-resumes", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("saved_resumes").select("*").eq("user_id", user.id).order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SavedResume[];
    },
  });
  const [resume, setResume] = useState("");
  const [name, setName] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SavedResume | null>(null);
  const [deleting, setDeleting] = useState(false);
  const score = useServerFn(scoreJob);
  const updateSaved = useServerFn(updateResumeVersion);
  const deleteSaved = useServerFn(deleteResumeVersion);

  useEffect(() => {
    if (profileQ.data) { setResume(profileQ.data.resume); setName(profileQ.data.display_name); }
  }, [profileQ.data]);

  async function save() {
    const { error } = await supabase.from("profiles").update({ resume, display_name: name }).eq("id", user.id);
    if (error) { toast.error(error.message); return false; }
    await qc.invalidateQueries({ queryKey: ["profile"] });
    return true;
  }

  async function saveAndRegradeAll() {
    if (!(await save())) return;
    const groups = await fetchGroups(user.id);
    const { data: jobs } = groups.length
      ? await supabase.from("jobs").select("id").in("group_id", groups.map((g) => g.id))
      : { data: [] as { id: string }[] };
    const list = jobs ?? [];
    setProgress({ done: 0, total: list.length });
    for (let i = 0; i < list.length; i++) {
      const job = list[i];
      if (!job) continue;
      const r = await score({ data: { jobId: job.id } });
      if ("error" in r && r.error) { toast.error(r.error); break; }
      setProgress({ done: i + 1, total: list.length });
    }
    setProgress(null);
    qc.invalidateQueries({ queryKey: ["group"] });
    toast.success("All jobs re-graded!");
  }

  async function saveSavedVersion(id: string, nextResume: string) {
    const r = await updateSaved({ data: { id, resume: nextResume } });
    if ("error" in r && r.error) { toast.error(r.error); return; }
    await qc.invalidateQueries({ queryKey: ["saved-resumes", user.id] });
    await qc.invalidateQueries({ queryKey: ["group"] });
    toast.success("Resume version saved");
  }

  async function removeSavedVersion(id: string) {
    if (!pendingDelete) return;
    setDeleting(true);
    const r = await deleteSaved({ data: { id } });
    setDeleting(false);
    if ("error" in r && r.error) { toast.error(r.error); return; }
    await qc.invalidateQueries({ queryKey: ["saved-resumes", user.id] });
    await qc.invalidateQueries({ queryKey: ["group"] });
    setPendingDelete(null);
    toast.success("Resume version deleted");
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link to="/board" className="text-sm underline">← Back to board</Link>
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <h1 className="font-display text-4xl font-bold">My resume</h1>
            <p className="mt-1 text-muted-foreground">Primary resume plus saved versions for each company and role.</p>
          </div>
          <Button onClick={saveAndRegradeAll} disabled={!!progress || !resume.trim()}>
            <RefreshCw className={`size-4 ${progress ? "animate-spin" : ""}`} />
            {progress ? `Re-grading ${progress.done}/${progress.total}…` : "Save & re-grade all"}
          </Button>
        </div>
        <div className="mt-6 space-y-5">
          <section className="rounded-xl border-2 border-foreground bg-card p-4 shadow-[var(--shadow-pop)]">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="space-y-1"><Label>Display name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <Button variant="outline" onClick={async () => (await save()) && toast.success("Saved")}><Save className="size-4" /> Save</Button>
            </div>
          </section>

          <Accordion type="single" collapsible className="rounded-xl border-2 border-foreground bg-card px-4 shadow-[var(--shadow-pop)]">
            <AccordionItem value="primary" className="border-b-0">
              <AccordionTrigger className="font-display text-lg font-bold hover:no-underline">Primary resume</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  <Textarea rows={14} value={resume} onChange={(e) => setResume(e.target.value)} />
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={async () => (await save()) && toast.success("Saved")}><Save className="size-4" /> Save primary</Button>
                    <Button onClick={saveAndRegradeAll} disabled={!!progress || !resume.trim()}>
                      <RefreshCw className={`size-4 ${progress ? "animate-spin" : ""}`} />
                      {progress ? `Re-grading ${progress.done}/${progress.total}…` : "Save & re-grade all"}
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <section>
            <h2 className="font-display text-2xl font-bold">Saved by job</h2>
            <div className="mt-3 space-y-3">
              {savedQ.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!savedQ.isLoading && (savedQ.data ?? []).length === 0 && <p className="rounded-xl border-2 border-dashed border-foreground p-4 text-sm text-muted-foreground">No job-specific resumes saved yet.</p>}
              {(savedQ.data ?? []).map((saved) => (
                <SavedResumeRow key={saved.id} saved={saved} onSave={saveSavedVersion} onRequestDelete={() => setPendingDelete(saved)} />
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function SavedResumeRow({ saved, onSave, onDelete }: { saved: SavedResume; onSave: (id: string, resume: string) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [draft, setDraft] = useState(saved.resume);
  const [busy, setBusy] = useState(false);

  useEffect(() => setDraft(saved.resume), [saved.resume]);

  async function save() {
    setBusy(true);
    await onSave(saved.id, draft);
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    await onDelete(saved.id);
    setBusy(false);
  }

  return (
    <Accordion type="single" collapsible className="rounded-xl border-2 border-foreground bg-card px-4 shadow-[var(--shadow-pop)]">
      <AccordionItem value={saved.id} className="border-b-0">
        <AccordionTrigger className="hover:no-underline">
          <div className="min-w-0 text-left">
            <div className="truncate font-display text-lg font-bold">{saved.role}</div>
            <div className="truncate text-sm text-muted-foreground">
              {saved.company}
              {saved.score_before !== null && saved.score_after !== null && ` · ${saved.score_before}% → ${saved.score_after}%`}
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-3">
            <Textarea rows={12} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={save} disabled={busy || !draft.trim()}><Save className="size-4" /> Save</Button>
              <Button size="sm" variant="destructive" onClick={remove} disabled={busy}><Trash2 className="size-4" /> Delete</Button>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
