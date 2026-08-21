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

export const DOC_TYPES = ['Hotel Voucher', 'Payment Bill', 'ID Proof', 'Itinerary', 'Other'] as const;
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
