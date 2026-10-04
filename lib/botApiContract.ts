import crypto from 'node:crypto';

/**
 * Pure, server-safe contract helpers for the bot API.  Date-only values are
 * intentionally never parsed with `new Date('YYYY-MM-DD')`: doing that turns
 * an Indian business date into the preceding calendar day in some timezones.
 */
export type ApiScope =
  | 'leads:read' | 'leads:write' | 'leads:assign'
  | 'payments:read' | 'payments:write'
  | 'supplier_payments:read' | 'suppliers:read'
  | 'customers:read' | 'exports:read' | 'tasks:write'
  | 'evidence:read' | 'health:read' | 'itinerary:read' | 'quotes:generate' | '*';

export type ApiCursor = { updated_at: string; id: string };

export function hasScope(scopes: readonly ApiScope[], scope: ApiScope): boolean {
  return scopes.includes('*') || scopes.includes(scope);
}

export function canonicalBusinessDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return value;
}

/**
 * Returns a canonical rupee decimal string.  API writers should send
 * amount_decimal (a string) to retain exact paise; numeric `amount` remains a
 * legacy/display compatibility field.
 */
export function canonicalMoneyDecimal(value: unknown): string | null {
  const raw = typeof value === 'number'
    ? (Number.isFinite(value) ? value.toString() : '')
    : typeof value === 'string' ? value.trim() : '';
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(raw)) return null;
  const [whole, fraction = ''] = raw.split('.');
  return `${whole}.${fraction.padEnd(2, '0')}`;
}

export function decimalToNumber(value: string): number {
  // `value` has already passed canonicalMoneyDecimal, so the number is only a
  // legacy compatibility convenience. Accounting consumers must use the
  // companion amount_decimal string for exact arithmetic.
  return Number(value);
}

export function stableLegacySupplierPaymentId(input: {
  payment_id?: unknown;
  booking_id?: unknown;
  supplier_id?: unknown;
  supplier_position?: unknown;
  payment_position?: unknown;
}): string {
  const supplied = typeof input.payment_id === 'string' ? input.payment_id.trim() : '';
  if (supplied) return supplied;
  // Match the SQL view: MD5 of booking|supplier|one-based vendor ordinal|
  // one-based payment ordinal, truncated to 24 hex characters. This is an
  // identity fallback, not a security hash. Reordering changes this fallback.
  const seed = [input.booking_id, input.supplier_id, input.supplier_position, input.payment_position]
    .map(value => String(value ?? ''))
    .join('|');
  return `legacy_sp_${crypto.createHash('md5').update(seed).digest('hex').slice(0, 24)}`;
}

/** Whitelist only safe evidence metadata; never leak object keys or URLs. */
export function privateEvidenceMetadata(row: Record<string, unknown>) {
  const size = Number(row.file_size);
  return {
    id: row.id ?? null,
    evidence_id: row.id ?? null,
    lead_id: row.lead_id ?? null,
    payment_id: row.payment_id ?? null,
    supplier_payment_id: row.supplier_payment_id ?? null,
    source: row.source ?? 'crm_attachment',
    filename: row.filename ?? '',
    mime_type: row.content_type ?? null,
    size_bytes: Number.isFinite(size) ? size : null,
    sha256: row.sha256 ?? null,
    doc_type: row.doc_type ?? 'Other',
    uploaded_by: row.uploaded_by ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? row.created_at ?? null,
  };
}

export function encodeOpaqueCursor(value: ApiCursor, secret: string): string {
  if (!secret) throw new Error('Cursor secret is required.');
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function decodeOpaqueCursor(value: string | undefined, secret: string): ApiCursor | null {
  if (!value) return null;
  const [payload, signature] = value.split('.');
  if (!payload || !signature || !secret) return null;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const left = Buffer.from(signature), right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  try {
    const result = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!result?.updated_at || !result?.id || Number.isNaN(Date.parse(result.updated_at))) return null;
    return { updated_at: String(result.updated_at), id: String(result.id) };
  } catch { return null; }
}

export function isAfterCursor(row: ApiCursor, cursor: ApiCursor | null): boolean {
  if (!cursor) return true;
  return row.updated_at > cursor.updated_at || (row.updated_at === cursor.updated_at && row.id > cursor.id);
}
