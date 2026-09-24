import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ScoreSchema = z.object({
  score: z.number().describe("ATS match score 0-100"),
  matched: z.array(z.string()).describe("Job keywords found in the resume"),
  missing: z.array(z.string()).describe("Important job keywords missing from the resume"),
  suggestions: z
    .array(z.string())
    .describe("0-4 very short, direct edits to improve the match. Empty if already strong."),
});

export const scoreJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: job, error: jErr }, { data: profile }] = await Promise.all([
      supabase.from("jobs").select("id, company, role, description").eq("id", data.jobId).single(),
      supabase.from("profiles").select("resume").eq("id", userId).maybeSingle(),
    ]);
    if (jErr || !job) return { error: "Job not found" };
    const resume = profile?.resume?.trim();
    if (!resume) return { error: "Add your resume first" };

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { error: "AI is not configured" };

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText, Output } = await import("ai");
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });

    try {
      const result = streamText({
        model: lovable.responses("openai/gpt-6-astra"),
        output: Output.object({ schema: ScoreSchema }),
        system:
          "You are an ATS (applicant tracking system). Extract the hard skills, tools, qualifications and key terms from the job post, check which appear (exactly or as clear synonyms) in the resume, and score the match 0-100 like an ATS would. Keep keywords short (1-3 words), max 20 each list. Suggestions: at most 4, each under 15 words, concrete and direct. Return none if the match is already strong.",
        prompt: `JOB: ${job.role} at ${job.company}\n\n${job.description.slice(0, 12000)}\n\n---\nRESUME:\n${resume.slice(0, 12000)}`,
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
      });
      const out = await result.output;
      const row = {
        job_id: job.id,
        user_id: userId,
        score: Math.max(0, Math.min(100, Math.round(out.score))),
        matched: out.matched,
        missing: out.missing,
        suggestions: out.suggestions,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("match_scores").upsert(row);
      if (error) return { error: error.message };
      return { ok: true as const, ...row };
    } catch (e) {
      const status = (e as { statusCode?: number })?.statusCode;
      console.error("scoring failed", e);
      if (status === 402) return { error: "Out of AI credits — add credits in Settings." };
      if (status === 429) return { error: "Too many requests, try again in a minute." };
      return { error: "Scoring failed. Try again." };
    }
  });
