import { createHash } from 'node:crypto';

// Public intake adapter for soubooking.in. The browser never receives the
// CRM webhook secret; this route validates and rate-limits the request, then
// forwards a narrow payload to the /api/leads handler, which creates a fresh lead for each enquiry.

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WEBSITE_WEBHOOK_SECRET = process.env.WEBSITE_LEADS_WEBHOOK_SECRET || '';

const ALLOWED_ORIGINS = new Set([
  'https://soubooking.in',
  'https://www.soubooking.in',
  'https://the-tourism-experts-sou.hiraniavnish.chatgpt.site',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
]);

const text = (value: unknown, limit: number) => String(value ?? '').trim().slice(0, limit);
const number = (value: unknown, fallback: number | null = null) => {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function setCors(req: any, res: any) {
  const origin = String(req.headers.origin || '');
  if (ALLOWED_ORIGINS.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

async function consumeRateLimit(req: any) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || String(req.socket?.remoteAddress || 'unknown');
  const clientId = `soubooking-${createHash('sha256').update(ip).digest('hex').slice(0, 24)}`;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/crm_api_consume_rate_limit`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_client_id: clientId, p_window_seconds: 60, p_limit: 8 }),
  });
  if (!response.ok) throw new Error('Lead rate limiter is unavailable');
  const result = await response.json();
  return Boolean(result?.allowed);
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  const origin = String(req.headers.origin || '');

  if (req.method === 'OPTIONS') {
    return ALLOWED_ORIGINS.has(origin) ? res.status(204).end() : res.status(403).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!ALLOWED_ORIGINS.has(origin)) return res.status(403).json({ ok: false, error: 'Origin not allowed' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !WEBSITE_WEBHOOK_SECRET) {
    return res.status(503).json({ ok: false, error: 'Lead intake is not configured' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  // Hidden-field honeypot. Legitimate forms leave this empty.
  if (text(body.company_website, 200)) return res.status(200).json({ ok: true, accepted: true });

  const name = text(body.name, 80);
  const rawPhone = text(body.phone, 30);
  const phoneDigits = rawPhone.replace(/\D/g, '').slice(-10);
  if (name.length < 2) return res.status(400).json({ ok: false, error: 'name is required' });
  if (phoneDigits.length !== 10) return res.status(400).json({ ok: false, error: 'a valid 10-digit mobile number is required' });

  try {
    if (!(await consumeRateLimit(req))) return res.status(429).json({ ok: false, error: 'Too many requests' });

    const sourceSuffix = text(body.source, 60).toLowerCase().replace(/[^a-z0-9_-]+/g, '_') || 'website_form';
    const guests = number(body.guests, null);
    const upstreamPayload = {
      name,
      phone: `+91${phoneDigits}`,
      email: text(body.email, 160) || null,
      source: `soubooking_${sourceSuffix}`,
      destination: 'Statue of Unity',
      message: text(body.message, 2000) || null,
      package: text(body.package || body.interest, 160) || null,
      nights: number(body.nights, null),
      guests: guests == null ? null : Math.max(1, Math.min(100, guests)),
      travel_date: text(body.travel_date, 30) || null,
      city: text(body.city, 100) || null,
      page_url: text(body.page_url, 500),
      page_title: text(body.page_title, 200),
      form_location: text(body.form_location, 80),
      submitted_at: new Date().toISOString(),
    };

    const host = String(req.headers.host || 'ttecrm.vercel.app');
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const upstream = await fetch(`${protocol}://${host}/api/leads`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WEBSITE_WEBHOOK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(upstreamPayload),
    });
    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok || !result?.ok) {
      console.error('soubooking lead forward failed', upstream.status, result);
      return res.status(502).json({ ok: false, error: 'Could not create CRM lead' });
    }

    return res.status(200).json({ ok: true, leadId: result.leadId, created: Boolean(result.created) });
  } catch (error: any) {
    console.error('/api/soubooking-lead error', error);
    return res.status(500).json({ ok: false, error: 'Could not create CRM lead' });
  }
}
