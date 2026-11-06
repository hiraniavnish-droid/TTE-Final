// ============================================================
// Lead detail page — Documents panel. Upload/view/download/share/delete
// files attached to a lead, grouped into fixed sections (Supplier Voucher,
// Client Invoice, Booking Voucher, ID Proof, Other) so it reads as a
// checklist rather than a flat pile. Stored in Cloudflare R2 via
// services/leadAttachments.ts — all rate/margin figures live elsewhere,
// this panel only ever deals with file metadata.
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn, formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { FileDropZone } from '../ui/WorkspaceVisuals';
import { Modal } from '../ui/Modal';
import { FileText, Plus, Eye, Download, Share2, Trash2, Loader2, File as FileIcon, Globe, FileWarning } from 'lucide-react';
import {
  listAttachments, uploadAttachment, getAttachmentUrl, deleteAttachment,
  getPublicUrl, hasPublicUrls,
  DOC_TYPES, type LeadAttachment, type DocType,
} from '../../services/leadAttachments';

const fmtSize = (bytes: number | null): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Nudge, not a block: past this, a friendly ask to compress before
// uploading — the agent can still proceed. Past HARD_LIMIT_BYTES, upload is
// refused outright.
const SOFT_LIMIT_BYTES = 10 * 1024 * 1024;
const HARD_LIMIT_BYTES = 25 * 1024 * 1024;

