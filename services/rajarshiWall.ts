// ============================================================
// Rajarshi adapter for the Rate Wall.
//
// Turns the wall's controls into priced rows by calling the existing,
// exhaustively verified quoteStay(). No rate maths lives here.
//
// Rajarshi prints occupancy PER ROOM as free text ('Single/Double',
// 'Quad Sharing', '04 Person') rather than as a rate column, so pax drives
// room fit and extra beds here — not column choice. Inland differs, which is
// exactly why each supplier gets its own adapter.
// ============================================================

import { type RajCity, type RajPlan, type RajRoom } from './rajarshiData';
import { quoteStay, hotelsByCity, type MarkupMode } from './rajarshiRates';
import { cheapestQuotable, type WallEntry, type WallRoomRow } from './rateWall';

export interface RajarshiWallInput {
  city: RajCity;
  checkIn: string;             // ISO
  nights: number;
  rooms: number;
  pax: number;                 // total guests across all rooms
  plan: RajPlan;
  markupMode: MarkupMode;
  markupValue: number;
}

// Most rooms print 'Single/Double'; a handful are quad. Anything that names
// four explicitly holds four, everything else holds two.
function baseCapacity(room: RajRoom): number {
  return /quad|04\s*person|4\s*pax/i.test(room.occupancy) ? 4 : 2;
}

const MAX_EXTRA_BEDS_PER_ROOM = 2;

// Local numeric arithmetic only. toISOString() forces UTC and in IST shifts
// the date back a day, which previously made peak-window boundary nights
// resolve as base rate.
function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function buildRajarshiWall(input: RajarshiWallInput): WallEntry[] {
  const hotels = hotelsByCity()[input.city] || [];
  const paxPerRoom = Math.ceil(input.pax / Math.max(1, input.rooms));
  const lastNight = addDays(input.checkIn, Math.max(0, input.nights - 1));

  return hotels.map(hotel => {
    const closedReason = hotel.validity && (input.checkIn < hotel.validity.from || lastNight > hotel.validity.to)
      ? 'Closed for these dates'
      : undefined;

    const rows: WallRoomRow[] = hotel.rooms.map((room, ri) => {
      const key = `${hotel.id}::${ri}`;
      const cap = baseCapacity(room);
      const extraPerRoom = Math.max(0, paxPerRoom - cap);
      const hasExtraRate = (hotel.extraPerson?.base?.[input.plan] ?? 0) > 0;

      const blocked = closedReason
        ? closedReason
        : extraPerRoom > MAX_EXTRA_BEDS_PER_ROOM
          ? `Too small for ${paxPerRoom} pax`
          : extraPerRoom > 0 && !hasExtraRate
            ? `No extra bed rate for ${paxPerRoom} pax`
            : undefined;

      if (blocked) {
        return { key, roomName: room.name, quotable: false, blockedReason: blocked };
      }

      const q = quoteStay({
        hotel, room, plan: input.plan, checkIn: input.checkIn, nights: input.nights,
        rooms: input.rooms, extraPersons: extraPerRoom * input.rooms,
        markupMode: input.markupMode, markupValue: input.markupValue,
      });

      // A non-finite or non-positive total means the data is wrong, not that
      // the room is cheap. Block it here rather than let '₹0' or '₹NaN' reach
      // a card the agent reads out to a customer.
      if (q.anyOnRequest || !Number.isFinite(q.sellingPrice) || q.sellingPrice <= 0) {
        return { key, roomName: room.name, quotable: false, blockedReason: 'On request' };
      }

      return {
        key, roomName: room.name, quotable: true,
        netTotal: q.netCost,
        markupAmount: q.markupAmount,
        sellingTotal: q.sellingPrice,
        sellingPerNight: Math.round(q.sellingPrice / Math.max(1, input.nights)),
      };
    });

    // Festive/blackout is exact here: the sheet prints its own tier labels, so
    // there is nothing to infer.
    //
    // Read the windows directly rather than probing quoteStay with a sample
    // room. resolveNightRate falls back to tierId 'base' when a particular
    // room+plan has no printed peak rate, so a probe would report "no festive
    // dates" for a stay that genuinely falls inside a blackout window, purely
    // because the sampled room happened not to list that tier. The window is a
    // property of the hotel and the dates, not of any one room.
    let festiveFlag: string | undefined;
    if (!closedReason) {
      const labels = new Set<string>();
      for (let n = 0; n < input.nights; n++) {
        const d = addDays(input.checkIn, n);
        for (const t of hotel.tiers) {
          if (t.windows.some(w => d >= w.from && d <= w.to)) labels.add(t.label);
        }
      }
      if (labels.size) festiveFlag = Array.from(labels).join(' · ');
    }

    // Derived by the shared layer, not here — otherwise each supplier adapter
    // re-implements the rule and banding can drift from what the cards render.
    const cheapestSelling = cheapestQuotable(rows);

    // The chip answers "why this rate", which for Rajarshi is the meal plan and
    // the date tier. Pax is deliberately not mentioned: it drives extra beds,
    // not rate selection, and room capacity varies (a quad room holds 4 with no
    // extra bed), so a hotel-level chip cannot state it accurately. The
    // extra-bed cost is already visible in the money on each row.
    //
    // This carries the supplier's raw wording, including any rupee figure in a
    // tier label. That is correct here: the agent should see it. The client
    // export sanitises it separately, and never prints this field at all.
    return {
      hotelId: hotel.id,
      hotelName: hotel.name,
      starLabel: hotel.descriptor,
      resolutionChip: `${input.plan} · ${festiveFlag ? festiveFlag : 'standard dates'}`,
      resolutionOk: true,   // Rajarshi is fully date-driven; nothing is inferred
      inclusions: `${input.plan} · GST included`,
      festiveFlag,
      closedReason,
      rows,
      cheapestSelling,
    };
  });
}
