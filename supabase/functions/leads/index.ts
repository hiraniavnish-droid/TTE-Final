// Supabase Edge Function: POST /functions/v1/leads
// Receives leads from the WordPress form and inserts into the `leads` table.
//
// Deploy:   supabase functions deploy leads --no-verify-jwt
// Secrets:  supabase secrets set LEADS_API_KEY=<key>
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const expected = Deno.env.get("LEADS_API_KEY");
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!expected || token !== expected) {
    return json({ success: false, error: "Unauthorized" }, 401);
  }

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

  const source = String(payload.source ?? "Website").trim() || "Website";
  const destination = payload.destination ? String(payload.destination) : "";
  const message = payload.message ? String(payload.message) : "";
  const budget = Number(payload.budget) || 0;
  const travelDate = payload.travel_date ? String(payload.travel_date) : null;
  const pax = Number(payload.pax) || 0;

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
      paxConfig: { adults: pax, children: 0 },
      notes: message,
    },
    preferences: {},
    vendors: [],
    tags: ["website"],
    interested_services: [],
    notes: message,
  };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase.from("leads").insert([row]).select("id").single();

  if (error) {
    console.error("Insert failed:", error);
    return json({ success: false, error: error.message }, 500);
  }

  return json({ success: true, id: data.id });
});
