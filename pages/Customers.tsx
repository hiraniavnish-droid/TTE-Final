
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Papa from 'papaparse';
import { useLeads } from '../contexts/LeadContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { usePaymentSummary } from '../hooks/usePaymentSummary';
import { LeadCodeChip } from '../components/ui/LeadCodeChip';
import { BookingDetailsDialog } from '../components/BookingDetailsDialog';
import { bookingVendors, totalVendors, matchesPayment, groupVendorBalances, PaymentState, VendorBalance } from '../lib/customerAccounts';
import { Card } from '../components/ui/Card';
import { Lead } from '../types';
import { STATUS_COLUMNS } from '../constants';
import { cn, formatDate } from '../utils/helpers';
import { getAgentColor } from './Leads'; // Import helper
import {
  Search,
  User,
  Phone,
  X,
  UserCheck,
  Download,
  Copy,
  Check,
} from 'lucide-react';

// Deliberately NOT the shared formatCurrency() — that returns "TBD" for 0,
// which is right for an undecided budget but wrong here: ₹0 collected/paid
// is real, known data on an accounts ledger, not something still pending.
const fmtAmt = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

interface AccountRow {
  lead: Lead;
  collected: number;
  vendor: { cost: number; paid: number; owed: number };
  vendorNames: string;
  vendorEntries: VendorBalance[];
}

// Same shape as pages/Leads.tsx's export (ExportColumn/ExportPanel) — kept as
// its own copy here rather than shared, since the two pages export different
// row shapes (a Lead vs this page's merged AccountRow) and the UI is small
// enough that forcing a shared generic wasn't worth it.
type ExportRow = Record<string, string | number>;
interface ExportColumn { key: string; label: string; get: (r: AccountRow) => string | number; }

const EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'leadCode', label: 'TTE ID', get: r => r.lead.leadCode || '' },
  { key: 'name', label: 'Customer', get: r => r.lead.name },
  { key: 'phone', label: 'Phone', get: r => r.lead.contact?.phone || '' },
  { key: 'email', label: 'Email', get: r => r.lead.contact?.email || '' },
  { key: 'destination', label: 'Destination', get: r => r.lead.tripDetails?.destination || '' },
  { key: 'status', label: 'Stage', get: r => r.lead.status },
  { key: 'wonAt', label: 'Booking Done Date', get: r => r.lead.wonAt ? formatDate(r.lead.wonAt) : '' },
  { key: 'sellingPrice', label: 'Selling Price', get: r => r.lead.commercials?.sellingPrice || 0 },
  { key: 'collected', label: 'Amount Collected', get: r => r.collected },
  { key: 'pending', label: 'Pending', get: r => Math.max((r.lead.commercials?.sellingPrice || 0) - r.collected, 0) },
  { key: 'vendorNames', label: 'Vendor(s)', get: r => r.vendorNames },
  { key: 'vendorCost', label: 'Vendor Cost', get: r => r.vendor.cost },
  { key: 'vendorPaid', label: 'Amount Paid to Vendor', get: r => r.vendor.paid },
  { key: 'vendorOwed', label: 'Vendor Owed', get: r => r.vendor.owed },
  { key: 'assignedTo', label: 'Agent', get: r => r.lead.assignedTo || 'Unassigned' },
  { key: 'createdAt', label: 'Created', get: r => r.lead.createdAt ? formatDate(r.lead.createdAt) : '' },
];

const EXPORT_PRESETS: { label: string; keys: string[] }[] = [
  { label: 'Accounts Summary', keys: ['leadCode', 'name', 'phone', 'destination', 'wonAt', 'sellingPrice', 'collected', 'pending', 'status'] },
  { label: 'Vendor Sheet', keys: ['leadCode', 'name', 'destination', 'vendorNames', 'vendorCost', 'vendorPaid', 'vendorOwed'] },
  { label: 'Everything', keys: EXPORT_COLUMNS.map(c => c.key) },
];

