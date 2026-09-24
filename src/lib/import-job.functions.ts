import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const JobSchema = z.object({
  found: z.boolean().describe("false if the page has no job posting"),
  company: z.string(),
  role: z.string(),
  description: z.string().describe("Full job description as plain text: responsibilities, requirements, qualifications"),
});

function htmlToText(html: string) {
  const ld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join("\n");
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const body = html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|li|div|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n");
  return `TITLE: ${title}\nSTRUCTURED DATA: ${ld.slice(0, 15000)}\nPAGE TEXT:\n${body.slice(0, 20000)}`;
}

export const importJobFromLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ url: z.string().url() }).parse(i))
  .handler(async ({ data }) => {
    const url = new URL(data.url);
    if (!/^https?:$/.test(url.protocol) || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(url.hostname)) {
      return { error: "That link isn't supported." };
    }
    let html = "";
    try {
      const res = await fetch(url.toString(), {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; CrewBoard/1.0)", Accept: "text/html" },
        redirect: "follow",
      });
      if (!res.ok) return { error: `The site blocked us (${res.status}). Paste the details instead.` };
      html = (await res.text()).slice(0, 600000);
    } catch {
      return { error: "Couldn't open that link. Paste the details instead." };
    }

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
        output: Output.object({ schema: JobSchema }),
        system: "Extract the job posting from this web page. Return company name, job title, and the complete job description as clean plain text (keep bullet lists as lines starting with '- '). Do not invent anything. If there's no job posting (login wall, error page), set found=false and leave other fields empty.",
        prompt: `URL: ${url}\n\n${htmlToText(html)}`,
        providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] } },
      });
      const out = await result.output;
      if (!out.found || !out.description.trim()) return { error: "Couldn't find the job on that page (it may need a login). Paste the details instead." };
      return { ok: true as const, company: out.company.trim(), role: out.role.trim(), description: out.description.trim() };
    } catch (e) {
      const status = (e as { statusCode?: number })?.statusCode;
      console.error("import failed", e);
      if (status === 402) return { error: "Out of AI credits — add credits in Settings." };
      if (status === 429) return { error: "Too many requests, try again in a minute." };
      return { error: "Couldn't read that job. Paste the details instead." };
    }
  });
