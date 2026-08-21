// Supabase Edge Function: POST /functions/v1/r2-upload-url
// Returns a short-lived presigned PUT URL for uploading a lead attachment
// (hotel voucher, payment bill, etc.) directly to Cloudflare R2 — the file
// bytes never pass through Supabase, avoiding Edge Function payload limits
// and keeping large uploads fast. The frontend PUTs the file straight to
// the returned URL, then inserts the lead_attachments row itself (RLS
// already permits an authenticated insert — see
// supabase/migrations/010_lead_attachments.sql).
//
// Deploy:  supabase functions deploy r2-upload-url --no-verify-jwt
// (--no-verify-jwt because this app's session token is a custom-minted JWT,
// not Supabase Auth — see lib/supabase.ts. Auth is instead checked below by
// making a real RLS-gated query with the caller's own token: if Postgres
// doesn't recognise it as `authenticated`, the request is rejected. Same
// real enforcement boundary as everywhere else in this app.)
//
// Secrets (supabase secrets set ...):
//   R2_ACCOUNT_ID        — Cloudflare account id (the subdomain in the R2 S3 endpoint)
//   R2_ACCESS_KEY_ID
//   R2_SECRET_ACCESS_KEY
//   R2_BUCKET            — e.g. tte-crm-documents
// (SUPABASE_URL and SUPABASE_ANON_KEY are auto-injected.)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
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

// Short, filesystem/URL-safe id — same shape as utils/helpers.ts generateId()
// on the frontend, so lead_attachments.id looks consistent everywhere.
const shortId = () => Math.random().toString(36).slice(2, 11);

const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!(await requireAuthed(req))) return json({ error: "Not authenticated" }, 401);

  let payload: { leadId?: string; filename?: string; contentType?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const { leadId, filename, contentType } = payload;
  if (!leadId || !filename) return json({ error: "leadId and filename are required" }, 400);

  const id = shortId();
  const r2Key = `leads/${leadId}/${id}-${sanitize(filename)}`;

  const accountId = Deno.env.get("R2_ACCOUNT_ID")!;
  const bucket = Deno.env.get("R2_BUCKET")!;
  const client = new AwsClient({
    service: "s3",
    region: "auto",
    accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
  });
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

  // 10 minutes is plenty for a single-file upload to start and finish.
  const expiresIn = 600;
  const headers: Record<string, string> = contentType ? { "Content-Type": contentType } : {};
  const signed = await client.sign(
    new Request(`${endpoint}/${bucket}/${r2Key}?X-Amz-Expires=${expiresIn}`, { method: "PUT", headers }),
    { aws: { signQuery: true } },
  );

  return json({ id, r2Key, uploadUrl: signed.url.toString(), contentType: contentType || null });
});
