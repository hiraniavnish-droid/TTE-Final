import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useLeads } from '../contexts/LeadContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { formatCurrency, formatDate, cn } from '../utils/helpers';
import toast from 'react-hot-toast';
import {
  CreditCard, IndianRupee, CheckCircle2, Clock, ExternalLink, RefreshCw, Copy,
  AlertTriangle, Send, User, Phone, Loader2, MessageCircle, Link2, Link2Off, Search, Plus, X, Pencil, Check,
  MapPin, Calendar, Users,
} from 'lucide-react';

const API_BASE = (import.meta as any).env?.DEV ? 'https://ttecrm.vercel.app' : '';

interface PaymentRecord {
  id: string; reference_id: string; short_url: string; amount: number; currency: string;
  customer_name: string; customer_phone: string; customer_email: string; status: string;
  description: string; created_at: string; created_by: string; paid_at: string | null;
  razorpay_payment_id: string | null; leadId: string | null; leadName: string | null;
}

const STATUS_META: Record<string, { label: string; dot: string; chip: string; icon: React.ReactNode }> = {
  paid:           { label: 'Paid',      dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 size={13} /> },
  partially_paid: { label: 'Partial',   dot: 'bg-blue-500',    chip: 'bg-blue-50 text-blue-700 border-blue-200',           icon: <IndianRupee size={13} /> },
  created:        { label: 'Pending',   dot: 'bg-amber-500',   chip: 'bg-amber-50 text-amber-700 border-amber-200',        icon: <Clock size={13} /> },
  expired:        { label: 'Expired',   dot: 'bg-slate-400',   chip: 'bg-slate-100 text-slate-600 border-slate-200',       icon: <AlertTriangle size={13} /> },
  cancelled:      { label: 'Cancelled', dot: 'bg-rose-500',    chip: 'bg-rose-50 text-rose-700 border-rose-200',           icon: <AlertTriangle size={13} /> },
};
const metaFor = (s: string) => STATUS_META[s] || STATUS_META.created;

