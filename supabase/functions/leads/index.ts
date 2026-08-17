// Supabase Edge Function: POST /functions/v1/leads
// Receives leads from the WordPress forms on each TTE website.
//
// Deploy:  supabase functions deploy leads --no-verify-jwt
//
// ── Secrets ────────────────────────────────────────────────────────────────
// LEADS_SITE_KEYS  (new, preferred) — JSON map of API key → site config, so the
//   SERVER derives which website a lead came from. A form physically cannot
//   mislabel itself as another site, because it only holds its own key:
//
//   supabase secrets set LEADS_SITE_KEYS='{
//     "<key-for-site-1>": { "site": "rannutsav.in",
//                           "source": "Website - Rann Utsav",
//                           "destination": "Rann Utsav",
//                           "assignTo": "Sonali" },
//     "<key-for-site-2>": { "site": "<sou-domain>",
//                           "source": "Website - Statue of Unity",
//                           "destination": "Statue of Unity",
//                           "assignTo": "Sonali" }
//   }'
//
//   site        — recorded as a tag so every lead is attributable to a website
//   source      — what shows in the CRM's Source column
//   destination — FALLBACK only, used when the form sends none. A destination
//                 in the payload always wins (a Rann site can still sell SOU).
//   assignTo    — per-site owner; overridden by an explicit assigned_to.
//
// LEADS_API_KEY  (legacy) — the original single shared key. Still accepted so
//   existing forms keep working during migration; such leads are tagged
//   "unattributed-site" precisely because we cannot tell which site sent them.
//   Remove this secret once every form is on its own key.
//
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected.)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface SiteConfig {
  site: string;
  source?: string;
  destination?: string;
  assignTo?: string;
}

// Resolve the caller's identity from its bearer token. Returns null if the key
// is unknown, which is what makes per-site keys trustworthy: identity comes
// from the secret, never from self-reported payload fields.
function resolveSite(token: string): SiteConfig | null {
  if (!token) return null;

  const raw = Deno.env.get("LEADS_SITE_KEYS");
  if (raw) {
    try {
      const map = JSON.parse(raw) as Record<string, SiteConfig>;
      const cfg = map[token];
      if (cfg && typeof cfg.site === "string") return cfg;
    } catch (e) {
      // Bad JSON must not silently disable auth — log and fall through to legacy.
      console.error("LEADS_SITE_KEYS is not valid JSON:", e);
    }
  }

  const legacy = Deno.env.get("LEADS_API_KEY");
  if (legacy && token === legacy) {
    return { site: "unattributed-site", source: "Website" };
  }
  return null;
}

// Six spellings of two products were reaching the CRM ("STATUE OF UNITY",
// "Statue of Unity ", "Rann Utsav (Kutch)", …), which broke grouping and
// reporting. Collapse known aliases to one canonical name. Anything we don't
// recognise is passed through cleaned but otherwise untouched, so a genuinely
// new destination (e.g. "Ladakh") is never mangled.
const CANONICAL: { name: string; test: RegExp }[] = [
  { name: "Rann Utsav", test: /rann\s*utsav|dhordo|white\s*desert/i },
  { name: "Statue of Unity", test: /statue\s*of\s*unity|\bsou\b|kevadia|ekta\s*nagar/i },
];

function canonicalDestination(raw: string): string {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  for (const c of CANONICAL) if (c.test.test(cleaned)) return c.name;
  return cleaned;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const siteCfg = resolveSite(token);
  if (!siteCfg) return json({ success: false, error: "Unauthorized" }, 401);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const name = String(payload.name ?? "").trim();
  const email = String(payload.email ?? "").trim();
  const phone = String(payload.phone ?? "").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ success: false, error: "Valid email is required" }, 400);
  }

  // Identity from the key, not the payload — a form can no longer claim to be
  // a different website by sending its own `source`.
  const source = siteCfg.source || "Website";

  // Explicit destination wins (a site may legitimately sell another product);
  // the site default only fills the gap when the form sends nothing.
  const destination =
    canonicalDestination(String(payload.destination ?? "")) ||
    canonicalDestination(String(siteCfg.destination ?? "")) ||
    "Not specified";

  const message = payload.message ? String(payload.message) : "";
  const budget = Number(payload.budget) || 0;
  const travelDate = payload.travel_date ? String(payload.travel_date) : new Date().toISOString();
  const pax = Number(payload.pax) || 2;
  const assignedTo = payload.assigned_to
    ? String(payload.assigned_to)
    : (siteCfg.assignTo || "Sonali");

  const row = {
    name: name || email,
    email,
    phone,
    contact: { email, phone },
    status: "New",
    temperature: "Warm",
    source,
    destination,
    pax,
    travel_date: travelDate,
    budget,
    trip_details: {
      destination,
      startDate: travelDate,
      budget,
      paxConfig: { adults: pax, children: 0, childAges: [] },
      notes: message,
    },
    preferences: {},
    commercials: null,
    vendors: [],
    // The site tag is what makes every inbound lead traceable to a website.
    tags: ["website", siteCfg.site],
    interested_services: [],
    reference_name: null,
    assigned_to: assignedTo,
    notes: message,
  };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // lead_code (TTE-0001…) is minted by the assign_lead_code DB trigger, so it
  // applies to website leads automatically — nothing to do here.
  const { data, error } = await supabase.from("leads").insert([row]).select("id, lead_code").single();

  if (error) {
    console.error("Insert failed:", error);
    return json({ success: false, error: error.message }, 500);
  }

  return json({ success: true, id: data.id, lead_code: data.lead_code, site: siteCfg.site });
});
