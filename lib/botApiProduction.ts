import { souCatalog, souHotelRates, souItineraryQuote, souQuote } from './botSou';
import {messageInput,quoteInput,settingsInput,MaxInputError,messageTime,dispatchWebhooks} from './maxAutomation';
import { quoteStorage, QuoteStorageError } from './quoteStorage';
import { takeIfMatch, tripUpdate, LeadUpdateError } from './botLeadUpdates';
import { catalog, hotels, packages, itineraryQuote, rannQuote, QuoteInputError } from './botItinerary';
import { createRannQuotationPdf } from '../services/rannQuotationPdf';
import crypto from 'node:crypto';

// Bot-facing API. It deliberately does not share the browser's passcode
// session, Supabase anon key, or UI code path. Every request is authenticated
// server-side and all mutations are idempotent and audited.

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PRIMARY_API_KEY = process.env.API_KEY || '';
const CURSOR_SECRET = process.env.API_CURSOR_SECRET || PRIMARY_API_KEY;
const API_VERSION = '2026-09-26';
const quotationAssetCache = new Map<string, Promise<string>>();
function quotationAsset(name: string): Promise<string> {
  if(!quotationAssetCache.has(name)){
    const pending=fetch(`https://ttecrm.vercel.app/quotation-assets/${encodeURIComponent(name)}`,{signal:AbortSignal.timeout(20000)}).then(async response=>{
      if(!response.ok)throw new ApiError(503,'A quotation asset could not be loaded.','quote_asset_unavailable');
      return Buffer.from(await response.arrayBuffer()).toString('base64');
    }).catch(error=>{quotationAssetCache.delete(name);throw error;});
    quotationAssetCache.set(name,pending);
  }
  return quotationAssetCache.get(name)!;
}

const READ_LIMIT = 100;
const RATE_WINDOW_SECONDS = 60;
const RATE_LIMIT = 120;
const WRITE_RATE_LIMIT = 120;

type Scope = 'leads:read'|'leads:write'|'leads:assign'|'payments:read'|'payments:write'|'suppliers:read'|'customers:read'|'exports:read'|'tasks:write'|'analytics:read'|'itinerary:read'|'quotes:generate'|'health:read'|'quotes:write'|'messages:write'|'availability:read'|'automation:manage'|'*';
type Client = { id: string; scopes: Scope[] };
type Cursor = { updated_at: string; id: string };

class ApiError extends Error { constructor(public status: number, message: string, public code = 'api_error') { super(message); } }

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const safeEqual = (left: string, right: string) => {
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const isoNow = () => new Date().toISOString();
const requestId = () => `req_${crypto.randomUUID()}`;
const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const asArray = (value: unknown) => Array.isArray(value) ? value : value == null ? [] : [value];
const one = (value: unknown) => String(asArray(value)[0] || '');
const cleanText = (value: unknown, limit = 500) => String(value ?? '').trim().slice(0, limit);
const jsonBody = (req: any) => typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

function envelope(res: any, status: number, request_id: string, body: Record<string, unknown>) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json({ ...body, request_id, meta: { version: API_VERSION } });
}

function fail(res: any, error: unknown, request_id: string) {
  const known = error instanceof ApiError ? error : new ApiError(500, 'The API could not complete this request.', 'internal_error');
  return envelope(res, known.status, request_id, { error: { code: known.code, message: known.message } });
}

function configuredClients(): Array<{ id: string; key: string; scopes: Scope[] }> {
  const clients: Array<{ id: string; key: string; scopes: Scope[] }> = [];
  if (PRIMARY_API_KEY) clients.push({ id: 'primary', key: PRIMARY_API_KEY, scopes: ['*'] });
  // Optional Vercel secret: BOT_API_KEYS='[{"id":"sales-bot","key":"...","scopes":["leads:read","leads:write"]}]'
  try {
    const parsed = JSON.parse(process.env.BOT_API_KEYS || '[]');
    if (Array.isArray(parsed)) for (const row of parsed) {
      if (typeof row?.id === 'string' && typeof row?.key === 'string' && Array.isArray(row?.scopes)) {
        clients.push({ id: cleanText(row.id, 80), key: row.key, scopes: row.scopes.filter((scope: unknown) => typeof scope === 'string') as Scope[] });
      }
    }
  } catch { /* Invalid optional config must not grant access. */ }
  return clients;
}

function authenticate(req: any): Client {
  const supplied = cleanText(req.headers?.['x-api-key'], 1000);
  if (!supplied) throw new ApiError(401, 'x-api-key is required.', 'missing_api_key');
  const match = configuredClients().find(client => safeEqual(client.key, supplied));
  if (!match) throw new ApiError(401, 'The supplied API key is invalid.', 'invalid_api_key');
  return { id: match.id, scopes: match.scopes };
}

function requireScope(client: Client, scope: Scope) {
  if (!client.scopes.includes('*') && !client.scopes.includes(scope)) throw new ApiError(403, `This API key does not have ${scope} permission.`, 'insufficient_scope');
}

async function db(path: string, init: any = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new ApiError(503, 'The bot API is not configured on the server.', 'not_configured');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    console.error('[bot-api] database request failed', { path: path.slice(0, 180), status: response.status, code: body?.code });
    // PostgREST returns 409 for a duplicate idempotency reservation. Preserve
    // that status so the caller can safely retry instead of receiving a vague
    // server error.
    throw new ApiError(response.status === 404 ? 503 : response.status === 409 ? 409 : 500, 'The CRM data service could not complete this request.', 'data_service_error');
  }
  return body;
}

