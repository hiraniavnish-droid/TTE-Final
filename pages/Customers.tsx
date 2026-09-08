
import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { useLeads } from '../contexts/LeadContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { usePaymentSummary } from '../hooks/usePaymentSummary';
import { useDocumentsSummary } from '../hooks/useDocumentsSummary';
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
  FileCheck2,
  FileClock,
  FileX2,
  ArrowUpRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const vendorTotals = (l: Lead) => {
  let cost = 0, paid = 0;
  for (const v of (l.vendors || [])) {
    cost += v.cost || 0;
    const vPaid = (v.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
    paid += Math.min(vPaid, v.cost || vPaid);
  }
  if ((!l.vendors || l.vendors.length === 0) && l.commercials) cost = l.commercials.netCost || 0;
  return { cost, paid, owed: Math.max(cost - paid, 0) };
};

// Deliberately NOT the shared formatCurrency() — that returns "TBD" for 0,
// which is right for an undecided budget but wrong here: ₹0 collected/paid
// is real, known data on an accounts ledger, not something still pending.
const fmtAmt = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

const vendorNamesOf = (l: Lead): string =>
  (l.vendors || []).map(v => v.name).join(', ') || l.commercials?.manualVendorName || '';

const GST_META: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  issued: { label: 'GST Issued', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30', icon: <FileCheck2 size={11} strokeWidth={2.5} /> },
  pending: { label: 'GST Pending', className: 'bg-amber-500/10 text-amber-600 border-amber-500/30', icon: <FileClock size={11} strokeWidth={2.5} /> },
  none: { label: 'No GST', className: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: <FileX2 size={11} strokeWidth={2.5} /> },
};

export const Customers = () => {
  const { leads } = useLeads();
  const { theme, getTextColor, getSecondaryTextColor, getInputClass } = useTheme();
  const { user, users } = useAuth();
  const { paymentSummary } = usePaymentSummary();
  const { gstSummary } = useDocumentsSummary();

  const [searchQuery, setSearchQuery] = useState('');
  const [destinationFilter, setDestinationFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Distinct filter option lists, derived from the leads actually on file —
  // destination and vendor are free text (no canonical list anywhere in the
  // app), so these are built the same way Dashboard's destination breakdown is.
  const destinationOptions = useMemo(() => {
    const seen = new Map<string, string>(); // lowercased -> original casing
    leads.forEach(l => {
      const d = (l.tripDetails?.destination || '').trim();
      if (d && !seen.has(d.toLowerCase())) seen.set(d.toLowerCase(), d);
    });
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }, [leads]);

  const vendorOptions = useMemo(() => {
    const seen = new Set<string>();
    leads.forEach(l => (l.vendors || []).forEach(v => v.name && seen.add(v.name)));
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [leads]);

  const agentOptions = useMemo(
    () => users.filter(u => u.role === 'agent').map(u => u.name),
    [users]);

  // --- One row per booking (lead), not grouped by customer — accounts care
  // about each booking's own collection/vendor/GST state, not a relationship
  // rollup. ---
  const rows = useMemo(() => {
    return leads
      .map(lead => ({
        lead,
        collected: paymentSummary[lead.id]?.collected || 0,
        vendor: vendorTotals(lead),
        vendorNames: vendorNamesOf(lead),
        gst: gstSummary[lead.id] || { status: 'none' as const, gstAmount: 0, invoiceNumbers: [] },
      }))
      .sort((a, b) => {
        const at = a.lead.wonAt || a.lead.lastStatusUpdate || a.lead.createdAt;
        const bt = b.lead.wonAt || b.lead.lastStatusUpdate || b.lead.createdAt;
        return new Date(bt).getTime() - new Date(at).getTime();
      });
  }, [leads, paymentSummary, gstSummary]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return rows.filter(r => {
      const l = r.lead;
      if (q) {
        const hit = l.name.toLowerCase().includes(q)
          || (l.contact?.phone || '').includes(q)
          || (l.contact?.email || '').toLowerCase().includes(q)
          || (l.tripDetails?.destination || '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (destinationFilter && (l.tripDetails?.destination || '').toLowerCase() !== destinationFilter.toLowerCase()) return false;
      if (agentFilter && l.assignedTo !== agentFilter) return false;
      if (vendorFilter && !(l.vendors || []).some(v => v.name === vendorFilter)) return false;
      if (statusFilter && l.status !== statusFilter) return false;
      return true;
    });
  }, [rows, searchQuery, destinationFilter, agentFilter, vendorFilter, statusFilter]);

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  const clearFilters = () => {
    setSearchQuery(''); setDestinationFilter(''); setAgentFilter(''); setVendorFilter(''); setStatusFilter('');
  };
  const hasActiveFilters = !!(searchQuery || destinationFilter || agentFilter || vendorFilter || statusFilter);

  const handleExport = () => {
    const csvRows = filteredRows.map(({ lead: l, collected, vendor, vendorNames, gst }) => ({
      'Lead Code': l.leadCode || '',
      'Customer': l.name,
      'Phone': l.contact?.phone || '',
      'Destination': l.tripDetails?.destination || '',
      'Stage': l.status,
      'Booking Done Date': l.wonAt ? formatDate(l.wonAt) : '',
      'Selling Price': l.commercials?.sellingPrice || 0,
      'Amount Collected': collected,
      'Vendor(s)': vendorNames,
      'Amount Paid to Vendor': vendor.paid,
      'Vendor Owed': vendor.owed,
      'GST Status': GST_META[gst.status].label,
      'GST Amount': gst.gstAmount,
      'GST Invoice No.': gst.invoiceNumbers.join('; '),
      'Agent': l.assignedTo || 'Unassigned',
    }));
    const csv = Papa.unparse(csvRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tte-accounts-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectCls = cn('rounded-lg px-3 py-2 text-[12px] font-medium outline-none border transition-all', getInputClass());

  return (
    <div className="relative min-h-[calc(100vh-100px)]">

      {/* --- Header --- */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-2">
          <div className="flex items-baseline gap-2.5">
            <h1 className={cn("text-2xl font-bold tracking-tight", getTextColor())}>Customers</h1>
            <span className={cn("text-sm font-medium", theme === 'light' ? 'text-slate-400' : 'text-white/40')}>
              {filteredRows.length} of {rows.length} booking{rows.length === 1 ? '' : 's'}
            </span>
          </div>
          <button
            onClick={handleExport}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border transition-colors shrink-0",
              theme === 'light' ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800' : 'bg-white text-slate-900 border-white hover:bg-white/90'
            )}
          >
            <Download size={15} strokeWidth={2.5} /> Export CSV
          </button>
        </div>
        <p className={cn("text-sm opacity-50 -mt-2", getTextColor())}>
          Booking-wise collections, vendor payments and GST invoice status.
        </p>

        {/* Search */}
        <div className={cn(
          "flex items-center px-4 rounded-xl transition-all border focus-within:ring-1",
          theme === 'light'
            ? 'bg-white border-slate-200 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.08)] focus-within:ring-slate-300 focus-within:border-slate-300'
            : 'bg-white/5 border-white/10 focus-within:ring-white/20'
        )}>
          <Search size={18} strokeWidth={2} className="opacity-40 shrink-0 mr-3" />
          <input
            type="text"
            placeholder="Search by name, mobile, or destination..."
            className={cn("w-full py-3 bg-transparent outline-none text-sm", getInputClass(), "border-none focus:ring-0")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="p-1 hover:bg-gray-500/10 rounded-full transition-colors">
              <X size={16} strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select value={destinationFilter} onChange={e => setDestinationFilter(e.target.value)} className={selectCls}>
            <option value="">All destinations</option>
            {destinationOptions.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          {user?.role === 'admin' && (
            <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)} className={selectCls}>
              <option value="">All agents</option>
              {agentOptions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
          <select value={vendorFilter} onChange={e => setVendorFilter(e.target.value)} className={selectCls}>
            <option value="">All vendors</option>
            {vendorOptions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectCls}>
            <option value="">All stages</option>
            {STATUS_COLUMNS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {hasActiveFilters && (
            <button onClick={clearFilters} className={cn("text-[12px] font-bold underline opacity-60 hover:opacity-100", getTextColor())}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* --- Accounts Table --- */}
      <Card noPadding className="overflow-hidden shadow-[0_4px_20px_-4px_rgba(15,23,42,0.08)] animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="overflow-x-auto">
          <table className={cn("w-full text-left border-collapse", getTextColor())}>
            <thead>
              <tr className={cn(theme === 'light' ? 'bg-slate-50 border-b border-slate-200' : 'bg-white/5 border-b border-white/10')}>
                <th className="p-4 font-bold text-[11px] uppercase tracking-wider opacity-50">Customer</th>
                <th className="p-4 font-bold text-[11px] uppercase tracking-wider opacity-50 hidden md:table-cell">Destination</th>
                <th className="p-4 font-bold text-[11px] uppercase tracking-wider opacity-50 hidden lg:table-cell">Booking Done</th>
                <th className="p-4 font-bold text-[11px] uppercase tracking-wider opacity-50 text-right">Collected</th>
                <th className="p-4 font-bold text-[11px] uppercase tracking-wider opacity-50 text-right hidden sm:table-cell">Vendor Paid</th>
                <th className="p-4 font-bold text-[11px] uppercase tracking-wider opacity-50 hidden lg:table-cell">Vendor(s)</th>
                <th className="p-4 font-bold text-[11px] uppercase tracking-wider opacity-50">GST</th>
                {user?.role === 'admin' && <th className="p-4 font-bold text-[11px] uppercase tracking-wider opacity-50 hidden md:table-cell">Agent</th>}
                <th className="p-4 font-bold text-[11px] uppercase tracking-wider opacity-50 text-right">Booking</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y", theme === 'light' ? 'divide-slate-100' : 'divide-white/5')}>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-16">
                    <div className="flex flex-col items-center text-center">
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center mb-4",
                        theme === 'light' ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-white/40'
                      )}>
                        <User size={24} strokeWidth={2} />
                      </div>
                      <p className={cn("text-base font-semibold", getTextColor())}>
                        {hasActiveFilters ? 'No bookings match these filters' : 'No bookings yet'}
                      </p>
                      <p className={cn("text-sm mt-1", theme === 'light' ? 'text-slate-400' : 'text-white/40')}>
                        {hasActiveFilters ? 'Try clearing a filter.' : 'Bookings appear here as leads are added.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredRows.map(({ lead, collected, vendor, vendorNames, gst }) => {
                const gstMeta = GST_META[gst.status];
                return (
                  <tr
                    key={lead.id}
                    className={cn(
                      "group relative transition-colors",
                      theme === 'light' ? "hover:bg-slate-50" : "hover:bg-white/5"
                    )}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0",
                          theme === 'light' ? 'bg-slate-900 text-white' : 'bg-white/10 border border-white/10 text-white'
                        )}>
                          {getInitials(lead.name)}
                        </div>
                        <div className="min-w-0">
                          <h3 className={cn("font-bold text-sm leading-tight truncate", getTextColor())}>{lead.name}</h3>
                          <div className={cn("flex items-center gap-1 text-[11px] opacity-70", getSecondaryTextColor())}>
                            <Phone size={9} /> {lead.contact?.phone || '—'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="p-4 hidden md:table-cell text-sm opacity-80">
                      {lead.tripDetails?.destination || <span className="opacity-30 italic">—</span>}
                    </td>

                    <td className="p-4 hidden lg:table-cell text-sm">
                      {lead.wonAt
                        ? formatDate(lead.wonAt)
                        : <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase", theme === 'light' ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-white/5 text-white/40 border-white/10')}>{lead.status}</span>}
                    </td>

                    <td className="p-4 text-right font-mono font-bold text-sm text-emerald-500">
                      {fmtAmt(collected)}
                    </td>

                    <td className="p-4 text-right font-mono text-sm hidden sm:table-cell">
                      {fmtAmt(vendor.paid)}
                      {vendor.owed > 0 && (
                        <div className="text-[10px] font-sans font-bold opacity-50 mt-0.5">
                          {fmtAmt(vendor.owed)} owed
                        </div>
                      )}
                    </td>

                    <td className="p-4 hidden lg:table-cell text-sm opacity-80 max-w-[160px] truncate" title={vendorNames}>
                      {vendorNames || <span className="opacity-30 italic">—</span>}
                    </td>

                    <td className="p-4">
                      <span className={cn("inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border font-bold uppercase tracking-wide", gstMeta.className)}>
                        {gstMeta.icon} {gstMeta.label}
                      </span>
                    </td>

                    {user?.role === 'admin' && (
                      <td className="p-4 hidden md:table-cell">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1 w-fit",
                          getAgentColor(lead.assignedTo)
                        )}>
                          <UserCheck size={9} /> {lead.assignedTo || 'Unassigned'}
                        </span>
                      </td>
                    )}

                    <td className="p-4 text-right">
                      <Link
                        to={`/leads/${lead.id}`}
                        className={cn(
                          "inline-flex items-center gap-1 text-[12px] font-bold px-3 py-1.5 rounded-lg border transition-colors",
                          theme === 'light' ? 'border-slate-200 text-slate-600 hover:bg-slate-100' : 'border-white/10 text-white/70 hover:bg-white/10'
                        )}
                      >
                        View <ArrowUpRight size={12} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
