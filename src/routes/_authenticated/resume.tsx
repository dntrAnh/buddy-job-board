import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ensureProfile, fetchGroups } from "@/lib/data";
import { scoreJob } from "@/lib/scoring.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw } from "lucide-react";

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
  const [resume, setResume] = useState("");
  const [name, setName] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const score = useServerFn(scoreJob);

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
      const r = await score({ data: { jobId: list[i]!.id } });
      if ("error" in r && r.error) { toast.error(r.error); break; }
      setProgress({ done: i + 1, total: list.length });
    }
    setProgress(null);
    qc.invalidateQueries({ queryKey: ["group"] });
    toast.success("All jobs re-graded!");
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link to="/board" className="text-sm underline">← Back to board</Link>
        <h1 className="mt-4 font-display text-4xl font-bold">My resume</h1>
        <p className="mt-1 text-muted-foreground">Tweak it, then re-grade to see how your ATS match changes.</p>
        <div className="mt-6 space-y-4">
          <div className="space-y-1"><Label>Display name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1"><Label>Primary resume</Label><Textarea rows={20} value={resume} onChange={(e) => setResume(e.target.value)} /></div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={async () => (await save()) && toast.success("Saved")}>Save</Button>
            <Button onClick={saveAndRegradeAll} disabled={!!progress || !resume.trim()}>
              <RefreshCw className={`size-4 ${progress ? "animate-spin" : ""}`} />
              {progress ? `Re-grading ${progress.done}/${progress.total}…` : "Save & re-grade all jobs"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