function encodeCursor(value: Cursor) {
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
  const signature = crypto.createHmac('sha256', CURSOR_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function decodeCursor(value: string | undefined): Cursor | null {
  if (!value) return null;
  const [payload, signature] = value.split('.');
  if (!payload || !signature || !CURSOR_SECRET) throw new ApiError(400, 'The cursor is invalid.', 'invalid_cursor');
  const expected = crypto.createHmac('sha256', CURSOR_SECRET).update(payload).digest('base64url');
  if (!safeEqual(signature, expected)) throw new ApiError(400, 'The cursor is invalid.', 'invalid_cursor');
  try {
    const result = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!result?.updated_at || !result?.id || Number.isNaN(Date.parse(result.updated_at))) throw new Error('invalid');
    return { updated_at: String(result.updated_at), id: String(result.id) };
  } catch { throw new ApiError(400, 'The cursor is invalid.', 'invalid_cursor'); }
}

function pageSize(query: any) {
  const requested = Number(one(query?.limit) || 50);
  if (!Number.isInteger(requested) || requested < 1) throw new ApiError(400, 'limit must be a positive integer.', 'invalid_limit');
  return Math.min(READ_LIMIT, requested);
}

async function consumeRateLimit(client: Client, isWrite: boolean) {
  const limit = isWrite ? WRITE_RATE_LIMIT : RATE_LIMIT;
  const result = await db('rpc/crm_api_consume_rate_limit', { method: 'POST', body: JSON.stringify({ p_client_id: client.id, p_window_seconds: RATE_WINDOW_SECONDS, p_limit: limit }) });
  if (!result?.allowed) throw new ApiError(429, 'Rate limit exceeded. Retry after the current minute.', 'rate_limited');
  return result;
}

async function audit(input: { requestId: string; client: Client; method: string; path: string; action: string; entityType?: string; entityId?: string; before?: any; after?: any; metadata?: any }) {
  await db('crm_api_audit', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
    request_id: input.requestId, client_id: input.client.id, method: input.method, path: input.path, action: input.action,
    entity_type: input.entityType || null, entity_id: input.entityId || null, before_value: input.before ?? null, after_value: input.after ?? null,
    metadata: input.metadata || {},
  }) });
}

type Reservation = { replay?: { status: number; body: any }; id?: string; requestHash: string };
async function reserveIdempotency(req: any, client: Client, path: string, body: any): Promise<Reservation> {
  const supplied = cleanText(req.headers?.['idempotency-key'], 300);
  if (!supplied) throw new ApiError(400, 'Idempotency-Key is required for write requests.', 'missing_idempotency_key');
  const keyHash = sha256(supplied), requestHash = sha256(`${req.method}:${path}:${JSON.stringify(body)}`);
  const existing = await db(`crm_api_idempotency?client_id=eq.${encodeURIComponent(client.id)}&key_hash=eq.${keyHash}&select=*&limit=1`);
  if (Array.isArray(existing) && existing[0]) {
    const row = existing[0];
    if (row.request_hash !== requestHash || row.method !== req.method || row.path !== path) throw new ApiError(409, 'This Idempotency-Key was used with a different request.', 'idempotency_conflict');
    if (row.state === 'completed') return { replay: { status: Number(row.response_status) || 200, body: row.response_body }, requestHash };
    throw new ApiError(409, 'This request is already being processed. Retry shortly with the same Idempotency-Key.', 'idempotency_in_progress');
  }
  let insert: any;
  try {
    insert = await db('crm_api_idempotency', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ client_id: client.id, key_hash: keyHash, method: req.method, path, request_hash: requestHash, state: 'processing' }) });
  } catch (error) {
    // Another request can reserve the same key between the initial read and
    // this insert. Fetch its reservation and follow the normal replay rules.
    if (!(error instanceof ApiError) || error.status !== 409) throw error;
    const raced = await db(`crm_api_idempotency?client_id=eq.${encodeURIComponent(client.id)}&key_hash=eq.${keyHash}&select=*&limit=1`);
    const row = asArray(raced)[0];
    if (!row) throw error;
    if (row.request_hash !== requestHash || row.method !== req.method || row.path !== path) throw new ApiError(409, 'This Idempotency-Key was used with a different request.', 'idempotency_conflict');
    if (row.state === 'completed') return { replay: { status: Number(row.response_status) || 200, body: row.response_body }, requestHash };
    throw new ApiError(409, 'This request is already being processed. Retry shortly with the same Idempotency-Key.', 'idempotency_in_progress');
  }
  const row = Array.isArray(insert) ? insert[0] : insert;
  if (!row?.id) throw new ApiError(503, 'Could not reserve this idempotent request.', 'idempotency_unavailable');
  return { id: row.id, requestHash };
}

async function completeIdempotency(reservation: Reservation, status: number, body: any) {
  if (!reservation.id) return;
  await db(`crm_api_idempotency?id=eq.${encodeURIComponent(reservation.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ state: 'completed', response_status: status, response_body: body, completed_at: isoNow() }) });
}

async function failIdempotency(reservation: Reservation) {
  if (!reservation.id) return;
  await db(`crm_api_idempotency?id=eq.${encodeURIComponent(reservation.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ state: 'failed', completed_at: isoNow() }) }).catch(() => undefined);
}

function money(value: any) { const number = Number(value); return Number.isFinite(number) ? number : 0; }
function leadRef(lead: any) { return lead?.lead_code || lead?.id; }
function paymentRef(payment: any) { return payment?.reference_id || payment?.id; }
function vendorCost(vendors: any) { return asArray(vendors).reduce((sum, vendor: any) => sum + money(vendor?.cost), 0); }
function vendorPaid(vendors: any) { return asArray(vendors).reduce((sum, vendor: any) => sum + asArray(vendor?.payments).reduce((sub: number, payment: any) => sub + money(payment?.amount), 0), 0); }

function paymentOutput(row: any) {
  return {
    id: row.id, ref_id: paymentRef(row), lead_id: row.lead_id || null, lead_ref_id: row.lead_code || null,
    amount: money(row.amount), currency: row.currency || 'INR', status: row.status || 'created', mode: row.method || row.source || 'manual',
    reference: row.manual_reference || row.razorpay_payment_id || row.reference_id || null, date: row.paid_at || row.created_at,
    customer: { name: row.customer_name || '', phone: row.customer_phone || '', email: row.customer_email || '' },
    description: row.description || '', notes: row.notes || '', source: row.source || 'manual', created_by: row.created_by || '',
    created_at: row.created_at, updated_at: row.updated_at || row.created_at,
  };
}

