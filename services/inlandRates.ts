// ============================================================
// Rate resolver for Inland Tourways (Gujarat-wide B2B hotel rates).
//
// Unlike Rajarshi/Rann/SOU, this sheet has NO consistent, machine-safe axis
// meaning — the same two rate columns mean weekday/weekend in one hotel,
// single/double in another, two meal plans in a third, and two half-year
// seasons in a fourth (50 distinct header-label spellings were found across
// the source). Auto-resolving which column applies from a date would risk
// silently picking the wrong number. So this resolver does NOT infer a
// column from the check-in date — it always requires the agent to pick a
// column explicitly, shown with the sheet's own printed label
// (axisLabels[0]/[1]) rather than a guessed universal meaning. The one
// exception is season (H1/H2), where we compute a SUGGESTED default from the
// check-in month but the agent can still override it.
//
// GST: the sheet states "GST Included" as an explicit global note — see
// INLAND_SUPPLIER.gstIncluded. Markup model matches Rajarshi: TTE marks up a
// net rate (percent or flat ₹/room-night), not a rack-rate commission.
// ============================================================

import { INLAND_HOTELS, type InlandHotel, type InlandRoom, type InlandHalfSeason } from './inlandData';

export type MarkupMode = 'percent' | 'flat';
export type RateColumn = 1 | 2;

export interface InlandQuoteInput {
  hotel: InlandHotel;
  room: InlandRoom;
  column: RateColumn;   // which of the room's two rate columns to charge
  nights: number;
  rooms: number;
  extraPersons: number;
  markupMode: MarkupMode;
  markupValue: number;
}

export interface InlandQuoteResult {
  columnLabel: string | undefined;
  isOnRequest: boolean;
  rawText?: string;
  baseRate: number;        // per room per night, before markup
  netRoomTotal: number;    // baseRate × nights × rooms
  extraPersonTotal: number;
  netCost: number;         // netRoomTotal + extraPersonTotal
  markupAmount: number;
  sellingPrice: number;    // netCost + markupAmount
}

export function quoteInlandStay(i: InlandQuoteInput): InlandQuoteResult {
  const rate = i.column === 1 ? i.room.rate1 : i.room.rate2;
  const onRequest = i.column === 1 ? i.room.onRequest1 : i.room.onRequest2;
  const rawText = i.column === 1 ? i.room.raw1 : i.room.raw2;
  const columnLabel = i.room.axisLabels[i.column - 1];

  if (onRequest || rate == null) {
    return { columnLabel, isOnRequest: true, rawText, baseRate: 0, netRoomTotal: 0, extraPersonTotal: 0, netCost: 0, markupAmount: 0, sellingPrice: 0 };
  }

  const netRoomTotal = rate * i.nights * i.rooms;
  const extraRate = typeof i.room.childAdult === 'number' ? i.room.childAdult : 0;
  const extraPersonTotal = i.extraPersons * extraRate * i.nights;
  const netCost = netRoomTotal + extraPersonTotal;
  const markupAmount = i.markupMode === 'percent'
    ? Math.round(netRoomTotal * i.markupValue / 100)
    : Math.round(i.markupValue * i.nights * i.rooms);
  const sellingPrice = netCost + markupAmount;

  return { columnLabel, isOnRequest: false, baseRate: rate, netRoomTotal, extraPersonTotal, netCost, markupAmount, sellingPrice };
}

// Suggested (not forced) season default from the check-in month — Apr-Sep -> H1, Oct-Mar -> H2.
export function suggestSeason(checkInISO: string): InlandHalfSeason {
  const month = Number(checkInISO.slice(5, 7));
  return (month >= 4 && month <= 9) ? 'H1' : 'H2';
}

export function roomHasSeasons(room: InlandRoom): boolean {
  return room.season != null;
}

export function hotelsByCity(): Record<string, InlandHotel[]> {
  const out: Record<string, InlandHotel[]> = {};
  for (const h of INLAND_HOTELS) (out[h.city] ||= []).push(h);
  return out;
}

export const fmtINR = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
