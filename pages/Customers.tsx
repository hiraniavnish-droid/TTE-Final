import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';

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
import { TableToolbar, SearchSelect, DateField, SegmentedControl } from '../components/ui/WorkspaceControls';
import { DataTable, TableColumn, MetricCard } from '../components/ui/WorkspaceVisuals';
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

  return (
    <Modal isOpen onClose={onClose} title="Export accounts" size="wide">
      <p className="ui-muted text-sm">{filtered.length} booking{filtered.length === 1 ? '' : 's'} will be exported</p>
        <div className="ui-export-body flex flex-col gap-4 mt-4">
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

        <div className="ui-export-footer flex items-center justify-end gap-2 border-t border-slate-500/10">
          <Button variant="secondary" onClick={handleCopy} disabled={filtered.length === 0 || cols.length === 0}>{copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? 'Copied!' : 'Copy to Clipboard'}</Button>
          <Button onClick={handleDownload} disabled={filtered.length === 0 || cols.length === 0}><Download size={15}/>Download CSV</Button>
        </div>
    </Modal>
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
  const [selectedBookings, setSelectedBookings] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState(['customer','destination','date','collected','paid','vendors','agent','open']);
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
  useEffect(() => { setSelectedBookings([]); }, [searchQuery, destinationFilter, agentFilter, vendorFilter, statusFilter, paymentFilter, collectionFilter, from, to, view]);
  const selectedRows = filteredRows.filter(row => selectedBookings.includes(row.lead.id));
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

  const bookingColumns: TableColumn<AccountRow>[] = [
    {key:'customer',label:'Customer / TTE ID',sortValue:r=>r.lead.name,render:r=><div><label className="flex items-center gap-2"><input type="checkbox" aria-label={`Select booking ${r.lead.leadCode || r.lead.name}`} checked={selectedBookings.includes(r.lead.id)} onChange={()=>setSelectedBookings(current=>current.includes(r.lead.id)?current.filter(id=>id!==r.lead.id):[...current,r.lead.id])}/><strong>{r.lead.name}</strong></label><div className="mt-1"><LeadCodeChip code={r.lead.leadCode}/></div><small className="ui-muted">{r.lead.contact?.phone || '—'}</small></div>},
    {key:'destination',label:'Destination',sortValue:r=>r.lead.tripDetails?.destination || '',render:r=>r.lead.tripDetails?.destination || '—'},
    {key:'date',label:'Booked',sortValue:r=>r.lead.wonAt || '',render:r=>r.lead.wonAt ? formatDate(r.lead.wonAt) : r.lead.status === 'Won' ? 'Date not recorded' : r.lead.status},
    {key:'collected',label:'Collected',align:'right',sortValue:r=>r.collected,render:r=>paymentSummaryLoaded ? fmtAmt(r.collected) : '—'},
    {key:'paid',label:'Vendor paid',align:'right',sortValue:r=>r.vendor.paid,render:r=><div>{fmtAmt(r.vendor.paid)}{r.vendor.owed>0&&<small className="block text-amber-600">{fmtAmt(r.vendor.owed)} owed</small>}</div>},
    {key:'vendors',label:'Vendors',render:r=>r.vendorNames || '—'},
    ...(user?.role === 'admin' ? [{key:'agent',label:'Agent',render:(r:AccountRow)=>r.lead.assignedTo || 'Unassigned'}] : []),
    {key:'open',label:'Booking',render:r=><button type="button" className="crm-button text-xs font-semibold text-blue-600 py-2" aria-label={`View booking ${r.lead.leadCode || r.lead.name}`} onClick={()=>setSelectedLead(r.lead.id)}>View booking ↗</button>},
  ];
  const vendorColumns: TableColumn<VendorBalance & {bookings:Set<string>}>[] = [
    {key:'vendor',label:'Vendor',sortValue:r=>r.name,render:r=><strong>{r.name}</strong>},
    {key:'bookings',label:'Bookings',sortValue:r=>r.bookings.size,render:r=>r.bookings.size},
    {key:'cost',label:'Vendor cost',align:'right',sortValue:r=>r.cost,render:r=>fmtAmt(r.cost)},
    {key:'paid',label:'Vendor paid',align:'right',sortValue:r=>r.paid,render:r=>fmtAmt(r.paid)},
    {key:'owed',label:'Outstanding',align:'right',sortValue:r=>r.owed,render:r=>fmtAmt(r.owed)},
    {key:'open',label:'Bookings',render:r=><button type="button" className="crm-button text-xs font-semibold text-blue-600 py-2" onClick={()=>{setVendorFilter(r.key);setView('bookings');}}>View bookings ↗</button>},
  ];
  return <div className={cn('relative min-h-[calc(100vh-100px)] space-y-4', getTextColor())}>
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div><h1 className="text-2xl font-bold tracking-tight">Customers <span className={cn('text-sm font-medium ml-2', muted)}>{filteredRows.length} of {rows.length} bookings</span></h1><p className={cn('text-sm mt-1', muted)}>Booking-wise collections and vendor payments. Legacy sales excluded.</p></div>

    </div>

    <Card className="space-y-3">
      <TableToolbar selectionCount={view === 'bookings' ? selectedRows.length : 0} onClearSelection={()=>setSelectedBookings([])} label="Bookings" search={searchQuery} onSearch={setSearchQuery} placeholder="Name, phone, TTE ID, destination or vendor…" columns={view === 'bookings' ? bookingColumns.map(c => ({key:c.key,label:c.label,visible:visibleColumns.includes(c.key)})) : undefined} onToggleColumn={key => setVisibleColumns(current => current.includes(key) ? current.filter(k => k !== key) : [...current,key])} onExport={() => view === 'vendors' ? exportVendors() : setShowExport(true)} exportDisabled={!ready || !paymentSummaryLoaded || invalidDates}/>

      <div className="grid grid-cols-2 lg:grid-cols-4 items-end gap-3">
        <div className="space-y-1"><span className={labelCls}>Destination</span><SearchSelect label="Destination" value={destinationFilter} onChange={setDestinationFilter} options={destinationOptions.map(d => ({value:d,label:d}))} placeholder="All destinations"/></div>
        <div className="space-y-1"><span className={labelCls}>Vendor</span><SearchSelect label="Vendor" value={vendorFilter} onChange={setVendorFilter} options={vendorOptions.map(v => ({value:v.key,label:v.name}))} placeholder="All vendors"/></div>
        <label className="space-y-1"><span className={labelCls}>Vendor payment</span><select aria-label="Vendor payment" value={paymentFilter} onChange={e => setPaymentFilter(e.target.value as PaymentState)} className={selectCls}><option value="">All payment states</option><option value="outstanding">Outstanding (unpaid + partial)</option><option value="unpaid">Not paid</option><option value="partial">Partially paid</option><option value="paid">Fully paid</option><option value="no-cost">No vendor cost entered</option></select></label>
        <label className="space-y-1"><span className={labelCls}>Customer collection</span><select aria-label="Customer collection" disabled={!paymentSummaryLoaded} value={collectionFilter} onChange={e => setCollectionFilter(e.target.value)} className={selectCls}><option value="">All collections</option><option value="pending">Collection pending</option><option value="uncollected">Nothing collected</option><option value="partial">Partially collected</option><option value="collected">Fully collected</option></select></label>
        <div className="ui-booking-date space-y-1"><span className={labelCls}>Booking done from</span><DateField label="Booking done from" value={from} onValueChange={setFrom} max={to || undefined}/></div>
        <div className="ui-booking-date space-y-1"><span className={labelCls}>Booking done to</span><DateField label="Booking done to" value={to} onValueChange={setTo} min={from || undefined}/></div>
        {user?.role === 'admin' && <div className="space-y-1"><span className={labelCls}>Agent</span><SearchSelect label="Agent" value={agentFilter} onChange={setAgentFilter} options={[{value:'__unassigned',label:'Unassigned'},...agentOptions.map(a => ({value:a,label:a}))]} placeholder="All agents"/></div>}
        <label className="space-y-1"><span className={labelCls}>Stage</span><select aria-label="Stage" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectCls}><option value="">All stages</option>{STATUS_COLUMNS.map(s => <option key={s}>{s}</option>)}</select></label>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-3 border-t border-slate-500/10 pt-3">
        <SegmentedControl label="Accounts view" value={view} onChange={value => setView(value as 'bookings' | 'vendors')} options={[{value:'bookings',label:'Bookings'},{value:'vendors',label:'By vendor'}]}/>
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
      <MetricCard label="Matching bookings" value={ready ? filteredRows.length : null}/>
      <MetricCard label="Collected" value={ready && paymentSummaryLoaded ? totals.collected : null} format={fmtAmt}/>
      <MetricCard label="Vendor paid" value={ready ? totals.paid : null} format={fmtAmt}/>
      <MetricCard featured label="Vendor outstanding" value={ready ? totals.owed : null} format={fmtAmt}/>

    </div>

    <Card noPadding className="overflow-hidden">
      {view === 'vendors' ? <DataTable key="vendors" label="Vendor balances" rows={vendorGroups} limit={visibleRows} columns={vendorColumns} rowKey={row=>row.key} onClearFilters={clearFilters}/> : <DataTable key={`bookings-${sort}`} label="Booking accounts" rows={filteredRows} limit={visibleRows} columns={bookingColumns.filter(c=>visibleColumns.includes(c.key))} rowKey={row=>row.lead.id} onClearFilters={clearFilters}/>}
    </Card>
    {visibleRows < shownCount && <button className="w-full rounded-lg border border-slate-500/20 p-3 text-sm font-semibold" onClick={() => setVisibleRows(n => n + 50)}>Show more ({shownCount - visibleRows} remaining)</button>}
    {showExport && ready && paymentSummaryLoaded && <ExportPanel rows={selectedRows.length ? selectedRows : filteredRows} onClose={() => setShowExport(false)} />}
    {selectedLead && <BookingDetailsDialog leadId={selectedLead} onClose={closeBooking} />}
  </div>;
};