function leadOutput(lead: any, extras: any = {}) {
  const payments = asArray(extras.payments).map(paymentOutput);
  const paid = payments.filter((payment: any) => ['paid','captured','completed'].includes(String(payment.status).toLowerCase())).reduce((sum: number, payment: any) => sum + money(payment.amount), 0);
  const documents = asArray(extras.documents);
  return {
    id: lead.id, ref_id: leadRef(lead), name: lead.name || '', status: lead.status || 'New', temperature: lead.temperature || 'Warm',
    last_customer_message_at:lead.last_customer_message_at||null,last_bot_message_at:lead.last_bot_message_at||null, owner: lead.assigned_to || null, source: lead.source || 'Other', contact: { phone: lead.phone || lead.contact?.phone || '', email: lead.email || lead.contact?.email || '' },
    trip: lead.trip_details || {}, preferences: lead.preferences || {}, tags: lead.tags || [], interested_services: lead.interested_services || [],
    financials: { selling_price: money(lead.commercials?.sellingPrice ?? lead.budget), net_cost: money(lead.commercials?.netCost), vendor_cost: vendorCost(lead.vendors), vendor_paid: vendorPaid(lead.vendors), collected: paid, outstanding: Math.max(0, money(lead.commercials?.sellingPrice ?? lead.budget) - paid) },
    gst: { issued: documents.some((document: any) => document.status === 'issued'), documents: documents.map((document: any) => ({ id: document.id, number: document.number, status: document.status, type: document.doc_type, amount: money(document.amount), gstin: document.customer_gstin || null, tax_type: document.tax_type || 'none' })) },
    vendors: lead.vendors || [], legacy: Boolean(lead.legacy), created_at: lead.created_at, updated_at: lead.updated_at || lead.created_at,
    ...(extras.interactions ? { interactions: extras.interactions } : {}), ...(extras.reminders ? { reminders: extras.reminders } : {}), ...(extras.payments ? { payments } : {}),
  };
}

async function getLead(value: string) {
  // `id` is a UUID column. Query human CRM codes first so PostgREST never
  // tries to cast `TTE-0586` to UUID and turns a legitimate lookup into 500.
  if (/^[A-Za-z]+-\d+$/.test(value)) {
    const coded = await db(`leads?lead_code=eq.${encodeURIComponent(value)}&select=*&limit=1`);
    return Array.isArray(coded) ? coded[0] || null : null;
  }
  const direct = await db(`leads?id=eq.${encodeURIComponent(value)}&select=*&limit=1`);
  return Array.isArray(direct) ? direct[0] || null : null;
}

function cursorQuery(cursor: Cursor | null) {
  if (!cursor) return '';
  return `&or=${encodeURIComponent(`(updated_at.gt.${cursor.updated_at},and(updated_at.eq.${cursor.updated_at},id.gt.${cursor.id}))`)}`;
}

async function listLeads(query: any) {
  const limit = pageSize(query), cursor = decodeCursor(one(query?.cursor) || undefined), clauses = [`select=*`, 'order=updated_at.asc,id.asc', `limit=${limit + 1}`];
  const status = one(query?.status), owner = one(query?.owner), from = one(query?.from), to = one(query?.to), since = one(query?.updated_since);
  if (status) clauses.push(`status=eq.${encodeURIComponent(status)}`); if(owner){const owners=owner.split(',').map(x=>x.trim());if(owners.some(x=>!/^[-a-zA-Z0-9_]{1,120}$/.test(x)))throw new ApiError(400,'Invalid owner filter.','invalid_request');const admins=owners.includes('admin')?await db('users?role=eq.admin&select=id'):[];const terms=owners.flatMap(x=>x==='unassigned'?['assigned_to.is.null','assigned_to.eq.']:x==='admin'?['assigned_to.eq.admin','assigned_to.eq.Avnish',...admins.map((a:any)=>`assigned_to.eq.${encodeURIComponent(a.id)}`)]:[`assigned_to.eq.${encodeURIComponent(x)}`]);clauses.push(`or=(${terms.join(',')})`);} 
  if (from) clauses.push(`created_at=gte.${encodeURIComponent(from)}`); if (to) clauses.push(`created_at=lte.${encodeURIComponent(to)}`); if (since) clauses.push(`updated_at=gte.${encodeURIComponent(since)}`);
  const rows = await db(`leads?${clauses.join('&')}${cursorQuery(cursor)}`); const list = asArray(rows); const more = list.length > limit; const data = list.slice(0, limit).map(row => leadOutput(row)); const tail = data[data.length - 1];
  return { data, next_cursor: more && tail ? encodeCursor({ updated_at: tail.updated_at, id: tail.id }) : null };
}

async function leadDetail(value: string) {
  const lead = await getLead(value); if (!lead) throw new ApiError(404, 'Lead not found.', 'not_found');
  const [payments, interactions, reminders, documents] = await Promise.all([
    db(`payments?lead_id=eq.${encodeURIComponent(lead.id)}&select=*&order=created_at.desc&limit=250`),
    db(`interactions?lead_id=eq.${encodeURIComponent(lead.id)}&select=*&order=timestamp.desc&limit=250`),
    db(`reminders?lead_id=eq.${encodeURIComponent(lead.id)}&select=*&order=due_date.asc&limit=100`),
    db(`documents?lead_id=eq.${encodeURIComponent(lead.id)}&select=*&order=created_at.desc&limit=100`),
  ]);
  return leadOutput(lead, { payments, interactions, reminders, documents });
}

async function listPayments(query: any) {
  const limit = pageSize(query), cursor = decodeCursor(one(query?.cursor) || undefined), clauses = ['select=*', 'order=updated_at.asc,id.asc', `limit=${limit + 1}`];
  const leadId = one(query?.lead_id), status = one(query?.status), since = one(query?.updated_since);
  if (leadId) clauses.push(`lead_id=eq.${encodeURIComponent(leadId)}`); if (status) clauses.push(`status=eq.${encodeURIComponent(status)}`); if (since) clauses.push(`updated_at=gte.${encodeURIComponent(since)}`);
  const list = asArray(await db(`payments?${clauses.join('&')}${cursorQuery(cursor)}`)); const more = list.length > limit; const data = list.slice(0, limit).map(paymentOutput); const tail = data[data.length - 1];
  return { data, next_cursor: more && tail ? encodeCursor({ updated_at: tail.updated_at, id: tail.id }) : null };
}

