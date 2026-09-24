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

async function safeSend(name: string, to: string, templateData: Record<string, unknown>, idempotencyKey: string) {
  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
  try {
    await sendTemplateEmail(name, to, { templateData, idempotencyKey });
  } catch (e) {
    console.error(`email ${name} to recipient failed`, e);
  }
}

const Id = z.object({ id: z.string().uuid() });

export const notifyNewJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Id.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: job } = await supabase.from("jobs").select("id, group_id, posted_by, company, role").eq("id", data.id).single();
    if (!job || job.posted_by !== userId) return { ok: false };
    const [{ data: group }, { data: members }] = await Promise.all([
      supabase.from("groups").select("name").eq("id", job.group_id).single(),
      supabase.from("group_members").select("user_id").eq("group_id", job.group_id),
    ]);
    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = await supabase.from("profiles").select("id, email, display_name, reminder_mode").in("id", ids);
    const poster = profiles?.find((p) => p.id === userId);
    const boardUrl = `${appOrigin()}/board`;
    const targets = (profiles ?? []).filter((p) => p.id !== userId && p.reminder_mode !== "easy");
    await Promise.all(
      targets.map((p) =>
        safeSend("new-job", p.email, {
          posterName: poster?.display_name || "A friend", company: job.company, role: job.role, groupName: group?.name, boardUrl,
        }, `new-job-${job.id}-${p.id}`),
      ),
    );
    return { ok: true, sent: targets.length };
  });

export const notifyApplied = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Id.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
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
    const { data: profiles } = await supabase.from("profiles").select("id, email, display_name, reminder_mode").in("id", ids);
    const me = profiles?.find((p) => p.id === userId);
    const boardUrl = `${appOrigin()}/board`;
    const targets = (profiles ?? []).filter((p) => p.id !== userId && p.reminder_mode === "hard" && !done.has(p.id));
    await Promise.all(
      targets.map((p) =>
        safeSend("friend-applied", p.email, {
          friendName: me?.display_name || "A friend", company: job.company, role: job.role, boardUrl,
        }, `friend-applied-${job.id}-${userId}-${p.id}`),
      ),
    );
    return { ok: true, sent: targets.length };
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
    await safeSend("group-invite", inv.email, {
      inviterName: me?.display_name || "A friend", groupName: group?.name, signupUrl: `${appOrigin()}/auth`,
    }, `group-invite-${inv.id}`);
    return { ok: true };
  });
