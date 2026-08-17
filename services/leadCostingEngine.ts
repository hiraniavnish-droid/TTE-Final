// ============================================================
// Shared commission/profit engine for the Rann Utsav & SOU rate cards.
//
// TTE does NOT mark the rate card up. The published rate IS the rack rate.
//   * TTE receives a travel-agent commission (18% or 22%) off the ROOM RENT,
//     so TTE pays the supplier  roomRent × (1 − commission%).
//   * The client is given a (smaller) discount off the same rack rate, so the
//     client pays                roomRent × (1 − discount%).
//   * Profit is the GAP BETWEEN THE TWO DISCOUNTS — not a markup on top.
//
// Extras (extra mattress / extra person) sit IDENTICALLY on both sides: no
// commission is earned on them and no discount is given, so they add the same
// rupee amount to what TTE pays and what the client pays, contributing zero
// profit. 18% GST is then applied to each side separately.
//
// Verified against the "Jay Peshawaria — Rajwadi 30th Dec 3N" sheet:
//   client:   105000 × (1−11.98%) = 92,422 + 23,250 = 115,672 → +18% = 1,36,493
//   supplier: 105000 × (1−18.00%) = 86,100 + 23,250 = 109,350 → +18% = 1,29,033
//   profit:   115,672 − 109,350 = 6,322 (GST nets off, it is not earnings)
// ============================================================

export const GST_RATE = 0.18;

// Travel-agent commission TTE earns off room rent. Named COMMISSION, not
// margin — it is money given back BY the supplier, never added on top.
export const COMMISSION_OPTIONS = [18, 22] as const;
export type CommissionPct = typeof COMMISSION_OPTIONS[number];

export interface CostingLine { label: string; amount: number; note?: string; }

export interface CostingBreakdown {
  roomRent: number;          // rack rate straight off the rate card
  extras: CostingLine[];
  extrasTotal: number;

  commissionPct: number;
  discountPct: number;

  // ── What TTE pays the supplier ──
  payableRoomRent: number;   // roomRent × (1 − commissionPct/100)
  payableBeforeTax: number;  // + extras
  payableGst: number;
  netCost: number;           // GST-inclusive: the real cash TTE sends out

  // ── What the client pays TTE ──
  clientRoomRent: number;    // roomRent × (1 − discountPct/100)
  clientDiscountAmount: number; // roomRent − clientRoomRent, for client-facing display
  clientBeforeTax: number;   // + extras
  clientGst: number;
  sellingPrice: number;      // GST-inclusive: the guest's final payable amount

  // ── Earnings ──
  // GST is a PASS-THROUGH, not income: you collect clientGst from the guest,
  // claim payableGst back as input credit, and remit the difference to the
  // government. So real profit is the difference of the two PRE-TAX figures.
  // (sellingPrice − netCost) would overstate it by exactly netGstPayable.
  profit: number;            // clientBeforeTax − payableBeforeTax
  netGstPayable: number;     // clientGst − payableGst — owed to govt, NOT profit
  isLoss: boolean;           // discount given exceeds commission earned
}

export function computeCosting(
  roomRent: number,
  extras: CostingLine[],
  commissionPct: number,
  discountPct: number,
): CostingBreakdown {
  const extrasTotal = extras.reduce((s, e) => s + e.amount, 0);

  const payableRoomRent = Math.round(roomRent * (1 - commissionPct / 100));
  const payableBeforeTax = payableRoomRent + extrasTotal;
  const payableGst = Math.round(payableBeforeTax * GST_RATE);
  const netCost = payableBeforeTax + payableGst;

  const clientRoomRent = Math.round(roomRent * (1 - discountPct / 100));
  const clientBeforeTax = clientRoomRent + extrasTotal;
  const clientGst = Math.round(clientBeforeTax * GST_RATE);
  const sellingPrice = clientBeforeTax + clientGst;

  return {
    roomRent, extras, extrasTotal,
    commissionPct, discountPct,
    payableRoomRent, payableBeforeTax, payableGst, netCost,
    clientRoomRent, clientDiscountAmount: roomRent - clientRoomRent,
    clientBeforeTax, clientGst, sellingPrice,
    profit: clientBeforeTax - payableBeforeTax,
    netGstPayable: clientGst - payableGst,
    // Not clamped to zero: giving away more than you earn is a real, if
    // deliberate, outcome and the UI must show it rather than hide it.
    isLoss: discountPct > commissionPct,
  };
}

export type CostingSource = 'rann-utsav' | 'sou-tent-city';
export const SOURCE_LABEL: Record<CostingSource, string> = {
  'rann-utsav': 'Rann Utsav',
  'sou-tent-city': 'Statue of Unity — Tent City-1',
};

// Conservative keyword match — no match returns null so the agent picks
// manually rather than the app silently guessing wrong.
export function matchDestination(destination: string | undefined): CostingSource | null {
  const d = (destination || '').toLowerCase();
  const isRann = d.includes('rann utsav') || d.includes('dhordo') || d.includes('white desert') || d.includes('rann tent resort');
  const isSou = d.includes('statue of unity') || /\bsou\b/.test(d) || d.includes('kevadia') || d.includes('ekta nagar') || d.includes('tent city-1') || d.includes('tent city 1');
  if (isRann) return 'rann-utsav';
  if (isSou) return 'sou-tent-city';
  return null;
}

export const fmtINR = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