async function listSuppliers(query: any) {
  const limit = pageSize(query), cursor = decodeCursor(one(query?.cursor) || undefined), clauses = ['select=*', 'order=updated_at.asc,id.asc', `limit=${limit + 1}`];
  const since = one(query?.updated_since); if (since) clauses.push(`updated_at=gte.${encodeURIComponent(since)}`);
  const list = asArray(await db(`suppliers?${clauses.join('&')}${cursorQuery(cursor)}`)); const more = list.length > limit;
  const data = list.slice(0, limit).map(row => ({ id: row.id, ref_id: row.id, name: row.name, contact_person: row.contact_person || '', phone: row.phone || '', email: row.email || '', destinations: row.destinations || [], category: row.category || '', rating: row.rating || null, created_at: row.created_at, updated_at: row.updated_at || row.created_at })); const tail = data[data.length - 1];
  return { data, next_cursor: more && tail ? encodeCursor({ updated_at: tail.updated_at, id: tail.id }) : null };
}

async function listCustomers(query: any) {
  const limit = pageSize(query), cursor = decodeCursor(one(query?.cursor) || undefined), clauses = ['select=*', 'status=eq.Won', 'order=updated_at.asc,id.asc', `limit=${limit + 1}`]; const since = one(query?.updated_since); if (since) clauses.push(`updated_at=gte.${encodeURIComponent(since)}`);
  const leads = asArray(await db(`leads?${clauses.join('&')}${cursorQuery(cursor)}`)); const more = leads.length > limit, page = leads.slice(0, limit), ids = page.map(lead => lead.id);
  const payments = ids.length ? asArray(await db(`payments?lead_id=in.(${ids.map(encodeURIComponent).join(',')})&select=*`)) : [];
  const docs = ids.length ? asArray(await db(`documents?lead_id=in.(${ids.map(encodeURIComponent).join(',')})&select=*`)) : [];
  const data = page.map(lead => leadOutput(lead, { payments: payments.filter(payment => payment.lead_id === lead.id), documents: docs.filter(document => document.lead_id === lead.id) })); const tail = data[data.length - 1];
  return { data, next_cursor: more && tail ? encodeCursor({ updated_at: tail.updated_at, id: tail.id }) : null };
}

function expectedVersion(req: any, row: any) {
  const given = cleanText(req.headers?.['if-match'], 100); if (given && given !== String(row.updated_at || row.created_at)) throw new ApiError(409, 'This record changed after it was read. Refresh it and retry.', 'version_conflict');
}

async function createLead(body: any, client: Client, request: string, path: string) {
  const name = cleanText(body.name, 160), phone = cleanText(body.phone, 40); if (!name || !phone) throw new ApiError(400, 'name and phone are required.', 'invalid_request');
  const digits = phone.replace(/[^0-9]/g, '').slice(-10); if (digits.length !== 10) throw new ApiError(400, 'phone must contain a valid 10-digit mobile number.', 'invalid_request');
  const duplicates = asArray(await db(`leads?phone=ilike.*${digits}&select=*&order=created_at.desc&limit=1`));
  if (duplicates[0]) return { status: 200, body: { data: leadOutput(duplicates[0]), duplicate: true } };
  const trip = body.trip && typeof body.trip === 'object' ? body.trip : {};
  const row = { name, phone: phone.startsWith('+') ? phone : `+${phone.replace(/[^0-9]/g, '')}`, email: cleanText(body.email, 200) || null, status: ['New','Contacted','Proposal Sent','Discussion','Won','Lost'].includes(body.status) ? body.status : 'New', temperature: ['Hot','Warm','Cold'].includes(body.temperature) ? body.temperature : 'Warm', source: cleanText(body.source, 100) || 'API Bot', destination: cleanText(trip.destination || body.destination, 120) || '', travel_date: cleanText(trip.startDate || body.travel_date, 30) || new Date().toISOString().slice(0, 10), pax: Math.max(1, Number(trip.paxConfig?.adults || body.pax || 2)), budget: Math.max(0, money(body.budget)), trip_details: trip, preferences: body.preferences || {}, commercials: body.commercials || null, vendors: Array.isArray(body.vendors) ? body.vendors : [], tags: Array.isArray(body.tags) ? body.tags.map((tag: unknown) => cleanText(tag, 60)).filter(Boolean) : [], interested_services: Array.isArray(body.interested_services) ? body.interested_services.map((item: unknown) => cleanText(item, 80)).filter(Boolean) : [], assigned_to: client.scopes.includes('*') || client.scopes.includes('leads:assign') ? cleanText(body.owner, 120) || null : null, notes: '' };
  const inserted = await db('leads', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify([row]) }); const lead = asArray(inserted)[0]; if (!lead) throw new ApiError(500, 'Could not create the lead.', 'write_failed');
  if (cleanText(body.note, 2000)) await db('interactions', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ id: id('api_note'), lead_id: lead.id, type: 'Note', content: cleanText(body.note, 2000), sentiment: null, timestamp: isoNow() }) });
  await audit({ requestId: request, client, method: 'POST', path, action: 'lead_created', entityType: 'lead', entityId: lead.id, after: lead });
  return { status: 201, body: { data: leadOutput(lead) } };
}

