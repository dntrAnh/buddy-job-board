import { createFileRoute } from "@tanstack/react-router";

// Weekly: reminds each opted-in member of jobs they still haven't acted on.
const BOARD_URL = "https://project--31b54844-c614-4616-bd08-3de7a026b0ba.lovable.app/board";

export const Route = createFileRoute("/api/public/hooks/weekly-reminder")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey");
        if (!key || key !== process.env["SUPABASE_PUBLISHABLE_KEY"]) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendAndLog } = await import("@/lib/email-log.server");
        const since = new Date(Date.now() - 60 * 86400 * 1000).toISOString();
        const weekKey = Math.floor(Date.now() / (7 * 86400 * 1000));

        const { data: profiles } = await supabaseAdmin.from("profiles").select("id, email").eq("email_weekly", true);
        let sent = 0;
        for (const p of profiles ?? []) {
          const { data: mem } = await supabaseAdmin.from("group_members").select("group_id").eq("user_id", p.id);
          const groupIds = (mem ?? []).map((m) => m.group_id);
          if (!groupIds.length) continue;
          const { data: jobs } = await supabaseAdmin.from("jobs").select("id, company, role, posted_by")
            .in("group_id", groupIds).gte("created_at", since).neq("posted_by", p.id);
          if (!jobs?.length) continue;
          const { data: apps } = await supabaseAdmin.from("applications").select("job_id, user_id, status").in("job_id", jobs.map((j) => j.id));
          const mine = new Set((apps ?? []).filter((a) => a.user_id === p.id).map((a) => a.job_id));
          const list = jobs.filter((j) => !mine.has(j.id)).slice(0, 15).map((j) => ({
            company: j.company, role: j.role,
            appliedCount: (apps ?? []).filter((a) => a.job_id === j.id && a.status === "applied").length,
          }));
          if (!list.length) continue;
          const ok = await sendAndLog({
            template: "weekly-reminder", to: p.email, recipientId: p.id, groupId: null,
            label: `${list.length} jobs to apply to`, templateData: { jobs: list, boardUrl: BOARD_URL },
            idempotencyKey: `weekly-${p.id}-${weekKey}`,
          });
          if (ok) sent++;
        }
        return Response.json({ sent });
      },
    },
  },
});
