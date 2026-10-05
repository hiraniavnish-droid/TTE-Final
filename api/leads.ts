// ============================================================
// POST /api/leads — inbound lead webhook from the Rann Utsav Tickets
// website (form submits + gated WhatsApp-click popup) and its WhatsApp bot.
// Self-contained (Vercel bundles each api/*.ts alone — no cross-file imports).
//
// Each accepted enquiry creates a new lead, even when the phone already exists.
// Existing leads and their assignments/history are never merged by this intake.
//
// AUTH: Authorization: Bearer <LEADS_WEBHOOK_SECRET> — shared secret, set as
// a Vercel env var, held by the sending (Rann Utsav Tickets) project too.
//
// Every one of these leads is for Rann Utsav specifically (this endpoint's
// only caller) — destination is hardcoded, not guessed from payload.
//
// Auto-assignment is read from source-specific routing data held in the
// existing app_settings record rather than hardcoded. Team Settings can
// therefore send Rann Utsav and Rann Utsav Tickets leads to different people,
// or pause either source separately, without a deployment. This deliberately
// keeps the settings in the already-live table, so no database migration can
// interrupt inbound leads.
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WEBHOOK_SECRET = process.env.LEADS_WEBHOOK_SECRET || '';
// A separate key lets the main Tourism Experts website connect without
// replacing a key already used by another Rann Utsav website integration.
const WEBSITE_WEBHOOK_SECRET = process.env.WEBSITE_LEADS_WEBHOOK_SECRET || '';

const DESTINATION = 'Rann Utsav';

const SOURCE_LABEL: Record<string, string> = {
  website_form: 'Website - rannutsavtickets.in',
  tte_website_form: 'Website - rannutsav.in',
  // The original tickets-site WhatsApp hand-off sent these two generic values.
  // Keep them as Tickets for backwards compatibility instead of falling back
  // to the global Sonali route.
  whatsapp_click: 'WhatsApp Click - rannutsavtickets.in',
  whatsapp_bot: 'WhatsApp Bot - rannutsavtickets.in',
  email: 'Email - rannutsavtickets.in',
  tickets_whatsapp_click: 'WhatsApp Click - rannutsavtickets.in',
  tickets_whatsapp_bot: 'WhatsApp Bot - rannutsavtickets.in',
  tickets_email: 'Email - rannutsavtickets.in',
  tte_whatsapp_click: 'WhatsApp Click - rannutsav.in',
  tte_whatsapp_bot: 'WhatsApp Bot - rannutsav.in',
  tte_email: 'Email - rannutsav.in',
};

// Each website sends a distinct `source` value in its webhook. Keep this
// mapping explicit: source routing must never be inferred from a destination
// entered by a guest.
const SOURCE_RULE_KEY: Record<string, string> = {
  tte_website_form: 'rannutsav_website',
  website_form: 'rannutsav_tickets',
  // These are all intake channels from the Rann Utsav Tickets site. They
  // used to miss this map and silently use the fallback assignee (Sonali).
  whatsapp_click: 'rannutsav_tickets',
  whatsapp_bot: 'rannutsav_tickets',
  email: 'rannutsav_tickets',
  tickets_whatsapp_click: 'rannutsav_tickets',
  tickets_whatsapp_bot: 'rannutsav_tickets',
  tickets_email: 'rannutsav_tickets',
  // Explicit main-site aliases preserve separate control when those
  // integrations are configured on rannutsav.in.
  tte_whatsapp_click: 'rannutsav_website',
  tte_whatsapp_bot: 'rannutsav_website',
  tte_email: 'rannutsav_website',
};

export function getWebsiteAttribution(rawSource: string, website?: string | null) {
  let sourceKey = String(rawSource || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  let site: string | null = null;
  if (website) {
    try {
      const host = new URL(website.includes('://') ? website : `https://${website}`).hostname.replace(/^www\./, '').toLowerCase();
      if (host === 'rannutsav.in' || host === 'rannutsavtickets.in') site = host;
    } catch {}
  }
  const routeKey = site ? (site === 'rannutsav.in' ? 'rannutsav_website' : 'rannutsav_tickets') : SOURCE_RULE_KEY[sourceKey];
  if (routeKey) {
    const channel = /whatsapp.*bot/.test(sourceKey) ? 'whatsapp_bot' : /whatsapp/.test(sourceKey) ? 'whatsapp_click' : /email/.test(sourceKey) ? 'email' : 'website_form';
    sourceKey = routeKey === 'rannutsav_website' ? `tte_${channel}` : channel;
    site = routeKey === 'rannutsav_website' ? 'rannutsav.in' : 'rannutsavtickets.in';
  }
  return { sourceKey, source: SOURCE_LABEL[sourceKey] || 'Website - The Tourism Experts', tags: [sourceKey || 'website', ...(site ? [site] : [])] };
}

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
  destination?: string | null;
  city?: string | null;
  rooms?: number | null;
  accommodation?: string | null;
  submittedFields?: Record<string, string>;
  timestamp?: string;
  website?: string | null;
}

