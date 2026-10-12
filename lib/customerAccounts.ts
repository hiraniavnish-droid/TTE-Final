import type { Lead, Supplier } from '../types';

export interface VendorBalance { key: string; name: string; cost: number; paid: number; owed: number; }
export type PaymentState = '' | 'outstanding' | 'unpaid' | 'partial' | 'paid' | 'no-cost';
export const vendorKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();
const amount = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;

export function bookingVendors(lead: Lead, suppliers: Supplier[] = []): VendorBalance[] {
  const entries = lead.vendors?.length ? lead.vendors.map(v => ({
    name: String(v.name || '').trim() || 'Vendor not specified', cost: amount(v.cost),
    paid: (v.payments || []).reduce((sum, p) => sum + amount(p.amount), 0),
  })) : [{
    name: lead.commercials?.manualVendorName?.trim()
      || suppliers.find(s => s.id === lead.commercials?.vendorId)?.name || 'Vendor not specified',
    cost: amount(lead.commercials?.netCost), paid: 0,
  }];
  // Keep each vendor's outstanding separate: an overpayment to one supplier
  // must never cancel an amount still owed to another supplier.
  const balances = new Map<string, VendorBalance>();
  for (const entry of entries) {
    const key = vendorKey(entry.name);
    const balance = balances.get(key) || { key, name: entry.name, cost: 0, paid: 0, owed: 0 };
    balance.cost += entry.cost;
    balance.paid += entry.paid;
    balance.owed += Math.max(entry.cost - entry.paid, 0);
    balances.set(key, balance);
  }
  return [...balances.values()];
}

export function totalVendors(entries: VendorBalance[]) {
  return entries.reduce((s, v) => ({ cost: s.cost + v.cost, paid: s.paid + v.paid, owed: s.owed + v.owed }), { cost: 0, paid: 0, owed: 0 });
}

export function matchesPayment(balance: { cost: number; paid: number; owed: number }, state: PaymentState): boolean {
  if (state === 'outstanding') return balance.owed > 0;
  if (state === 'unpaid') return balance.cost > 0 && balance.paid === 0;
  if (state === 'partial') return balance.paid > 0 && balance.owed > 0;
  if (state === 'paid') return balance.cost > 0 && balance.owed === 0;
  if (state === 'no-cost') return balance.cost === 0;
  return true;
}

export function groupVendorBalances(rows: { lead: Lead; vendorEntries: VendorBalance[] }[]) {
  const groups = new Map<string, VendorBalance & { bookings: Set<string> }>();
  for (const row of rows) for (const vendor of row.vendorEntries) {
    const group = groups.get(vendor.key) || { key: vendor.key, name: vendor.name, cost: 0, paid: 0, owed: 0, bookings: new Set<string>() };
    group.cost += vendor.cost; group.paid += vendor.paid; group.owed += vendor.owed;
    group.bookings.add(row.lead.id);
    groups.set(vendor.key, group);
  }
  return [...groups.values()].sort((a, b) => b.owed - a.owed || a.name.localeCompare(b.name));
}
