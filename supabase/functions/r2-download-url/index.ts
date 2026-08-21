// Supabase Edge Function: POST /functions/v1/r2-download-url
// Returns a short-lived presigned GET URL for viewing/downloading/sharing a
// lead attachment stored in Cloudflare R2.
//
// Deploy:  supabase functions deploy r2-download-url --no-verify-jwt
// (see r2-upload-url/index.ts for why --no-verify-jwt + the RLS-based auth
// check instead of Supabase's own JWT verification.)
//
// Secrets: same four R2_* secrets as r2-upload-url.
// (SUPABASE_URL and SUPABASE_ANON_KEY are auto-injected.)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  // supabase-js's functions.invoke() sends x-client-info and apikey
  // alongside authorization/content-type — all four must be allowed or the
  // browser's CORS preflight rejects the request before it ever reaches
  // this function.
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function requireAuthed(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return false;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { error } = await supabase.from("users").select("id").limit(1);
  return !error;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!(await requireAuthed(req))) return json({ error: "Not authenticated" }, 401);

  let payload: { r2Key?: string; filename?: string; download?: boolean; expiresInSeconds?: number };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const { r2Key, filename, download, expiresInSeconds } = payload;
  if (!r2Key) return json({ error: "r2Key is required" }, 400);

  const accountId = Deno.env.get("R2_ACCOUNT_ID")!;
  const bucket = Deno.env.get("R2_BUCKET")!;
  const client = new AwsClient({
    service: "s3",
    region: "auto",
    accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
  });
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

  // Default 10 minutes (viewing/downloading), extendable up to 48h when a
  // longer-lived link is explicitly requested (e.g. a client-share link).
  const expiresIn = Math.min(Math.max(Number(expiresInSeconds) || 600, 60), 172800);

  const url = new URL(`${endpoint}/${bucket}/${r2Key}`);
  url.searchParams.set("X-Amz-Expires", String(expiresIn));
  if (download) {
    const safeName = (filename || r2Key.split("/").pop() || "file").replace(/"/g, "");
    url.searchParams.set("response-content-disposition", `attachment; filename="${safeName}"`);
  }

  const signed = await client.sign(new Request(url.toString()), { aws: { signQuery: true } });
  return json({ url: signed.url.toString(), expiresIn });
});
