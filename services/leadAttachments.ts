// ============================================================
// Lead attachments — hotel vouchers, payment bills, etc. uploaded against a
// lead. File bytes live in Cloudflare R2 (bucket: tte-crm-documents), never
// in Supabase — this file only ever calls three Edge Functions for the R2
// side (r2-upload-url, r2-download-url, r2-delete-object) and reads/writes
// the pointer row in lead_attachments directly (RLS already permits an
// authenticated select/insert/delete — see
// supabase/migrations/010_lead_attachments.sql).
//
// Upload is presigned-PUT, not routed through an Edge Function body: the
// browser PUTs the file straight to R2, so there's no Supabase payload-size
// limit on how large a voucher/bill can be.
// ============================================================

import { supabase } from '../lib/supabase';

// Supplier Voucher — what the hotel/supplier sends TTE confirming the booking.
// Client Invoice   — the bill/GST invoice TTE sends the client (a different,
//                     freeform-upload concept from the sequential `documents`
//                     table's auto-generated invoices — see migration 010's
//                     header comment).
// Booking Voucher   — the confirmation voucher TTE hands the client, not a
//                     bill (multiple allowed, e.g. one per hotel on a trip).
// ID Proof          — passport/Aadhaar/etc., also frequently multiple.
export const DOC_TYPES = ['Supplier Voucher', 'Client Invoice', 'Booking Voucher', 'ID Proof', 'Other'] as const;
export type DocType = typeof DOC_TYPES[number];

export interface LeadAttachment {
  id: string;
  leadId: string;
  filename: string;
  docType: string;
  r2Key: string;
  contentType: string | null;
  fileSize: number | null;
  uploadedBy: string | null;
  createdAt: string;
}

function fromRow(r: any): LeadAttachment {
  return {
    id: r.id, leadId: r.lead_id, filename: r.filename, docType: r.doc_type,
    r2Key: r.r2_key, contentType: r.content_type, fileSize: r.file_size,
    uploadedBy: r.uploaded_by, createdAt: r.created_at,
  };
}

export async function listAttachments(leadId: string): Promise<LeadAttachment[]> {
  const { data, error } = await supabase
    .from('lead_attachments')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(fromRow);
}

export async function uploadAttachment(
  leadId: string, file: File, docType: string, uploadedBy: string,
): Promise<LeadAttachment> {
  const { data: presign, error: presignError } = await supabase.functions.invoke('r2-upload-url', {
    body: { leadId, filename: file.name, contentType: file.type || undefined },
  });
  if (presignError || !presign?.uploadUrl) throw new Error(presignError?.message || 'Could not get an upload URL');

  const putRes = await fetch(presign.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: presign.contentType ? { 'Content-Type': presign.contentType } : {},
  });
  if (!putRes.ok) throw new Error(`Upload to storage failed (${putRes.status})`);

  const row = {
    id: presign.id as string,
    lead_id: leadId,
    filename: file.name,
    doc_type: docType,
    r2_key: presign.r2Key as string,
    content_type: file.type || null,
    file_size: file.size,
    uploaded_by: uploadedBy,
  };
  const { data, error } = await supabase.from('lead_attachments').insert(row).select().single();
  if (error || !data) throw new Error(error?.message || 'Uploaded, but could not save the record');
  return fromRow(data);
}

// Set once R2's "Public Development URL" (or a custom domain) is enabled on
// the bucket — a permanent, unsigned link an agent can hand to anyone, no
// expiry. Until that env var is set, callers fall back to a long-lived
// presigned link (getAttachmentUrl below) instead of failing outright.
//
// Trade-off, deliberately accepted per explicit request for a durable public
// link: once enabled, ANYONE with a document's URL can view it forever —
// the object key is the only thing standing between a leaked link and the
// file, not a real access check. Fine for vouchers/bills meant to be shared
// with a client anyway; do not point this at anything more sensitive.
const R2_PUBLIC_BASE_URL = (import.meta as any).env?.VITE_R2_PUBLIC_BASE_URL as string | undefined;

export function hasPublicUrls(): boolean {
  return !!R2_PUBLIC_BASE_URL;
}

export function getPublicUrl(attachment: LeadAttachment): string | null {
  if (!R2_PUBLIC_BASE_URL) return null;
  return `${R2_PUBLIC_BASE_URL.replace(/\/$/, '')}/${attachment.r2Key}`;
}

export async function getAttachmentUrl(
  attachment: LeadAttachment, opts: { download?: boolean; expiresInSeconds?: number } = {},
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('r2-download-url', {
    body: {
      r2Key: attachment.r2Key, filename: attachment.filename,
      download: opts.download, expiresInSeconds: opts.expiresInSeconds,
    },
  });
  if (error || !data?.url) throw new Error(error?.message || 'Could not generate a link for this file');
  return data.url as string;
}

// RLS with no matching policy silently filters a delete to zero rows rather
// than erroring (same gotcha fixed in quoteTrainerResults.ts) — requesting
// the deleted row back and checking it's actually gone catches that case
// rather than the UI claiming success while the DB row survives untouched.
export async function deleteAttachment(attachment: LeadAttachment): Promise<void> {
  const { error: r2Error } = await supabase.functions.invoke('r2-delete-object', {
    body: { r2Key: attachment.r2Key },
  });
  if (r2Error) throw new Error(r2Error.message || 'Could not delete the file from storage');

  const { data, error: dbError } = await supabase.from('lead_attachments').delete().eq('id', attachment.id).select('id');
  if (dbError) throw new Error(dbError.message);
  if (!data || data.length === 0) throw new Error('File deleted, but the record could not be removed — check the delete policy has been applied.');
}
