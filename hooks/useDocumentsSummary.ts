import { useEffect, useState } from 'react';
import { TTE_TOKEN_KEY } from '../lib/supabase';

const API_BASE = (import.meta as any).env?.DEV ? 'https://ttecrm.vercel.app' : '';

export interface LeadGstSummary {
  // 'issued' wins over 'pending' if a lead has both an issued and a separate
  // pending GST invoice (rare, but a repeat/partial payment could do it).
  status: 'issued' | 'pending' | 'none';
  gstAmount: number;        // sum of cgst+sgst+igst across ISSUED gst invoices for this lead
  invoiceNumbers: string[]; // issued invoice numbers, e.g. TTE/INV/00001
}

const authHeaders = (): Record<string, string> => {
  try {
    const token = localStorage.getItem(TTE_TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch { return {}; }
};

/** Fetches every document once (GET /api/documents with no leadId returns
 *  all rows) and reduces it to a per-lead GST-invoice status, so the
 *  Customers/Accounts page can show "has this booking been GST-invoiced?"
 *  without a request per lead. Only `doc_type: 'invoice'` rows with a real
 *  tax_type count — a plain receipt (tax_type 'none') never carries GST. */
export function useDocumentsSummary() {
  const [map, setMap] = useState<Record<string, LeadGstSummary>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/documents`, { headers: authHeaders() })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const rows: any[] = data.documents || [];
        const next: Record<string, LeadGstSummary> = {};
        for (const d of rows) {
          if (!d.lead_id || d.doc_type !== 'invoice' || d.tax_type === 'none') continue;
          const s = next[d.lead_id] || { status: 'none', gstAmount: 0, invoiceNumbers: [] };
          if (d.status === 'issued') {
            s.status = 'issued';
            s.gstAmount += (Number(d.cgst_amount) || 0) + (Number(d.sgst_amount) || 0) + (Number(d.igst_amount) || 0);
            if (d.number) s.invoiceNumbers.push(d.number);
          } else if (d.status === 'pending' && s.status !== 'issued') {
            s.status = 'pending';
          }
          next[d.lead_id] = s;
        }
        setMap(next);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => { cancelled = true; };
  }, []);

  return { gstSummary: map, gstSummaryLoaded: loaded };
}
