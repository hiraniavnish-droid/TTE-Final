// ============================================================
// POST/GET /api/documents — Voucher / GST invoice numbering system
//
// Documents (receipts + GST invoices) go through a request → approve/reject
// workflow. A sequential number is only ever minted at APPROVAL time (via the
// atomic `increment_document_counter` Postgres function), so a rejected
// request never burns a number or creates a gap in the sequence your CA sees.
//
// Actions (POST body.action):
//   request           — any authenticated user creates a pending document
//   approve           — admin only; mints the number, marks issued
//   reject            — admin only; discards, no number consumed
//   cancel            — admin only; retires an already-issued number (never
//                        deleted/renumbered — GST compliance requires the
//                        cancelled number to remain visible in the sequence)
//   register_external — any authenticated user logs a number that was
//                        created by hand outside the CRM; does not touch the
//                        CRM's own auto-incrementing counter
//
// GET ?leadId=... and/or ?status=... — list documents for the approval UI.
//
// Auth: the same passcode-session JWT used everywhere else in the app is
// verified here (HMAC signature + expiry) so `approve`/`reject`/`cancel` can
// be restricted to app_role === 'admin' server-side, not just hidden in the UI.
// ============================================================

import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || '';

function corsOrigin(origin: string): string | null {
  if (!origin) return null;
  if (origin === 'https://ttecrm.vercel.app') return origin;
  if (/^https:\/\/[a-z0-9-]+-avnishs-projects-[a-z0-9]+\.vercel\.app$/.test(origin)) return origin;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return origin;
  return null;
}