const unwrapField = (value: any): any => value && typeof value === 'object' && 'value' in value ? value.value : value;

const SYSTEM_FORM_FIELDS = new Set([
  'source', 'timestamp', 'formfields', 'fields', 'action', 'key', 'nonce',
  'wpcf7', 'wpcf7version', 'wpcf7locale', 'wpcf7unitag', 'wpcf7containerpost',
  'gresponse', 'grecaptcharesponse', 'recaptcharesponse', 'formid', 'pageurl', 'referrer', 'submit',
]);

const humanizeField = (key: string) => key
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/\b\w/g, char => char.toUpperCase());

// Keep a readable copy of every meaningful field the website submits. The
// normalised values below power CRM filters and trip tools; this copy ensures a
// later form-builder change cannot silently discard a new enquiry detail.
function captureSubmittedFields(fields: Record<string, any>): Record<string, string> {
  const captured: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(fields)) {
    const normalizedKey = rawKey.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!rawKey || rawKey.startsWith('_') || SYSTEM_FORM_FIELDS.has(normalizedKey)) continue;
    const value = unwrapField(rawValue);
    const text = Array.isArray(value)
      ? value.map(item => String(unwrapField(item) ?? '')).filter(Boolean).join(', ')
      : typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? String(value).trim()
        : '';
    if (!text || text.length > 3000) continue;
    captured[humanizeField(rawKey)] = text;
  }
  return captured;
}

// Website forms use more than one date widget. CF7's homepage picker currently
// posts `DD-MM-YYYY`, while the CRM database only accepts an ISO `YYYY-MM-DD`
// date. Normalise at the boundary so one form's presentation can never block a
// valid lead from being saved. Unknown formats are deliberately treated as no
// date rather than rejecting the entire enquiry.
function normalizeTravelDate(value: any): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const toValidYmd = (year: string, month: string, day: string): string | null => {
    const y = Number(year), m = Number(month), d = Number(day);
    const parsed = new Date(Date.UTC(y, m - 1, d));
    if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() !== m - 1 || parsed.getUTCDate() !== d) return null;
    return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  const iso = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (iso) {
    const [, year, month, day] = iso;
    return toValidYmd(year, month, day);
  }

  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, day, month, year] = dmy;
    return toValidYmd(year, month, day);
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

export function normalizeWebsitePayload(raw: any, query: any): LeadPayload {
  const fields = { ...(raw || {}), ...((raw && (raw.form_fields || raw.fields)) || {}) } as Record<string, any>;
  const pick = (...names: string[]) => {
    const wanted = names.map(name => name.toLowerCase().replace(/[^a-z0-9]/g, ''));
    for (const [key, value] of Object.entries(fields)) {
      if (wanted.includes(key.toLowerCase().replace(/[^a-z0-9]/g, ''))) return unwrapField(value);
    }
    return undefined;
  };
  const number = (value: any) => value == null || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
  return {
    phone: String(pick('phone','mobile','mobile_number','phone_number','tel') || ''),
    name: pick('name','full_name','your_name','first_name') || null,
    email: pick('email','email_address') || null,
    source: String(raw?.source || query?.source || 'website_form'),
    website: pick('website','website_url','site_url','page_url','pageUrl','referrer') || query?.website || null,
    message: pick('message','comments','enquiry','inquiry','your_message','additional_details') || null,
    packageSlug: pick('package_slug','package','tour_package') || null,
    nights: number(pick('nights','number_of_nights','no_of_nights','noofnights','stay_nights')),
    guests: number(pick('guests','pax','travellers','travelers','number_of_people','number_of_persons','no_of_persons','no_of_people','adults')),
    travelDate: normalizeTravelDate(pick('travel_date','traveldate','check_in_date','arrival_date','date_of_travel')),
    destination: pick('destination','travel_destination','where_to','tour_destination') || null,
    city: pick('city','from_city','departure_city') || null,
    rooms: number(pick('rooms','number_of_rooms','no_of_rooms','noofrooms','room_count','total_rooms')),
    accommodation: pick('accommodation','hotel','hotel_name','stay','property','resort','tent_type') || null,
    submittedFields: captureSubmittedFields(fields),
    timestamp: raw?.timestamp || undefined,
  };
}

type AssignmentRule = { enabled: boolean; assignTo: string | null };
type LeadRoutingSettings = { kind: 'lead-routing-v1'; fallback: AssignmentRule; routes: Record<string, AssignmentRule> };

function asRule(value: any, fallback: AssignmentRule): AssignmentRule {
  if (!value || typeof value !== 'object') return fallback;
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : fallback.enabled,
    assignTo: typeof value.assignTo === 'string' && value.assignTo.trim() ? value.assignTo : null,
  };
}

