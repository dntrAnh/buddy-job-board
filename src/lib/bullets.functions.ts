import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const BulletSchema = z.object({
  bullets: z.array(z.object({
    priority: z.enum(["high", "medium", "low"]),
    original: z.string().describe("Existing resume bullet being improved, or empty string for a new bullet"),
    improved: z.string().describe("ATS-friendly rewritten bullet"),
    keywords: z.array(z.string()).describe("Job keywords this bullet adds"),
    why: z.string().describe("Under 15 words"),
  })),
});

export type BulletTip = z.infer<typeof BulletSchema>["bullets"][number];

export const improveBullets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ jobId: z.string().uuid(), resume: z.string().max(20000).nullable() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: job }, { data: profile }] = await Promise.all([
      supabase.from("jobs").select("company, role, description").eq("id", data.jobId).single(),
      supabase.from("profiles").select("resume").eq("id", userId).maybeSingle(),
    ]);
    if (!job) return { error: "Job not found" };
    const resume = (data.resume ?? profile?.resume ?? "").trim();
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
          "You are an expert resume writer optimizing for ATS. Rewrite the candidate's existing bullets (and add at most 2 new ones only if clearly supported by their experience) to match the job's keywords. Rules: start with a strong action verb, include measurable impact when present in the resume (never invent numbers — use [X] placeholders), plain text, no tables/symbols, under 30 words each. Return 4-8 bullets ordered by priority (highest impact on ATS match first). Never fabricate experience.",
        prompt: `JOB: ${job.role} at ${job.company}\n\n${job.description.slice(0, 12000)}\n\n---\nRESUME:\n${resume.slice(0, 12000)}`,
        providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] } },
      });
      const out = await result.output;
      const order = { high: 0, medium: 1, low: 2 };
      return { ok: true as const, bullets: out.bullets.slice(0, 8).sort((a, b) => order[a.priority] - order[b.priority]) };
    } catch (e) {
      const status = (e as { statusCode?: number })?.statusCode;
      console.error("bullets failed", e);
      if (status === 402) return { error: "Out of AI credits — add credits in Settings." };
      if (status === 429) return { error: "Too many requests, try again in a minute." };
      return { error: "Couldn't generate suggestions. Try again." };
    }
  });
