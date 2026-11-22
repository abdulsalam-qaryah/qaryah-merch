// قراءة صور الرف وملخص اليوم بالذكاء الاصطناعي (Claude) لتطبيق متابعة المناديب.
// المفتاح يُحفظ كسرّ في Supabase باسم ANTHROPIC_API_KEY ولا يظهر في المتصفح.
// deno-lint-ignore-file no-explicit-any
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const client = new Anthropic(); // يقرأ ANTHROPIC_API_KEY
const MODEL = Deno.env.get("CLAUDE_MODEL") ?? "claude-opus-5-5";
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only", code: "invalid_request" }, 405);

  // الموظفين المعتمدين فقط
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: approved } = await sb.rpc("is_approved");
  if (!approved) return json({ error: "الحساب غير معتمد", code: "not_granted" }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad JSON", code: "invalid_request" }, 400); }
  const prompt = body?.prompt;
  const images: { type: string; data: string }[] = Array.isArray(body?.images) ? body.images.slice(0, 4) : [];
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 200_000) {
    return json({ error: "prompt missing or too long", code: "invalid_request" }, 400);
  }
  if (images.some((im) => !IMAGE_TYPES.has(im?.type) || typeof im?.data !== "string")) {
    return json({ error: "unsupported image", code: "image_rejected" }, 400);
  }

  const content: any[] = [
    ...images.map((im) => ({ type: "image", source: { type: "base64", media_type: im.type, data: im.data } })),
    { type: "text", text: prompt },
  ];

  try {
    const msg: any = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      messages: [{ role: "user", content }],
    } as any);
    if (msg.stop_reason === "refusal") return json({ error: "refused", code: "refused" });
    const text = msg.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    if (!text) return json({ error: "empty answer", code: "empty_completion" });
    return json({ text, truncated: msg.stop_reason === "max_tokens", model: msg.model });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "rate limited", code: "rate_limited" }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "ANTHROPIC_API_KEY غير صحيح أو غير موجود", code: "sampling_disabled" }, 500);
    if (e instanceof Anthropic.BadRequestError) return json({ error: e.message, code: "invalid_request" }, 400);
    if (e instanceof Anthropic.APIError) return json({ error: e.message, code: "upstream_error" }, 502);
    return json({ error: String(e), code: "upstream_error" }, 500);
  }
});
