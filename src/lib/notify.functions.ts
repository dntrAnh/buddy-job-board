import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

function appOrigin() {
  const req = getRequest();
  const url = new URL(req.url);
  const fwd = url.hostname === "localhost" ? req.headers.get("x-forwarded-host") : null;
  return fwd ? `https://${fwd}` : url.origin;
}

const Id = z.object({ id: z.string().uuid() });

export const notifyNewJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Id.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { sendAndLog, logSkipped } = await import("@/lib/email-log.server");
    const { data: job } = await supabase.from("jobs").select("id, group_id, posted_by, company, role").eq("id", data.id).single();
    if (!job || job.posted_by !== userId) return { ok: false };
    const [{ data: group }, { data: members }] = await Promise.all([
      supabase.from("groups").select("name").eq("id", job.group_id).single(),
      supabase.from("group_members").select("user_id").eq("group_id", job.group_id),
    ]);
    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = await supabase.from("profiles").select("id, email, display_name, reminder_mode, email_new_jobs").in("id", ids);
    const poster = profiles?.find((p) => p.id === userId);
    const boardUrl = `${appOrigin()}/board`;
    const label = `${job.role} at ${job.company}`;
    const others = (profiles ?? []).filter((p) => p.id !== userId && p.reminder_mode !== "easy");
    await Promise.all(others.map((p) =>
      p.email_new_jobs
        ? sendAndLog({
            template: "new-job", to: p.email, recipientId: p.id, groupId: job.group_id, label,
            templateData: { posterName: poster?.display_name || "A friend", company: job.company, role: job.role, groupName: group?.name, boardUrl },
            idempotencyKey: `new-job-${job.id}-${p.id}`,
          })
        : logSkipped(p.id, job.group_id, "new-job", label, "Turned off new-job emails"),
    ));
    return { ok: true };
  });

export const notifyApplied = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Id.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { sendAndLog, logSkipped } = await import("@/lib/email-log.server");
    const { data: app } = await supabase.from("applications").select("status").eq("job_id", data.id).eq("user_id", userId).maybeSingle();
    if (app?.status !== "applied") return { ok: false };
    const { data: job } = await supabase.from("jobs").select("id, group_id, company, role").eq("id", data.id).single();
    if (!job) return { ok: false };
    const [{ data: members }, { data: apps }] = await Promise.all([
      supabase.from("group_members").select("user_id").eq("group_id", job.group_id),
      supabase.from("applications").select("user_id").eq("job_id", job.id),
    ]);
    const done = new Set((apps ?? []).map((a) => a.user_id));
    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = await supabase.from("profiles").select("id, email, display_name, reminder_mode, email_nudges").in("id", ids);
    const me = profiles?.find((p) => p.id === userId);
    const boardUrl = `${appOrigin()}/board`;
    const label = `${me?.display_name || "A friend"} applied: ${job.role} at ${job.company}`;
    const targets = (profiles ?? []).filter((p) => p.id !== userId && p.reminder_mode === "hard" && !done.has(p.id));
    await Promise.all(targets.map((p) =>
      p.email_nudges
        ? sendAndLog({
            template: "friend-applied", to: p.email, recipientId: p.id, groupId: job.group_id, label,
            templateData: { friendName: me?.display_name || "A friend", company: job.company, role: job.role, boardUrl },
            idempotencyKey: `friend-applied-${job.id}-${userId}-${p.id}`,
          })
        : logSkipped(p.id, job.group_id, "friend-applied", label, "Turned off nudges"),
    ));
    return { ok: true };
  });

export const notifyInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Id.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: inv } = await supabase.from("invites").select("id, email, group_id, invited_by, accepted").eq("id", data.id).single();
    if (!inv || inv.invited_by !== userId || inv.accepted) return { ok: false };
    const [{ data: group }, { data: me }] = await Promise.all([
      supabase.from("groups").select("name").eq("id", inv.group_id).single(),
      supabase.from("profiles").select("display_name").eq("id", userId).single(),
    ]);
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    try {
      await sendTemplateEmail("group-invite", inv.email, {
        templateData: { inviterName: me?.display_name || "A friend", groupName: group?.name, signupUrl: `${appOrigin()}/auth` },
        idempotencyKey: `group-invite-${inv.id}`,
      });
    } catch (e) { console.error("invite email failed", e); return { ok: false }; }
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ groupId: z.string().uuid(), userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("group_members").delete().eq("group_id", data.groupId).eq("user_id", data.userId);
    if (error) return { error: error.message };
    return { ok: true };
  });