export const DocumentsPanel: React.FC<{ leadId: string; uploadedBy: string }> = ({ leadId, uploadedBy }) => {
  const { theme, getTextColor, getSecondaryTextColor } = useTheme();
  const [docs, setDocs] = useState<LeadAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<DocType>('Other');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const uploadLock = useRef(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [oversizeNudge, setOversizeNudge] = useState<{ file: File; docType: DocType } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingDocType = useRef<DocType>('Other');

  const load = () => {
    setLoading(true);
    listAttachments(leadId).then(setDocs).finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [leadId]);

  const startUpload = (docType: DocType) => {
    pendingDocType.current = docType;
    fileInputRef.current?.click();
  };

  const doUpload = async (file: File, docType: DocType) => {
    if (uploadLock.current) return;
    uploadLock.current = true;
    setUploading(true); setUploadStatus('uploading'); setUploadMessage(file.name);
    try {
      const doc = await uploadAttachment(leadId, file, docType, uploadedBy);
      setDocs(prev => [doc, ...prev]);
      toast.success('File uploaded');
      setUploadStatus('success'); setUploadMessage(`${file.name} uploaded successfully.`);
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed');
      setUploadStatus('error'); setUploadMessage(err?.message || 'Upload failed. Choose the file again to retry.');
    } finally {
      setUploading(false); uploadLock.current = false;
    }
  };

  const queueFile = (file: File, docType: DocType) => {
    if (uploadLock.current) return;
    if (file.size > HARD_LIMIT_BYTES) { setUploadStatus('error'); setUploadMessage(`“${file.name}” is ${fmtSize(file.size)}. The maximum is 25 MB.`); return; }
    if (file.size > SOFT_LIMIT_BYTES) { setOversizeNudge({ file, docType }); return; }
    void doUpload(file, docType);
  };
  const handleFileChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (file) queueFile(file, pendingDocType.current);
  };

  const openLink = async (doc: LeadAttachment, download: boolean) => {
    const publicUrl = getPublicUrl(doc);
    if (publicUrl && !download) { window.open(publicUrl, '_blank'); return; }
    setBusyId(doc.id);
    try {
      const url = publicUrl || await getAttachmentUrl(doc, { download });
      window.open(url, '_blank');
    } catch (err: any) {
      toast.error(err?.message || 'Could not open this file');
    } finally {
      setBusyId(null);
    }
  };

  const shareToClient = async (doc: LeadAttachment) => {
    setBusyId(doc.id);
    try {
      // Permanent public link once R2's Public Development URL is
      // configured (see services/leadAttachments.ts); otherwise a
      // long-lived (48h) presigned link — the client may not open it
      // immediately.
      const url = getPublicUrl(doc) || await getAttachmentUrl(doc, { download: false, expiresInSeconds: 172800 });
      const text = `Hi! Sharing your ${doc.docType.toLowerCase()} — ${doc.filename}\n${url}`;
      window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
    } catch (err: any) {
      toast.error(err?.message || 'Could not generate a share link');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (doc: LeadAttachment) => {
    if (!window.confirm(`Delete "${doc.filename}"? This cannot be undone.`)) return;
    setBusyId(doc.id);
    try {
      await deleteAttachment(doc);
      setDocs(prev => prev.filter(d => d.id !== doc.id));
      toast.success('File deleted');
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
      setBusyId(null);
    }
  };

  const byType = (t: DocType) => docs.filter(d => d.docType === t);

  return (
    <div className={cn('rounded-2xl border overflow-hidden', theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10')}>
      <div className={cn('p-3 border-b flex items-center justify-between', theme === 'light' ? 'border-slate-100 bg-slate-50/50' : 'border-white/10 bg-white/5')}>
        <div className="flex items-center gap-2">
          <FileText size={13} className="opacity-60" />
          <span className={cn('text-[11px] font-bold uppercase tracking-wider opacity-60', getTextColor())}>Documents</span>
          {hasPublicUrls() && (
            <span title="Public links enabled" className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-600 border border-sky-100">
              <Globe size={9} /> Public
            </span>
          )}
        </div>
        <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-bold', theme === 'light' ? 'bg-slate-200 text-slate-600' : 'bg-white/10 text-white')}>{docs.length}</span>
      </div>

      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChosen} disabled={uploading} />

      <div className="p-4 space-y-3">
        <label className="block text-xs font-semibold">Document category<select aria-label="Document category" value={uploadType} disabled={uploading} onChange={event => setUploadType(event.target.value as DocType)} className="block mt-2 w-full rounded-lg border border-slate-500/20 p-2.5 bg-transparent">{DOC_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
        <FileDropZone onFile={file => queueFile(file, uploadType)} status={uploadStatus} message={uploadMessage} disabled={loading}/>
      </div>
      <div className="p-2.5 space-y-2">
        {loading ? (
          <div className="py-4 text-center opacity-40 text-xs">Loading…</div>
        ) : (
          DOC_TYPES.map(docType => {
            const items = byType(docType);
            return (
              <div key={docType} className={cn('rounded-lg border', theme === 'light' ? 'border-slate-100' : 'border-white/10')}>
                <div className="flex items-center justify-between px-2.5 py-1.5">
                  <span className={cn('text-[10.5px] font-bold uppercase tracking-wide', getSecondaryTextColor())}>
                    {docType}{items.length > 0 && <span className="ml-1.5 opacity-60">({items.length})</span>}
                  </span>
                  <button onClick={() => startUpload(docType)} disabled={uploading}
                    aria-label={`Add ${docType}`} title={`Add ${docType}`}
                    className={cn('flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold transition disabled:opacity-50',
                      theme === 'light' ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100' : 'text-white/50 hover:text-white hover:bg-white/10')}>
                    {uploading ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} Add
                  </button>
                </div>
                {items.length > 0 && (
                  <div className="px-1.5 pb-1.5 space-y-1">
                    {items.map(doc => (
                      <div key={doc.id} className={cn('ui-document-row p-1.5 rounded-md flex items-center gap-2',
                        theme === 'light' ? 'bg-slate-50 hover:bg-slate-100' : 'bg-white/5 hover:bg-white/10')}>
                        <FileIcon size={13} className="shrink-0 opacity-40" />
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-[11.5px] font-semibold truncate', getTextColor())} title={doc.filename}>{doc.filename}</p>
                          <p className="text-[9.5px] opacity-50 font-mono truncate">
                            {formatDate(doc.createdAt)}{doc.fileSize ? ` · ${fmtSize(doc.fileSize)}` : ''}{doc.uploadedBy ? ` · ${doc.uploadedBy}` : ''}
                          </p>
                        </div>
                        <div className="ui-document-actions flex items-center gap-0.5 shrink-0">
                          {busyId === doc.id ? (
                            <Loader2 size={13} className="animate-spin opacity-50 mx-2" />
                          ) : (
                            <>
                              <button onClick={() => openLink(doc, false)} aria-label="View document" title="View" className="p-1 rounded opacity-60 hover:opacity-100 hover:bg-black/5 transition"><Eye size={12.5} /></button>
                              <button onClick={() => openLink(doc, true)} aria-label="Download document" title="Download" className="p-1 rounded opacity-60 hover:opacity-100 hover:bg-black/5 transition"><Download size={12.5} /></button>
                              <button onClick={() => shareToClient(doc)} aria-label="Share on WhatsApp document" title="Share on WhatsApp" className="p-1 rounded opacity-60 hover:opacity-100 hover:bg-black/5 transition"><Share2 size={12.5} /></button>
                              <button onClick={() => remove(doc)} aria-label="Delete document" title="Delete" className="p-1 rounded opacity-60 hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition"><Trash2 size={12.5} /></button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <Modal isOpen={!!oversizeNudge} onClose={() => setOversizeNudge(null)} title="Large file">
        {oversizeNudge && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className={cn('p-2 rounded-lg shrink-0', theme === 'light' ? 'bg-amber-50 text-amber-600' : 'bg-amber-500/15 text-amber-300')}>
                <FileWarning size={18} />
              </div>
              <p className={cn('text-sm leading-relaxed', getTextColor())}>
                Dear {uploadedBy}, "{oversizeNudge.file.name}" is {fmtSize(oversizeNudge.file.size)}. Compressing it before uploading would be appreciated — though if that's not possible, completely fine, go ahead and upload as-is.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setOversizeNudge(null)}
                className={cn('py-2.5 rounded-lg text-[13px] font-bold border transition',
                  theme === 'light' ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-400' : 'bg-white/5 border-white/10 text-white/80')}>
                I'll compress it
              </button>
              <button onClick={() => { const n = oversizeNudge; setOversizeNudge(null); if (n) doUpload(n.file, n.docType); }}
                className="py-2.5 rounded-lg text-[13px] font-bold bg-slate-900 text-white hover:bg-slate-800 transition">
                Upload anyway
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
