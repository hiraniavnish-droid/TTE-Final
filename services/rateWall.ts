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
  planLabel?: string;          // e.g. 'CPAI' — set when a row represents one meal plan of a room
  // Set when this row's price was computed by us (e.g. CPAI + a printed meal
  // supplement) rather than printed by the supplier as its own rate. Internal
  // provenance for the agent only — formatClientExport must never print it.
  derivedNote?: string;
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

// The repo's tsconfig does not enable strict, and without strictNullChecks
// TypeScript will not narrow a boolean-literal discriminant — `if (!row.quotable)`
// leaves the type as the full union. A user-defined type predicate narrows
// correctly regardless, so consumers use these rather than testing the field.
// Without them the tempting workaround is to give BlockedRow dummy zero money
// fields, which is exactly the footgun the union exists to remove.
export const isQuotable = (r: WallRoomRow): r is QuotableRow => r.quotable;
export const isBlocked = (r: WallRoomRow): r is BlockedRow => !r.quotable;

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
    .filter(isQuotable)
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

export interface ExportSelection {
  entry: WallEntry;
  row: QuotableRow;
}

export interface ExportContext {
  supplierName: string;        // deliberately NOT printed — for callers' logging only
  cityLabel: string;
  clientName: string;
  checkIn: string;             // ISO
  checkOut: string;            // ISO
  nights: number;
  rooms: number;
  pax: number;
  // mealLabel and inclusions must be caller-normalised values — a meal-plan
  // code, or a short phrase built from one. Never raw supplier text.
  //
  // Sanitising here collapses newlines and strips currency-marked amounts, but
  // it deliberately does NOT redact bare numbers: 'GST 18%' and 'CLUB ROOM
  // ( 302 Sq. Ft)' are legitimate, and no reliable rule separates those from a
  // stray rate. The safety property lives at the call site, which builds these
  // from a meal-plan enum, not at this boundary.
  //
  // mealLabel is optional: a selection can now mix rows from several meal
  // plans (each row carries its own planLabel, printed per line), so there is
  // no single global plan left to state on the guest/rooms summary line. When
  // absent it is simply omitted from that line.
  mealLabel?: string;
  inclusions: string;
}

// Local numeric arithmetic only — never toISOString(), which forces UTC and in
// IST renders the day before the one the agent selected.
const fmtDateOut = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Everything interpolated into an export is transcribed from supplier PDFs and
// spreadsheets, so it is not trusted. Newlines would inject their own lines
// into the message (real supplier fields contain embedded newlines carrying
// rupee figures), and a stray WhatsApp markup character breaks the formatting
// of everything after it — 'RE:GEN:TA INN -3*' is a real hotel name.
const sanitizeLine = (s: string) =>
  s.replace(/[\r\n\t]+/g, ' ').replace(/[*_]/g, '').replace(/\s{2,}/g, ' ').trim();

const AMOUNT_RE = /(?:₹|\bRs\.?)\s?[\d,]+/i;

// A rupee figure in a descriptive field is never legitimate in an export: the
// only prices a customer may see are the ones we computed. Verified against
// the rate data — no real room name contains a currency marker, and the three
// that carry numbers are square footage ('CLUB ROOM ( 302 Sq. Ft)'), which
// AMOUNT_RE ignores because it requires a ₹/Rs prefix.
//
// The whole field is replaced rather than surgically edited. Cutting the amount
// out of supplier prose can leave a sentence that reads as a different offer —
// 'Black-Out Date Rate (Additional  on room rate)' is worse than saying nothing.
const safeText = (s: string | undefined, fallback: string): string => {
  const clean = sanitizeLine(s ?? '');
  if (!clean) return '';
  return AMOUNT_RE.test(clean) ? fallback : clean;
};

// The hotel identity must survive even a suspect field, so amount tokens are
// stripped rather than triggering a fallback that would hide which hotel this is.
const safeHotelName = (s: string) =>
  sanitizeLine(s).replace(new RegExp(AMOUNT_RE.source, 'gi'), '').replace(/\s{2,}/g, ' ').trim();

// Everything the client receives. Never contains net cost, markup, margin, the
// supplier's name, or band labels — the on-screen grouping is an internal
// scanning aid, and calling a hotel 'Value' to a customer editorialises about a
// property the agent may be actively recommending. Price order carries the same
// ranking without the judgement.
export function formatClientExport(selections: ExportSelection[], ctx: ExportContext): string {
  // A non-finite or non-positive total is a data fault, not a price. Left in,
  // it makes the comparator below return NaN — which V8 treats as "leave as
  // is", silently putting the dearest hotel first in a cheapest-first quote —
  // and prints '₹NaN' to the customer.
  const priceable = selections.filter(
    s => Number.isFinite(s.row.sellingTotal) && s.row.sellingTotal > 0
  );
  if (!priceable.length) return '';

  const ordered = [...priceable].sort((a, b) => a.row.sellingTotal - b.row.sellingTotal);

  const L: string[] = ['*THE TOURISM EXPERTS*', `*${sanitizeLine(ctx.cityLabel)} — Hotel Options*`, ''];
  if (ctx.clientName.trim()) L.push(`Guest: ${sanitizeLine(ctx.clientName)}`);
  L.push(`${fmtDateOut(ctx.checkIn)} to ${fmtDateOut(ctx.checkOut)} · ${ctx.nights}N/${ctx.nights + 1}D`);
  const meal = safeText(ctx.mealLabel, '');
  L.push([`${ctx.pax} guest(s)`, `${ctx.rooms} room(s)`, meal].filter(Boolean).join(' · '));
  L.push('');

  ordered.forEach((s, i) => {
    L.push(`*${i + 1}. ${safeHotelName(s.entry.hotelName)}*`);
    const roomWithPlan = s.row.roomName + (s.row.planLabel ? ' · ' + s.row.planLabel : '');
    const sub = [safeText(roomWithPlan, 'Room'), safeText(s.entry.starLabel, '')].filter(Boolean).join(' · ');
    if (sub) L.push(sub);
    // 'per night' is a rate claim. On a multi-night stay the nights can carry
    // different tier rates, so this figure is an average no single night costs
    // — label it as one. On a one-night stay it just repeats the total.
    L.push(ctx.nights > 1
      ? `${fmtINR(s.row.sellingTotal)} total · ${fmtINR(s.row.sellingPerNight)} avg/night`
      : `${fmtINR(s.row.sellingTotal)} total`);
    if (s.entry.festiveFlag) L.push(`_${safeText(s.entry.festiveFlag, 'Peak / festive dates')}_`);
    L.push('');
  });

  const inclusions = safeText(ctx.inclusions, '');
  if (inclusions) L.push(inclusions);
  L.push('_Rates as quoted. Subject to availability at time of booking._');
  L.push('The Tourism Experts');
  return L.join('\n');
}
