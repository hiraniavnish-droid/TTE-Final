import React, { useState, useEffect, useCallback } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { TTE_TOKEN_KEY } from '../lib/supabase';
import { generateVoucherPdf } from '../utils/generateVoucherPdf';
import { Lead } from '../types';
import { formatCurrency, cn } from '../utils/helpers';
import toast from 'react-hot-toast';
import {
  CreditCard,
  IndianRupee,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  Copy,
  AlertTriangle,
  Send,
  Hash,
  Calendar,
  User,
  Phone,
  Loader2,
  MessageCircle,
  Banknote,
  Plus,
  FileText,
  Receipt,
  FileBadge,
  Check,
  X,
  Ban,
  ClipboardEdit,
  Eye,
  Download,
} from 'lucide-react';

const MANUAL_METHODS = ['Cash', 'Cheque', 'Bank Transfer', 'UPI', 'Other'] as const;

// In production the API lives on the same origin; during `vite dev`
// there is no serverless runtime, so fall back to the deployed URL.
const API_BASE = (import.meta as any).env?.DEV ? 'https://ttecrm.vercel.app' : '';

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
  source?: 'razorpay' | 'manual';
  method?: string;
  manual_reference?: string;
  notes?: string;
}

interface DocRecord {
  id: string;
  doc_type: 'invoice' | 'receipt';
  number: string | null;
  status: 'pending' | 'issued' | 'rejected' | 'cancelled';
  source: 'system' | 'external';
  lead_id: string;
  lead_name: string | null;
  payment_id: string;
  payment_reference_id: string;
  amount: number;
  customer_name: string | null;
  customer_phone: string | null;
  customer_gstin: string | null;
  place_of_supply: string | null;
  tax_type: 'none' | 'cgst_sgst' | 'igst';
  tax_rate: number;
  taxable_value: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  notes: string | null;
  requested_by: string;
  requested_at: string;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
}

