// ============================================================
// Supplier-agnostic layer for the Rate Wall.
//
// Knows nothing about Rajarshi or Inland. Each supplier ships an adapter
// that produces WallEntry[]; everything below operates on that shape only.
// ============================================================

export type PriceBandId = 'value' | 'mid' | 'premium' | 'similar' | 'single';

interface WallRoomBase {
  key: string;                 // stable and unique, e.g. `${hotelId}::${roomIdx}`
  roomName: string;
}

// A room we can actually price. Carries money; carries no reason.
export interface QuotableRow extends WallRoomBase {
  quotable: true;
  netTotal: number;
  markupAmount: number;
  sellingTotal: number;
  sellingPerNight: number;
}

// A room we cannot price — on request, too small for the party, hotel closed.
// Deliberately carries NO money fields: a blocked row with a price is a bug we
// would rather not be able to write than have to catch in review.
export interface BlockedRow extends WallRoomBase {
  quotable: false;
  blockedReason: string;
}

export type WallRoomRow = QuotableRow | BlockedRow;

export interface WallEntry {
  hotelId: string;
  hotelName: string;
  starLabel?: string;
  resolutionChip: string;      // why this rate was chosen
  resolutionOk: boolean;       // false renders amber
  inclusions: string;          // e.g. 'CPAI · GST included'
  festiveFlag?: string;        // supplier's own printed wording
  closedReason?: string;       // outside printed validity
  rows: WallRoomRow[];
  cheapestSelling: number | null;  // null when nothing on this hotel is quotable
}

export interface WallBand {
  id: PriceBandId;
  label: string;               // '' when a single unlabelled band
  entries: WallEntry[];
}

export interface BandedWall {
  bands: WallBand[];
  onRequestOnly: WallEntry[];
}

// The one place this rule lives. Supplier adapters call it rather than
// re-deriving it, so the figure banding sorts on cannot drift from the
// cheapest figure the card actually renders.
export function cheapestQuotable(rows: WallRoomRow[]): number | null {
  const priced = rows.filter((r): r is QuotableRow => r.quotable).map(r => r.sellingTotal);
  return priced.length ? Math.min(...priced) : null;
}

const SIMILAR_PRICING_MAX_SPREAD = 1.15;

type PricedEntry = WallEntry & { cheapestSelling: number };

// Bands are derived from the results actually on screen, so they adapt per
// city — ₹6,000 is premium in Bhuj and mid in Ahmedabad. Star rating never
// participates: a 5-star hotel lands in 'Mid' when its rate says so.
export function bandHotels(entries: WallEntry[]): BandedWall {
  // Number.isFinite, not != null: a NaN or Infinity from a malformed rate would
  // otherwise sort unpredictably, defeat the spread comparison below, and reach
  // the card as '₹NaN'. Degrading to 'On request' is the honest failure mode.
  const quotable = entries.filter((e): e is PricedEntry => Number.isFinite(e.cheapestSelling));
  const onRequestOnly = entries.filter(e => !Number.isFinite(e.cheapestSelling));

  if (quotable.length === 0) return { bands: [], onRequestOnly };

  const sorted = [...quotable].sort((a, b) => a.cheapestSelling - b.cheapestSelling);

  if (sorted.length < 3) {
    return { bands: [{ id: 'single', label: '', entries: sorted }], onRequestOnly };
  }

  const min = sorted[0].cheapestSelling;
  const max = sorted[sorted.length - 1].cheapestSelling;
  // Forcing three bands over a narrow spread implies a difference that isn't
  // there, so collapse instead.
  if (max <= min * SIMILAR_PRICING_MAX_SPREAD) {
    return { bands: [{ id: 'similar', label: 'Similar pricing', entries: sorted }], onRequestOnly };
  }

  // Equal-count terciles, remainder to the cheaper groups so 'Premium' stays
  // the most selective.
  const n = sorted.length;
  const base = Math.floor(n / 3);
  const rem = n % 3;
  const sizes = [base + (rem > 0 ? 1 : 0), base + (rem > 1 ? 1 : 0), base];

  // A cut must never fall inside a group of hotels sharing one price — two
  // identical rates labelled 'Value' and 'Mid' on the same screen is not
  // something an agent can explain on a call. Advance past the whole tie group
  // and accept unequal bands; a band emptied by the nudge is dropped below.
  const cutPast = (idx: number) => {
    let i = Math.min(idx, sorted.length);
    while (i > 0 && i < sorted.length && sorted[i].cheapestSelling === sorted[i - 1].cheapestSelling) i++;
    return i;
  };

  const firstCut = cutPast(sizes[0]);
  const secondCut = cutPast(Math.max(firstCut, firstCut + sizes[1]));

  const slices = [
    sorted.slice(0, firstCut),
    sorted.slice(firstCut, secondCut),
    sorted.slice(secondCut),
  ];

  const meta: { id: PriceBandId; label: string }[] = [
    { id: 'value', label: 'Value' },
    { id: 'mid', label: 'Mid' },
    { id: 'premium', label: 'Premium' },
  ];

  const bands: WallBand[] = [];
  for (let i = 0; i < 3; i++) {
    if (slices[i].length) bands.push({ id: meta[i].id, label: meta[i].label, entries: slices[i] });
  }

  return { bands, onRequestOnly };
}

export const fmtINR = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