interface SessionUser {
  id: string;
  name: string;
  role: 'admin' | 'agent' | string;
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function verifyToken(authHeader: string | undefined): SessionUser | null {
  if (!authHeader || !JWT_SECRET) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  const expectedSig = Buffer.from(
    crypto.createHmac('sha256', JWT_SECRET).update(`${headerB64}.${payloadB64}`).digest()
  );
  const gotSig = b64urlDecode(sigB64);
  if (expectedSig.length !== gotSig.length || !crypto.timingSafeEqual(expectedSig, gotSig)) return null;
  let payload: any;
  try { payload = JSON.parse(b64urlDecode(payloadB64).toString('utf8')); } catch { return null; }
  if (!payload?.exp || payload.exp * 1000 < Date.now()) return null;
  return { id: payload.app_user_id, name: payload.name, role: payload.app_role };
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

async function fetchDocument(id: string): Promise<any | null> {
  const res = await sb(`documents?id=eq.${encodeURIComponent(id)}&select=*`);
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

const genId = () => `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export default async function handler(req: any, res: any) {
  const allowed = corsOrigin(req.headers?.origin || '');
  if (allowed) res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !JWT_SECRET) {
    return res.status(500).json({ error: 'Not configured on the server.' });
  }

  const user = verifyToken(req.headers?.authorization);
  if (!user) return res.status(401).json({ error: 'Sign in required.' });

  try {
    if (req.method === 'GET') {
      const leadId = Array.isArray(req.query.leadId) ? req.query.leadId[0] : req.query.leadId;
      const status = Array.isArray(req.query.status) ? req.query.status[0] : req.query.status;
      const clauses: string[] = [];
      if (leadId) clauses.push(`lead_id=eq.${encodeURIComponent(leadId)}`);
      if (status) clauses.push(`status=eq.${encodeURIComponent(status)}`);
      const qs = clauses.length ? `&${clauses.join('&')}` : '';
      const rRes = await sb(`documents?select=*&order=created_at.desc${qs}`);
      const rows = await rRes.json().catch(() => []);
      return res.status(200).json({ documents: rows });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const action = body.action;

    // ─── Request a new voucher/invoice — creates a PENDING row, no number yet ───
    if (action === 'request') {
      const docType = body.docType;
      if (docType !== 'invoice' && docType !== 'receipt') {
        return res.status(400).json({ error: 'docType must be "invoice" or "receipt".' });
      }
      if (!body.leadId || !body.paymentId || !body.paymentReferenceId || !(Number(body.amount) > 0)) {
        return res.status(400).json({ error: 'leadId, paymentId, paymentReferenceId and a positive amount are required.' });
      }
      const taxType = ['none', 'cgst_sgst', 'igst'].includes(body.taxType) ? body.taxType : 'none';
      const row = {
        id: genId(),
        doc_type: docType,
        number: null,
        status: 'pending',
        source: 'system',
        lead_id: String(body.leadId),
        lead_name: body.leadName ? String(body.leadName).slice(0, 200) : null,
        payment_id: String(body.paymentId),
        payment_reference_id: String(body.paymentReferenceId),
        amount: Number(body.amount),
        customer_name: body.customerName ? String(body.customerName).slice(0, 200) : null,
        customer_phone: body.customerPhone ? String(body.customerPhone).slice(0, 30) : null,
        customer_gstin: body.customerGstin ? String(body.customerGstin).slice(0, 20) : null,
        place_of_supply: body.placeOfSupply ? String(body.placeOfSupply).slice(0, 100) : null,
        tax_type: taxType,
        tax_rate: taxType === 'none' ? 0 : Number(body.taxRate) || 0,
        taxable_value: Number(body.taxableValue) || Number(body.amount),
        cgst_amount: taxType === 'cgst_sgst' ? Number(body.cgstAmount) || 0 : 0,
        sgst_amount: taxType === 'cgst_sgst' ? Number(body.sgstAmount) || 0 : 0,
        igst_amount: taxType === 'igst' ? Number(body.igstAmount) || 0 : 0,
        notes: body.notes ? String(body.notes).slice(0, 1000) : null,
        requested_by: user.name,
        requested_at: new Date().toISOString(),
      };
      const insertRes = await sb('documents', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(row),
      });
      const inserted = await insertRes.json().catch(() => null);
      if (!insertRes.ok) return res.status(500).json({ error: 'Failed to create request.', detail: inserted });
      return res.status(200).json({ document: Array.isArray(inserted) ? inserted[0] : inserted });
    }

    // ─── Register a document that was already created by hand outside the CRM ───
    if (action === 'register_external') {
      if (!body.number || !body.docType || !body.leadId || !body.paymentId || !body.paymentReferenceId) {
        return res.status(400).json({ error: 'number, docType, leadId, paymentId and paymentReferenceId are required.' });
      }
      if (body.docType !== 'invoice' && body.docType !== 'receipt') {
        return res.status(400).json({ error: 'docType must be "invoice" or "receipt".' });
      }
      const row = {
        id: genId(),
        doc_type: body.docType,
        number: String(body.number).slice(0, 100),
        status: 'issued',
        source: 'external',
        lead_id: String(body.leadId),
        lead_name: body.leadName ? String(body.leadName).slice(0, 200) : null,
        payment_id: String(body.paymentId),
        payment_reference_id: String(body.paymentReferenceId),
        amount: Number(body.amount) || 0,
        customer_name: body.customerName ? String(body.customerName).slice(0, 200) : null,
        customer_phone: body.customerPhone ? String(body.customerPhone).slice(0, 30) : null,
        notes: body.notes ? String(body.notes).slice(0, 1000) : null,
        requested_by: user.name,
        requested_at: new Date().toISOString(),
        approved_by: user.name,
        approved_at: new Date().toISOString(),
      };
      const insertRes = await sb('documents', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(row),
      });
      const inserted = await insertRes.json().catch(() => null);
      if (!insertRes.ok) return res.status(500).json({ error: 'Failed to register document.', detail: inserted });
      return res.status(200).json({ document: Array.isArray(inserted) ? inserted[0] : inserted });
    }

    // ─── Everything past this point mutates an official number — admin only ───
    if (action === 'approve' || action === 'reject' || action === 'cancel') {
      if (user.role !== 'admin') return res.status(403).json({ error: 'Only Admin can do this.' });
      if (!body.id) return res.status(400).json({ error: 'Missing document id.' });
      const doc = await fetchDocument(String(body.id));
      if (!doc) return res.status(404).json({ error: 'Document not found.' });

      if (action === 'approve') {
        // Single atomic Postgres function: row-locks the document, checks it's
        // still 'pending', mints the number and marks it issued — all in one
        // transaction. If this same document is approved twice concurrently
        // (double-click, two tabs), the second call blocks on the lock, then
        // sees it's no longer pending and fails WITHOUT touching the counter,
        // so no number is ever wasted/gapped by a race.
        const rpcRes = await sb('rpc/approve_document', {
          method: 'POST',
          body: JSON.stringify({ p_id: doc.id, p_approver: user.name }),
        });
        const result = await rpcRes.json().catch(() => null);
        if (!rpcRes.ok) {
          const msg = result?.message || 'Could not approve this document.';
          return res.status(409).json({ error: msg });
        }
        return res.status(200).json({ document: result });
      }

      // reject/cancel: the expected status goes in the WHERE clause, so the UPDATE
      // itself is the check. A single conditional UPDATE is atomic in Postgres, so
      // if a concurrent approve_document() has already flipped the row, zero rows
      // match and we 409 instead of silently overwriting a freshly-issued (and
      // number-consuming) document back to rejected/cancelled.
      if (action === 'reject') {
        if (doc.status !== 'pending') return res.status(400).json({ error: `Cannot reject a ${doc.status} document.` });
        const patchRes = await sb(`documents?id=eq.${encodeURIComponent(doc.id)}&status=eq.pending`, {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ status: 'rejected', rejected_by: user.name, rejected_at: new Date().toISOString() }),
        });
        const updated = await patchRes.json().catch(() => null);
        const row = Array.isArray(updated) ? updated[0] : updated;
        if (!patchRes.ok || !row) {
          const current = await fetchDocument(String(body.id));
          return res.status(409).json({ error: `This document is no longer pending${current ? ` — it is now ${current.status}` : ''}. Refresh and try again.` });
        }
        return res.status(200).json({ document: row });
      }

      // action === 'cancel'
      if (doc.status !== 'issued') return res.status(400).json({ error: `Cannot cancel a ${doc.status} document.` });
      if (!body.reason || !String(body.reason).trim()) {
        return res.status(400).json({ error: 'A cancellation reason is required.' });
      }
      const patchRes = await sb(`documents?id=eq.${encodeURIComponent(doc.id)}&status=eq.issued`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          status: 'cancelled',
          cancelled_by: user.name,
          cancelled_at: new Date().toISOString(),
          cancellation_reason: String(body.reason).slice(0, 1000),
        }),
      });
      const updated = await patchRes.json().catch(() => null);
      const row = Array.isArray(updated) ? updated[0] : updated;
      if (!patchRes.ok || !row) {
        const current = await fetchDocument(String(body.id));
        return res.status(409).json({ error: `This document is no longer issued${current ? ` — it is now ${current.status}` : ''}. Refresh and try again.` });
      }
      return res.status(200).json({ document: row });
    }

    return res.status(400).json({ error: 'Unknown action.' });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
}
