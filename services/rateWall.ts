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
//
// Non-finite and non-positive room totals are skipped rather than allowed to
// poison the result: Math.min propagates NaN and -Infinity wins outright, so
// one corrupt room would otherwise hide a hotel's perfectly good rooms behind
// "On request".
export function cheapestQuotable(rows: WallRoomRow[]): number | null {
  const priced = rows
    .filter((r): r is QuotableRow => r.quotable)
    .map(r => r.sellingTotal)
    .filter(v => Number.isFinite(v) && v > 0);
  return priced.length ? Math.min(...priced) : null;
}

const SIMILAR_PRICING_MAX_SPREAD = 1.15;

type PricedEntry = WallEntry & { cheapestSelling: number };

// A price must be finite AND positive. Zero is not a cheap room, it is a data
// error — and it would break the proportional spread test below outright,
// since 0 * 1.15 === 0 makes every wall containing one look wide.
const isPriced = (v: number | null | undefined): v is number =>
  v != null && Number.isFinite(v) && v > 0;

// Bands are derived from the results actually on screen, so they adapt per
// city — ₹6,000 is premium in Bhuj and mid in Ahmedabad. Star rating never
// participates: a 5-star hotel lands in 'Mid' when its rate says so.
export function bandHotels(entries: WallEntry[]): BandedWall {
  const quotable = entries.filter((e): e is PricedEntry => isPriced(e.cheapestSelling));
  const onRequestOnly = entries.filter(e => !isPriced(e.cheapestSelling));

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

  // A cut may only fall where the price actually changes. Splitting a group of
  // hotels that share one rate puts identical prices under different labels,
  // which an agent cannot explain on a call.
  const legalCuts: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].cheapestSelling !== sorted[i - 1].cheapestSelling) legalCuts.push(i);
  }

  // Aim for equal-count terciles, remainder to the cheaper groups.
  const n = sorted.length;
  const base = Math.floor(n / 3);
  const rem = n % 3;
  const idealFirst = base + (rem > 0 ? 1 : 0);
  const idealSecond = idealFirst + base + (rem > 1 ? 1 : 0);

  // Snap to the NEAREST legal boundary in either direction. Only moving
  // forward overshoots whenever the legal cut sits behind the ideal, and one
  // band then swallows the whole wall.
  const nearestCut = (ideal: number, taken: number | null): number | null => {
    let best: number | null = null;
    for (const c of legalCuts) {
      if (c === taken) continue;
      if (best === null || Math.abs(c - ideal) < Math.abs(best - ideal)) best = c;
    }
    return best;
  };

  const firstCut = nearestCut(idealFirst, null);
  const secondCut = firstCut === null ? null : nearestCut(idealSecond, firstCut);

  const cuts = [firstCut, secondCut]
    .filter((c): c is number => c !== null)
    .sort((a, b) => a - b);

  const groups: PricedEntry[][] = [];
  let start = 0;
  for (const c of cuts) {
    groups.push(sorted.slice(start, c));
    start = c;
  }
  groups.push(sorted.slice(start));
  const surviving = groups.filter(g => g.length > 0);

  // Label by how many groups actually survived, never by index with empties
  // dropped — that names the priciest group 'Mid', or titles a 50x spread
  // 'Value', which is worse than showing no labels at all.
  const LABELS: Record<number, { id: PriceBandId; label: string }[]> = {
    1: [{ id: 'single', label: '' }],
    2: [{ id: 'value', label: 'Value' }, { id: 'premium', label: 'Premium' }],
    3: [{ id: 'value', label: 'Value' }, { id: 'mid', label: 'Mid' }, { id: 'premium', label: 'Premium' }],
  };
  const meta = LABELS[surviving.length] ?? LABELS[3];

  return {
    bands: surviving.map((entries, i) => ({ id: meta[i].id, label: meta[i].label, entries })),
    onRequestOnly,
  };
}

export const fmtINR = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