export function parseLeadRouting(row: any): LeadRoutingSettings {
  const legacy: AssignmentRule = {
    enabled: Boolean(row?.auto_assign_enabled),
    assignTo: typeof row?.auto_assign_to === 'string' && !row.auto_assign_to.trim().startsWith('{') ? row.auto_assign_to : null,
  };
  try {
    const stored = JSON.parse(String(row?.auto_assign_to || ''));
    if (stored?.kind !== 'lead-routing-v1') throw new Error('not routing settings');
    const fallback = asRule(stored.fallback, legacy);
    return {
      kind: 'lead-routing-v1',
      fallback,
      routes: {
        rannutsav_website: asRule(stored.routes?.rannutsav_website, fallback),
        rannutsav_tickets: asRule(stored.routes?.rannutsav_tickets, fallback),
      },
    };
  } catch {
    return {
      kind: 'lead-routing-v1',
      fallback: legacy,
      routes: { rannutsav_website: legacy, rannutsav_tickets: legacy },
    };
  }
}

async function getAutoAssignee(sourceKey: string): Promise<string | null> {
  try {
    const res = await sb('app_settings?select=auto_assign_enabled,auto_assign_to&limit=1');
    const rows = await res.json().catch(() => []);
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!row) return 'Sonali'; // table unreachable/empty — preserve prior hardcoded behavior
    const routing = parseLeadRouting(row);
    const rule = SOURCE_RULE_KEY[sourceKey] ? routing.routes[SOURCE_RULE_KEY[sourceKey]] : routing.fallback;
    return rule.enabled && rule.assignTo ? rule.assignTo : null;
  } catch {
    return 'Sonali';
  }
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

const formDetailsText = (fields: Record<string, string> | undefined) => Object.entries(fields || {})
  .map(([label, value]) => `${label}: ${value}`)
  .join(' · ');

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const auth = String(req.headers.authorization || '');
  // Header authentication is preferred. The query fallback is for WordPress
  // form builders such as Elementor's native Webhook action, which only
  // exposes a webhook URL and cannot attach custom headers.
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : String(req.headers['x-lead-webhook-key'] || req.query?.key || '');
  if (!token || ![WEBHOOK_SECRET, WEBSITE_WEBHOOK_SECRET].filter(Boolean).includes(token)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const body = normalizeWebsitePayload(req.body || {}, req.query || {});
  // A dedicated main-site credential identifies its origin even when a form
  // builder sends the generic website_form channel without a page URL.
  if (!body.website && WEBSITE_WEBHOOK_SECRET && WEBSITE_WEBHOOK_SECRET !== WEBHOOK_SECRET && token === WEBSITE_WEBHOOK_SECRET) body.website = 'rannutsav.in';
  const phoneDigits = digitsOnly(body.phone || '');
  if (!phoneDigits) return res.status(400).json({ ok: false, error: 'phone is required' });

  const phone10 = last10(phoneDigits);
  // Website builders vary between `whatsapp_click`, `WhatsApp Click`, and
  // `whatsapp-click`. Route all of those forms through one stable key.
  const { sourceKey, source, tags: sourceTags } = getWebsiteAttribution(body.source || '', body.website);
  const destination = String(body.destination || DESTINATION).trim() || DESTINATION;
  const timestamp = body.timestamp || new Date().toISOString();

  try {
    const autoAssignee = await getAutoAssignee(sourceKey);

    const row = {
      name: body.name || `Rann Utsav Lead (${phone10})`,
      phone: `+${phoneDigits}`,
      email: body.email || null,
      status: 'New',
      temperature: 'Warm',
      source,
      destination,
      pax: body.guests ?? 2,
      travel_date: body.travelDate || new Date().toISOString().slice(0, 10),
      budget: 0,
      trip_details: {
        destination,
        startDate: body.travelDate || null,
        nights: body.nights ?? null,
        packageSlug: body.packageSlug || null,
        city: body.city || null,
        rooms: body.rooms ?? null,
        accommodation: body.accommodation || null,
        websiteFields: body.submittedFields || {},
        paxConfig: { adults: body.guests ?? 2, children: 0, childAges: [] },
        notes: body.message || '',
      },
      preferences: {},
      commercials: null,
      vendors: [],
      tags: sourceTags,
      interested_services: [],
      reference_name: null,
      assigned_to: autoAssignee,
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

    const allSubmittedDetails = formDetailsText(body.submittedFields);
    if (allSubmittedDetails) {
      await insertNote(inserted[0].id, `Website enquiry captured via ${source} at ${timestamp} · ${allSubmittedDetails}`);
    }

    return res.status(200).json({ ok: true, leadId: inserted[0].id, created: true });
  } catch (err: any) {
    console.error('/api/leads error:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Internal error' });
  }
}
