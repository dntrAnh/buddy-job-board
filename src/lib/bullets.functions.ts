import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const BulletSchema = z.object({
  estimatedScoreAfter: z.number().describe("Estimated ATS match score after applying all changes, 0-100"),
  tailoredResume: z.string().describe("Full compact revised resume text tailored for this job"),
  bullets: z.array(z.object({
    priority: z.enum(["high", "medium", "low"]),
    estimatedLift: z.number().describe("Estimated score increase from this single change in percentage points"),
    target: z.string().describe("Resume section or bullet to change"),
    original: z.string().describe("Existing resume bullet being improved, or empty string for a new bullet"),
    improved: z.string().describe("ATS-friendly rewritten bullet"),
    keywords: z.array(z.string()).describe("Job keywords this bullet adds"),
    why: z.string().describe("Under 15 words"),
  })),
});

export type BulletTip = z.infer<typeof BulletSchema>["bullets"][number];
export type BulletResult = z.infer<typeof BulletSchema>;

export const improveBullets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ jobId: z.string().uuid(), resume: z.string().max(20000).nullable() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: job }, { data: profile }, { data: savedResume }, { data: currentScore }] = await Promise.all([
      supabase.from("jobs").select("id, company, role, description").eq("id", data.jobId).single(),
      supabase.from("profiles").select("resume").eq("id", userId).maybeSingle(),
      supabase.from("saved_resumes").select("resume").eq("job_id", data.jobId).eq("user_id", userId).maybeSingle(),
      supabase.from("match_scores").select("score, missing, matched, suggestions").eq("job_id", data.jobId).eq("user_id", userId).maybeSingle(),
    ]);
    if (!job) return { error: "Job not found" };
    const resume = (data.resume ?? savedResume?.resume ?? profile?.resume ?? "").trim();
    if (!resume) return { error: "Add your resume first" };
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { error: "AI is not configured" };

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText, Output } = await import("ai");
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1", apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    try {
      const result = streamText({
        model: lovable.responses("openai/gpt-6-astra"),
        output: Output.object({ schema: BulletSchema }),
        system:
          "You are an expert resume writer optimizing for ATS. Return prioritized changes that can realistically improve this resume for this exact job. Estimate the score lift for each change in percentage points and an overall score after all changes. Rewrite existing bullets first, add new bullets only if supported by the resume. Use [X] only where a real metric is missing. Keep bullets compact, plain text, no tables, and never fabricate experience.",
        prompt: `JOB: ${job.role} at ${job.company}\n\n${job.description.slice(0, 12000)}\n\nCURRENT ATS SCORE: ${currentScore?.score ?? "not scored yet"}\nMATCHED KEYWORDS: ${(currentScore?.matched ?? []).join(", ") || "none yet"}\nMISSING KEYWORDS: ${(currentScore?.missing ?? []).join(", ") || "none yet"}\nCURRENT SUGGESTIONS: ${(currentScore?.suggestions ?? []).join("; ") || "none yet"}\n\n---\nRESUME:\n${resume.slice(0, 12000)}`,
        providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] } },
      });
      const out = await result.output;
      const order = { high: 0, medium: 1, low: 2 };
      return {
        ok: true as const,
        scoreBefore: currentScore?.score ?? null,
        estimatedScoreAfter: Math.max(0, Math.min(100, Math.round(out.estimatedScoreAfter))),
        tailoredResume: out.tailoredResume.trim() || resume,
        bullets: out.bullets
          .slice(0, 8)
          .map((b) => ({ ...b, estimatedLift: Math.max(0, Math.min(25, Math.round(b.estimatedLift))) }))
          .sort((a, b) => order[a.priority] - order[b.priority]),
      };
    } catch (e) {
      const status = (e as { statusCode?: number; status?: number })?.statusCode ?? (e as { status?: number })?.status;
      const message = (e as { message?: string })?.message;
      console.error("bullets failed", e);
      if (status === 402) return { error: "Out of AI credits — add credits in Settings." };
      if (status === 403) return { error: message || "AI access is blocked for this workspace right now." };
      if (status === 429) return { error: "Too many requests, try again in a minute." };
      return { error: "Couldn't generate suggestions. Try again." };
    }
  });
