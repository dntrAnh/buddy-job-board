import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft } from "lucide-react";
import { DeliveryList, type EmailEvent } from "@/components/DeliveryList";
import { ModeOptions } from "./board";
import type { Profile } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Email settings — Crew Board" },
      { name: "description", content: "Choose which Crew Board emails you get and see their delivery status." },
      { property: "og:title", content: "Email settings — Crew Board" },
      { property: "og:description", content: "Choose which Crew Board emails you get and see their delivery status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Settings,
});

type Prefs = { email_new_jobs: boolean; email_nudges: boolean; email_weekly: boolean; reminder_mode: Profile["reminder_mode"] };

function Settings() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const prefs = useQuery({
    queryKey: ["prefs", user.id],
    queryFn: async () => (await supabase.from("profiles").select("email_new_jobs, email_nudges, email_weekly, reminder_mode").eq("id", user.id).single()).data as Prefs,
  });
  const events = useQuery({
    queryKey: ["myEmails", user.id],
    queryFn: async () => ((await supabase.from("email_events").select("*").eq("recipient_id", user.id).order("created_at", { ascending: false }).limit(50)).data ?? []) as EmailEvent[],
  });

  async function update(patch: Partial<Prefs>) {
    const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["prefs"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Saved");
  }

  const p = prefs.data;
  const rows: { k: keyof Prefs; title: string; desc: string }[] = [
    { k: "email_new_jobs", title: "New job emails", desc: "Instant (medium/hard) or digest (easy) when friends post jobs." },
    { k: "email_nudges", title: "Friend-applied nudges", desc: "Hard mode: when a friend applies before you." },
    { k: "email_weekly", title: "Weekly reminder", desc: "Mondays: jobs you still haven't applied to or skipped." },
  ];
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <Link to="/board" className="inline-flex items-center gap-1 text-sm underline"><ArrowLeft className="size-4" /> Back to board</Link>
        <h1 className="font-display text-3xl font-bold">Email settings</h1>
        {p && (
          <>
            <section className="space-y-3 rounded-2xl border-2 border-foreground bg-card p-5">
              <h2 className="font-display text-xl font-bold">Reminder level</h2>
              <ModeOptions value={p.reminder_mode} onChange={(m) => update({ reminder_mode: m })} />
            </section>
            <section className="rounded-2xl border-2 border-foreground bg-card p-5">
              <h2 className="mb-2 font-display text-xl font-bold">What to send me</h2>
              {rows.map((r) => (
                <label key={r.k} className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0">
                  <div><div className="font-medium">{r.title}</div><div className="text-sm text-muted-foreground">{r.desc}</div></div>
                  <Switch checked={p[r.k] as boolean} onCheckedChange={(v) => update({ [r.k]: v })} />
                </label>
              ))}
            </section>
          </>
        )}
        <section className="rounded-2xl border-2 border-foreground bg-card p-5">
          <h2 className="mb-3 font-display text-xl font-bold">My email activity</h2>
          <DeliveryList events={events.data ?? []} />
        </section>
      </div>
    </div>
  );
}
