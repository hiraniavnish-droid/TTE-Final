import crypto from 'node:crypto';
// ============================================================
// Vercel Serverless Function — Razorpay Payment Links + manual payments
//
// Each payment is ONE ROW in the `payments` table. Every write below touches
// exactly the row it owns (INSERT one / UPDATE one by id) — never the whole
// collection.
//
// This replaced an earlier design where all records lived in a single
// tte-payments/_master.json blob that each write rewrote wholesale. That lost
// records for real: two agents creating links at once, or anyone loading the
// Payments page (which runs refreshStatuses, several seconds of Razorpay calls)
// while a colleague recorded a payment, would write back a stale array and
// silently delete the other's record — while the Razorpay link stayed live and
// payable. Rows make that impossible; do not reintroduce a read-all/write-all
// pattern here.
//
// POST   /api/razorpay-link            → create a link (leadId optional)
// POST   { manual: true, ... }         → log an already-received payment
// GET    /api/razorpay-link            → list ALL payments (generic page)
// GET    /api/razorpay-link?leadId=..  → list payments for one lead (widget)
// PATCH  /api/razorpay-link            → assign/reassign { id, leadId, leadName }
//
// Secrets (Vercel env): RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET,
//                       SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================

const RZP_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const INTERAKT_API_KEY = process.env.INTERAKT_API_KEY || '';

// Corrections require a current staff session; gateway-owned entries are read-only.
async function paymentEditor(auth: string): Promise<{ name: string } | null> {
  try {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret || !/^Bearer /i.test(auth)) return null;
    const [h, p, sig, extra] = auth.replace(/^Bearer\s+/i, '').split('.');
    if (!h || !p || !sig || extra) return null;
    if (JSON.parse(Buffer.from(h, 'base64url').toString()).alg !== 'HS256') return null;
    const expected = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest();
    const actual = Buffer.from(sig, 'base64url');
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
    if (!(claims.exp * 1000 > Date.now()) || !claims.app_user_id) return null;
    const res = await sb(`users?id=eq.${encodeURIComponent(claims.app_user_id)}&select=name,role,session_version&limit=1`);
    const rows = await res.json();
    const user = rows[0];
    if (!res.ok || !user || !['admin','agent'].includes(user.role) || Number(user.session_version) !== Number(claims.session_version)) return null;
    return { name: user.name };
  } catch { return null; }
}

