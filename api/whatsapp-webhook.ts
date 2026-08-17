// ============================================================
// POST /api/whatsapp-webhook — WhatsApp → CRM (inbound)
// Registered as Interakt's account-level "Configure Webhook" URL.
// Secured with a shared secret passed as ?key=... in the URL itself
// (Interakt's own "secret key" field mechanism isn't documented, so
// we don't rely on it — this query-param check is our own guard).
//
// On a new incoming message: match to a Lead by phone (last 10 digits) and log
// a 'WhatsApp' interaction on every matching lead. If no lead matches, the
// message is intentionally dropped — no lead is auto-created (business
// decision: check Interakt's own inbox directly for brand-new inquiries).
// Payload field names are NOT fully confirmed from docs — this parses
// defensively across the field names Interakt's other endpoints use
// (fullPhoneNumber/phoneNumber/countryCode, message/text/body) and logs
// the raw body so real traffic can be inspected via Vercel function logs.
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WEBHOOK_SECRET = process.env.INTERAKT_WEBHOOK_SECRET || '';
const INTERAKT_API_KEY = process.env.INTERAKT_API_KEY || '';

async function sendWhatsApp(fullPhoneNumber: string, message: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.interakt.ai/v1/public/message/', {
      method: 'POST',
      headers: { Authorization: `Basic ${INTERAKT_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullPhoneNumber, type: 'Text', data: { message } }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok && data?.result !== false;
  } catch { return false; }
}

const MENU_TEXT =
`🧭 *CEO Mode — available commands*

📊 *Summaries*
SUMMARY / DAILY — today so far
REPORT / DEEP — yesterday, full detail
WEEKLY · MONTHLY

💰 *Money*
REVENUE · PROFIT — this month, collected vs pending
PENDING — full outstanding-balance list
VENDORS — who's owed what

👥 *Team*
LEADERBOARD — ranked by revenue this month
STALE — leads untouched 48h+
SONALI · PRAKASH · JIGAR — that agent's stats

📦 *Pipeline*
PIPELINE — stage counts + value
HOT — hot leads not yet won
TRIPS — ongoing + departing soon

Text MENU anytime to see this again.`;

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

// A "text-shaped" field can itself be a nested object, not a plain string — unwrap
// those instead of letting them stringify to the literal "[object Object]".
function coerceText(v: any): string {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') {
    if (typeof v.body === 'string') return v.body;
    if (typeof v.text === 'string') return v.text;
    if (typeof v.caption === 'string') return v.caption;
  }
  return '';
}

function extractMessage(body: any): { phone: string; text: string; name: string; raw: any } | null {
  // Confirmed from real Interakt traffic on 2026-07-14 (message_received event):
  // { data: { customer: { phone_number, channel_phone_number, traits:{name} },
  //           message: { chat_message_type: 'CustomerMessage'|'AgentMessage', message: 'Hi', ... },
  //           channel_type: 'Whatsapp' } }
  // Interakt's own field for the message text is confusingly named `message.message`,
  // not `message.text` — that guess silently dropped every real event (returned
  // `{ok:true, ignored:true}` since !text, no error, just data loss).
  const d = body?.data || body?.message || body || {};
  const customer = body?.customer || d?.customer || {};

  // Only customer-authored messages are inbound replies — a human agent typing
  // directly in Interakt's own inbox UI fires this same webhook event and must NOT
  // be logged as if the client sent it.
  const chatMessageType = d.message?.chat_message_type;
  if (chatMessageType && chatMessageType !== 'CustomerMessage') return null;

  const phone =
    customer.phone_number || customer.channel_phone_number ||
    d.fullPhoneNumber || d.customerFullPhoneNumber || d.phoneNumber ||
    body.fullPhoneNumber || body.phoneNumber || body.from || '';

  const text =
    coerceText(d.message?.message) ||
    coerceText(d.message?.text) || coerceText(d.message) ||
    coerceText(d.text) || coerceText(d.body) ||
    coerceText(body.message) || coerceText(body.text) || '';

  const name = customer.traits?.name || d.customerName || d.name || '';

  if (!phone || !text) return null;
  return { phone: String(phone), text, name: String(name || ''), raw: body };
}

async function findLeadsByPhone(phone10: string): Promise<{ id: string }[]> {
  // A phone number can genuinely belong to more than one lead (repeat customer with a
  // past enquiry, a family member booking for someone else, dupes/seed data). Rather
  // than guessing which one a message "really" belongs to, log it on every matching
  // lead — most recently created first — so nothing is silently hidden from any of them.
  const res = await sb(`leads?select=id&phone=ilike.*${phone10}&order=created_at.desc`);
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
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
  await sb('interactions', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row) });
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  // Shared-secret guard — our own scheme, appended by us when we register the URL.
  const key = req.query?.key;
  if (!WEBHOOK_SECRET || key !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Invalid webhook key.' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Not configured.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    // Always log the raw payload once (Vercel function logs) so the real shape can be
    // confirmed from the first live event, without blocking/erroring the response.
    console.log('whatsapp-webhook raw payload:', JSON.stringify(body).slice(0, 2000));

    const msg = extractMessage(body);
    if (!msg) {
      // Not a recognisable incoming-message event (could be a delivery-status callback) — ack and ignore.
      return res.status(200).json({ ok: true, ignored: true });
    }

    const phone10 = last10(msg.phone);
    if (phone10.length !== 10) return res.status(200).json({ ok: true, ignored: true });

    // ── Admin chat commands ─────────────────────────────────────
    // An ADMIN texting a keyword to the business number gets the business summary
    // back on WhatsApp. Admin-only by sender phone — a customer texting "summary"
    // must fall through to the normal lead-message flow below.
    const command = msg.text.trim().toLowerCase();
    const PERIOD_COMMANDS: Record<string, { period: string; level: string }> = {
      'summary': { period: 'daily', level: 'detailed' },
      'daily': { period: 'daily', level: 'detailed' },
      'report': { period: 'daily', level: 'deep' },
      'deep': { period: 'daily', level: 'deep' },
      'weekly': { period: 'weekly', level: 'deep' },
      'monthly': { period: 'monthly', level: 'deep' },
    };
    const QUICK_COMMANDS: Record<string, { kind: string; agent?: string }> = {
      'revenue': { kind: 'revenue' },
      'profit': { kind: 'profit' },
      'pending': { kind: 'pending' },
      'vendors': { kind: 'vendors' },
      'leaderboard': { kind: 'leaderboard' },
      'stale': { kind: 'stale' },
      'pipeline': { kind: 'pipeline' },
      'hot': { kind: 'hot' },
      'trips': { kind: 'trips' },
      'sonali': { kind: 'agent', agent: 'Sonali' },
      'prakash': { kind: 'agent', agent: 'Prakash' },
      'jigar': { kind: 'agent', agent: 'Jigar' },
    };
    const MENU_COMMANDS = new Set(['menu', 'help', 'ceo', 'ceo mode', 'ceo mode on', 'commands']);

    const isAdminCommand = !!PERIOD_COMMANDS[command] || !!QUICK_COMMANDS[command] || MENU_COMMANDS.has(command);
    if (isAdminCommand) {
      const aRes = await sb(`users?select=phone&role=eq.admin&phone=not.is.null`);
      const admins = await aRes.json().catch(() => []);
      const isAdmin = (Array.isArray(admins) ? admins : []).some((u: any) => last10(u.phone) === phone10);
      if (isAdmin) {
        if (MENU_COMMANDS.has(command)) {
          const ok = await sendWhatsApp(msg.phone.startsWith('91') || msg.phone.length > 10 ? msg.phone : `91${phone10}`, MENU_TEXT);
          console.log('[whatsapp-webhook] admin command menu', ok);
          return res.status(200).json({ ok: true, command: 'menu', sent: ok });
        }
        const body = PERIOD_COMMANDS[command] || QUICK_COMMANDS[command];
        // Reuse the summary endpoint on this same deployment (server-to-server, CORS n/a).
        const host = req.headers?.host || 'ttecrm.vercel.app';
        const r = await fetch(`https://${host}/api/team-summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const d = await r.json().catch(() => ({}));
        console.log('[whatsapp-webhook] admin command', command, JSON.stringify(d));
        return res.status(200).json({ ok: true, command, ...d });
      }
      // Admin-only command word from a non-admin sender falls through to normal
      // lead-message logging below — a customer legitimately texting "help" or
      // "pending" must not be silently swallowed.
    }

    const matches = await findLeadsByPhone(phone10);
    if (matches.length === 0) {
      // No existing lead for this number — per business decision, we do NOT
      // auto-create one (was previously a race: two near-simultaneous first
      // messages from the same new number could create duplicate leads).
      // The message is intentionally not logged anywhere; check Interakt's
      // own inbox directly for genuinely new inquiries.
      return res.status(200).json({ ok: true, ignored: true, reason: 'no matching lead' });
    }

    const leadIds = matches.map(l => l.id);
    await Promise.all(leadIds.map(id => insertInteraction(id, { direction: 'in', text: msg.text, status: 'received', phone: phone10 })));

    return res.status(200).json({ ok: true, leadIds });
  } catch (e: any) {
    console.error('whatsapp-webhook error:', e?.message);
    // Still 200 — Interakt shouldn't retry-storm us over a parsing issue on our side.
    return res.status(200).json({ ok: false, error: e?.message });
  }
}
