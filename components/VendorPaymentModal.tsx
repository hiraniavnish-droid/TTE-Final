import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { VendorDetail, VendorPayment } from '../types';
import { cn, formatCurrency, generateId } from '../utils/helpers';
import { IndianRupee, Loader2, Banknote, AlertTriangle, Pencil, Trash2, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';

const METHODS = ['Cash', 'Cheque', 'Bank Transfer', 'UPI', 'Other'] as const;

interface VendorPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: VendorDetail | null;
  onSave: (vendorId: string, payments: VendorPayment[]) => void;
}

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
};

export const VendorPaymentModal: React.FC<VendorPaymentModalProps> = ({ isOpen, onClose, vendor, onSave }) => {
  const { theme, getTextColor, getSecondaryTextColor, getInputClass } = useTheme();
  const { user } = useAuth();

  // null = adding a new payment; an id = editing that existing payment
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<typeof METHODS[number]>('Bank Transfer');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const payments = vendor?.payments || [];
  const paidSoFar = payments.reduce((s, p) => s + p.amount, 0);
  const owed = Math.max((vendor?.cost || 0) - paidSoFar, 0);

  const resetForNew = () => {
    setEditingId(null);
    setAmount(owed > 0 ? String(owed) : '');
    setMethod('Bank Transfer');
    setDate(new Date().toISOString().slice(0, 10));
    setReference('');
    setNotes('');
  };

  useEffect(() => {
    if (isOpen) {
      // Open straight into the add-payment form only if nothing's been paid yet;
      // otherwise show the history first so existing entries aren't hidden behind the form.
      setFormOpen(payments.length === 0);
      resetForNew();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, vendor?.id]);

  const openAddForm = () => {
    resetForNew();
    setFormOpen(true);
  };

  const openEditForm = (p: VendorPayment) => {
    setEditingId(p.id);
    setAmount(String(p.amount));
    setMethod(p.method);
    setDate(p.date);
    setReference(p.reference || '');
    setNotes(p.notes || '');
    setFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!vendor) return;
    if (!window.confirm('Delete this payment entry? This cannot be undone.')) return;
    onSave(vendor.id, payments.filter(p => p.id !== id));
    toast.success('Payment entry deleted.');
  };

  const handleSave = () => {
    const amt = Number(amount);
    if (!vendor || !(amt > 0)) {
      toast.error('Enter a valid amount.');
      return;
    }
    setSaving(true);
    if (editingId) {
      const updated: VendorPayment = {
        ...(payments.find(p => p.id === editingId) as VendorPayment),
        amount: amt,
        method,
        date,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      onSave(vendor.id, payments.map(p => p.id === editingId ? updated : p));
      toast.success('Payment entry updated.');
    } else {
      const payment: VendorPayment = {
        id: generateId(),
        amount: amt,
        method,
        date,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        recordedBy: user?.name || 'Agent',
        recordedAt: new Date().toISOString(),
      };
      onSave(vendor.id, [...payments, payment]);
      toast.success('Vendor payment recorded.');
    }
    setSaving(false);
    setFormOpen(false);
    setEditingId(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={() => !saving && onClose()} title={`Payments — ${vendor?.name || 'Vendor'}`}>
      <div className="space-y-5">
        <div className={cn('rounded-xl border p-3.5 space-y-1.5 text-sm', theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/10')}>
          <div className="flex justify-between"><span className="opacity-60">Buying cost</span><span className={cn('font-mono font-bold', getTextColor())}>{formatCurrency(vendor?.cost || 0)}</span></div>
          <div className="flex justify-between"><span className="opacity-60">Paid so far</span><span className="font-mono text-emerald-600">₹{paidSoFar.toLocaleString('en-IN')}</span></div>
          <div className="flex justify-between font-bold border-t border-gray-500/10 pt-1.5"><span className={getTextColor()}>Balance due</span><span className={cn('font-mono', owed > 0 ? 'text-rose-600' : 'text-emerald-600')}>₹{owed.toLocaleString('en-IN')}</span></div>
        </div>

        {payments.length > 0 && (
          <div className="space-y-2">
            <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Payment history</label>
            {payments.map(p => (
              <div key={p.id} className={cn('flex items-center justify-between gap-2 rounded-lg border px-3 py-2', theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10')}>
                <div className="min-w-0">
                  <div className={cn('font-mono font-bold text-sm', getTextColor())}>₹{p.amount.toLocaleString('en-IN')}</div>
                  <div className={cn('text-[11px] truncate', getSecondaryTextColor())}>
                    {fmtDate(p.date)} · {p.method}{p.reference ? ` · ${p.reference}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEditForm(p)} className="p-1.5 rounded-md opacity-60 hover:opacity-100 hover:bg-black/5 transition">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-md text-rose-500 opacity-60 hover:opacity-100 hover:bg-rose-50 transition">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!formOpen ? (
          <Button variant="secondary" onClick={openAddForm} className="w-full justify-center border-dashed border-2">
            <Plus size={16} /> Add Payment
          </Button>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>
                {editingId ? 'Edit payment' : 'New payment'}
              </label>
              {editingId && (
                <button onClick={() => { setFormOpen(payments.length > 0 ? false : true); setEditingId(null); }} className="flex items-center gap-1 text-[11px] font-semibold opacity-60 hover:opacity-100">
                  <X size={12} /> Cancel edit
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Amount</label>
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
            </div>

            <div className="space-y-1.5">
              <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Payment method</label>
              <div className="grid grid-cols-3 gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={cn('py-2 rounded-lg text-xs font-bold border transition',
                      method === m ? 'bg-slate-900 border-slate-900 text-white' : cn(theme === 'light' ? 'bg-white border-slate-200 text-slate-500' : 'bg-white/5 border-white/10 text-white/50'))}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Date paid</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={cn('w-full px-3 py-2.5 rounded-lg border outline-none text-sm font-mono', getInputClass())}
                />
              </div>
              <div className="space-y-1.5">
                <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Reference ID (optional)</label>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder={method === 'Cheque' ? 'Cheque no.' : method === 'Bank Transfer' ? 'UTR / txn ref' : method === 'UPI' ? 'UPI txn ID' : 'Reference'}
                  className={cn('w-full px-3 py-2.5 rounded-lg border outline-none text-sm font-mono', getInputClass())}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Notes (optional)</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Advance for safari"
                className={cn('w-full px-3 py-2.5 rounded-lg border outline-none text-sm', getInputClass())}
              />
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">
                This logs money you've <b>already paid out</b> to this vendor — it doesn't send any payment itself.
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Close</Button>
          {formOpen && (
            <Button onClick={handleSave} disabled={saving} className="min-w-[160px] bg-slate-900 hover:bg-slate-800 border-none text-white">
              {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><Banknote size={16} /> {editingId ? 'Save Changes' : 'Save Payment'}</>}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