async function patchLead(value: string, body: any, req: any, client: Client, request: string, path: string, reservation: Reservation) {
  const before = await getLead(value); if (!before) throw new ApiError(404, 'Lead not found.', 'not_found');
  const patch: any = {}; if (body.status !== undefined) { const valid = ['New','Contacted','Proposal Sent','Discussion','Won','Lost']; if (!valid.includes(body.status)) throw new ApiError(400, 'status is invalid.', 'invalid_request'); patch.status = body.status; patch.last_status_update = isoNow(); if (body.status === 'Won' && !before.won_at) patch.won_at = isoNow(); }
  if (body.temperature !== undefined) { if (!['Hot','Warm','Cold'].includes(body.temperature)) throw new ApiError(400, 'temperature is invalid.', 'invalid_request'); patch.temperature = body.temperature; }
  if (body.owner !== undefined) { requireScope(client, 'leads:assign'); patch.assigned_to = cleanText(body.owner, 120) || null; }
  for(const key of ['last_customer_message_at','last_bot_message_at'])if(body[key]!==undefined)patch[key]=messageTime(body[key],key);
  const update=tripUpdate(before.trip_details,body);
  if(update){patch.trip_details=update.trip;Object.assign(patch,update.columns);}
  if(body.payment_status!==undefined||body.gst!==undefined)patch.trip_details={...(patch.trip_details||before.trip_details||{}),...(body.payment_status!==undefined?{paymentStatus:cleanText(body.payment_status,80)}:{}),...(body.gst!==undefined?{gst:body.gst}:{})};
  if (!Object.keys(patch).length && !cleanText(body.note, 2000)) throw new ApiError(400, 'No supported lead changes were supplied.', 'invalid_request');
  const template=await leadDetail(before.id);
  const result=await db('rpc/crm_api_patch_lead',{method:'POST',body:JSON.stringify({p_lead_id:before.id,p_expected_version:req.crmIfMatch||before.updated_at,p_patch:patch,p_note:cleanText(body.note,2000),p_note_id:id('api_note'),p_request_id:request,p_client_id:client.id,p_path:path,p_reservation_id:reservation.id,p_response_template:template})});
  return {status:result.status,body:result.body};
}

async function createPayment(body: any, client: Client, request: string, path: string) {
  const lead = await getLead(cleanText(body.lead_id, 100)); if (!lead) throw new ApiError(404, 'lead_id does not match a CRM lead.', 'not_found');
  const amount = money(body.amount); if (!(amount > 0)) throw new ApiError(400, 'amount must be a positive rupee amount.', 'invalid_request');
  const mode = cleanText(body.mode, 50) || 'Other', date = cleanText(body.date, 40) || isoNow(); if (Number.isNaN(Date.parse(date))) throw new ApiError(400, 'date must be ISO 8601.', 'invalid_request');
  const row = { id: id('api_payment'), reference_id: cleanText(body.reference, 120) || `API-${Date.now()}`, short_url: '', amount, currency: 'INR', customer_name: lead.name || '', customer_phone: lead.phone || '', customer_email: lead.email || '', status: cleanText(body.status, 40) || 'paid', description: cleanText(body.description, 1000), created_at: isoNow(), created_by: `API:${client.id}`, paid_at: date, razorpay_payment_id: null, lead_id: lead.id, lead_name: lead.name || '', source: 'manual', method: mode, manual_reference: cleanText(body.reference, 120) || null, notes: cleanText(body.notes, 2000) || null };
  const inserted = await db('payments', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) }); const payment = asArray(inserted)[0]; if (!payment) throw new ApiError(500, 'Could not record payment.', 'write_failed');
  await audit({ requestId: request, client, method: 'POST', path, action: 'payment_created', entityType: 'payment', entityId: payment.id, after: payment });
  return { status: 201, body: { data: paymentOutput(payment) } };
}

async function createNote(leadId: string, body: any, client: Client, request: string, path: string) {
  const lead = await getLead(leadId); if (!lead) throw new ApiError(404, 'Lead not found.', 'not_found'); const note = cleanText(body.note, 2000); if (!note) throw new ApiError(400, 'note is required.', 'invalid_request');
  const row = { id: id('api_note'), lead_id: lead.id, type: 'Note', content: note, sentiment: null, timestamp: isoNow() }; await db('interactions', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) });
  await audit({ requestId: request, client, method: 'POST', path, action: 'lead_note_created', entityType: 'lead', entityId: lead.id, after: row }); return { status: 201, body: { data: row } };
}

async function createTask(leadId: string, body: any, client: Client, request: string, path: string) {
  const lead = await getLead(leadId); if (!lead) throw new ApiError(404, 'Lead not found.', 'not_found'); const task = cleanText(body.task, 500), due = cleanText(body.due_date, 40); if (!task || !due || Number.isNaN(Date.parse(due))) throw new ApiError(400, 'task and ISO due_date are required.', 'invalid_request');
  const row = { id: id('api_task'), lead_id: lead.id, task, due_date: due, is_completed: false }; await db('reminders', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) });
  await audit({ requestId: request, client, method: 'POST', path, action: 'task_created', entityType: 'lead', entityId: lead.id, after: row }); return { status: 201, body: { data: row } };
}

