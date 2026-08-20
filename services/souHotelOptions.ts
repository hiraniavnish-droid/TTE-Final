// ============================================================
// Statue of Unity Hotels — comparison engine.
//
// Same job as rannOptions.ts, for Kevadiya hotels instead of Rann Utsav tent
// categories: an agent picks several hotels and several night counts, this
// module fills in every cell by calling buildInlandWall() — the same
// resolver the main Rate Wall uses — so no room/plan pricing logic is
// duplicated or able to drift from the real engine.
//
// Grid granularity is per HOTEL, not per room/plan, but WHICH plan a cell
// resolves to is steered by `preferredPlan` (mirrors RateWallCard's global
// CPAI/MAPAI quick-pick) rather than always taking the cheapest row —
// otherwise adjacent cells could silently mix CP and MAP pricing, which is
// not a comparison an agent can read at a glance.
// ============================================================

import { buildInlandWall } from './inlandWall';
import { isQuotable, type WallEntry, type WallRoomRow, type QuotableRow } from './rateWall';
import type { MarkupMode } from './inlandRates';

export const SOU_CITY = 'KEVADIYA (Ekta Nagar)';

export type SouOptionNights = 1 | 2 | 3;

export interface SouHotelOptionsInput {
  checkIn: string; // ISO yyyy-mm-dd
  hotelIds: string[];
  durations: SouOptionNights[];
  rooms: number;
  pax: number;
  extraMattress?: number;
  markupMode: MarkupMode;
  markupValue: number;
  /** e.g. 'CPAI' / 'MAPAI' — same loose-match + MAP-ness fallback as
   *  RateWallCard's pickDefaultRow, so it also reaches hotels whose MAP row
   *  is a derived label ('WEEKDAYS (MAP)') rather than the literal text. */
  preferredPlan?: string;
}

export interface SouOptionCell {
  hotelId: string;
  hotelName: string;
  starLabel?: string;
  nights: SouOptionNights;
  sellingTotal: number;
  netTotal: number;
  markupAmount: number;
  roomName: string;
  planLabel?: string;
  resolutionOk: boolean;
}

export interface SouHotelOptionsResult {
  cells: SouOptionCell[];
  /** hotelId -> reason nothing was quotable for at least one duration. */
  unquotable: Map<string, string>;
}

const uniq = <T,>(xs: T[]): T[] => {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const x of xs) if (!seen.has(x)) { seen.add(x); out.push(x); }
  return out;
};

// Loose match so 'CPAI', 'CP', 'cpai (breakfast)' etc. all count as the same
// preference — identical normalisation to RateWallCard.tsx's `norm`.
const norm = (s: string | undefined | null) => (s || '').toLowerCase().replace(/[^a-z]/g, '');

/** Same selection order as RateWallCard.tsx's pickDefaultRow: exact plan
 *  match, then a loose prefix match, then MAP-ness alone (for derived MAP
 *  rows whose label never contains 'mapai' literally), then just the
 *  cheapest quotable row. Kept in sync deliberately — a change to one should
 *  usually be mirrored in the other. */
function pickRow(rows: WallRoomRow[], preferredPlan: string | undefined): QuotableRow | null {
  const quotable = rows.filter(isQuotable);
  if (quotable.length === 0) return null;
  if (preferredPlan) {
    const pref = norm(preferredPlan);
    const exact = quotable.find(r => norm(r.planLabel) === pref);
    if (exact) return exact;
    const starts = quotable.find(r => norm(r.planLabel).startsWith(pref) || pref.startsWith(norm(r.planLabel)));
    if (starts) return starts;
    const prefersMap = /map/.test(pref);
    const byMapness = quotable.find(r => /\(map\)$/i.test(r.planLabel || '') === prefersMap);
    if (byMapness) return byMapness;
  }
  return quotable.reduce((min, r) => (r.sellingTotal < min.sellingTotal ? r : min));
}

export function buildSouHotelOptions(input: SouHotelOptionsInput): SouHotelOptionsResult {
  const hotelIds = uniq(input.hotelIds);
  const durations = uniq(input.durations);
  const cells: SouOptionCell[] = [];
  const unquotable = new Map<string, string>();

  for (const nights of durations) {
    const entries: WallEntry[] = buildInlandWall({
      city: SOU_CITY, checkIn: input.checkIn, nights,
      rooms: input.rooms, pax: input.pax, extraMattress: input.extraMattress,
      markupMode: input.markupMode, markupValue: input.markupValue,
    });
    const byId = new Map(entries.map(e => [e.hotelId, e]));

    for (const hotelId of hotelIds) {
      const entry = byId.get(hotelId);
      if (!entry) continue;
      const best = pickRow(entry.rows, input.preferredPlan);
      if (!best) {
        const blocked = entry.rows.find(r => !isQuotable(r));
        unquotable.set(hotelId, entry.closedReason || (blocked && !isQuotable(blocked) ? blocked.blockedReason : undefined) || 'On request for these dates');
        continue;
      }
      cells.push({
        hotelId, hotelName: entry.hotelName, starLabel: entry.starLabel, nights,
        sellingTotal: best.sellingTotal, netTotal: best.netTotal, markupAmount: best.markupAmount,
        roomName: best.roomName, planLabel: best.planLabel,
        resolutionOk: entry.resolutionOk,
      });
    }
  }

  return { cells, unquotable };
}

/** Every Kevadiya hotel name/id, for the hotel picker — pulled from a single
 *  neutral resolver call so the picker can never list a hotel the engine
 *  itself does not know about. */
export function listSouHotels(): { hotelId: string; hotelName: string; starLabel?: string }[] {
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const entries = buildInlandWall({
    city: SOU_CITY, checkIn: iso, nights: 1, rooms: 1, pax: 2,
    markupMode: 'percent', markupValue: 0,
  });
  return entries
    .map(e => ({ hotelId: e.hotelId, hotelName: e.hotelName, starLabel: e.starLabel }))
    .sort((a, b) => a.hotelName.localeCompare(b.hotelName));
}