const authHeaders = (): Record<string, string> => {
  try {
    const token = localStorage.getItem(TTE_TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch { return {}; }
};

const DOC_STATUS_META: Record<string, { label: string; chip: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending approval', chip: 'bg-amber-50 text-amber-700 border-amber-200', icon: <Clock size={12} /> },
  issued: { label: 'Issued', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 size={12} /> },
  rejected: { label: 'Rejected', chip: 'bg-rose-50 text-rose-700 border-rose-200', icon: <X size={12} /> },
  cancelled: { label: 'Cancelled', chip: 'bg-slate-100 text-slate-600 border-slate-200', icon: <Ban size={12} /> },
};

const STATUS_META: Record<string, { label: string; dot: string; chip: string; icon: React.ReactNode }> = {
  paid: {
    label: 'Payment Received',
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: <CheckCircle2 size={16} />,
  },
  partially_paid: {
    label: 'Partially Paid',
    dot: 'bg-blue-500',
    chip: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: <IndianRupee size={16} />,
  },
  created: {
    label: 'Payment Pending',
    dot: 'bg-amber-500 animate-pulse',
    chip: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: <Clock size={16} />,
  },
  expired: {
    label: 'Link Expired',
    dot: 'bg-slate-400',
    chip: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: <AlertTriangle size={16} />,
  },
  cancelled: {
    label: 'Cancelled',
    dot: 'bg-rose-500',
    chip: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: <AlertTriangle size={16} />,
  },
};

const metaFor = (status: string) => STATUS_META[status] || STATUS_META.created;

const fmtDateTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

interface PaymentLinkWidgetProps {
  lead: Lead;
}

export const PaymentLinkWidget: React.FC<PaymentLinkWidgetProps> = ({ lead }) => {
  const { theme, getTextColor, getInputClass } = useTheme();
  const { user } = useAuth();

  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [amount, setAmount] = useState<string>('');
  const [sendSms, setSendSms] = useState(true);

  // Manual payment entry (cash/cheque/bank transfer/UPI)
  const [manualOpen, setManualOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null);
  const [manualCustomer, setManualCustomer] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualMethod, setManualMethod] = useState<typeof MANUAL_METHODS[number]>('Cash');
  const [manualRef, setManualRef] = useState('');
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualNotes, setManualNotes] = useState('');
  const [savingManual, setSavingManual] = useState(false);

  // Voucher / GST invoice numbering
  const [documents, setDocuments] = useState<DocRecord[]>([]);
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docTarget, setDocTarget] = useState<PaymentRecord | null>(null);
  const [docType, setDocType] = useState<'invoice' | 'receipt'>('receipt');
  const [docTaxType, setDocTaxType] = useState<'none' | 'cgst_sgst' | 'igst'>('none');
  const [docTaxRate, setDocTaxRate] = useState('18');
  const [docGstin, setDocGstin] = useState('');
  const [docPlaceOfSupply, setDocPlaceOfSupply] = useState('');
  const [docNotes, setDocNotes] = useState('');
  const [requestingDoc, setRequestingDoc] = useState(false);

  const [externalOpen, setExternalOpen] = useState(false);
  const [externalTarget, setExternalTarget] = useState<PaymentRecord | null>(null);
  const [externalDocType, setExternalDocType] = useState<'invoice' | 'receipt'>('receipt');
  const [externalNumber, setExternalNumber] = useState('');
  const [externalNotes, setExternalNotes] = useState('');
  const [savingExternal, setSavingExternal] = useState(false);

  const [reviewDoc, setReviewDoc] = useState<DocRecord | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | 'cancel' | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/documents?leadId=${encodeURIComponent(lead.id)}`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) setDocuments(data.documents || []);
    } catch { /* offline / dev without API */ }
  }, [lead.id]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  // Most relevant document for a given payment: prefer an active one (pending/issued)
  // over a stale rejected/cancelled one, else fall back to the latest overall.
  const docFor = (paymentId: string): DocRecord | null => {
    const forPayment = documents.filter(d => d.payment_id === paymentId);
    if (!forPayment.length) return null;
    const active = forPayment.find(d => d.status === 'pending' || d.status === 'issued');
    return active || forPayment[0];
  };

  const fetchRecords = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch(`${API_BASE}/api/razorpay-link?leadId=${encodeURIComponent(lead.id)}`);
      const data = await res.json();
      if (res.ok) setRecords(data.records || []);
    } catch {
      /* offline / dev without API — leave as-is */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [lead.id]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const latest = records[0];

  // ─── Collection summary across all links ───
  const paidRecords = records.filter((r) => r.status === 'paid');
  const collected = paidRecords.reduce((s, r) => s + r.amount, 0);
  const totalRequested = records.reduce((s, r) => s + r.amount, 0);
  const paidCount = paidRecords.length;
  const pendingCount = records.filter((r) => r.status === 'created' || r.status === 'partially_paid').length;
  const pct = totalRequested > 0 ? Math.round((collected / totalRequested) * 100) : 0;
  const multi = records.length > 1;

  const openDetail = () => { setDetailOpen(true); fetchRecords(true); };

  const openCreate = () => {
    // Default to the lead budget (or last link amount) but keep it editable.
    const def = lead.tripDetails?.budget && lead.tripDetails.budget > 0
      ? String(lead.tripDetails.budget)
      : latest?.amount ? String(latest.amount) : '';
    setAmount(def);
    setSendSms(!!lead.contact?.phone); // default SMS on only if a phone exists
    setCreateOpen(true);
  };

  // Custom WhatsApp message with the customer's name + amount.
  const waMessage = (rec: PaymentRecord) =>
    `Hi ${rec.customer_name || 'there'}, here is your secure payment link for ${formatCurrency(rec.amount)}:\n${rec.short_url}\n\nPlease complete the payment at your convenience.\nThank you!\n— The Tourism Experts`;

  const waHref = (rec: PaymentRecord) => {
    const digits = (rec.customer_phone || '').replace(/[^0-9]/g, '');
    const to = digits.length === 10 ? '91' + digits : digits.length >= 11 ? digits : '';
    return `https://wa.me/${to}?text=${encodeURIComponent(waMessage(rec))}`;
  };

  const handleCreate = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || !(amt >= 1)) {
      toast.error('Enter a valid amount (min ₹1).');
      return;
    }
    if (sendSms && !lead.contact?.phone) {
      toast.error('This lead has no phone number — turn off SMS to create a shareable link.');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/razorpay-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          leadName: lead.name,
          amount: amt,
          name: lead.name,
          phone: lead.contact?.phone || '',
          email: lead.contact?.email || '',
          description: `Trip payment — ${lead.tripDetails?.destination || 'Booking'}`,
          createdBy: user?.name || 'Agent',
          sendSms,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create link');
      setRecords((prev) => [data.record, ...prev]);
      setCreateOpen(false);
      // Auto-copy the fresh link so it's ready to paste anywhere.
      try {
        await navigator.clipboard.writeText(data.record.short_url);
        toast.success(sendSms ? 'Link created, SMS sent & copied!' : 'Link created & copied to clipboard!');
      } catch {
        toast.success(sendSms ? 'Payment link created & SMS sent!' : 'Payment link created!');
      }
      // Open details so Copy / WhatsApp share are one click away.
      setDetailOpen(true);
    } catch (e: any) {
      toast.error(e?.message || 'Could not create payment link.');
    } finally {
      setCreating(false);
    }
  };

  const openManual = () => {
    setEditingPayment(null);
    setManualCustomer(lead.name);setManualPhone(lead.contact?.phone || '');setManualEmail(lead.contact?.email || '');
    const def = lead.tripDetails?.budget && lead.tripDetails.budget > 0 ? String(lead.tripDetails.budget) : '';
    setManualAmount(def);
    setManualMethod('Cash');
    setManualRef('');
    setManualDate(new Date().toISOString().slice(0, 10));
    setManualNotes('');
    setManualOpen(true);
  };

  const openEditPayment = (record: PaymentRecord) => {
    setEditingPayment(record);
    setManualAmount(String(record.amount));setManualMethod((record.method || 'Other') as typeof MANUAL_METHODS[number]);
    setManualRef(record.manual_reference || '');setManualDate(record.paid_at?.slice(0,10) || '');setManualNotes(record.notes || '');
    setManualCustomer(record.customer_name);setManualPhone(record.customer_phone || '');setManualEmail(record.customer_email || '');
    setDetailOpen(false);setManualOpen(true);
  };

  const handleSaveManual = async () => {
    const amt = Number(manualAmount);
    if (!Number.isFinite(amt) || !(amt >= 1)) {
      toast.error('Enter a valid amount (min ₹1).');
      return;
    }
    setSavingManual(true);
    try {
      const res = await fetch(`${API_BASE}/api/razorpay-link`, {
        method: editingPayment ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          manual: true,
          ...(editingPayment ? { action:'edit_manual', id:editingPayment.id, expected:{amount:editingPayment.amount,method:editingPayment.method,paid_at:editingPayment.paid_at,manual_reference:editingPayment.manual_reference,notes:editingPayment.notes,customer_name:editingPayment.customer_name,customer_phone:editingPayment.customer_phone,customer_email:editingPayment.customer_email} } : {}),
          leadId: lead.id,
          leadName: lead.name,
          amount: amt,
          name: manualCustomer,
          phone: manualPhone,
          email: manualEmail,
          method: manualMethod,
          manualReference: manualRef,
          paidAt: manualDate,
          notes: manualNotes,
          createdBy: user?.name || 'Agent',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record payment');
      setRecords((prev) => editingPayment ? prev.map(record => record.id === data.record.id ? data.record : record) : [data.record, ...prev]);
      window.dispatchEvent(new Event('tte:payments-changed'));
      setManualOpen(false);
      toast.success(editingPayment ? 'Payment updated!' : 'Manual payment recorded!');
      if (data.warning) toast.error(data.warning);
      setDetailOpen(true);
    } catch (e: any) {
      toast.error(e?.message || 'Could not record payment.');
    } finally {
      setSavingManual(false);
    }
  };

  const openDocModal = (rec: PaymentRecord, type: 'invoice' | 'receipt') => {
    setDocTarget(rec);
    setDocType(type);
    setDocTaxType('none');
    setDocTaxRate('18');
    setDocGstin('');
    setDocPlaceOfSupply('');
    setDocNotes('');
    setDocModalOpen(true);
  };

  // Amount is treated as tax-inclusive (what was actually paid) — back-calculate
  // the taxable value and split so the two always add up to the amount received.
  const taxPreview = (() => {
    if (!docTarget) return { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    const amt = docTarget.amount;
    const rate = Number(docTaxRate) || 0;
    if (docTaxType === 'none' || rate <= 0) return { taxable: amt, cgst: 0, sgst: 0, igst: 0 };
    const taxable = amt / (1 + rate / 100);
    const totalTax = amt - taxable;
    if (docTaxType === 'igst') return { taxable, cgst: 0, sgst: 0, igst: totalTax };
    return { taxable, cgst: totalTax / 2, sgst: totalTax / 2, igst: 0 };
  })();

  const handleRequestDoc = async () => {
    if (!docTarget) return;
    if (docType === 'invoice' && docTaxType !== 'none' && !(Number(docTaxRate) > 0)) {
      toast.error('Enter a valid GST rate.');
      return;
    }
    setRequestingDoc(true);
    try {
      const res = await fetch(`${API_BASE}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          action: 'request',
          docType,
          leadId: lead.id,
          leadName: lead.name,
          paymentId: docTarget.id,
          paymentReferenceId: docTarget.reference_id,
          amount: docTarget.amount,
          customerName: docTarget.customer_name,
          customerPhone: docTarget.customer_phone,
          customerGstin: docType === 'invoice' ? docGstin : undefined,
          placeOfSupply: docType === 'invoice' ? docPlaceOfSupply : undefined,
          taxType: docType === 'invoice' ? docTaxType : 'none',
          taxRate: docType === 'invoice' ? Number(docTaxRate) : 0,
          taxableValue: docType === 'invoice' ? taxPreview.taxable : docTarget.amount,
          cgstAmount: taxPreview.cgst,
          sgstAmount: taxPreview.sgst,
          igstAmount: taxPreview.igst,
          notes: docNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to request document');
      setDocuments(prev => [data.document, ...prev]);
      setDocModalOpen(false);
      toast.success('Request sent — waiting for Admin approval.');
    } catch (e: any) {
      toast.error(e?.message || 'Could not request document.');
    } finally {
      setRequestingDoc(false);
    }
  };

  const openExternal = (rec: PaymentRecord) => {
    setExternalTarget(rec);
    setExternalDocType('receipt');
    setExternalNumber('');
    setExternalNotes('');
    setExternalOpen(true);
  };

  const handleSaveExternal = async () => {
    if (!externalTarget) return;
    if (!externalNumber.trim()) {
      toast.error('Enter the document number you already used.');
      return;
    }
    setSavingExternal(true);
    try {
      const res = await fetch(`${API_BASE}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          action: 'register_external',
          docType: externalDocType,
          number: externalNumber.trim(),
          leadId: lead.id,
          leadName: lead.name,
          paymentId: externalTarget.id,
          paymentReferenceId: externalTarget.reference_id,
          amount: externalTarget.amount,
          customerName: externalTarget.customer_name,
          customerPhone: externalTarget.customer_phone,
          notes: externalNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register document');
      setDocuments(prev => [data.document, ...prev]);
      setExternalOpen(false);
      toast.success('External document registered.');
    } catch (e: any) {
      toast.error(e?.message || 'Could not register document.');
    } finally {
      setSavingExternal(false);
    }
  };

  const openReview = (doc: DocRecord, action: 'approve' | 'reject' | 'cancel') => {
    setReviewDoc(doc);
    setReviewAction(action);
    setCancelReason('');
  };

  const handleReview = async () => {
    if (!reviewDoc || !reviewAction) return;
    if (reviewAction === 'cancel' && !cancelReason.trim()) {
      toast.error('A cancellation reason is required.');
      return;
    }
    setReviewing(true);
    try {
      const res = await fetch(`${API_BASE}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ action: reviewAction, id: reviewDoc.id, reason: cancelReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      setDocuments(prev => prev.map(d => d.id === data.document.id ? data.document : d));
      setReviewDoc(null);
      setReviewAction(null);
      toast.success(
        reviewAction === 'approve' ? `${data.document.number} issued!`
          : reviewAction === 'reject' ? 'Request rejected.'
          : 'Document cancelled.'
      );
    } catch (e: any) {
      toast.error(e?.message || 'Could not complete action.');
    } finally {
      setReviewing(false);
    }
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url).then(
      () => toast.success('Link copied!'),
      () => toast.error('Copy failed'),
    );
  };

  const phonePreview = lead.contact?.phone || '—';

  return (
    <>
      <Card noPadding className="overflow-hidden border-l-4 border-l-indigo-500">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={cn('p-1.5 rounded-md', theme === 'light' ? 'bg-indigo-50 text-indigo-600' : 'bg-indigo-500/20 text-indigo-300')}>
                <CreditCard size={16} />
              </div>
              <span className={cn('font-bold text-sm', getTextColor())}>Collect Payment</span>
            </div>
            <span className="text-[9px] uppercase font-extrabold tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
              Razorpay
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-4 opacity-50">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : multi ? (
            // ─── Multi-link summary (collected vs total) ───
            <button
              onClick={openDetail}
              className={cn('w-full text-left rounded-xl border p-3 transition-all hover:shadow-md', theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10')}
            >
              <div className="flex items-end justify-between mb-2">
                <div>
                  <div className="text-[9px] uppercase font-extrabold tracking-wider opacity-50">Collected</div>
                  <div className="text-xl font-mono font-bold text-emerald-600 leading-none mt-0.5">{formatCurrency(collected)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] uppercase font-extrabold tracking-wider opacity-50">of {formatCurrency(totalRequested)}</div>
                  <div className={cn('text-xs font-bold mt-0.5', getTextColor())}>{paidCount}/{records.length} links paid</div>
                </div>
              </div>
              {/* progress bar */}
              <div className="h-1.5 w-full rounded-full bg-gray-200/70 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center gap-3 mt-2 text-[10px] font-semibold">
                {paidCount > 0 && <span className="flex items-center gap-1 text-emerald-600"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{paidCount} paid</span>}
                {pendingCount > 0 && <span className="flex items-center gap-1 text-amber-600"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{pendingCount} pending</span>}
                <span className="ml-auto flex items-center gap-1 opacity-50"><ExternalLink size={11} /> View all</span>
              </div>
            </button>
          ) : latest ? (
            // ─── Single status chip (click → details) ───
            <button
              onClick={openDetail}
              className={cn(
                'w-full flex items-center justify-between gap-2 p-3 rounded-xl border transition-all hover:shadow-md text-left',
                metaFor(latest.status).chip,
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', metaFor(latest.status).dot)} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-bold text-sm">
                    {latest.source === 'manual' ? <Banknote size={16} /> : metaFor(latest.status).icon}
                    {metaFor(latest.status).label}
                    {latest.source === 'manual' && (
                      <span className="text-[8.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-black/5">{latest.method}</span>
                    )}
                  </div>
                  <div className="text-[11px] opacity-70 font-mono truncate">
                    {formatCurrency(latest.amount)} · {latest.reference_id}
                  </div>
                </div>
              </div>
              <ExternalLink size={15} className="opacity-50 shrink-0" />
            </button>
          ) : (
            // ─── Generate options ───
            <div className="grid grid-cols-2 gap-2">
              <Button className="w-full justify-center" onClick={openCreate}>
                <IndianRupee size={16} /> Payment Link
              </Button>
              <Button variant="secondary" className="w-full justify-center" onClick={openManual}>
                <Banknote size={16} /> Record Payment
              </Button>
            </div>
          )}

          {latest && (
            <div className="flex items-center justify-center gap-3 mt-2">
              <button
                onClick={openCreate}
                className={cn('text-[11px] font-semibold opacity-60 hover:opacity-100 transition-opacity', getTextColor())}
              >
                + New link
              </button>
              <span className="opacity-20 text-[11px]">·</span>
              <button
                onClick={openManual}
                className={cn('text-[11px] font-semibold opacity-60 hover:opacity-100 transition-opacity', getTextColor())}
              >
                + Record payment
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* ─── Create Modal (with confirmation) ─── */}
      <Modal isOpen={createOpen} onClose={() => !creating && setCreateOpen(false)} title="Generate Payment Link">
        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Amount to collect</label>
            <div className="relative">
              <IndianRupee size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
                min={1}
                className={cn('w-full pl-9 pr-3 py-3 rounded-lg border outline-none font-mono text-lg font-bold', getInputClass())}
                placeholder="0"
              />
            </div>
            <p className="text-[11px] opacity-50">Pre-filled from the lead budget — edit if needed.</p>
          </div>

          <div className={cn('rounded-xl border p-3.5 space-y-3', theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/10')}>
            <div className="flex items-center gap-2 text-sm">
              <User size={14} className="opacity-40" />
              <span className="opacity-60">Customer:</span>
              <span className={cn('font-semibold', getTextColor())}>{lead.name}</span>
            </div>

            {/* Delivery method toggle */}
            <div className="pt-1 border-t border-gray-500/10">
              <label className={cn('flex items-start gap-2.5 cursor-pointer select-none', !lead.contact?.phone && 'opacity-50 cursor-not-allowed')}>
                <input
                  type="checkbox"
                  checked={sendSms}
                  disabled={!lead.contact?.phone}
                  onChange={(e) => setSendSms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-indigo-600 cursor-pointer disabled:cursor-not-allowed"
                />
                <div>
                  <div className={cn('font-semibold text-sm flex items-center gap-1.5', getTextColor())}>
                    <Phone size={13} /> Send payment link via SMS
                  </div>
                  <div className="text-[11px] opacity-55">
                    {lead.contact?.phone
                      ? sendSms
                        ? <>Razorpay will text the link to <span className="font-mono font-semibold">{phonePreview}</span>.</>
                        : <>Off — you'll get a copyable link to share yourself.</>
                      : <>No phone on this lead. Link will be copy-only.</>}
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className={cn('flex items-start gap-2.5 p-3 rounded-lg border',
            sendSms ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-indigo-50 border-indigo-200 text-indigo-800')}>
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">
              {sendSms
                ? <>A secure Razorpay link will be created and an <b>SMS sent to {phonePreview}</b>. Confirm the amount before sending.</>
                : <>A secure Razorpay link will be created and <b>copied to your clipboard</b> — share it on WhatsApp or anywhere.</>}
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating} className="min-w-[180px]">
              {creating
                ? <><Loader2 size={16} className="animate-spin" /> Creating…</>
                : sendSms
                  ? <><Send size={16} /> Create &amp; Send Link</>
                  : <><Copy size={16} /> Create &amp; Copy Link</>}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Detail / Status Modal ─── */}
      <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)} title="Payment Status">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className={cn('text-xs font-bold uppercase tracking-wider opacity-50', getTextColor())}>
              {records.length} link{records.length !== 1 ? 's' : ''} for {lead.name}
            </span>
            <button
              onClick={() => fetchRecords(true)}
              className={cn('flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-md transition-colors', theme === 'light' ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-white/10 text-slate-300')}
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          {/* Collection summary (only when more than one link) */}
          {multi && (
            <div className={cn('rounded-xl border p-4', theme === 'light' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-emerald-500/10 border-emerald-500/20')}>
              <div className="flex items-end justify-between mb-2">
                <div>
                  <div className="text-[10px] uppercase font-extrabold tracking-wider opacity-50">Total Collected</div>
                  <div className="text-2xl font-mono font-bold text-emerald-600 leading-none mt-1">{formatCurrency(collected)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-extrabold tracking-wider opacity-50">of {formatCurrency(totalRequested)} sent</div>
                  <div className={cn('text-sm font-bold mt-1', getTextColor())}>{paidCount}/{records.length} links paid · {pct}%</div>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-200/70 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
              {pendingCount > 0 && (
                <div className="text-[11px] font-semibold text-amber-600 mt-2 flex items-center gap-1">
                  <Clock size={12} /> {formatCurrency(totalRequested - collected)} still pending across {pendingCount} link{pendingCount !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
            {records.map((rec) => {
              const m = metaFor(rec.status);
              const isManual = rec.source === 'manual';
              return (
                <div key={rec.id} className={cn('rounded-xl border p-4', theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10')}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={cn('inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border', m.chip)}>
                      <span className={cn('w-2 h-2 rounded-full', m.dot)} />
                      {isManual ? <Banknote size={14} /> : m.icon} {isManual ? 'Payment Received' : m.label}
                      {isManual && <span className="text-[8.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-black/5">{rec.method}</span>}
                    </span>
                    <span className={cn('text-lg font-mono font-bold', getTextColor())}>{formatCurrency(rec.amount)}</span>
                  </div>

                  {isManual && <button onClick={() => openEditPayment(rec)} className="mb-3 flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-600"><ClipboardEdit size={13} /> Edit Payment</button>}
                  <div className="space-y-1.5 text-xs">
                    <Row icon={<Hash size={12} />} label="Reference ID" value={rec.reference_id} />
                    {!isManual && <Row icon={<CreditCard size={12} />} label="Link ID" value={rec.id} />}
                    <Row icon={<User size={12} />} label="Customer" value={`${rec.customer_name} · ${rec.customer_phone}`} />
                    <Row icon={<Calendar size={12} />} label="Created" value={`${fmtDateTime(rec.created_at)}${rec.created_by ? ' · ' + rec.created_by : ''}`} />
                    {rec.paid_at && <Row icon={<CheckCircle2 size={12} />} label="Paid at" value={fmtDateTime(rec.paid_at)} />}
                    {rec.razorpay_payment_id && <Row icon={<IndianRupee size={12} />} label="Payment ID" value={rec.razorpay_payment_id} />}
                    {isManual && rec.manual_reference && <Row icon={<Hash size={12} />} label="Entry Ref" value={rec.manual_reference} />}
                    {isManual && rec.notes && <Row icon={<FileText size={12} />} label="Notes" value={rec.notes} />}
                  </div>

                  {!isManual && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-500/10">
                      <a href={waHref(rec)} target="_blank" rel="noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-lg border transition-colors bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100">
                        <MessageCircle size={13} /> WhatsApp
                      </a>
                      <button onClick={() => copyLink(rec.short_url)}
                        className={cn('flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors', theme === 'light' ? 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700' : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200')}>
                        <Copy size={13} /> Copy
                      </button>
                      <a href={rec.short_url} target="_blank" rel="noreferrer"
                        className={cn('flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors', theme === 'light' ? 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700' : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200')}>
                        <ExternalLink size={13} /> Open
                      </a>
                    </div>
                  )}

                  {/* ─── Voucher / GST Invoice ─── */}
                  {rec.status === 'paid' && (() => {
                    const doc = docFor(rec.id);
                    if (!doc) {
                      return (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-500/10">
                          <button onClick={() => openDocModal(rec, 'receipt')}
                            className={cn('flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-2 py-2 rounded-lg border transition-colors', theme === 'light' ? 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700' : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200')}>
                            <Receipt size={13} /> Generate Receipt
                          </button>
                          <button onClick={() => openDocModal(rec, 'invoice')}
                            className={cn('flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-2 py-2 rounded-lg border transition-colors', theme === 'light' ? 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700' : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200')}>
                            <FileBadge size={13} /> Generate Invoice
                          </button>
                          <button onClick={() => openExternal(rec)} title="Register a number already created outside the CRM"
                            className={cn('flex items-center justify-center px-2.5 py-2 rounded-lg border transition-colors', theme === 'light' ? 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-500' : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300')}>
                            <ClipboardEdit size={13} />
                          </button>
                        </div>
                      );
                    }
                    const dm = DOC_STATUS_META[doc.status];
                    return (
                      <div className="mt-3 pt-3 border-t border-gray-500/10">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-full border', dm.chip)}>
                            {dm.icon} {doc.doc_type === 'invoice' ? 'Invoice' : 'Receipt'} {doc.number || `· ${dm.label}`}
                          </span>
                          {doc.status === 'pending' && user?.role === 'admin' && (
                            <div className="flex gap-1.5">
                              <button onClick={() => openReview(doc, 'approve')}
                                className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md bg-emerald-500 text-white hover:bg-emerald-600">
                                <Check size={12} /> Approve
                              </button>
                              <button onClick={() => openReview(doc, 'reject')}
                                className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100">
                                <X size={12} /> Reject
                              </button>
                            </div>
                          )}
                          {doc.status === 'pending' && user?.role !== 'admin' && (
                            <span className="text-[10px] opacity-50">Waiting for Admin to approve</span>
                          )}
                          {doc.status === 'issued' && (
                            <div className="flex items-center gap-1">
                              <button onClick={() => generateVoucherPdf(doc, 'view')} title="View"
                                className={cn('flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md border', theme === 'light' ? 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600' : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300')}>
                                <Eye size={12} /> View
                              </button>
                              <button onClick={() => generateVoucherPdf(doc, 'download')} title="Download PDF"
                                className={cn('flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md border', theme === 'light' ? 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600' : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300')}>
                                <Download size={12} /> PDF
                              </button>
                              {user?.role === 'admin' && (
                                <button onClick={() => openReview(doc, 'cancel')} className="text-[10px] font-semibold opacity-50 hover:opacity-100 hover:text-rose-600 transition ml-1">
                                  Cancel
                                </button>
                              )}
                            </div>
                          )}
                          {(doc.status === 'rejected' || doc.status === 'cancelled') && (
                            <button onClick={() => openDocModal(rec, doc.doc_type)} className="text-[10px] font-bold underline opacity-70 hover:opacity-100">
                              Generate again
                            </button>
                          )}
                        </div>
                        {doc.status === 'cancelled' && doc.cancellation_reason && (
                          <p className="text-[10px] opacity-50 mt-1">Reason: {doc.cancellation_reason}</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );})}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => { setDetailOpen(false); openManual(); }}>
              <Banknote size={16} /> Record Payment
            </Button>
            <Button onClick={() => { setDetailOpen(false); openCreate(); }}>
              <IndianRupee size={16} /> New Payment Link
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Manual Payment Modal ─── */}
      <Modal isOpen={manualOpen} onClose={() => { if (!savingManual) { setManualOpen(false); if (editingPayment) setDetailOpen(true); } }} title={editingPayment ? 'Edit Recorded Payment' : 'Record Manual Payment'}>
        <div className="space-y-5">
          {editingPayment && <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 text-xs">Customer name<input aria-label="Customer name" value={manualCustomer} onChange={e => setManualCustomer(e.target.value)} className={cn('block w-full rounded-lg border p-2 mt-1',getInputClass())} /></label>
            <label className="text-xs">Phone<input aria-label="Customer phone" value={manualPhone} onChange={e => setManualPhone(e.target.value)} className={cn('block w-full rounded-lg border p-2 mt-1',getInputClass())} /></label>
            <label className="text-xs">Email<input aria-label="Customer email" value={manualEmail} onChange={e => setManualEmail(e.target.value)} className={cn('block w-full rounded-lg border p-2 mt-1',getInputClass())} /></label>
          </div>}
          {editingPayment && documents.some(doc => doc.payment_id === editingPayment.id && ['pending','issued'].includes(doc.status)) && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Existing receipts and invoices keep their original details. Review those documents after saving this correction.</p>}
          <div className="space-y-1.5">
            <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Amount received</label>
            <div className="relative">
              <IndianRupee size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
              <input
                type="number"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                autoFocus
                min={1}
                className={cn('w-full pl-9 pr-3 py-3 rounded-lg border outline-none font-mono text-lg font-bold', getInputClass())}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Payment method</label>
            <div className="grid grid-cols-3 gap-2">
              {MANUAL_METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setManualMethod(m)}
                  className={cn('py-2 rounded-lg text-xs font-bold border transition',
                    manualMethod === m ? 'bg-slate-900 border-slate-900 text-white' : cn(theme === 'light' ? 'bg-white border-slate-200 text-slate-500' : 'bg-white/5 border-white/10 text-white/50'))}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Entry / reference ID</label>
              <input
                value={manualRef}
                onChange={(e) => setManualRef(e.target.value)}
                placeholder={manualMethod === 'Cheque' ? 'Cheque no.' : manualMethod === 'Bank Transfer' ? 'UTR / txn ref' : manualMethod === 'UPI' ? 'UPI txn ID' : 'Reference'}
                className={cn('w-full px-3 py-2.5 rounded-lg border outline-none text-sm', getInputClass())}
              />
            </div>
            <div className="space-y-1.5">
              <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Date received</label>
              <input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className={cn('w-full px-3 py-2.5 rounded-lg border outline-none text-sm font-mono', getInputClass())}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Notes (optional)</label>
            <textarea
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Advance token received in cash at office"
              className={cn('w-full px-3 py-2.5 rounded-lg border outline-none text-sm resize-none', getInputClass())}
            />
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">
              {editingPayment ? 'This corrects the existing payment entry and updates totals.' : <>This logs an <b>already-received</b> payment — it doesn't collect money itself. Only record it once you've actually received the {manualMethod.toLowerCase()}.</>}
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={() => { setManualOpen(false); if (editingPayment) setDetailOpen(true); }} disabled={savingManual}>Cancel</Button>
            <Button onClick={handleSaveManual} disabled={savingManual} className="min-w-[160px] bg-slate-900 hover:bg-slate-800 border-none text-white">
              {savingManual ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><Banknote size={16} /> {editingPayment ? 'Save Changes' : 'Save Entry'}</>}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Generate Receipt / Invoice Modal ─── */}
      <Modal isOpen={docModalOpen} onClose={() => !requestingDoc && setDocModalOpen(false)} title={docType === 'invoice' ? 'Generate GST Invoice' : 'Generate Payment Receipt'}>
        <div className="space-y-5">
          {docTarget && (
            <div className={cn('rounded-xl border p-3.5 space-y-1.5 text-sm', theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/10')}>
              <div className="flex justify-between"><span className="opacity-60">Customer</span><span className={cn('font-semibold', getTextColor())}>{docTarget.customer_name}</span></div>
              <div className="flex justify-between"><span className="opacity-60">Amount received</span><span className={cn('font-mono font-bold', getTextColor())}>{formatCurrency(docTarget.amount)}</span></div>
              <div className="flex justify-between"><span className="opacity-60">Payment ref</span><span className="font-mono text-xs">{docTarget.reference_id}</span></div>
            </div>
          )}

          {docType === 'invoice' && (
            <>
              <div className="space-y-1.5">
                <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>GST handling</label>
                <div className="grid grid-cols-3 gap-2">
                  {([['none', 'No Tax'], ['cgst_sgst', 'CGST+SGST'], ['igst', 'IGST']] as const).map(([val, label]) => (
                    <button key={val} onClick={() => setDocTaxType(val)}
                      className={cn('py-2 rounded-lg text-xs font-bold border transition',
                        docTaxType === val ? 'bg-slate-900 border-slate-900 text-white' : cn(theme === 'light' ? 'bg-white border-slate-200 text-slate-500' : 'bg-white/5 border-white/10 text-white/50'))}>
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] opacity-50">CGST+SGST for Gujarat customers, IGST for anywhere else.</p>
              </div>

              {docTaxType !== 'none' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>GST rate (%)</label>
                    <input type="number" value={docTaxRate} onChange={(e) => setDocTaxRate(e.target.value)}
                      className={cn('w-full px-3 py-2.5 rounded-lg border outline-none text-sm font-mono', getInputClass())} />
                  </div>
                  <div className="space-y-1.5">
                    <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Place of supply</label>
                    <input value={docPlaceOfSupply} onChange={(e) => setDocPlaceOfSupply(e.target.value)} placeholder="e.g. Gujarat"
                      className={cn('w-full px-3 py-2.5 rounded-lg border outline-none text-sm', getInputClass())} />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Customer GSTIN (optional, B2B only)</label>
                <input value={docGstin} onChange={(e) => setDocGstin(e.target.value)} placeholder="Leave blank for B2C"
                  className={cn('w-full px-3 py-2.5 rounded-lg border outline-none text-sm font-mono', getInputClass())} />
              </div>

              {docTaxType !== 'none' && (
                <div className={cn('rounded-xl border p-3.5 space-y-1.5 text-xs font-mono', theme === 'light' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-emerald-500/10 border-emerald-500/20')}>
                  <div className="flex justify-between"><span className="opacity-60">Taxable value</span><span className={getTextColor()}>{formatCurrency(taxPreview.taxable)}</span></div>
                  {docTaxType === 'cgst_sgst' ? (
                    <>
                      <div className="flex justify-between"><span className="opacity-60">CGST ({(Number(docTaxRate) / 2).toFixed(1)}%)</span><span className={getTextColor()}>{formatCurrency(taxPreview.cgst)}</span></div>
                      <div className="flex justify-between"><span className="opacity-60">SGST ({(Number(docTaxRate) / 2).toFixed(1)}%)</span><span className={getTextColor()}>{formatCurrency(taxPreview.sgst)}</span></div>
                    </>
                  ) : (
                    <div className="flex justify-between"><span className="opacity-60">IGST ({docTaxRate}%)</span><span className={getTextColor()}>{formatCurrency(taxPreview.igst)}</span></div>
                  )}
                  <div className="flex justify-between font-bold border-t border-emerald-500/20 pt-1.5"><span>Total</span><span>{formatCurrency(docTarget?.amount || 0)}</span></div>
                </div>
              )}
            </>
          )}

          <div className="space-y-1.5">
            <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Notes (optional)</label>
            <textarea value={docNotes} onChange={(e) => setDocNotes(e.target.value)} rows={2}
              className={cn('w-full px-3 py-2.5 rounded-lg border outline-none text-sm resize-none', getInputClass())} />
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">
              This sends a <b>request</b> — Admin must approve it before an official sequential number is issued. Nothing is finalized yet.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={() => setDocModalOpen(false)} disabled={requestingDoc}>Cancel</Button>
            <Button onClick={handleRequestDoc} disabled={requestingDoc} className="min-w-[160px]">
              {requestingDoc ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : <><Send size={16} /> Send Request</>}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Register External Document Modal ─── */}
      <Modal isOpen={externalOpen} onClose={() => !savingExternal && setExternalOpen(false)} title="Register External Document">
        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Document type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['receipt', 'invoice'] as const).map((t) => (
                <button key={t} onClick={() => setExternalDocType(t)}
                  className={cn('py-2 rounded-lg text-xs font-bold border transition capitalize',
                    externalDocType === t ? 'bg-slate-900 border-slate-900 text-white' : cn(theme === 'light' ? 'bg-white border-slate-200 text-slate-500' : 'bg-white/5 border-white/10 text-white/50'))}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Number you already used</label>
            <input value={externalNumber} onChange={(e) => setExternalNumber(e.target.value)} placeholder="e.g. hand-written receipt no."
              className={cn('w-full px-3 py-2.5 rounded-lg border outline-none text-sm font-mono', getInputClass())} autoFocus />
          </div>

          <div className="space-y-1.5">
            <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Notes (optional)</label>
            <textarea value={externalNotes} onChange={(e) => setExternalNotes(e.target.value)} rows={2}
              className={cn('w-full px-3 py-2.5 rounded-lg border outline-none text-sm resize-none', getInputClass())} />
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">
              For a document already created <b>by hand outside the CRM</b>. This just logs it for traceability — it does <b>not</b> consume a number from the CRM's own sequence, so there's no collision risk.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={() => setExternalOpen(false)} disabled={savingExternal}>Cancel</Button>
            <Button onClick={handleSaveExternal} disabled={savingExternal} className="min-w-[140px] bg-slate-900 hover:bg-slate-800 border-none text-white">
              {savingExternal ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><ClipboardEdit size={16} /> Register</>}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Approve / Reject / Cancel Confirm Modal ─── */}
      <Modal isOpen={!!reviewDoc} onClose={() => !reviewing && setReviewDoc(null)}
        title={reviewAction === 'approve' ? 'Approve & Issue Number' : reviewAction === 'reject' ? 'Reject Request' : 'Cancel Document'}>
        <div className="space-y-5">
          {reviewDoc && (
            <div className={cn('rounded-xl border p-3.5 space-y-1.5 text-sm', theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/10')}>
              <div className="flex justify-between"><span className="opacity-60">Type</span><span className={cn('font-semibold capitalize', getTextColor())}>{reviewDoc.doc_type}</span></div>
              <div className="flex justify-between"><span className="opacity-60">Customer</span><span className={cn('font-semibold', getTextColor())}>{reviewDoc.customer_name}</span></div>
              <div className="flex justify-between"><span className="opacity-60">Amount</span><span className={cn('font-mono font-bold', getTextColor())}>{formatCurrency(reviewDoc.amount)}</span></div>
              <div className="flex justify-between"><span className="opacity-60">Requested by</span><span className={getTextColor()}>{reviewDoc.requested_by}</span></div>
              {reviewDoc.number && <div className="flex justify-between"><span className="opacity-60">Number</span><span className="font-mono">{reviewDoc.number}</span></div>}
            </div>
          )}

          {reviewAction === 'cancel' && (
            <div className="space-y-1.5">
              <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Cancellation reason (required)</label>
              <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={2} autoFocus
                placeholder="e.g. wrong amount entered"
                className={cn('w-full px-3 py-2.5 rounded-lg border outline-none text-sm resize-none', getInputClass())} />
            </div>
          )}

          <div className={cn('flex items-start gap-2.5 p-3 rounded-lg border',
            reviewAction === 'approve' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800')}>
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">
              {reviewAction === 'approve'
                ? <>This will mint the next sequential {reviewDoc?.doc_type} number and mark it issued. <b>It cannot be undone or renumbered</b> — you'd need to cancel it afterward instead.</>
                : reviewAction === 'reject'
                  ? <>This discards the request — no number is consumed, nothing is sent to your CA.</>
                  : <>The number stays visible in your records as cancelled — it is never deleted or reused, so your sequence stays gap-free.</>}
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={() => setReviewDoc(null)} disabled={reviewing}>Back</Button>
            <Button onClick={handleReview} disabled={reviewing}
              className={cn('min-w-[140px]', reviewAction !== 'approve' && 'bg-rose-600 hover:bg-rose-700 border-none text-white')}>
              {reviewing ? <><Loader2 size={16} className="animate-spin" /> Working…</> : reviewAction === 'approve' ? <><Check size={16} /> Confirm & Issue</> : reviewAction === 'reject' ? <><X size={16} /> Confirm Reject</> : <><Ban size={16} /> Confirm Cancel</>}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

const Row: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => {
  const { getTextColor } = useTheme();
  return (
    <div className="flex items-start gap-2">
      <span className="opacity-40 mt-0.5 shrink-0">{icon}</span>
      <span className="opacity-50 shrink-0 w-24">{label}</span>
      <span className={cn('font-mono font-medium break-all', getTextColor())}>{value}</span>
    </div>
  );
};
