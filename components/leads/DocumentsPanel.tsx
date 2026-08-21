// ============================================================
// Lead detail page — Documents panel. Upload/view/download/share/delete
// files attached to a lead (hotel vouchers, payment bills, etc.), stored in
// Cloudflare R2 via services/leadAttachments.ts. All rate/margin figures
// live elsewhere; this panel only ever deals with file metadata.
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn, formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { FileText, Upload, Eye, Download, Share2, Trash2, Loader2, File as FileIcon } from 'lucide-react';
import {
  listAttachments, uploadAttachment, getAttachmentUrl, deleteAttachment,
  DOC_TYPES, type LeadAttachment, type DocType,
} from '../../services/leadAttachments';

const fmtSize = (bytes: number | null): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const DocumentsPanel: React.FC<{ leadId: string; uploadedBy: string }> = ({ leadId, uploadedBy }) => {
  const { theme, getTextColor } = useTheme();
  const [docs, setDocs] = useState<LeadAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<DocType>('Hotel Voucher');
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    listAttachments(leadId).then(setDocs).finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [leadId]);

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file next time
    if (!file) return;
    setUploading(true);
    try {
      const doc = await uploadAttachment(leadId, file, docType, uploadedBy);
      setDocs(prev => [doc, ...prev]);
      toast.success('File uploaded');
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const openLink = async (doc: LeadAttachment, download: boolean) => {
    setBusyId(doc.id);
    try {
      const url = await getAttachmentUrl(doc, { download });
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
      // Long-lived (48h) link — the client may not open it immediately.
      const url = await getAttachmentUrl(doc, { download: false, expiresInSeconds: 172800 });
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

  return (
    <div className={cn('rounded-2xl border overflow-hidden', theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10')}>
      <div className={cn('p-4 border-b flex items-center justify-between', theme === 'light' ? 'border-slate-100 bg-slate-50/50' : 'border-white/10 bg-white/5')}>
        <div className="flex items-center gap-2">
          <FileText size={14} className="opacity-60" />
          <span className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Documents</span>
        </div>
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-bold', theme === 'light' ? 'bg-slate-200 text-slate-600' : 'bg-white/10 text-white')}>{docs.length}</span>
      </div>

      <div className="p-3 space-y-3">
        {/* Upload row */}
        <div className="flex gap-2">
          <select
            value={docType}
            onChange={e => setDocType(e.target.value as DocType)}
            className={cn('flex-1 min-w-0 px-2.5 py-2 rounded-lg border text-[12px] font-semibold outline-none',
              theme === 'light' ? 'bg-white border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-white/80')}>
            {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChosen} disabled={uploading} />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold shrink-0 transition disabled:opacity-60',
              theme === 'light' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-slate-900 hover:bg-white/90')}>
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="py-6 text-center opacity-40 text-xs">Loading…</div>
        ) : docs.length === 0 ? (
          <div className="py-6 text-center opacity-40 text-xs italic">No documents yet.</div>
        ) : (
          <div className="space-y-1.5">
            {docs.map(doc => (
              <div key={doc.id} className={cn('p-2.5 rounded-lg border flex items-center gap-2.5',
                theme === 'light' ? 'bg-white border-slate-100 hover:border-slate-300' : 'bg-white/5 border-white/10')}>
                <FileIcon size={15} className="shrink-0 opacity-40" />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-[12.5px] font-semibold truncate', getTextColor())} title={doc.filename}>{doc.filename}</p>
                  <p className="text-[10px] opacity-50 font-mono truncate">
                    {doc.docType} · {formatDate(doc.createdAt)}{doc.fileSize ? ` · ${fmtSize(doc.fileSize)}` : ''}{doc.uploadedBy ? ` · ${doc.uploadedBy}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {busyId === doc.id ? (
                    <Loader2 size={14} className="animate-spin opacity-50 mx-2" />
                  ) : (
                    <>
                      <button onClick={() => openLink(doc, false)} title="View" className="p-1.5 rounded-md opacity-60 hover:opacity-100 hover:bg-black/5 transition"><Eye size={14} /></button>
                      <button onClick={() => openLink(doc, true)} title="Download" className="p-1.5 rounded-md opacity-60 hover:opacity-100 hover:bg-black/5 transition"><Download size={14} /></button>
                      <button onClick={() => shareToClient(doc)} title="Share on WhatsApp" className="p-1.5 rounded-md opacity-60 hover:opacity-100 hover:bg-black/5 transition"><Share2 size={14} /></button>
                      <button onClick={() => remove(doc)} title="Delete" className="p-1.5 rounded-md opacity-60 hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition"><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
