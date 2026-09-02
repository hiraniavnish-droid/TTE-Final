// ============================================================
// POST /api/leads — inbound lead webhook from the Rann Utsav Tickets
// website (form submits + gated WhatsApp-click popup) and its WhatsApp bot.
// Self-contained (Vercel bundles each api/*.ts alone — no cross-file imports).
//
// De-duplicates by phone number: the same guest often submits the form AND
// messages on WhatsApp, and that must land as ONE lead, not two. Matching is
// on the last 10 digits (India mobile length) via `ilike`, same approach
// already proven in api/whatsapp-webhook.ts — phone numbers already in this
// table are stored in mixed formats (+91XXXXXXXXXX, plain, etc.), so an
// exact-string match would silently miss real duplicates.
//
// AUTH: Authorization: Bearer <LEADS_WEBHOOK_SECRET> — shared secret, set as
// a Vercel env var, held by the sending (Rann Utsav Tickets) project too.
//
// Every one of these leads is for Rann Utsav specifically (this endpoint's
// only caller) — destination is hardcoded, not guessed from payload.
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WEBHOOK_SECRET = process.env.LEADS_WEBHOOK_SECRET || '';

const DESTINATION = 'Rann Utsav';

const SOURCE_LABEL: Record<string, string> = {
  website_form: 'Website - Rann Utsav',
  whatsapp_click: 'WhatsApp Click - Rann Utsav',
  whatsapp_bot: 'WhatsApp Bot - Rann Utsav',
};

const sb = (path: string, init: any = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

const last10 = (raw: string) => String(raw || '').replace(/[^0-9]/g, '').slice(-10);
const digitsOnly = (raw: string) => String(raw || '').replace(/[^0-9]/g, '');

interface LeadPayload {
  phone?: string;
  name?: string | null;
  email?: string | null;
  source?: string;
  message?: string | null;
  packageSlug?: string | null;
  nights?: number | null;
  guests?: number | null;
  travelDate?: string | null;
  city?: string | null;
  timestamp?: string;
}

async function findExistingLead(phone10: string): Promise<any | null> {
  // Most recently created first — if a phone genuinely maps to more than one
  // lead (rare, but possible with seed/legacy data), attach the new touch to
  // the freshest one rather than an old closed-out lead.
  const res = await sb(`leads?select=*&phone=ilike.*${phone10}&order=created_at.desc&limit=1`);
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function insertNote(leadId: string, content: string) {
  const row = {
    id: `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    lead_id: leadId,
    type: 'Note',
    content,
    sentiment: null,
    timestamp: new Date().toISOString(),
  };
  await sb('interactions', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row) });
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const auth = String(req.headers.authorization || '');
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!WEBHOOK_SECRET || token !== WEBHOOK_SECRET) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const body: LeadPayload = req.body || {};
  const phoneDigits = digitsOnly(body.phone || '');
  if (!phoneDigits) return res.status(400).json({ ok: false, error: 'phone is required' });

  const phone10 = last10(phoneDigits);
  const source = SOURCE_LABEL[body.source || ''] || 'Website - Rann Utsav';
  const timestamp = body.timestamp || new Date().toISOString();

  try {
    const existing = await findExistingLead(phone10);

    if (existing) {
      // Fill in previously-null fields only — never overwrite a real value
      // with null/blank.
      const patch: Record<string, unknown> = {};
      if (!existing.name && body.name) patch.name = body.name;
      if (!existing.email && body.email) patch.email = body.email;

      const existingTripDetails = existing.trip_details || {};
      const tripPatch: Record<string, unknown> = {};
      if (existingTripDetails.nights == null && body.nights != null) tripPatch.nights = body.nights;
      if (!existingTripDetails.startDate && body.travelDate) tripPatch.startDate = body.travelDate;
      if (!existingTripDetails.packageSlug && body.packageSlug) tripPatch.packageSlug = body.packageSlug;
      if (!existingTripDetails.city && body.city) tripPatch.city = body.city;
      if (existingTripDetails.paxConfig == null && body.guests != null) {
        tripPatch.paxConfig = { adults: body.guests, children: 0, childAges: [] };
      }
      if (Object.keys(tripPatch).length > 0) {
        patch.trip_details = { ...existingTripDetails, ...tripPatch };
      }

      // Multi-channel touch tracking — dedup so the same source tag isn't
      // added twice across repeat visits.
      const existingTags: string[] = Array.isArray(existing.tags) ? existing.tags : [];
      const sourceTag = body.source || 'website';
      if (!existingTags.includes(sourceTag)) {
        patch.tags = [...existingTags, sourceTag];
      }

      if (Object.keys(patch).length > 0) {
        await sb(`leads?id=eq.${existing.id}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify(patch),
        });
      }

      const noteParts = [`Also came in via ${source} at ${timestamp}`];
      if (body.message) noteParts.push(`Message: ${body.message}`);
      if (body.packageSlug) noteParts.push(`Package: ${body.packageSlug}`);
      if (body.nights != null) noteParts.push(`Nights: ${body.nights}`);
      if (body.guests != null) noteParts.push(`Guests: ${body.guests}`);
      await insertNote(existing.id, noteParts.join(' · '));

      return res.status(200).json({ ok: true, leadId: existing.id, created: false });
    }

    const row = {
      name: body.name || `Rann Utsav Lead (${phone10})`,
      phone: `+${phoneDigits}`,
      email: body.email || null,
      status: 'New',
      temperature: 'Warm',
      source,
      destination: DESTINATION,
      pax: body.guests ?? 2,
      travel_date: body.travelDate || new Date().toISOString().slice(0, 10),
      budget: 0,
      trip_details: {
        destination: body.city || DESTINATION,
        startDate: body.travelDate || null,
        nights: body.nights ?? null,
        packageSlug: body.packageSlug || null,
        city: body.city || null,
        paxConfig: { adults: body.guests ?? 2, children: 0, childAges: [] },
        notes: body.message || '',
      },
      preferences: {},
      commercials: null,
      vendors: [],
      tags: [body.source || 'website'],
      interested_services: [],
      reference_name: null,
      assigned_to: null,
      notes: body.message || '',
    };

    const insertRes = await sb('leads', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify([row]),
    });
    const inserted = await insertRes.json().catch(() => null);
    if (!insertRes.ok || !Array.isArray(inserted) || !inserted[0]) {
      console.error('Lead insert failed:', inserted);
      return res.status(500).json({ ok: false, error: 'Could not create lead' });
    }

    return res.status(200).json({ ok: true, leadId: inserted[0].id, created: true });
  } catch (err: any) {
    console.error('/api/leads error:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Internal error' });
  }
}
