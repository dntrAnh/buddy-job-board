import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SaveResumeSchema = z.object({
  jobId: z.string().uuid(),
  resume: z.string(),
  scoreBefore: z.number().nullable().optional(),
  scoreAfter: z.number().nullable().optional(),
});

const UpdateResumeSchema = z.object({ id: z.string().uuid(), resume: z.string() });
const DeleteResumeSchema = z.object({ id: z.string().uuid() });

export const saveResumeVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveResumeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const resume = data.resume.trim();
    if (!resume) return { error: "Resume text is empty" };
    const { data: job, error: jobError } = await context.supabase
      .from("jobs")
      .select("id, company, role")
      .eq("id", data.jobId)
      .single();
    if (jobError || !job) return { error: "Job not found" };
    const { data: saved, error } = await context.supabase
      .from("saved_resumes")
      .upsert({
        user_id: context.userId,
        job_id: job.id,
        company: job.company,
        role: job.role,
        resume,
        score_before: data.scoreBefore ?? null,
        score_after: data.scoreAfter ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,job_id" })
      .select("*")
      .single();
    if (error) return { error: error.message };
    return { ok: true as const, saved };
  });

export const updateResumeVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateResumeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const resume = data.resume.trim();
    if (!resume) return { error: "Resume text is empty" };
    const { data: saved, error } = await context.supabase
      .from("saved_resumes")
      .update({ resume, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (error) return { error: error.message };
    return { ok: true as const, saved };
  });

export const deleteResumeVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeleteResumeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("saved_resumes")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) return { error: error.message };
    return { ok: true as const };
  });