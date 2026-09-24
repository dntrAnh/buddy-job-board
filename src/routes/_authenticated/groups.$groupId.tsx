import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { notifyInvite, removeMember } from "@/lib/notify.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Crown, Trash2, UserPlus, X } from "lucide-react";
import { DeliveryList, type EmailEvent } from "@/components/DeliveryList";

const CAP = 15;

export const Route = createFileRoute("/_authenticated/groups/$groupId")({
  head: () => ({
    meta: [
      { title: "Manage group — Crew Board" },
      { name: "description", content: "Invite and remove members, and track your group's 15-person capacity." },
      { property: "og:title", content: "Manage group — Crew Board" },
      { property: "og:description", content: "Invite and remove members, and track your group's 15-person capacity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManageGroup,
});

async function loadGroup(groupId: string) {
  const [g, m, inv, ev] = await Promise.all([
    supabase.from("groups").select("id, name, created_by").eq("id", groupId).single(),
    supabase.from("group_members").select("user_id, joined_at").eq("group_id", groupId),
    supabase.from("invites").select("id, email, created_at").eq("group_id", groupId).eq("accepted", false),
    supabase.from("email_events").select("*").eq("group_id", groupId).order("created_at", { ascending: false }).limit(50),
  ]);
  if (g.error) throw g.error;
  const ids = (m.data ?? []).map((x) => x.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, display_name, email").in("id", ids)
    : { data: [] };
  return { group: g.data, members: m.data ?? [], invites: inv.data ?? [], profiles: profiles ?? [], events: (ev.data ?? []) as EmailEvent[] };
}

function ManageGroup() {
  const { groupId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["manage", groupId], queryFn: () => loadGroup(groupId) });
  const sendInvite = useServerFn(notifyInvite);
  const remove = useServerFn(removeMember);
  const [email, setEmail] = useState("");

  if (q.isError) return <p className="p-8">Couldn't load this group.</p>;
  if (!q.data) return <p className="p-8 text-muted-foreground">Loading…</p>;
  const { group, members, invites, profiles, events } = q.data;
  const isOwner = group.created_by === user.id;
  const used = members.length + invites.length;
  const left = CAP - used;
  const name = (id: string) => profiles.find((p) => p.id === id);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["manage", groupId] }); qc.invalidateQueries({ queryKey: ["group", groupId] }); };

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (left <= 0) return;
    const { data: inv, error } = await supabase.from("invites").insert({ group_id: groupId, email: email.trim().toLowerCase(), invited_by: user.id }).select("id").single();
    if (error) { toast.error(error.message.includes("duplicate") ? "Already invited." : error.message); return; }
    sendInvite({ data: { id: inv.id } }).catch(() => {});
    toast.success("Invite sent!");
    setEmail("");
    refresh();
  }
  async function revoke(id: string) {
    await supabase.from("invites").delete().eq("id", id);
    refresh();
  }
  async function kick(uid: string) {
    if (!confirm(`Remove ${name(uid)?.display_name || "this member"} from the group?`)) return;
    const r = await remove({ data: { groupId, userId: uid } });
    if ("error" in r && r.error) { toast.error(r.error); return; }
    toast.success("Member removed.");
    refresh();
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <Link to="/board" className="inline-flex items-center gap-1 text-sm underline"><ArrowLeft className="size-4" /> Back to board</Link>
        <h1 className="font-display text-3xl font-bold">{group.name}</h1>

        <section className="rounded-2xl border-2 border-foreground bg-card p-5 shadow-[var(--shadow-pop)]">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl font-bold">Capacity</h2>
            <span className="font-display text-2xl font-bold">{used}/{CAP}</span>
          </div>
          <Progress value={(used / CAP) * 100} className="mt-3 h-3" />
          <p className="mt-2 text-sm text-muted-foreground">
            {members.length} member{members.length === 1 ? "" : "s"} · {invites.length} pending invite{invites.length === 1 ? "" : "s"} ·{" "}
            <strong className="text-foreground">{left > 0 ? `${left} seat${left === 1 ? "" : "s"} left` : "Group is full"}</strong>
          </p>
          <form onSubmit={invite} className="mt-4 flex gap-2">
            <Input type="email" required placeholder="friend@email.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={left <= 0} />
            <Button disabled={left <= 0}><UserPlus className="size-4" /> Invite</Button>
          </form>
          {left <= 0 && <p className="mt-2 text-sm text-destructive">Remove a member or cancel an invite to free a seat.</p>}
        </section>

        <section className="rounded-2xl border-2 border-foreground bg-card p-5">
          <h2 className="mb-3 font-display text-xl font-bold">Members</h2>
          <ul className="divide-y divide-border">
            {members.map((m) => {
              const p = name(m.user_id);
              const owner = m.user_id === group.created_by;
              return (
                <li key={m.user_id} className="flex items-center justify-between py-2">
                  <div>
                    <div className="flex items-center gap-1.5 font-medium">{p?.display_name || p?.email || "Member"}{owner && <Crown className="size-4 text-primary" />}{m.user_id === user.id && <span className="text-xs text-muted-foreground">(you)</span>}</div>
                    <div className="text-xs text-muted-foreground">{p?.email}</div>
                  </div>
                  {isOwner && !owner && (
                    <Button size="sm" variant="ghost" onClick={() => kick(m.user_id)}><Trash2 className="size-4" /> Remove</Button>
                  )}
                </li>
              );
            })}
          </ul>
          {invites.length > 0 && (
            <>
              <h3 className="mb-1 mt-4 text-xs font-bold uppercase text-muted-foreground">Pending invites</h3>
              <ul className="divide-y divide-border">
                {invites.map((i) => (
                  <li key={i.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{i.email}</span>
                    <Button size="sm" variant="ghost" onClick={() => revoke(i.id)}><X className="size-4" /> Cancel</Button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {isOwner && (
          <section className="rounded-2xl border-2 border-foreground bg-card p-5">
            <h2 className="mb-3 font-display text-xl font-bold">Email delivery</h2>
            <DeliveryList events={events} nameFor={(id) => name(id)?.display_name || name(id)?.email || "Former member"} />
          </section>
        )}
      </div>
    </div>
  );
}
