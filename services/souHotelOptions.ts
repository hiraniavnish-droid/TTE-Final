// ============================================================
// Statue of Unity Hotels — comparison engine.
//
// Same job as rannOptions.ts, for Kevadiya hotels instead of Rann Utsav tent
// categories: an agent picks several hotels and several night counts, this
// module fills in every cell by calling buildInlandWall() — the same
// resolver the main Rate Wall uses — so no room/plan pricing logic is
// duplicated or able to drift from the real engine.
//
// Grid granularity is per HOTEL, not per room/plan: buildInlandWall() already
// picks the cheapest quotable row per hotel via cheapestSelling, which is the
// right level for a quick multi-hotel comparison to share with a client. The
// hotel's own Rate Wall card is still there for a room-by-room look.
// ============================================================

import { buildInlandWall } from './inlandWall';
import { isQuotable, type WallEntry, type QuotableRow } from './rateWall';
import type { MarkupMode } from './inlandRates';

export const SOU_CITY = 'KEVADIYA (Ekta Nagar)';

export type SouOptionNights = 1 | 2 | 3;

export interface SouHotelOptionsInput {
  checkIn: string; // ISO yyyy-mm-dd
  hotelIds: string[];
  durations: SouOptionNights[];
  rooms: number;
  pax: number;
  markupMode: MarkupMode;
  markupValue: number;
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

export function buildSouHotelOptions(input: SouHotelOptionsInput): SouHotelOptionsResult {
  const hotelIds = uniq(input.hotelIds);
  const durations = uniq(input.durations);
  const cells: SouOptionCell[] = [];
  const unquotable = new Map<string, string>();

  for (const nights of durations) {
    const entries: WallEntry[] = buildInlandWall({
      city: SOU_CITY, checkIn: input.checkIn, nights,
      rooms: input.rooms, pax: input.pax,
      markupMode: input.markupMode, markupValue: input.markupValue,
    });
    const byId = new Map(entries.map(e => [e.hotelId, e]));

    for (const hotelId of hotelIds) {
      const entry = byId.get(hotelId);
      if (!entry) continue;
      const best = entry.rows.filter(isQuotable).reduce<QuotableRow | null>(
        (min, r) => (!min || r.sellingTotal < min.sellingTotal ? r : min), null,
      );
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