function csv(value: unknown) { const text = String(value ?? ''); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
async function customerCsv(query: any) { const result = await listCustomers({ ...query, limit: Math.min(READ_LIMIT, pageSize(query)) }); const header = ['ref_id','name','phone','email','owner','status','selling_price','collected','outstanding','vendor_cost','vendor_paid','created_at','updated_at']; const rows = result.data.map((customer: any) => [customer.ref_id,customer.name,customer.contact.phone,customer.contact.email,customer.owner,customer.status,customer.financials.selling_price,customer.financials.collected,customer.financials.outstanding,customer.financials.vendor_cost,customer.financials.vendor_paid,customer.created_at,customer.updated_at].map(csv).join(',')); return [header.join(','), ...rows].join('\n'); }

async function maxAvailability(query:any){
 const check=one(query.check_in),nights=Number(one(query.nights));if(!/^\d{4}-\d\d-\d\d$/.test(check)||!Number.isFinite(Date.parse(check+'T12:00:00Z'))||new Date(check+'T12:00:00Z').toISOString().slice(0,10)!==check||![1,2,3].includes(nights))throw new ApiError(400,'Provide valid check_in and nights=1,2,3.','invalid_request');
 const names:Record<string,string>={'161':'Non-AC Swiss Cottage','162':'Deluxe AC Swiss Cottage','163':'Premium Tent','164':'Super Premium Tent','165':'Rajwadi Suite','166':'Darbari Suite'};const cat=one(query.category);const tent=Object.keys(names).find(k=>k===cat||names[k].toLowerCase()===cat.toLowerCase());if(!tent)throw new ApiError(400,'Unknown category.','invalid_category');
 const pkg=String(259+nights);const rows=await db(`crm_rann_inventory_snapshots?package_id=eq.${pkg}&check_in_date=eq.${check}&tent_id=eq.${tent}&order=captured_at.desc,id.desc&limit=1`);if(!rows[0])throw new ApiError(404,'No saved availability check exists for this package/date/category. Refresh inventory in the CRM first.','availability_not_checked');const snapshot=rows[0];const holds=await db(`crm_rann_holds?package_id=eq.${pkg}&check_in_date=eq.${check}&tent_id=eq.${tent}&status=in.(active,confirmed)&select=units,status,expires_at`);const held=holds.filter((h:any)=>h.status==='confirmed'||Date.parse(h.expires_at)>Date.now()).reduce((sum:number,h:any)=>sum+Number(h.units),0);return{check_in:check,nights,category:names[tent],package_id:pkg,supplier_available:snapshot.available,crm_held:held,tents_left:Number(snapshot.status)===0?Math.max(0,snapshot.available-held):0,checked_at:snapshot.captured_at,source:'saved_supplier_snapshot',live:false};
}

export default async function handler(req: any, res: any) {
  const rid = requestId();
  try {
    const rawIfMatch=req.headers?.['if-match'];
    // Vercel's outer response layer retains the original request headers.
    // Echo the transport validator so it cannot replace our database result.
    if(typeof rawIfMatch==='string')res.setHeader('ETag',rawIfMatch);
    const client = authenticate(req); req.crmIfMatch=takeIfMatch(req); const pathname = new URL(req.url || '/', 'https://ttecrm.vercel.app').pathname; const urlParts = pathname.startsWith('/api/v1/') ? pathname.slice(8).split('/').filter(Boolean).map(decodeURIComponent) : []; const segments = urlParts.length ? urlParts : asArray(req.query?.path).flatMap(value => String(value).split('/')).filter(Boolean); const path = `/api/v1/${segments.join('/')}`.replace(/\/$/, ''); const method = String(req.method || 'GET').toUpperCase(); const isWrite = ['POST','PATCH','PUT','DELETE'].includes(method); await consumeRateLimit(client, isWrite);
    const endpoint = segments.join('/');
    if (method === 'GET' && ['sou/catalog','sou/itineraries','sou/transfers','sou/tentcity','sou/hotels'].includes(endpoint)) {
      requireScope(client,'itinerary:read'); const data=souCatalog(endpoint.slice(4));
      return envelope(res,200,rid,{data,rate_version:sha256(JSON.stringify(data))});
    }
    if (method === 'POST' && ['sou/hotel-rates','sou/itinerary/quote','sou/quote'].includes(endpoint)) {
      requireScope(client,'quotes:generate'); const input=jsonBody(req);
      const data=endpoint==='sou/hotel-rates'?souHotelRates(input):endpoint==='sou/itinerary/quote'?souItineraryQuote(input):souQuote(input);
      await audit({requestId:rid,client,method,path,action:'sou_quote_calculated',metadata:{input_hash:sha256(JSON.stringify(input))}});
      return envelope(res,200,rid,{data});
    }
    if (method === 'GET' && endpoint === 'itinerary/catalog') { requireScope(client, 'itinerary:read'); return envelope(res, 200, rid, {data:catalog()}); }
    if (method === 'GET' && ['itinerary/hotels','itinerary/packages'].includes(endpoint)) {
      requireScope(client, 'itinerary:read');
      const query = Object.fromEntries(Object.entries(req.query || {}).map(([key,value])=>[key,one(value)]));
      const rows = endpoint.endsWith('hotels') ? hotels(query) : packages(query);
      const version=sha256(JSON.stringify(rows)); const size=pageSize(req.query); let offset=0;
      if(query.cursor){const [encoded, signature]=query.cursor.split('.'); const expected=crypto.createHmac('sha256',CURSOR_SECRET).update(encoded || '').digest('base64url'); let cursor:any; try{cursor=JSON.parse(Buffer.from(encoded || '', 'base64url').toString());}catch{throw new ApiError(400,'Invalid catalog cursor.','invalid_cursor');} if(!signature || !safeEqual(signature,expected) || !cursor || cursor.updated_at!==version || !/^\d+$/.test(cursor.id))throw new ApiError(400,'Catalog changed or cursor is invalid. Restart the list.','invalid_cursor');offset=Number(cursor.id);}
      const data=rows.slice(offset,offset+size);
      return envelope(res,200,rid,{data,rate_version:version,next_cursor:offset+size<rows.length?encodeCursor({updated_at:version,id:String(offset+size)}):null});
    }
    if (method === 'POST' && ['itinerary/quote','rann/quote','rann/quote/pdf','rann/quote/pdf-link'].includes(endpoint)) {
      requireScope(client, 'quotes:generate'); const input=jsonBody(req);
      if(endpoint==='itinerary/quote'){const data=itineraryQuote(input);await audit({requestId:rid,client,method,path,action:'itinerary_quote_calculated',metadata:{product:input.product,input_hash:sha256(JSON.stringify(input))}});return envelope(res,200,rid,{data});}
      const {model,data}=rannQuote(input);
      if(endpoint==='rann/quote') {await audit({requestId:rid,client,method,path,action:'rann_quote_calculated',metadata:{input_hash:sha256(JSON.stringify(input)),total:data.price.total}});return envelope(res,200,rid,{data});}
      const storage=endpoint==='rann/quote/pdf-link'?quoteStorage(SUPABASE_URL,SUPABASE_SERVICE_KEY):null;
      if(storage)await storage.cleanup();
      const document=await createRannQuotationPdf(model, quotationAsset);
      const bytes=Buffer.from(document.output('arraybuffer'));
      if(!storage && bytes.length>4400000)throw new ApiError(413,'This PDF exceeds the delivery limit. Generate fewer comparison categories.','pdf_too_large');
      if(storage){
        const link=await storage.upload(bytes);
        try{await audit({requestId:rid,client,method,path,action:'rann_pdf_link_generated',entityType:'quote_pdf',entityId:link.filename,metadata:{input_hash:sha256(JSON.stringify(input)),pdf_sha256:sha256(bytes.toString('base64')),total:data.price.total,bytes:bytes.length,expires_at:link.expires_at}});}catch(error){await storage.remove([link.filename]).catch(()=>{});throw error;}
        return envelope(res,200,rid,link);
      }
      await audit({requestId:rid,client,method,path,action:'rann_pdf_generated',metadata:{input_hash:sha256(JSON.stringify(input)),pdf_sha256:sha256(bytes.toString('base64')),total:data.price.total,bytes:bytes.length}});
      res.setHeader('Content-Type','application/pdf');res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Disposition','attachment; filename="rann-utsav-quotation.pdf"');res.setHeader('X-Request-Id',rid);return res.status(200).send(bytes);
    }
    if(endpoint==='automation/test' && method==='POST'){
      requireScope(client,'automation:manage');const input=jsonBody(req),event=input.event||'lead.created';
      if(!['lead.created','lead.assigned_to_admin','followup.due'].includes(event)||Object.keys(input).some(k=>k!=='event'))throw new ApiError(400,'Provide event=lead.created, lead.assigned_to_admin or followup.due.','invalid_request');
      const reserve=await reserveIdempotency(req,client,path,{event});if(reserve.replay)return envelope(res,reserve.replay.status,rid,reserve.replay.body);
      try{
        const settings=(await db('crm_max_settings?select=*'))[0];if(!settings?.target_url||!settings?.signing_secret)throw new ApiError(400,'Configure the webhook URL and signing secret first.','webhook_not_configured');
        const eid=reserve.id,now=isoNow(),body={id:eid,event,occurred_at:now,test:true,dry_run:true,data:{id:eid,lead_id:eid,ref_id:'WEBHOOK-CONNECTION-TEST',name:'CRM webhook connection test — no customer',phone:null,source:'CRM connection test',status:'New',owner:'admin',trip:{},created_at:now,step:1,due_at:now,last_note:'Connection test only. Do not contact a customer.',test:true,dry_run:true}};
        let httpStatus=0;
        const result=await dispatchWebhooks(async(route,init)=>{
          if(route.endsWith('claim'))return [{id:eid,event,lease_token:eid}];
          if(route.endsWith('preflight'))return {target_url:settings.target_url,signing_secret:settings.signing_secret,body};
          if(route.endsWith('finish'))httpStatus=JSON.parse(init.body).p_status;
        });
        const response={data:{event_id:eid,event,test:true,http_status:httpStatus,accepted:result.delivered===1}};
        await audit({requestId:rid,client,method,path,action:'webhook_connection_test',entityType:'automation_settings',metadata:response.data});
        await completeIdempotency(reserve,200,response);return envelope(res,200,rid,response);
      }catch(e){await failIdempotency(reserve);throw e;}
    }
    if(endpoint==='automation/settings' && method==='GET'){requireScope(client,'automation:manage');const rows=await db('crm_max_settings?select=id,enabled,target_url,updated_at');const secret=(await db('crm_max_settings?select=signing_secret'))[0]?.signing_secret;return envelope(res,200,rid,{data:{...rows[0],secret_configured:!!secret}});}
    if(endpoint==='automation/deliveries' && method==='GET'){requireScope(client,'automation:manage');return envelope(res,200,rid,{data:await db(`crm_max_outbox?select=id,lead_id,event,state,attempts,last_http_status,last_error,next_attempt_at,created_at,updated_at&order=created_at.desc&limit=${pageSize(req.query)}`)});}
    if(endpoint==='automation/settings' && method==='PATCH'){requireScope(client,'automation:manage');const current=(await db('crm_max_settings?select=*'))[0];const body=await settingsInput(jsonBody(req),current);const reserve=await reserveIdempotency(req,client,path,body);if(reserve.replay)return envelope(res,reserve.replay.status,rid,reserve.replay.body);try{const output=await db('rpc/crm_max_write',{method:'POST',body:JSON.stringify({p_action:'settings',p_lead_id:null,p_data:body,p_request:rid,p_client:client.id,p_path:path,p_reservation:reserve.id})});return envelope(res,output.status,rid,output.body);}catch(e){await failIdempotency(reserve);throw e;}}
    if(endpoint==='leads/needs_attention' && method==='GET'){requireScope(client,'leads:read');const size=pageSize(req.query),cursor=decodeCursor(one(req.query.cursor)||undefined);const after=cursor?`&or=(attention_since.gt.${encodeURIComponent(cursor.updated_at)},and(attention_since.eq.${encodeURIComponent(cursor.updated_at)},id.gt.${encodeURIComponent(cursor.id)}))`:'';const rows=await db(`crm_max_needs_attention?attention_since=lt.infinity&select=*&order=attention_since.asc,id.asc&limit=${size+1}${after}`);const data=rows.slice(0,size),tail=data.at(-1);return envelope(res,200,rid,{data:data.map((row:any)=>({...leadOutput(row),attention_since:row.attention_since,overdue_followup:row.overdue_followup})),next_cursor:rows.length>size&&tail?encodeCursor({updated_at:tail.attention_since,id:tail.id}):null});}
    if(segments[0]==='leads'&&segments.length===3&&segments[2]==='activity'&&method==='GET'){requireScope(client,'leads:read');const lead=await getLead(segments[1]);if(!lead)throw new ApiError(404,'Lead not found.','not_found');const size=pageSize(req.query),cursor=decodeCursor(one(req.query.cursor)||undefined),after=cursor?`&or=(created_at.lt.${encodeURIComponent(cursor.updated_at)},and(created_at.eq.${encodeURIComponent(cursor.updated_at)},id.lt.${encodeURIComponent(cursor.id)}))`:'';const rows=await db(`crm_max_activity?lead_id=eq.${lead.id}&select=*&order=created_at.desc,id.desc&limit=${size+1}${after}`),data=rows.slice(0,size),tail=data.at(-1);return envelope(res,200,rid,{data,next_cursor:rows.length>size&&tail?encodeCursor({updated_at:tail.created_at,id:tail.id}):null});}
    if(segments[0]==='leads'&&segments.length===3&&['quotes','messages'].includes(segments[2])&&method==='POST'){
      const action=segments[2]==='quotes'?'quote':'message';requireScope(client,action==='quote'?'quotes:write':'messages:write');const lead=await getLead(segments[1]);if(!lead)throw new ApiError(404,'Lead not found.','not_found');const body=action==='quote'?quoteInput(jsonBody(req)):messageInput(jsonBody(req));const reserve=await reserveIdempotency(req,client,path,body);if(reserve.replay)return envelope(res,reserve.replay.status,rid,reserve.replay.body);try{const output=await db('rpc/crm_max_write',{method:'POST',body:JSON.stringify({p_action:action,p_lead_id:lead.id,p_data:body,p_request:rid,p_client:client.id,p_path:path,p_reservation:reserve.id})});return envelope(res,output.status,rid,output.body);}catch(e){await failIdempotency(reserve);throw e;}
    }
    if(endpoint==='availability'&&method==='GET'){requireScope(client,'availability:read');return envelope(res,200,rid,{data:await maxAvailability(req.query)});}
    if (method === 'GET' && segments.join('/') === 'health') { requireScope(client, 'health:read'); return envelope(res, 200, rid, { data: { status: 'ok', service: 'tte-crm-bot-api', time: isoNow() } }); }
    if (method === 'GET' && segments.join('/') === 'leads') { requireScope(client, 'leads:read'); return envelope(res, 200, rid, await listLeads(req.query)); }
    if (method === 'POST' && segments.join('/') === 'leads') { requireScope(client, 'leads:write'); const body = jsonBody(req), reserve = await reserveIdempotency(req, client, path, body); if (reserve.replay) return envelope(res, reserve.replay.status, rid, reserve.replay.body); try { const output = await createLead(body, client, rid, path); await completeIdempotency(reserve, output.status, output.body); return envelope(res, output.status, rid, output.body); } catch (error) { await failIdempotency(reserve); throw error; } }
    if (segments[0] === 'leads' && segments[1] && segments.length === 2 && method === 'GET') { requireScope(client, 'leads:read'); return envelope(res, 200, rid, { data: await leadDetail(segments[1]) }); }
    if (segments[0] === 'leads' && segments[1] && segments.length === 2 && method === 'PATCH') { requireScope(client, 'leads:write'); const body = jsonBody(req), reserve = await reserveIdempotency(req, client, path, body); if (reserve.replay) return envelope(res, reserve.replay.status, rid, reserve.replay.body); try { const output = await patchLead(segments[1], body, req, client, rid, path, reserve); return envelope(res, output.status, rid, output.body); } catch (error) { await failIdempotency(reserve); throw error; } }
    if (segments[0] === 'leads' && segments[1] && segments[2] === 'notes' && method === 'POST') { requireScope(client, 'leads:write'); const body = jsonBody(req), reserve = await reserveIdempotency(req, client, path, body); if (reserve.replay) return envelope(res, reserve.replay.status, rid, reserve.replay.body); try { const output = await createNote(segments[1], body, client, rid, path); await completeIdempotency(reserve, output.status, output.body); return envelope(res, output.status, rid, output.body); } catch (error) { await failIdempotency(reserve); throw error; } }
    if (segments[0] === 'leads' && segments[1] && segments[2] === 'tasks' && method === 'POST') { requireScope(client, 'tasks:write'); const body = jsonBody(req), reserve = await reserveIdempotency(req, client, path, body); if (reserve.replay) return envelope(res, reserve.replay.status, rid, reserve.replay.body); try { const output = await createTask(segments[1], body, client, rid, path); await completeIdempotency(reserve, output.status, output.body); return envelope(res, output.status, rid, output.body); } catch (error) { await failIdempotency(reserve); throw error; } }
    if (method === 'GET' && segments.join('/') === 'customers') { requireScope(client, 'customers:read'); return envelope(res, 200, rid, await listCustomers(req.query)); }
    if (method === 'GET' && segments.join('/') === 'payments') { requireScope(client, 'payments:read'); return envelope(res, 200, rid, await listPayments(req.query)); }
    if (method === 'POST' && segments.join('/') === 'payments') { requireScope(client, 'payments:write'); const body = jsonBody(req), reserve = await reserveIdempotency(req, client, path, body); if (reserve.replay) return envelope(res, reserve.replay.status, rid, reserve.replay.body); try { const output = await createPayment(body, client, rid, path); await completeIdempotency(reserve, output.status, output.body); return envelope(res, output.status, rid, output.body); } catch (error) { await failIdempotency(reserve); throw error; } }
    if (method === 'GET' && segments.join('/') === 'suppliers') { requireScope(client, 'suppliers:read'); return envelope(res, 200, rid, await listSuppliers(req.query)); }
    if (method === 'GET' && segments.join('/') === 'export/customers.csv') { requireScope(client, 'exports:read'); const content = await customerCsv(req.query); res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', 'attachment; filename="tte-customers.csv"'); res.setHeader('X-Request-Id', rid); return res.status(200).send(content); }
    throw new ApiError(404, 'Endpoint not found.', 'not_found');
  } catch (error: any) {
    if(req.headers)delete req.headers['if-match'];
    if(error instanceof QuoteStorageError)return envelope(res,error.status,rid,{error:{code:error.code,message:error.message}});
    if(error instanceof MaxInputError || error instanceof QuoteInputError || error instanceof LeadUpdateError)return envelope(res,400,rid,{error:{code:error.code,message:error.message}}); return fail(res, error, rid); }
}
