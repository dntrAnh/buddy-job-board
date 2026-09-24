import { createFileRoute } from "@tanstack/react-router";

// Called by a schedule 3x/day. Sends easy-mode members a digest of jobs posted
// in the last 8 hours that they haven't acted on.
const WINDOW_HOURS = 8;
const BOARD_URL = "https://project--31b54844-c614-4616-bd08-3de7a026b0ba.lovable.app/board";

export const Route = createFileRoute("/api/public/hooks/job-digest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey");
        if (!key || key !== process.env["SUPABASE_PUBLISHABLE_KEY"]) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendAndLog } = await import("@/lib/email-log.server");

        const since = new Date(Date.now() - WINDOW_HOURS * 3600 * 1000);
        const windowKey = Math.floor(Date.now() / (WINDOW_HOURS * 3600 * 1000));
        const { data: jobs } = await supabaseAdmin
          .from("jobs").select("id, group_id, posted_by, company, role").gte("created_at", since.toISOString());
        if (!jobs?.length) return Response.json({ sent: 0 });

        const groupIds = [...new Set(jobs.map((j) => j.group_id))];
        const [{ data: members }, { data: apps }] = await Promise.all([
          supabaseAdmin.from("group_members").select("group_id, user_id").in("group_id", groupIds),
          supabaseAdmin.from("applications").select("job_id, user_id").in("job_id", jobs.map((j) => j.id)),
        ]);
        const userIds = [...new Set((members ?? []).map((m) => m.user_id))];
        const { data: profiles } = await supabaseAdmin
          .from("profiles").select("id, email, reminder_mode").in("id", userIds).eq("reminder_mode", "easy").eq("email_new_jobs", true);
        const acted = new Set((apps ?? []).map((a) => `${a.job_id}:${a.user_id}`));

        let sent = 0;
        for (const p of profiles ?? []) {
          const myGroups = new Set((members ?? []).filter((m) => m.user_id === p.id).map((m) => m.group_id));
          const list = jobs.filter((j) => myGroups.has(j.group_id) && j.posted_by !== p.id && !acted.has(`${j.id}:${p.id}`));
          if (!list.length) continue;
          const ok = await sendAndLog({
            template: "job-digest", to: p.email, recipientId: p.id, groupId: null,
            label: `Digest: ${list.length} new jobs`,
            templateData: { jobs: list.map((j) => ({ company: j.company, role: j.role })), boardUrl: BOARD_URL },
            idempotencyKey: `job-digest-${p.id}-${windowKey}`,
          });
          if (ok) sent++;
        }
        return Response.json({ sent });
      },
    },
  },
});
