// ============================================================
// Supplier-agnostic layer for the Rate Wall.
//
// Knows nothing about Rajarshi or Inland. Each supplier ships an adapter
// that produces WallEntry[]; everything below operates on that shape only.
// ============================================================

export type PriceBandId = 'value' | 'mid' | 'premium' | 'single';

export interface WallRoomRow {
  key: string;                 // stable and unique, e.g. `${hotelId}::${roomIdx}`
  roomName: string;
  quotable: boolean;           // false => never priced, never tickable
  blockedReason?: string;      // 'On request' | 'Too small for 4 pax' | ...
  netTotal: number;
  markupAmount: number;
  sellingTotal: number;
  sellingPerNight: number;
}

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

// Bands are derived from the results actually on screen, so they adapt per
// city — ₹6,000 is premium in Bhuj and mid in Ahmedabad. Star rating never
// participates: a 5-star hotel lands in 'Mid' when its rate says so.
export function bandHotels(entries: WallEntry[]): BandedWall {
  const quotable = entries.filter(e => e.cheapestSelling != null);
  const onRequestOnly = entries.filter(e => e.cheapestSelling == null);

  if (quotable.length === 0) return { bands: [], onRequestOnly };

  const sorted = [...quotable].sort((a, b) => (a.cheapestSelling as number) - (b.cheapestSelling as number));

  if (sorted.length < 3) {
    return { bands: [{ id: 'single', label: '', entries: sorted }], onRequestOnly };
  }

  const min = sorted[0].cheapestSelling as number;
  const max = sorted[sorted.length - 1].cheapestSelling as number;
  // Forcing three bands over a narrow spread implies a difference that isn't
  // there, so collapse instead.
  if (max <= min * 1.15) {
    return { bands: [{ id: 'single', label: 'Similar pricing', entries: sorted }], onRequestOnly };
  }

  // Equal-count terciles guarantee no empty band; the remainder goes to the
  // cheaper groups so 'Premium' stays the most selective.
  const n = sorted.length;
  const base = Math.floor(n / 3);
  const rem = n % 3;
  const sizes = [base + (rem > 0 ? 1 : 0), base + (rem > 1 ? 1 : 0), base];

  const bands: WallBand[] = [];
  const meta: { id: PriceBandId; label: string }[] = [
    { id: 'value', label: 'Value' },
    { id: 'mid', label: 'Mid' },
    { id: 'premium', label: 'Premium' },
  ];
  let cursor = 0;
  for (let i = 0; i < 3; i++) {
    const slice = sorted.slice(cursor, cursor + sizes[i]);
    cursor += sizes[i];
    if (slice.length) bands.push({ id: meta[i].id, label: meta[i].label, entries: slice });
  }

  return { bands, onRequestOnly };
}

export const fmtINR = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
