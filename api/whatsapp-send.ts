// ============================================================
// POST /api/whatsapp-send — CRM → WhatsApp (outbound)
// Body: { leadId, phone, message }
// Sends via Interakt's Send Text Message API, then logs the message
// as a 'WhatsApp' interaction on the lead (service role — bypasses RLS).
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

// Normalise to a bare 91XXXXXXXXXX (no +, no leading 0) for Interakt's fullPhoneNumber field.
function toFullPhone(raw: string): string | null {
  const digits = String(raw || '').replace(/[^0-9]/g, '');
  if (digits.length === 10) return '91' + digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return '91' + digits.slice(1);
  return digits.length >= 10 ? digits : null;
}

async function insertInteraction(leadId: string, contentObj: any) {
  const row = {
    id: `wa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    lead_id: leadId,
    type: 'WhatsApp',
    content: JSON.stringify(contentObj),
    sentiment: null,
    timestamp: new Date().toISOString(),
  };
  await fetch(`${SUPABASE_URL}/rest/v1/interactions`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });
}

const last10 = (raw: string) => String(raw || '').replace(/[^0-9]/g, '').slice(-10);

// Other leads sharing this same phone number should see this outbound message too —
// it's the same real WhatsApp conversation, just viewed from a different lead record.
async function findLeadIdsByPhone(phone10: string, alwaysInclude: string): Promise<string[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/leads?select=id&phone=ilike.*${phone10}`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  });
  const rows = await res.json().catch(() => []);
  const ids = new Set<string>(Array.isArray(rows) ? rows.map((r: any) => r.id) : []);
  ids.add(alwaysInclude);
  return Array.from(ids);
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
    return res.status(500).json({ error: 'WhatsApp integration is not configured on the server.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const { leadId, phone, message } = body;
    if (!leadId || !phone || !message || !String(message).trim()) {
      return res.status(400).json({ error: 'leadId, phone and message are required.' });
    }
    const fullPhoneNumber = toFullPhone(phone);
    if (!fullPhoneNumber) return res.status(400).json({ error: 'Invalid phone number.' });

    const rzRes = await fetch('https://api.interakt.ai/v1/public/message/', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${INTERAKT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fullPhoneNumber,
        type: 'Text',
        data: { message: String(message) },
      }),
    });
    const rzData = await rzRes.json().catch(() => ({}));

    const phone10 = last10(fullPhoneNumber);
    const leadIds = phone10.length === 10 ? await findLeadIdsByPhone(phone10, leadId) : [leadId];

    if (!rzRes.ok || rzData?.result === false) {
      await Promise.all(leadIds.map(id => insertInteraction(id, { direction: 'out', text: message, status: 'failed', error: rzData?.message, phone: phone10 })));
      return res.status(502).json({ error: rzData?.message || 'Failed to send WhatsApp message.' });
    }

    await Promise.all(leadIds.map(id => insertInteraction(id, { direction: 'out', text: message, status: 'sent', interaktId: rzData?.id, phone: phone10 })));
    return res.status(200).json({ ok: true, interaktId: rzData?.id });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
}