const fmtDate = (iso: string) => {
  try { return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
};

const waMessage = (r: PaymentRecord) =>
  `Hi ${r.customer_name || 'there'}, here is your secure payment link for ${formatCurrency(r.amount)}:\n${r.short_url}\n\nPlease complete the payment at your convenience.\nThank you!\n— The Tourism Experts`;
const waHref = (r: PaymentRecord) => {
  const d = (r.customer_phone || '').replace(/[^0-9]/g, '');
  const to = d.length === 10 ? '91' + d : d.length >= 11 ? d : '';
  return `https://wa.me/${to}?text=${encodeURIComponent(waMessage(r))}`;
};

type FilterKey = 'all' | 'created' | 'paid' | 'unassigned';

export const Payments = () => {
  const { theme, getTextColor, getSecondaryTextColor, getInputClass } = useTheme();
  const { user } = useAuth();
  const { leads } = useLeads();

  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [amount, setAmount] = useState('');
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [sendSms, setSendSms] = useState(false);
  const [linkLeadId, setLinkLeadId] = useState('');   // in the create modal
  const [assigning, setAssigning] = useState<string | null>(null); // record id being reassigned

  // Confirmation-gated link picker (prevents accidental re-linking)
  const [linkRec, setLinkRec] = useState<PaymentRecord | null>(null);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkChoice, setLinkChoice] = useState<{ id: string; name: string } | null>(null);

  const sortedLeads = useMemo(
    () => [...leads].sort((a, b) => a.name.localeCompare(b.name)),
    [leads]
  );
  const leadName = useCallback((id: string | null) => {
    if (!id) return null;
    return leads.find(l => l.id === id)?.name || null;
  }, [leads]);

  const isAdmin = user?.role === 'admin';

  const fetchRecords = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      // Agents see only their own payments; admin sees all.
      const q = !isAdmin && user?.name ? `?createdBy=${encodeURIComponent(user.name)}` : '';
      const res = await fetch(`${API_BASE}/api/razorpay-link${q}`);
      const data = await res.json();
      if (res.ok) setRecords(data.records || []);
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [isAdmin, user?.name]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // ─── Derived summary ───
  const collected = records.filter(r => r.status === 'paid').reduce((s, r) => s + r.amount, 0);
  const total = records.reduce((s, r) => s + r.amount, 0);
  const paidCount = records.filter(r => r.status === 'paid').length;
  const counts = {
    all: records.length,
    created: records.filter(r => r.status === 'created' || r.status === 'partially_paid').length,
    paid: paidCount,
    unassigned: records.filter(r => !r.leadId).length,
  };
  const visible = records
    .filter(r => {
      if (filter === 'all') return true;
      if (filter === 'paid') return r.status === 'paid';
      if (filter === 'created') return r.status === 'created' || r.status === 'partially_paid';
      if (filter === 'unassigned') return !r.leadId;
      return true;
    })
    // Realized (actually collected — Razorpay or manual) first; unrealized (still pending) after.
    .sort((a, b) => (a.status === 'paid' ? 0 : 1) - (b.status === 'paid' ? 0 : 1));

  // ─── Create ───
  const openCreate = () => {
    setAmount(''); setCustName(''); setCustPhone(''); setSendSms(false); setLinkLeadId('');
    setCreateOpen(true);
  };
  const onPickLeadInModal = (id: string) => {
    setLinkLeadId(id);
    const l = leads.find(x => x.id === id);
    if (l) {
      if (!custName.trim()) setCustName(l.name);
      if (!custPhone.trim() && l.contact?.phone) setCustPhone(l.contact.phone);
    }
  };
  const handleCreate = async () => {
    const amt = Number(amount);
    if (!(amt >= 1)) { toast.error('Enter a valid amount (min ₹1).'); return; }
    if (!custName.trim()) { toast.error('Enter a customer name.'); return; }
    if (sendSms && custPhone.replace(/[^0-9]/g, '').length < 10) { toast.error('Enter a valid phone to send an SMS.'); return; }
    setCreating(true);
    try {
      const linked = leads.find(l => l.id === linkLeadId);
      const res = await fetch(`${API_BASE}/api/razorpay-link`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: linkLeadId || undefined,
          leadName: linked?.name || undefined,
          amount: amt, name: custName.trim(), phone: custPhone.trim(),
          description: `Payment — ${custName.trim()}`,
          createdBy: user?.name || 'Agent', sendSms,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create link');
      setRecords(prev => [data.record, ...prev]);
      setCreateOpen(false);
      try { await navigator.clipboard.writeText(data.record.short_url); toast.success('Link created & copied!'); }
      catch { toast.success('Payment link created!'); }
    } catch (e: any) { toast.error(e?.message || 'Could not create link.'); }
    finally { setCreating(false); }
  };

  // ─── Assign / reassign (only ever called after explicit confirmation) ───
  const openLinkModal = (rec: PaymentRecord) => { setLinkRec(rec); setLinkSearch(''); setLinkChoice(null); };

  const confirmLink = async () => {
    if (!linkRec || !linkChoice) return;
    const rec = linkRec, newLeadId = linkChoice.id;
    setAssigning(rec.id);
    setLinkRec(null);
    const linked = leads.find(l => l.id === newLeadId);
    try {
      const res = await fetch(`${API_BASE}/api/razorpay-link`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rec.id, leadId: newLeadId || undefined, leadName: linked?.name || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to link');
      setRecords(prev => prev.map(r => r.id === rec.id ? { ...r, leadId: newLeadId || null, leadName: linked?.name || null } : r));
      toast.success(newLeadId ? `Linked to ${linked?.name}` : 'Unlinked');
    } catch (e: any) { toast.error(e?.message || 'Could not link payment.'); }
    finally { setAssigning(null); }
  };

  const linkFiltered = useMemo(() => {
    const q = linkSearch.trim().toLowerCase();
    const qDigits = q.replace(/[^0-9]/g, '');
    const list = q ? sortedLeads.filter(l =>
      l.name.toLowerCase().includes(q) ||
      (l.tripDetails?.destination || '').toLowerCase().includes(q) ||
      (qDigits.length >= 3 && (l.contact?.phone || '').replace(/[^0-9]/g, '').includes(qDigits))
    ) : sortedLeads;
    return list.slice(0, 60);
  }, [linkSearch, sortedLeads]);

  const copyLink = (url: string) => navigator.clipboard.writeText(url).then(
    () => toast.success('Link copied!'), () => toast.error('Copy failed'));

  const inputBase = cn('w-full px-3 py-2.5 rounded-lg border outline-none text-sm', getInputClass());

  return (
    <div className="animate-in fade-in duration-500 max-w-6xl mx-auto pb-20">
      {/* Header toolbar */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
        <div className="shrink-0 flex items-center gap-2.5">
          <div className={cn('p-2 rounded-xl', theme === 'light' ? 'bg-slate-900 text-white' : 'bg-white/10 text-white')}>
            <CreditCard size={18} strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className={cn('text-2xl font-bold tracking-tight leading-none', getTextColor())}>Payments</h1>
              <span className={cn('text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border',
                isAdmin ? 'bg-slate-900 text-white border-slate-900' : (theme === 'light' ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-white/10 text-white/60 border-white/10'))}>
                {isAdmin ? 'All agents' : 'Your links'}
              </span>
            </div>
            <p className={cn('text-[11px] mt-1 font-semibold', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>
              <span className="text-emerald-600 font-bold">{formatCurrency(collected)} realized</span>
              {total - collected > 0 && <span className="opacity-70"> · {formatCurrency(total - collected)} unrealized</span>}
              {' '}· {paidCount}/{records.length} paid
            </p>
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => fetchRecords(true)}
            className={cn('flex items-center gap-1.5 text-xs font-bold px-3 h-10 rounded-lg border transition-all active:scale-[0.97]',
              theme === 'light' ? 'bg-white border-slate-200 text-slate-600 hover:border-slate-400' : 'bg-white/5 border-white/10 text-white/70')}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 h-10 pl-4 pr-4 rounded-lg text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 transition-all active:scale-[0.97] shadow-[0_4px_16px_-4px_rgba(15,23,42,0.4)]"
          >
            <Plus size={16} strokeWidth={2.5} /> New Payment
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto no-scrollbar">
        {([['all', 'All'], ['created', 'Pending'], ['paid', 'Paid'], ['unassigned', 'Unassigned']] as [FilterKey, string][]).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all shrink-0 active:scale-[0.97]',
              filter === k
                ? 'bg-slate-900 border-slate-900 text-white'
                : (theme === 'light' ? 'bg-white border-slate-200 text-slate-500 hover:border-slate-400' : 'bg-white/5 border-white/10 text-white/50'))}
          >
            {label}
            <span className={cn('tabular-nums', filter === k ? 'text-white/70' : 'opacity-50')}>{counts[k]}</span>
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={cn('h-20 rounded-2xl animate-pulse', theme === 'light' ? 'bg-slate-100' : 'bg-white/5')} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center mb-4', theme === 'light' ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-white/30')}>
            <CreditCard size={28} strokeWidth={2} />
          </div>
          <h3 className={cn('text-base font-bold mb-1', getTextColor())}>{filter === 'all' ? 'No payments yet' : 'Nothing here'}</h3>
          <p className={cn('text-sm mb-5', getSecondaryTextColor())}>
            {filter === 'all' ? 'Create a payment link and share it with any customer.' : 'Try a different filter.'}
          </p>
          {filter === 'all' && <Button onClick={openCreate}><Plus size={16} /> New Payment</Button>}
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map(rec => {
            const m = metaFor(rec.status);
            const displayLeadName = leadName(rec.leadId) || rec.leadName;
            return (
              <Card key={rec.id} noPadding className="p-3.5 md:p-4">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  {/* Left: status + customer + amount */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', m.dot)} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('font-bold text-sm truncate', getTextColor())}>{rec.customer_name}</span>
                        <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border', m.chip)}>
                          {m.icon} {m.label}
                        </span>
                      </div>
                      <div className={cn('text-[11px] font-mono mt-0.5 truncate', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>
                        {rec.reference_id} · {fmtDate(rec.created_at)}{rec.created_by ? ' · ' + rec.created_by : ''}
                      </div>
                    </div>
                  </div>

                  {/* Amount — realized (paid) shown bold & full-size, unrealized smaller & faded */}
                  <div className={cn(
                    'font-mono shrink-0 md:text-right md:w-28',
                    rec.status === 'paid' ? cn('font-bold text-lg', getTextColor()) : 'font-semibold text-sm opacity-45'
                  )}>
                    {formatCurrency(rec.amount)}
                  </div>

                  {/* Link-to-customer — read-only chip, click to open confirm picker */}
                  <div className="shrink-0 md:w-56">
                    <button
                      onClick={() => openLinkModal(rec)}
                      disabled={assigning === rec.id}
                      title={displayLeadName ? `Linked to ${displayLeadName} — click to change` : 'Click to link a customer'}
                      className={cn('w-full flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition-all active:scale-[0.98] group',
                        displayLeadName
                          ? (theme === 'light' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:border-emerald-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300 hover:border-emerald-500/40')
                          : (theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-400' : 'bg-white/5 border-white/10 text-white/50'))}
                    >
                      <Link2 size={13} className="shrink-0" />
                      <span className="truncate flex-1 text-left">{displayLeadName || 'Link customer'}</span>
                      {assigning === rec.id
                        ? <Loader2 size={12} className="animate-spin shrink-0" />
                        : <Pencil size={11} className="opacity-40 group-hover:opacity-90 shrink-0" />}
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a href={waHref(rec)} target="_blank" rel="noreferrer" title="WhatsApp"
                      className="w-9 h-9 flex items-center justify-center rounded-lg border bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100 transition-colors active:scale-[0.95]">
                      <MessageCircle size={15} />
                    </a>
                    <button onClick={() => copyLink(rec.short_url)} title="Copy link"
                      className={cn('w-9 h-9 flex items-center justify-center rounded-lg border transition-colors active:scale-[0.95]',
                        theme === 'light' ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50' : 'bg-white/5 border-white/10 text-white/70')}>
                      <Copy size={15} />
                    </button>
                    <a href={rec.short_url} target="_blank" rel="noreferrer" title="Open link"
                      className={cn('w-9 h-9 flex items-center justify-center rounded-lg border transition-colors active:scale-[0.95]',
                        theme === 'light' ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50' : 'bg-white/5 border-white/10 text-white/70')}>
                      <ExternalLink size={15} />
                    </a>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={createOpen} onClose={() => !creating && setCreateOpen(false)} title="New Payment Link">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Amount to collect</label>
            <div className="relative">
              <IndianRupee size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
              <input type="number" min={1} value={amount} onChange={e => setAmount(e.target.value)} autoFocus
                className={cn('w-full pl-9 pr-3 py-3 rounded-lg border outline-none font-mono text-lg font-bold', getInputClass())} placeholder="0" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Customer name</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                <input value={custName} onChange={e => setCustName(e.target.value)} className={cn(inputBase, 'pl-9')} placeholder="Full name" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Phone <span className="opacity-50 font-normal normal-case">(optional)</span></label>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                <input value={custPhone} onChange={e => setCustPhone(e.target.value)} className={cn(inputBase, 'pl-9')} placeholder="10-digit number" />
              </div>
            </div>
          </div>

          {/* Link to customer/lead */}
          <div className="space-y-1.5">
            <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60 flex items-center gap-1.5', getTextColor())}>
              <Link2 size={12} /> Link to customer <span className="opacity-50 font-normal normal-case">(optional — assign now or later)</span>
            </label>
            <select value={linkLeadId} onChange={e => onPickLeadInModal(e.target.value)}
              className={cn(inputBase, 'cursor-pointer [&>option]:text-black')}>
              <option value="">Don't link — assign later</option>
              {sortedLeads.map(l => <option key={l.id} value={l.id}>{l.name}{l.tripDetails?.destination ? ` · ${l.tripDetails.destination}` : ''}</option>)}
            </select>
          </div>

          {/* SMS toggle */}
          <label className={cn('flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer select-none', theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/10')}>
            <input type="checkbox" checked={sendSms} onChange={e => setSendSms(e.target.checked)} className="mt-0.5 w-4 h-4 accent-slate-900 cursor-pointer" />
            <div>
              <div className={cn('font-semibold text-sm flex items-center gap-1.5', getTextColor())}><Phone size={13} /> Send link via SMS</div>
              <div className="text-[11px] opacity-55">Off — you'll get a copyable link to share on WhatsApp or anywhere.</div>
            </div>
          </label>

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating} className="min-w-[170px] bg-slate-900 hover:bg-slate-800 border-none text-white">
              {creating ? <><Loader2 size={16} className="animate-spin" /> Creating…</> : sendSms ? <><Send size={16} /> Create &amp; Send</> : <><Copy size={16} /> Create &amp; Copy</>}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Link picker (search + explicit confirm — prevents accidental re-linking) ─── */}
      <Modal isOpen={!!linkRec} onClose={() => setLinkRec(null)} title="Link payment to customer">
        {linkRec && (
          <div className="space-y-4">
            {/* Which payment */}
            <div className={cn('rounded-xl border p-3 flex items-center justify-between gap-3', theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/10')}>
              <div className="min-w-0">
                <div className={cn('font-bold text-sm truncate', getTextColor())}>{linkRec.customer_name}</div>
                <div className={cn('text-[11px] font-mono truncate flex items-center gap-1.5', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>
                  {linkRec.reference_id}
                  {linkRec.customer_phone && <><span className="opacity-40">·</span><Phone size={10} /> {linkRec.customer_phone}</>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={cn('font-mono font-bold', getTextColor())}>{formatCurrency(linkRec.amount)}</div>
                <div className={cn('text-[10px] font-semibold', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>
                  {leadName(linkRec.leadId) || linkRec.leadName ? `Now: ${leadName(linkRec.leadId) || linkRec.leadName}` : 'Unassigned'}
                </div>
              </div>
            </div>

            {/* Paid warning */}
            {linkRec.status === 'paid' && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed">This payment is <b>already paid</b>. Re-linking only changes which customer it's reported against — double-check before confirming.</p>
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
              <input autoFocus value={linkSearch} onChange={e => setLinkSearch(e.target.value)}
                placeholder="Search customers…"
                className={cn('w-full pl-9 pr-3 py-2.5 rounded-lg border outline-none text-sm', getInputClass())} />
            </div>

            {/* List */}
            <div className="max-h-64 overflow-y-auto custom-scrollbar -mx-1 px-1 space-y-1">
              {linkRec.leadId && (
                <button
                  onClick={() => setLinkChoice({ id: '', name: 'Unassign (remove link)' })}
                  className={cn('w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-colors',
                    linkChoice?.id === '' ? 'bg-rose-50 border-rose-300 text-rose-700' : (theme === 'light' ? 'bg-white border-slate-200 hover:border-rose-300 text-slate-600' : 'bg-white/5 border-white/10 text-white/70'))}
                >
                  <Link2Off size={15} className="shrink-0" />
                  <span className="text-sm font-semibold">Unassign — remove link</span>
                </button>
              )}
              {linkFiltered.map(l => {
                const isCurrent = l.id === linkRec.leadId;
                const isChosen = linkChoice?.id === l.id;
                const pax = l.tripDetails?.paxConfig;
                const paxStr = pax ? `${pax.adults || 0}A${pax.children ? ' ' + pax.children + 'C' : ''}` : '';
                const metaColor = isChosen ? 'text-white/55' : theme === 'light' ? 'text-slate-400' : 'text-white/40';
                const meta = [
                  l.tripDetails?.destination && { Icon: MapPin, text: l.tripDetails.destination },
                  l.contact?.phone && { Icon: Phone, text: l.contact.phone },
                  l.tripDetails?.startDate && { Icon: Calendar, text: formatDate(l.tripDetails.startDate) },
                  paxStr && { Icon: Users, text: paxStr },
                ].filter(Boolean) as { Icon: any; text: string }[];
                return (
                  <button
                    key={l.id}
                    onClick={() => setLinkChoice({ id: l.id, name: l.name })}
                    className={cn('w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors',
                      isChosen ? 'bg-slate-900 border-slate-900 text-white'
                      : (theme === 'light' ? 'bg-white border-slate-200 hover:border-slate-400' : 'bg-white/5 border-white/10 hover:border-white/25'))}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-sm font-semibold truncate', isChosen ? 'text-white' : getTextColor())}>{l.name}</span>
                        {l.status && (
                          <span className={cn('text-[8.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0',
                            isChosen ? 'bg-white/15 text-white/80' : theme === 'light' ? 'bg-slate-100 text-slate-500' : 'bg-white/10 text-white/50')}>
                            {l.status}
                          </span>
                        )}
                      </div>
                      <div className={cn('flex items-center gap-2 mt-0.5 flex-wrap', metaColor)}>
                        {meta.length === 0
                          ? <span className="text-[11px] italic">No trip details</span>
                          : meta.map((m, i) => (
                            <span key={i} className="inline-flex items-center gap-1 text-[11px] whitespace-nowrap">
                              <m.Icon size={10} className="shrink-0 opacity-70" /> {m.text}
                            </span>
                          ))}
                      </div>
                    </div>
                    {l.assignedTo && !isChosen && (
                      <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 hidden sm:inline', theme === 'light' ? 'bg-violet-50 text-violet-600' : 'bg-violet-500/20 text-violet-300')}>
                        {l.assignedTo}
                      </span>
                    )}
                    {isCurrent && !isChosen && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-600 shrink-0">Current</span>}
                    {isChosen && <Check size={16} className="shrink-0" />}
                  </button>
                );
              })}
              {linkFiltered.length === 0 && (
                <div className="text-center py-6 text-sm opacity-50">No customers match “{linkSearch}”.</div>
              )}
            </div>

            {/* Confirm footer — the safety gate */}
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-gray-500/10">
              <div className={cn('text-xs min-w-0 truncate', theme === 'light' ? 'text-slate-500' : 'text-white/50')}>
                {linkChoice
                  ? <>Link <b className={getTextColor()}>{formatCurrency(linkRec.amount)}</b> → <b className={getTextColor()}>{linkChoice.name}</b></>
                  : 'Pick a customer to continue'}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="secondary" onClick={() => setLinkRec(null)}>Cancel</Button>
                <Button onClick={confirmLink} disabled={!linkChoice} className={cn('border-none text-white', linkChoice?.id === '' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-slate-900 hover:bg-slate-800')}>
                  <Check size={16} /> Confirm
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
