// Sends a template email and records the delivery outcome in email_events.
export async function sendAndLog(opts: {
  template: string;
  to: string;
  recipientId: string;
  groupId: string | null;
  label: string;
  templateData: Record<string, unknown>;
  idempotencyKey: string;
}) {
  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let status = "sent";
  let detail: string | null = null;
  try {
    const r = await sendTemplateEmail(opts.template, opts.to, {
      templateData: opts.templateData,
      idempotencyKey: opts.idempotencyKey,
    });
    if (!r.sent) { status = "suppressed"; detail = "Recipient unsubscribed or bounced"; }
  } catch (e) {
    status = "failed";
    detail = e instanceof Error ? e.message.slice(0, 200) : "Unknown error";
    console.error(`email ${opts.template} failed`, e);
  }
  await supabaseAdmin.from("email_events").insert({
    recipient_id: opts.recipientId, group_id: opts.groupId, kind: opts.template,
    subject_label: opts.label, status, detail,
  });
  return status === "sent";
}

export async function logSkipped(recipientId: string, groupId: string | null, kind: string, label: string, detail: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("email_events").insert({ recipient_id: recipientId, group_id: groupId, kind, subject_label: label, status: "skipped", detail });
}