// ─── Team WhatsApp notification (fire-and-forget) ──────────────
// WhatsApp Business API can't post to groups (Meta restriction), so "notify the
// team" = the same Interakt DM to every user with a phone on file. Failures are
// swallowed — a notification must never fail a payment write.
function notifyTeamPhone(raw: string): string | null {
  const digits = String(raw || '').replace(/[^0-9]/g, '');
  if (digits.length === 10) return '91' + digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return '91' + digits.slice(1);
  return digits.length >= 10 ? digits : null;
}
async function notifyTeam(text: string): Promise<void> {
  if (!INTERAKT_API_KEY) return;
  try {
    const uRes = await fetch(`${SUPABASE_URL}/rest/v1/users?select=phone&phone=not.is.null`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    });
    const users: any[] = await uRes.json().catch(() => []);
    const phones = (Array.isArray(users) ? users : []).map(u => notifyTeamPhone(u.phone)).filter(Boolean) as string[];
    await Promise.all(phones.map(fullPhoneNumber =>
      fetch('https://api.interakt.ai/v1/public/message/', {
        method: 'POST',
        headers: { Authorization: `Basic ${INTERAKT_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullPhoneNumber, type: 'Text', data: { message: text } }),
      }).catch(() => null)
    ));
  } catch { /* best-effort */ }
}
const fmtINR = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');

const FINAL_STATUSES = ['paid', 'cancelled', 'expired'];
const LEAD_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_AMOUNT = 5_000_000;   // ₹50 lakh sanity cap per link
const MAX_REFRESH = 60;         // cap live status refreshes per request

function corsOrigin(origin: string): string | null {
  if (!origin) return null;
  if (origin === 'https://ttecrm.vercel.app') return origin;
  if (/^https:\/\/[a-z0-9-]+-avnishs-projects-[a-z0-9]+\.vercel\.app$/.test(origin)) return origin;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return origin;
  return null;
}

interface PaymentRecord {
  id: string;
  reference_id: string;
  short_url: string;
  amount: number;
  currency: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  status: string;
  description: string;
  created_at: string;
  created_by: string;
  paid_at: string | null;
  razorpay_payment_id: string | null;
  leadId: string | null;    // linked customer/lead (null = unassigned)
  leadName: string | null;  // display name of the linked lead
  source: 'razorpay' | 'manual'; // how this payment was recorded
  method?: string;          // manual only: Cash | Cheque | Bank Transfer | UPI | Other
  manual_reference?: string; // manual only: cheque no. / UTR / transaction ref
  notes?: string;
}

const MANUAL_METHODS = ['Cash', 'Cheque', 'Bank Transfer', 'UPI', 'Other'];

function rzpAuthHeader(): string {
  const token = Buffer.from(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`).toString('base64');
  return `Basic ${token}`;
}

function formatContact(phone: string): string {
  const digits = (phone || '').replace(/[^0-9]/g, '');
  if (digits.length === 10) return '+91' + digits;
  if (digits.length === 11 && digits.startsWith('0')) return '+91' + digits.slice(1);
  if (digits.length === 12 && digits.startsWith('91')) return '+' + digits;
  if (digits.length === 13 && digits.startsWith('91')) return '+' + digits.slice(0, 12);
  return digits ? '+' + digits : '';
}

// ─── payments table (one row per payment) ──────────────────────
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

// The table is snake_case throughout; the API has always exposed leadId/leadName
// in camelCase. Map at the boundary so the frontend contract is unchanged.
const rowToRecord = (r: any): PaymentRecord => ({
  id: r.id,
  reference_id: r.reference_id,
  short_url: r.short_url || '',
  amount: Number(r.amount) || 0,
  currency: r.currency || 'INR',
  customer_name: r.customer_name || '',
  customer_phone: r.customer_phone || '',
  customer_email: r.customer_email || '',
  status: r.status,
  description: r.description || '',
  created_at: r.created_at,
  created_by: r.created_by || '',
  paid_at: r.paid_at,
  razorpay_payment_id: r.razorpay_payment_id,
  leadId: r.lead_id,
  leadName: r.lead_name,
  source: r.source,
  ...(r.method ? { method: r.method } : {}),
  ...(r.manual_reference ? { manual_reference: r.manual_reference } : {}),
  ...(r.notes ? { notes: r.notes } : {}),
});

const recordToRow = (rec: PaymentRecord) => ({
  id: rec.id,
  reference_id: rec.reference_id,
  short_url: rec.short_url || '',
  amount: rec.amount,
  currency: rec.currency,
  customer_name: rec.customer_name,
  customer_phone: rec.customer_phone,
  customer_email: rec.customer_email,
  status: rec.status,
  description: rec.description,
  created_at: rec.created_at,
  created_by: rec.created_by,
  paid_at: rec.paid_at,
  razorpay_payment_id: rec.razorpay_payment_id,
  lead_id: rec.leadId,
  lead_name: rec.leadName,
  source: rec.source,
  method: rec.method ?? null,
  manual_reference: rec.manual_reference ?? null,
  notes: rec.notes ?? null,
});

async function insertRecord(rec: PaymentRecord): Promise<PaymentRecord> {
  const res = await sb('payments', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(recordToRow(rec)),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Failed to save payment: ${JSON.stringify(data)}`);
  return rowToRecord(Array.isArray(data) ? data[0] : data);
}

async function listRecords(opts: { leadId?: string; createdBy?: string } = {}): Promise<PaymentRecord[]> {
  const clauses = ['select=*', 'order=created_at.desc'];
  if (opts.leadId) clauses.push(`lead_id=eq.${encodeURIComponent(opts.leadId)}`);
  const res = await sb(`payments?${clauses.join('&')}`);
  const rows = await res.json().catch(() => []);
  if (!Array.isArray(rows)) return [];
  const out = rows.map(rowToRecord);
  // Per-user visibility is a case-insensitive match, which PostgREST can't express
  // on a plain column filter — do it here rather than risk an index-less ilike.
  return opts.createdBy
    ? out.filter(r => (r.created_by || '').toLowerCase() === opts.createdBy!.toLowerCase())
    : out;
}

// Refresh live status against Razorpay. Each changed record is written back on
// its own (UPDATE ... WHERE id = <that row>), so a slow refresh here can never
// clobber a payment someone else creates while it runs.
async function refreshStatuses(records: PaymentRecord[], onlyLeadId?: string): Promise<void> {
  if (!RZP_KEY_ID || !RZP_KEY_SECRET) return; // nothing to poll against
  let budget = MAX_REFRESH;
  for (const rec of records) {
    if (budget <= 0) break;
    if (rec.source === 'manual') continue;          // no Razorpay link behind it
    if (FINAL_STATUSES.includes(rec.status)) continue;
    if (onlyLeadId && rec.leadId !== onlyLeadId) continue;
    budget--;
    try {
      const res = await fetch(`https://api.razorpay.com/v1/payment_links/${rec.id}`, {
        headers: { Authorization: rzpAuthHeader() },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.status || data.status === rec.status) continue;

      const patch: any = { status: data.status };
      if (data.status === 'paid') {
        patch.paid_at = new Date().toISOString();
        if (Array.isArray(data.payments) && data.payments[0]) {
          patch.razorpay_payment_id = data.payments[0].payment_id || null;
        }
      }
      await sb(`payments?id=eq.${encodeURIComponent(rec.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(patch),
      });
      // Reflect it in the copy we're about to return, so the caller sees fresh data.
      Object.assign(rec, { status: patch.status, paid_at: patch.paid_at ?? rec.paid_at, razorpay_payment_id: patch.razorpay_payment_id ?? rec.razorpay_payment_id });
      if (patch.status === 'paid') {
        void notifyTeam(`💰 *Payment Received*\n${rec.customer_name || rec.leadName || 'Customer'}\n${fmtINR(rec.amount)} via Razorpay${rec.leadName ? `\nLead: ${rec.leadName}` : ''}`);
      }
    } catch { /* skip transient errors */ }
  }
}

// ─── Razorpay ──────────────────────────────────────────────────
async function createLink(body: any): Promise<PaymentRecord> {
  const { amount, name, phone, email, description, createdBy, sendSms } = body;
  const leadId: string | null = body.leadId && LEAD_ID_RE.test(String(body.leadId)) ? String(body.leadId) : null;
  const leadName: string | null = body.leadName ? String(body.leadName).slice(0, 120) : null;
  const amt = Number(amount);
  const refTag = leadId ? String(leadId).slice(0, 8) : 'GEN';
  const referenceId = `TTE-${refTag}-${Date.now().toString(36).toUpperCase()}`;

  const contact = formatContact(phone);
  const hasContact = contact.length >= 12;
  const wantsSms = !!sendSms && hasContact;

  const payload: any = {
    amount: Math.round(amt * 100),
    currency: 'INR',
    accept_partial: false,
    description: (description && String(description).trim()) || `Payment — ${name}`,
    reference_id: referenceId,
    notify: { sms: wantsSms, email: wantsSms && !!email },
    reminder_enable: true,
    notes: { lead_id: leadId || '', created_by: createdBy || '' },
  };
  const customer: any = {};
  if (name) customer.name = name;
  if (hasContact) customer.contact = contact;
  if (email) customer.email = email;
  if (customer.contact || customer.email) payload.customer = customer;

  const res = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: { Authorization: rzpAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.description || 'Razorpay could not create the link');

  const record: PaymentRecord = {
    id: data.id,
    reference_id: data.reference_id || referenceId,
    short_url: data.short_url,
    amount: amt,
    currency: 'INR',
    customer_name: name || 'Customer',
    customer_phone: phone || '',
    customer_email: email || '',
    status: data.status || 'created',
    description: payload.description,
    created_at: new Date().toISOString(),
    created_by: createdBy || '',
    paid_at: null,
    razorpay_payment_id: null,
    leadId,
    leadName,
    source: 'razorpay',
  };

  return insertRecord(record);
}

// ─── Manual payment (cash / cheque / bank transfer / UPI recorded after the fact) ─
async function createManualPayment(body: any): Promise<PaymentRecord> {
  const { amount, name, phone, email, method, manualReference, notes, paidAt, createdBy } = body;
  const leadId: string | null = body.leadId && LEAD_ID_RE.test(String(body.leadId)) ? String(body.leadId) : null;
  const leadName: string | null = body.leadName ? String(body.leadName).slice(0, 120) : null;
  const amt = Number(amount);
  const refTag = leadId ? String(leadId).slice(0, 8) : 'GEN';
  const referenceId = `TTE-MAN-${refTag}-${Date.now().toString(36).toUpperCase()}`;
  const chosenMethod = MANUAL_METHODS.includes(method) ? method : 'Other';

  const record: PaymentRecord = {
    id: `manual_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    reference_id: referenceId,
    short_url: '',
    amount: amt,
    currency: 'INR',
    customer_name: name || 'Customer',
    customer_phone: phone || '',
    customer_email: email || '',
    status: 'paid', // manual entries are logged only after money is actually received
    description: (notes && String(notes).trim()) || `Manual payment — ${chosenMethod}`,
    created_at: new Date().toISOString(),
    created_by: createdBy || '',
    paid_at: paidAt ? new Date(paidAt).toISOString() : new Date().toISOString(),
    razorpay_payment_id: null,
    leadId,
    leadName,
    source: 'manual',
    method: chosenMethod,
    manual_reference: manualReference ? String(manualReference).slice(0, 120) : '',
    notes: notes ? String(notes).slice(0, 500) : '',
  };

  const saved = await insertRecord(record);
  void notifyTeam(`💰 *Payment Received*\n${saved.customer_name}\n${fmtINR(saved.amount)} via ${chosenMethod}${saved.leadName ? `\nLead: ${saved.leadName}` : ''}${saved.created_by ? `\n— recorded by ${saved.created_by}` : ''}`);
  return saved;
}

// ─── Handler ───────────────────────────────────────────────────
export default async function handler(req: any, res: any) {
  const allowed = corsOrigin(req.headers?.origin || '');
  if (allowed) res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return res.status(500).json({ error: 'Supabase storage is not configured on the server.' });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      if (body.leadId && !LEAD_ID_RE.test(String(body.leadId))) {
        return res.status(400).json({ error: 'Invalid lead reference.' });
      }
      const amt = Number(body.amount);
      if (!(amt >= 1) || amt > MAX_AMOUNT) {
        return res.status(400).json({ error: `Amount must be between ₹1 and ₹${MAX_AMOUNT.toLocaleString('en-IN')}.` });
      }

      // ─── Manual payment (cash/cheque/bank transfer/UPI) — no Razorpay call ───
      if (body.manual === true) {
        if (!body.method || !MANUAL_METHODS.includes(body.method)) {
          return res.status(400).json({ error: 'Pick a valid payment method.' });
        }
        if (body.manualReference && String(body.manualReference).length > 120) {
          return res.status(400).json({ error: 'Reference is too long.' });
        }
        const record = await createManualPayment(body);
        return res.status(200).json({ record });
      }

      // ─── Razorpay link ───
      if (!RZP_KEY_ID || !RZP_KEY_SECRET) {
        return res.status(500).json({ error: 'Razorpay keys are not configured on the server.' });
      }
      if (!body.name || String(body.name).length > 120) {
        return res.status(400).json({ error: 'Customer name is missing or too long.' });
      }
      if (body.description && String(body.description).length > 255) {
        return res.status(400).json({ error: 'Description is too long.' });
      }
      if (body.sendSms && formatContact(body.phone).length < 12) {
        return res.status(400).json({ error: 'A valid phone number is required to send an SMS.' });
      }
      const record = await createLink(body);
      return res.status(200).json({ record });
    }

    if (req.method === 'PATCH') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      if (!body.id) return res.status(400).json({ error: 'Missing payment id.' });
      if (body.action === 'edit_manual') {
        const editor = await paymentEditor(String(req.headers.authorization || ''));
        if (!editor) return res.status(401).json({ error: 'Sign in again before editing a payment.' });
        const read = await sb(`payments?id=eq.${encodeURIComponent(String(body.id))}&select=*&limit=1`);
        if (!read.ok) return res.status(500).json({ error: 'Could not load payment.' });
        const rows = await read.json();
        const current = rows[0];
        if (!current) return res.status(404).json({ error: 'Payment not found.' });
        if (current.source !== 'manual') return res.status(400).json({ error: 'Gateway payments cannot be edited here.' });
        const amount = Number(body.amount);
        if (!Number.isFinite(amount) || amount < 1 || amount > MAX_AMOUNT || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001) return res.status(400).json({ error: 'Enter a valid payment amount with at most two decimals.' });
        if (!MANUAL_METHODS.includes(body.method)) return res.status(400).json({ error: 'Pick a valid payment method.' });
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.paidAt || '')) || Number.isNaN(Date.parse(body.paidAt)) || new Date(body.paidAt).toISOString().slice(0,10) !== body.paidAt) return res.status(400).json({ error: 'Enter a valid received date.' });
        if (!String(body.name || '').trim() || String(body.name).length > 120) return res.status(400).json({ error: 'Enter a customer name (up to 120 characters).' });
        if (String(body.manualReference || '').length > 120 || String(body.notes || '').length > 500 || String(body.phone || '').length > 40 || String(body.email || '').length > 254) return res.status(400).json({ error: 'One of the payment details is too long.' });
        const patch = { amount, method: body.method, paid_at: String(current.paid_at || '').slice(0,10) === body.paidAt ? current.paid_at : new Date(body.paidAt).toISOString(), manual_reference: String(body.manualReference || ''), notes: String(body.notes || ''), customer_name: String(body.name).trim(), customer_phone: String(body.phone || ''), customer_email: String(body.email || '') };
        const before = Object.fromEntries(Object.keys(patch).map(key => [key, current[key]]));
        if (!body.expected || Object.keys(patch).some(key => String(body.expected[key] ?? '') !== String(current[key] ?? ''))) return res.status(409).json({ error: 'This payment changed since you opened it. Refresh and try again.' });
        // Compare-and-swap on the same fields prevents a concurrent correction
        // from being overwritten after the read above. Never rewrite linkage or IDs.
        const query = new URLSearchParams({ id: `eq.${current.id}`, source: 'eq.manual' });
        for (const key of Object.keys(patch)) {
          const value = current[key];
          query.set(key, value == null ? 'is.null' : `eq.${String(value)}`);
        }
        const saved = await sb(`payments?${query}`, { method:'PATCH', headers:{Prefer:'return=representation'}, body:JSON.stringify(patch) });
        if (!saved.ok) return res.status(500).json({ error: 'Could not save payment changes.' });
        const updated = (await saved.json())[0];
        if (!updated) return res.status(409).json({ error: 'Another person changed this payment. Refresh and try again.' });
        let auditOk = false;
        try {
        const audit = await sb('activity_logs', { method:'POST', body:JSON.stringify({ id:`payment_edit_${crypto.randomUUID()}`, agent_name:editor.name, action_type:'COMMENT', details:`Payment ${current.reference_id} corrected`, timestamp:new Date().toISOString(), lead_id:current.lead_id, metadata:{kind:'payment_correction',paymentId:current.id,before,after:patch} }) });
        auditOk = audit.ok;
        } catch { /* Payment is saved; surface audit failure without retrying it. */ }
        return res.status(200).json({ record:rowToRecord(updated), ...(!auditOk ? {warning:'Payment updated, but its activity log could not be saved.'} : {}) });
      }

      if (!Object.prototype.hasOwnProperty.call(body, 'leadId')) return res.status(400).json({ error: 'Specify a lead or use the payment edit action.' });
      const leadId: string | null = body.leadId && LEAD_ID_RE.test(String(body.leadId)) ? String(body.leadId) : null;
      if (body.leadId && !leadId) return res.status(400).json({ error: 'Invalid lead reference.' });

      // Targeted UPDATE of just this row — reassigning one payment can no longer
      // revert a different payment someone else is reassigning at the same time.
      const patch: any = { lead_id: leadId };
      if (leadId) {
        if (body.leadName) patch.lead_name = String(body.leadName).slice(0, 120);
      } else {
        patch.lead_name = null; // unassigned → drop the stale name too
      }
      const patchRes = await sb(`payments?id=eq.${encodeURIComponent(String(body.id))}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(patch),
      });
      const data = await patchRes.json().catch(() => null);
      const row = Array.isArray(data) ? data[0] : data;
      if (!patchRes.ok) return res.status(500).json({ error: 'Failed to update payment.', detail: data });
      if (!row) return res.status(404).json({ error: 'Payment not found.' });
      return res.status(200).json({ record: rowToRecord(row) });
    }

    if (req.method === 'GET') {
      const leadId = Array.isArray(req.query.leadId) ? req.query.leadId[0] : req.query.leadId;
      const createdBy = Array.isArray(req.query.createdBy) ? req.query.createdBy[0] : req.query.createdBy;
      // Callers that just need to READ (e.g. the Dashboard's payment summary) can skip the
      // live Razorpay poll — up to MAX_REFRESH sequential external calls, several seconds.
      // The Payments page still refreshes live (its own "Refresh" button + initial load).
      const skipRefresh = req.query.skipRefresh === '1';

      if (leadId) {
        if (!LEAD_ID_RE.test(String(leadId))) return res.status(400).json({ error: 'Invalid lead reference.' });
        const records = await listRecords({ leadId: String(leadId) });
        if (!skipRefresh) await refreshStatuses(records, String(leadId));
        return res.status(200).json({ records });
      }

      // Per-user visibility: when a createdBy is supplied (non-admin), return only
      // that agent's payments. Admin omits the param and sees everything.
      const records = await listRecords({ createdBy: createdBy ? String(createdBy) : undefined });
      if (!skipRefresh) await refreshStatuses(records);
      return res.status(200).json({ records });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
}
