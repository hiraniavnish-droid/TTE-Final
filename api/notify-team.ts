// ============================================================
// POST /api/notify-team — broadcast a lead-update to the whole team
// Body: { text }
//
// WhatsApp's official Business API cannot post into WhatsApp groups (a Meta
// platform restriction, not a plan limit), so "the team group" is emulated by
// sending the same message to every team member's own WhatsApp number via
// Interakt. Users with no phone on file are silently skipped.
//
// Fire-and-forget by design: notification failures must never block or roll
// back the CRM action that triggered them.
// ============================================================

const INTERAKT_API_KEY = process.env.INTERAKT_API_KEY || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function corsOrigin(origin: string): string | null {
  if (!origin) return null;
  if (origin === 'https://ttecrm.vercel.app') return origin;
  if (/^https:\/\/[a-z0-9-]+-avnishs-projects-[a-z0-9]+\.vercel\.app$/.test(origin)) return origin;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return origin;
  return null;
}

function toFullPhone(raw: string): string | null {
  const digits = String(raw || '').replace(/[^0-9]/g, '');
  if (digits.length === 10) return '91' + digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return '91' + digits.slice(1);
  return digits.length >= 10 ? digits : null;
}

async function sendWhatsApp(fullPhoneNumber: string, message: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('https://api.interakt.ai/v1/public/message/', {
      method: 'POST',
      headers: { Authorization: `Basic ${INTERAKT_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullPhoneNumber, type: 'Text', data: { message } }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.result !== false) return { ok: true };
    return { ok: false, error: data?.message || `HTTP ${res.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'network error' };
  }
}

export default async function handler(req: any, res: any) {
  const allowed = corsOrigin(req.headers?.origin || '');
  if (allowed) res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  if (!INTERAKT_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Notifications are not configured on the server.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const text = String(body.text || '').trim().slice(0, 1500);
    if (!text) return res.status(400).json({ error: 'text is required.' });

    const uRes = await fetch(`${SUPABASE_URL}/rest/v1/users?select=name,phone&phone=not.is.null`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    });
    const users: any[] = await uRes.json().catch(() => []);
    const targets = (Array.isArray(users) ? users : [])
      .map(u => ({ name: u.name, full: toFullPhone(u.phone) }))
      .filter(u => !!u.full);

    if (targets.length === 0) return res.status(200).json({ ok: true, sent: 0, skipped: 'no team phone numbers on file' });

    const results = await Promise.all(targets.map(t => sendWhatsApp(t.full as string, text)));
    // Per-recipient delivery record — shows up in Vercel function logs, so "why didn't
    // X get the alert?" is answerable (name + masked number + Interakt's exact error).
    const delivery = targets.map((t, i) => ({
      name: t.name,
      phone: `…${String(t.full).slice(-4)}`,
      ok: results[i].ok,
      ...(results[i].error ? { error: results[i].error } : {}),
    }));
    console.log('[notify-team]', JSON.stringify({ preview: text.slice(0, 60), delivery }));
    const sent = results.filter(r => r.ok).length;
    return res.status(200).json({ ok: true, sent, total: targets.length, delivery });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
}
