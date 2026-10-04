import { useEffect, useState } from 'react';

const API_BASE = (import.meta as any).env?.DEV ? 'https://ttecrm.vercel.app' : '';

export interface LeadPaymentSummary {
  collected: number;   // sum of amounts actually received (status === 'paid', any source)
  requested: number;   // sum of all amounts ever requested/recorded for this lead
  hasAny: boolean;      // any payment record at all (link or manual)
  // reference_id (Razorpay link) or manual_reference (manually-logged payment),
  // one entry per PAID record, in the order the records were fetched.
  referenceIds: string[];
}

// Raw shape needed for cash-basis (bank/Razorpay-reconcilable) reporting — every
// payment record with its actual paid date, independent of which lead/deal it belongs to.
export interface RawPaymentRecord {
  leadId: string | null;
  amount: number;
  status: string;
  paidAt: string | null;   // ISO — when the money was actually received, null if not yet paid
  createdAt: string | null; // ISO — when the payment entry itself was recorded (link created / manual entry logged)
}

// Fetches every payment record once (cheap — single JSON file server-side) and
// reduces it to a per-lead summary, used to flag "Won but not (fully) paid" leads
// on the Kanban board without an API call per card. Also exposes the raw records
// for cash-basis (paid-date-scoped) reporting on the Dashboard.
let pendingSummary: Promise<any> | null = null;
function fetchSummary() {
  if (!pendingSummary) pendingSummary = fetch(`${API_BASE}/api/razorpay-link?skipRefresh=1`, { signal: AbortSignal.timeout(20_000) })
    .then(response => { if (!response.ok) throw new Error('Payment summary unavailable'); return response.json(); })
    .finally(() => { pendingSummary = null; });
  return pendingSummary;
}

export function usePaymentSummary() {
  const [map, setMap] = useState<Record<string, LeadPaymentSummary>>({});
  const [records, setRecords] = useState<RawPaymentRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // skipRefresh: this is a read-only summary, not the Payments page — don't pay for a
    // live Razorpay poll (up to 60 sequential external calls) just to paint the Dashboard.
    fetchSummary()
      .then(data => {
        if (cancelled) return;
        const raw: any[] = data.records || [];
        const next: Record<string, LeadPaymentSummary> = {};
        for (const r of raw) {
          if (!r.leadId) continue;
          const s = next[r.leadId] || { collected: 0, requested: 0, hasAny: false, referenceIds: [] };
          s.hasAny = true;
          s.requested += Number(r.amount) || 0;
          if (r.status === 'paid') {
            s.collected += Number(r.amount) || 0;
            const ref = r.source === 'manual' ? r.manual_reference : r.reference_id;
            if (ref) s.referenceIds.push(ref);
          }
          next[r.leadId] = s;
        }
        setMap(next);
        setRecords(raw.map(r => ({ leadId: r.leadId || null, amount: Number(r.amount) || 0, status: r.status, paidAt: r.paid_at || null, createdAt: r.created_at || null })));
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) setLoaded(false); });
    return () => { cancelled = true; };
  }, []);

  return { paymentSummary: map, paymentSummaryLoaded: loaded, paymentRecords: records };
}