const ExportPanel: React.FC<{ rows: AccountRow[]; onClose: () => void }> = ({ rows, onClose }) => {
  const { theme, getTextColor, getBorderClass } = useTheme();
  const [stage, setStage] = useState('');
  const [selected, setSelected] = useState<string[]>(EXPORT_PRESETS[0].keys);
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(() => (stage ? rows.filter(r => r.lead.status === stage) : rows), [rows, stage]);
  const cols = useMemo(() => EXPORT_COLUMNS.filter(c => selected.includes(c.key)), [selected]);

  const toCsvRows = () => filtered.map(r => {
    const row: ExportRow = {};
    for (const c of cols) row[c.label] = c.get(r);
    return row;
  });

  const handleDownload = () => {
    const csv = Papa.unparse(toCsvRows());
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tte-accounts-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    const header = cols.map(c => c.label).join('\t');
    const body = filtered.map(r => cols.map(c => String(c.get(r))).join('\t')).join('\n');
    try {
      await navigator.clipboard.writeText(`${header}\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  const toggleCol = (key: string) => setSelected(p => p.includes(key) ? p.filter(k => k !== key) : [...p, key]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button tabIndex={-1} aria-label="Close export backdrop" className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Export accounts" className={cn('relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden', theme !== 'light' ? 'bg-slate-900 border border-white/10' : 'bg-white')}>
        <div className={cn('flex items-center justify-between px-5 py-4 border-b shrink-0', getBorderClass())}>
          <div>
            <h2 className={cn('text-lg font-bold', getTextColor())}>Export Accounts</h2>
            <p className={cn('text-[12px]', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>{filtered.length} booking{filtered.length === 1 ? '' : 's'} will be exported</p>
          </div>
          <button aria-label="Close export" onClick={onClose} className={cn('p-2 rounded-full', theme === 'light' ? 'hover:bg-slate-100 text-slate-400' : 'hover:bg-white/10 text-white/50')}><X size={18} /></button>
        </div>

        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          {/* Stage filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-[11px] font-bold uppercase tracking-wide', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>Stage</span>
            {['', ...STATUS_COLUMNS].map(s => (
              <button
                key={s || 'all'}
                onClick={() => setStage(s)}
                className={cn('px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors',
                  stage === s ? 'bg-slate-900 border-slate-900 text-white' : (theme === 'light' ? 'bg-white border-slate-200 text-slate-500' : 'bg-white/5 border-white/10 text-white/50'))}
              >
                {s || 'All'}
              </button>
            ))}
          </div>

          {/* Presets */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-[11px] font-bold uppercase tracking-wide', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>Presets</span>
            {EXPORT_PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => setSelected(p.keys)}
                className={cn('px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors',
                  theme === 'light' ? 'bg-white border-slate-200 text-slate-600 hover:border-slate-400' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/30')}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Column picker */}
          <div>
            <span className={cn('text-[11px] font-bold uppercase tracking-wide', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>Columns ({selected.length})</span>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {EXPORT_COLUMNS.map(c => (
                <label key={c.key} className={cn('flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[12px] cursor-pointer select-none', theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-white/5')}>
                  <input type="checkbox" checked={selected.includes(c.key)} onChange={() => toggleCol(c.key)} className="w-3.5 h-3.5 accent-slate-900 cursor-pointer shrink-0" />
                  <span className={getTextColor()}>{c.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div>
            <span className={cn('text-[11px] font-bold uppercase tracking-wide', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>Preview</span>
            <div className={cn('mt-2 overflow-auto rounded-xl border max-h-56', getBorderClass())}>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className={theme === 'light' ? 'bg-slate-50' : 'bg-white/5'}>
                    {cols.map(c => <th key={c.key} className={cn('px-2.5 py-2 text-left font-bold whitespace-nowrap', getTextColor())}>{c.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 25).map(r => (
                    <tr key={r.lead.id} className={cn('border-t', getBorderClass())}>
                      {cols.map(c => <td key={c.key} className={cn('px-2.5 py-1.5 whitespace-nowrap', theme === 'light' ? 'text-slate-600' : 'text-white/70')}>{String(c.get(r))}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 25 && <div className={cn('px-2.5 py-2 text-[11px] text-center', theme === 'light' ? 'text-slate-400 bg-slate-50' : 'text-white/30 bg-white/5')}>…and {filtered.length - 25} more rows in the export</div>}
              {filtered.length === 0 && <div className={cn('px-2.5 py-6 text-[11px] text-center', theme === 'light' ? 'text-slate-400' : 'text-white/30')}>No bookings match this stage.</div>}
            </div>
          </div>
        </div>

        <div className={cn('flex items-center justify-end gap-2 px-5 py-4 border-t shrink-0', getBorderClass())}>
          <button
            onClick={handleCopy}
            disabled={filtered.length === 0 || cols.length === 0}
            className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-40',
              theme === 'light' ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-400' : 'bg-white/5 border-white/10 text-white/80 hover:border-white/30')}
          >
            {copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
          <button
            onClick={handleDownload}
            disabled={filtered.length === 0 || cols.length === 0}
            className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40',
              theme === 'light' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-slate-900 hover:bg-white/90')}
          >
            <Download size={15} /> Download CSV
          </button>
        </div>
      </div>
    </div>, document.body
  );
};

export const Customers = () => {
  const { leads, suppliers, isLoading, loadError, retryLoad } = useLeads();
  const { theme, getTextColor, getSecondaryTextColor, getInputClass } = useTheme();
  const { user, users } = useAuth();
  const { paymentSummary, paymentSummaryLoaded, paymentSummaryError, refreshPaymentSummary } = usePaymentSummary();
  const [searchQuery, setSearchQuery] = useState('');
  const [destinationFilter, setDestinationFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('Won');
  const [paymentFilter, setPaymentFilter] = useState<PaymentState>('');
  const [collectionFilter, setCollectionFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('recent');
  const [view, setView] = useState<'bookings' | 'vendors'>('bookings');
  const [visibleRows, setVisibleRows] = useState(50);
  const [showExport, setShowExport] = useState(false);
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const closeBooking = useCallback(() => { setSelectedLead(null); refreshPaymentSummary(); }, [refreshPaymentSummary]);

  useEffect(() => { setVisibleRows(50); }, [searchQuery, destinationFilter, agentFilter, vendorFilter, statusFilter, paymentFilter, collectionFilter, from, to, sort, view]);

  // Historical sales before the current banking setup are outside this ledger.
  // Exclude them before deriving rows, options, totals, vendor groups or exports.
  const accountLeads = useMemo(() => leads.filter(lead => !lead.legacy), [leads]);
  const rows = useMemo<AccountRow[]>(() => accountLeads.map(lead => {
    const vendorEntries = bookingVendors(lead, suppliers);
    return { lead, collected: paymentSummary[lead.id]?.collected || 0, vendorEntries, vendor: totalVendors(vendorEntries), vendorNames: [...new Set(vendorEntries.map(v => v.name))].join(', ') };
  }), [accountLeads, suppliers, paymentSummary]);
  const destinationOptions = useMemo(() => [...new Set<string>(accountLeads.map(l => l.tripDetails?.destination?.trim()).filter((d): d is string => !!d))].sort((a, b) => a.localeCompare(b)), [accountLeads]);
  const vendorOptions = useMemo(() => groupVendorBalances(rows).sort((a, b) => a.name.localeCompare(b.name)), [rows]);
  const agentOptions = useMemo(() => [...new Set([...users.map(u => u.name), ...accountLeads.map(l => l.assignedTo).filter(Boolean)])].sort(), [users, accountLeads]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return rows.flatMap(row => {
      const l = row.lead;
      if (q && ![l.name, l.leadCode, l.contact?.phone, l.contact?.email, l.tripDetails?.destination, row.vendorNames].some(v => v?.toLowerCase().includes(q))) return [];
      if (destinationFilter && l.tripDetails?.destination?.trim() !== destinationFilter) return [];
      if (agentFilter && (l.assignedTo || '__unassigned') !== agentFilter) return [];
      if (statusFilter && l.status !== statusFilter) return [];
      // Booking date is the recorded Won date; never substitute enquiry creation.
      const date = l.wonAt ? new Date(l.wonAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : '';
      if ((from && (!date || date < from)) || (to && (!date || date > to))) return [];
      const selling = Math.max(0, Number(l.commercials?.sellingPrice) || 0);
      if (collectionFilter === 'uncollected' && row.collected > 0) return [];
      if (collectionFilter === 'pending' && (!selling || row.collected >= selling)) return [];
      if (collectionFilter === 'partial' && !(row.collected > 0 && row.collected < selling)) return [];
      if (collectionFilter === 'collected' && !(selling > 0 && row.collected >= selling)) return [];
      let entries = vendorFilter ? row.vendorEntries.filter(v => v.key === vendorFilter) : row.vendorEntries;
      // Vendor view filters individual booking/vendor balances before grouping.
      // This keeps an unpaid supplier visible even if a different supplier is paid.
      if (view === 'vendors') entries = entries.filter(v => matchesPayment(v, paymentFilter));
      if (!entries.length) return [];
      const vendor = totalVendors(entries);
      if (view === 'bookings' && !matchesPayment(vendor, paymentFilter)) return [];
      return [{ ...row, vendor, vendorEntries: entries, vendorNames: [...new Set(entries.map(v => v.name))].join(', ') }];
    }).sort((a, b) => {
      if (sort === 'owed') return b.vendor.owed - a.vendor.owed;
      if (sort === 'collected') return b.collected - a.collected;
      if (sort === 'name') return a.lead.name.localeCompare(b.lead.name);
      return new Date(b.lead.wonAt || b.lead.lastStatusUpdate || b.lead.createdAt).getTime() - new Date(a.lead.wonAt || a.lead.lastStatusUpdate || a.lead.createdAt).getTime();
    });
  }, [rows, searchQuery, destinationFilter, agentFilter, vendorFilter, statusFilter, paymentFilter, collectionFilter, from, to, sort, view]);
  const vendorGroups = useMemo(() => groupVendorBalances(filteredRows), [filteredRows]);
  const totals = useMemo(() => filteredRows.reduce((s, r) => ({ collected: s.collected + r.collected, paid: s.paid + r.vendor.paid, owed: s.owed + r.vendor.owed }), { collected: 0, paid: 0, owed: 0 }), [filteredRows]);
  const hasActiveFilters = !!(searchQuery || destinationFilter || agentFilter || vendorFilter || statusFilter || paymentFilter || collectionFilter || from || to);
  const clearFilters = () => { setSearchQuery(''); setDestinationFilter(''); setAgentFilter(''); setVendorFilter(''); setStatusFilter(''); setPaymentFilter(''); setCollectionFilter(''); setFrom(''); setTo(''); setSort('recent'); };
  const invalidDates = !!(from && to && from > to);
  const ready = !isLoading && !loadError;
  const muted = getSecondaryTextColor();
  const selectCls = cn('w-full rounded-lg px-3 py-2 text-xs font-medium border', getInputClass());
  const labelCls = cn('text-[10px] font-bold uppercase tracking-wider', muted);
  const thCls = 'px-4 py-3 font-bold text-[10px] uppercase tracking-wider opacity-60 whitespace-nowrap';
  const exportVendors = () => {
    const csv = Papa.unparse(vendorGroups.map(v => ({ Vendor: v.name, Bookings: v.bookings.size, 'Vendor Cost': v.cost, 'Vendor Paid': v.paid, Outstanding: v.owed })));
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `tte-vendor-balances-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const shownCount = view === 'vendors' ? vendorGroups.length : filteredRows.length;

  return <div className={cn('relative min-h-[calc(100vh-100px)] space-y-4', getTextColor())}>
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div><h1 className="text-2xl font-bold tracking-tight">Customers <span className={cn('text-sm font-medium ml-2', muted)}>{filteredRows.length} of {rows.length} bookings</span></h1><p className={cn('text-sm mt-1', muted)}>Booking-wise collections and vendor payments. Legacy sales excluded.</p></div>
      <button disabled={!ready || !paymentSummaryLoaded || invalidDates} onClick={() => view === 'vendors' ? exportVendors() : setShowExport(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold disabled:opacity-40"><Download size={15} />{view === 'vendors' ? 'Export vendor balances' : 'Export CSV'}</button>
    </div>

    <Card className="space-y-3">
      <label className="flex items-center gap-3"><Search size={18} className="opacity-40 shrink-0" /><input aria-label="Search bookings" placeholder="Search name, phone, TTE ID, destination or vendor…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className={cn('w-full px-3 py-2 text-sm', getInputClass())} /></label>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="space-y-1"><span className={labelCls}>Destination</span><select aria-label="Destination" value={destinationFilter} onChange={e => setDestinationFilter(e.target.value)} className={selectCls}><option value="">All destinations</option>{destinationOptions.map(d => <option key={d}>{d}</option>)}</select></label>
        <label className="space-y-1"><span className={labelCls}>Vendor</span><select aria-label="Vendor" value={vendorFilter} onChange={e => setVendorFilter(e.target.value)} className={selectCls}><option value="">All vendors</option>{vendorOptions.map(v => <option key={v.key} value={v.key}>{v.name}</option>)}</select></label>
        <label className="space-y-1"><span className={labelCls}>Vendor payment</span><select aria-label="Vendor payment" value={paymentFilter} onChange={e => setPaymentFilter(e.target.value as PaymentState)} className={selectCls}><option value="">All payment states</option><option value="outstanding">Outstanding (unpaid + partial)</option><option value="unpaid">Not paid</option><option value="partial">Partially paid</option><option value="paid">Fully paid</option><option value="no-cost">No vendor cost entered</option></select></label>
        <label className="space-y-1"><span className={labelCls}>Customer collection</span><select aria-label="Customer collection" disabled={!paymentSummaryLoaded} value={collectionFilter} onChange={e => setCollectionFilter(e.target.value)} className={selectCls}><option value="">All collections</option><option value="pending">Collection pending</option><option value="uncollected">Nothing collected</option><option value="partial">Partially collected</option><option value="collected">Fully collected</option></select></label>
        <label className="space-y-1"><span className={labelCls}>Booking done from</span><input aria-label="Booking done from" type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} className={selectCls} /></label>
        <label className="space-y-1"><span className={labelCls}>Booking done to</span><input aria-label="Booking done to" type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} className={selectCls} /></label>
        {user?.role === 'admin' && <label className="space-y-1"><span className={labelCls}>Agent</span><select aria-label="Agent" value={agentFilter} onChange={e => setAgentFilter(e.target.value)} className={selectCls}><option value="">All agents</option><option value="__unassigned">Unassigned</option>{agentOptions.map(a => <option key={a}>{a}</option>)}</select></label>}
        <label className="space-y-1"><span className={labelCls}>Stage</span><select aria-label="Stage" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectCls}><option value="">All stages</option>{STATUS_COLUMNS.map(s => <option key={s}>{s}</option>)}</select></label>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-3 border-t border-slate-500/10 pt-3">
        <div className="flex rounded-lg border border-slate-500/20 p-1 gap-1" aria-label="Accounts view">{(['bookings', 'vendors'] as const).map(v => <button key={v} aria-pressed={view === v} onClick={() => setView(v)} className={cn('px-3 py-1.5 rounded-md text-xs font-semibold', view === v ? 'bg-indigo-600 text-white' : 'hover:bg-slate-500/10')}>{v === 'bookings' ? 'Bookings' : 'By vendor'}</button>)}</div>
        <div className="flex items-center gap-3"><label className="flex items-center gap-2 text-xs">Sort<select aria-label="Sort bookings" value={sort} onChange={e => setSort(e.target.value)} className={selectCls}><option value="recent">Newest booking</option><option value="owed">Highest outstanding</option><option value="collected">Highest collected</option><option value="name">Customer name</option></select></label>{hasActiveFilters && <button onClick={clearFilters} className="text-xs font-semibold underline whitespace-nowrap">Clear filters</button>}</div>
      </div>
      {vendorFilter && <p className={cn('text-xs', muted)}>Vendor paid, outstanding and exports show only {vendorOptions.find(v => v.key === vendorFilter)?.name}. Collections remain the full booking amount.</p>}
      {view === 'vendors' && <p className={cn('text-xs', muted)}>Vendor balances across the matching bookings, highest outstanding first. Select “View bookings” to review and record payments.</p>}
      {invalidDates && <p role="alert" className="text-xs text-rose-600">The end date must be on or after the start date.</p>}
    </Card>

    {(!ready || !paymentSummaryLoaded) && <div role={loadError || paymentSummaryError ? 'alert' : 'status'} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
      {loadError ? <>{loadError} <button className="underline" onClick={retryLoad}>Retry bookings</button></> : isLoading ? 'Loading all bookings. Totals and exports will be available when loading completes.' : paymentSummaryError ? <>Customer collections could not load. <button className="underline" onClick={refreshPaymentSummary}>Retry collections</button></> : 'Loading customer collections…'}
    </div>}

    <div className="grid grid-cols-2 md:grid-cols-4 gap-3" aria-label="Filtered account totals">
      {[['Matching bookings', ready ? filteredRows.length : '…'], ['Collected', ready && paymentSummaryLoaded ? fmtAmt(totals.collected) : '—'], ['Vendor paid', ready ? fmtAmt(totals.paid) : '—'], ['Vendor outstanding', ready ? fmtAmt(totals.owed) : '—']].map(([label, value]) => <Card key={label} className="!p-3"><div className={labelCls}>{label}</div><div className={cn('text-lg font-bold mt-1 font-mono', label === 'Vendor outstanding' && 'text-amber-600')}>{value}</div></Card>)}
    </div>

    <Card noPadding className="overflow-hidden">
      <div className="overflow-x-auto">
        {view === 'vendors' ? <table className="w-full text-sm text-left min-w-[620px]" aria-label="Vendor balances">
          <thead className="bg-slate-500/5 border-b border-slate-500/10"><tr>{['Vendor', 'Bookings', 'Vendor cost', 'Vendor paid', 'Outstanding', ''].map((h, i) => <th key={i} className={cn(thCls, i > 1 && 'text-right')}>{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-500/10">{vendorGroups.slice(0, visibleRows).map(v => <tr key={v.key} className="hover:bg-slate-500/5"><td className="p-4 font-semibold">{v.name}</td><td className="p-4">{v.bookings.size}</td><td className="p-4 text-right font-mono">{fmtAmt(v.cost)}</td><td className="p-4 text-right font-mono">{fmtAmt(v.paid)}</td><td className="p-4 text-right font-mono font-bold text-amber-600">{fmtAmt(v.owed)}</td><td className="p-4 text-right"><button className="px-3 py-2 rounded-lg border border-slate-500/20 text-xs font-bold whitespace-nowrap" onClick={() => { setVendorFilter(v.key); setView('bookings'); }}>View bookings</button></td></tr>)}</tbody>
        </table> : <table className="w-full text-left border-collapse min-w-[900px]" aria-label="Booking accounts">
          <thead className="bg-slate-500/5 border-b border-slate-500/10"><tr>{['Customer / TTE ID', 'Destination', 'Booking done', 'Collected', 'Vendor paid', 'Vendor(s)', ...(user?.role === 'admin' ? ['Agent'] : []), 'Booking'].map(h => <th key={h} className={cn(thCls, ['Collected', 'Vendor paid', 'Booking'].includes(h) && 'text-right')}>{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-500/10">{filteredRows.slice(0, visibleRows).map(({ lead, collected, vendor, vendorNames }) => <tr key={lead.id} className="hover:bg-slate-500/5">
            <td className="p-4"><div className="font-bold text-sm">{lead.name}</div><div className="mt-1"><LeadCodeChip code={lead.leadCode} /></div><div className={cn('flex items-center gap-1 text-[11px] mt-1 whitespace-nowrap', muted)}><Phone size={10} />{lead.contact?.phone || '—'}</div></td>
            <td className="p-4 text-sm max-w-[200px]">{lead.tripDetails?.destination || '—'}</td>
            <td className="p-4 text-xs whitespace-nowrap">{lead.wonAt ? formatDate(lead.wonAt) : lead.status === 'Won' ? 'Date not recorded' : lead.status}</td>
            <td className="p-4 text-right font-mono font-bold text-sm text-emerald-600">{paymentSummaryLoaded ? fmtAmt(collected) : '—'}</td>
            <td className="p-4 text-right font-mono text-sm whitespace-nowrap">{fmtAmt(vendor.paid)}{vendor.owed > 0 && <div className="text-[10px] font-sans font-semibold text-amber-600 mt-1">{fmtAmt(vendor.owed)} owed</div>}</td>
            <td className="p-4 text-xs max-w-[220px]" title={vendorNames}>{vendorNames}</td>
            {user?.role === 'admin' && <td className="p-4"><span className={cn('px-2 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 whitespace-nowrap', getAgentColor(lead.assignedTo))}><UserCheck size={10} />{lead.assignedTo || 'Unassigned'}</span></td>}
            <td className="p-4 text-right"><button aria-label={`View booking ${lead.leadCode || lead.name}`} onClick={() => setSelectedLead(lead.id)} className="text-xs font-bold px-3 py-2 rounded-lg border border-slate-500/20 hover:bg-slate-500/10">View</button></td>
          </tr>)}</tbody>
        </table>}
        {shownCount === 0 && <div className="p-10 text-center"><User size={24} className="mx-auto opacity-30 mb-2" /><p className="font-semibold">{isLoading ? 'Loading bookings…' : 'No bookings match these filters'}</p><p className={cn('text-sm mt-1', muted)}>Try clearing a filter or changing the booking dates.</p></div>}
      </div>
    </Card>
    {visibleRows < shownCount && <button className="w-full rounded-lg border border-slate-500/20 p-3 text-sm font-semibold" onClick={() => setVisibleRows(n => n + 50)}>Show more ({shownCount - visibleRows} remaining)</button>}
    {showExport && ready && paymentSummaryLoaded && <ExportPanel rows={filteredRows} onClose={() => setShowExport(false)} />}
    {selectedLead && <BookingDetailsDialog leadId={selectedLead} onClose={closeBooking} />}
  </div>;
};
