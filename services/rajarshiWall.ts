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

import { RAJARSHI_HOTELS, type RajCity, type RajPlan, type RajRoom } from './rajarshiData';
import { quoteStay, hotelsByCity, type MarkupMode } from './rajarshiRates';
import { cheapestQuotable, isQuotable, type WallEntry, type WallRoomRow } from './rateWall';

export const RAJARSHI_PLANS = ['EPAI', 'CPAI', 'MAPAI'] as const;

export interface RajarshiWallInput {
  city: RajCity | 'ALL';
  checkIn: string;             // ISO
  nights: number;
  rooms: number;
  pax: number;                 // total guests across all rooms
  // Extra mattresses REQUESTED on top of whatever a room already fits, total
  // across the booking — separate from the automatic extra-bed charge that
  // kicks in when pax exceeds a room's base occupancy. Spread across rooms
  // the same way pax already is.
  extraMattress?: number;
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

// A room "publishes" a plan when that plan appears under ANY tier's rate
// table for that room — the union of keys across all of room.rates' tier
// objects, not just 'base'. Checked against every hotel in rajarshiData.ts:
// no room ever adds a plan under a peak/festive tier that is absent from
// base (the one asymmetric case in the data runs the other way — Hotel White
// Desert prints EPAI under base but not under its peak tier, so that room's
// EPAI row is quotable on ordinary dates and correctly falls to on-request
// during the blackout window via quoteStay's own on-request handling, not
// because we omitted the row). So the union rule cannot manufacture a plan
// that is priced-on-peak-but-on-request-on-base; it can only do the reverse,
// which is real supplier data, not a modelling bug.
function publishedPlans(room: RajRoom): RajPlan[] {
  const plans = new Set<RajPlan>();
  for (const tierRates of Object.values(room.rates)) {
    for (const p of Object.keys(tierRates) as RajPlan[]) plans.add(p);
  }
  return Array.from(plans);
}

export function buildRajarshiWall(input: RajarshiWallInput): WallEntry[] {
  const byCity = hotelsByCity();
  const hotels = input.city === 'ALL'
    ? Object.values(byCity).flat()
    : (byCity[input.city] || []);
  const paxPerRoom = Math.ceil(input.pax / Math.max(1, input.rooms));
  const manualMattressPerRoom = Math.ceil(Math.max(0, input.extraMattress || 0) / Math.max(1, input.rooms));
  const lastNight = addDays(input.checkIn, Math.max(0, input.nights - 1));

  return hotels.map(hotel => {
    const closedReason = hotel.validity && (input.checkIn < hotel.validity.from || lastNight > hotel.validity.to)
      ? 'Closed for these dates'
      : undefined;

    const rows: WallRoomRow[] = hotel.rooms.flatMap((room, ri) => {
      const cap = baseCapacity(room);
      // Auto shortfall (pax exceeding the room's base capacity) plus whatever
      // extra mattresses the agent asked for on top of that — both are the
      // same physical thing (an extra bed) and share the same per-room cap
      // and the same supplier rate.
      const autoShortfall = Math.max(0, paxPerRoom - cap);
      const extraPerRoom = autoShortfall + manualMattressPerRoom;
      const plans = publishedPlans(room);

      const publishedRows: WallRoomRow[] = plans.map((plan): WallRoomRow => {
        const key = `${hotel.id}::${ri}::${plan}`;
        const hasExtraRate = (hotel.extraPerson?.base?.[plan] ?? 0) > 0;

        const blocked = closedReason
          ? closedReason
          : extraPerRoom > MAX_EXTRA_BEDS_PER_ROOM
            ? (autoShortfall === 0
                ? `Too many extra mattresses requested (max ${MAX_EXTRA_BEDS_PER_ROOM} extra beds per room)`
                : `Too small for ${paxPerRoom} pax`)
            : extraPerRoom > 0 && !hasExtraRate
              ? `No extra bed rate for ${paxPerRoom} pax`
              : undefined;

        if (blocked) {
          return { key, roomName: room.name, planLabel: plan, quotable: false, blockedReason: blocked };
        }

        const q = quoteStay({
          hotel, room, plan, checkIn: input.checkIn, nights: input.nights,
          rooms: input.rooms, extraPersons: extraPerRoom * input.rooms,
          markupMode: input.markupMode, markupValue: input.markupValue,
        });

        // A non-finite or non-positive total means the data is wrong, not that
        // the room is cheap. Block it here rather than let '₹0' or '₹NaN' reach
        // a card the agent reads out to a customer.
        if (q.anyOnRequest || !Number.isFinite(q.sellingPrice) || q.sellingPrice <= 0) {
          return { key, roomName: room.name, planLabel: plan, quotable: false, blockedReason: 'On request' };
        }

        return {
          key, roomName: room.name, planLabel: plan, quotable: true,
          netTotal: q.netCost,
          markupAmount: q.markupAmount,
          sellingTotal: q.sellingPrice,
          sellingPerNight: Math.round(q.sellingPrice / Math.max(1, input.nights)),
        };
      });

      // Derived MAPAI row. Most Bhuj hotels print only a CPAI (bed & breakfast)
      // rate plus a per-meal, per-person meal supplement rather than a MAPAI
      // column. MAP (half-board) is obtainable as CPAI + one meal per guest per
      // night, computed from the supplier's own printed supplement — but only
      // when the room doesn't already publish a real MAPAI rate, which must
      // never be shadowed by a computed one.
      const supplementAmount = hotel.mealSupplement?.amount;
      const cpaiRow = publishedRows.find(r => r.planLabel === 'CPAI');
      const hasMapai = plans.includes('MAPAI');
      const derivedRows: WallRoomRow[] = [];

      if (
        typeof supplementAmount === 'number' && Number.isFinite(supplementAmount) && supplementAmount > 0 &&
        cpaiRow && !hasMapai
      ) {
        const key = `${hotel.id}::${ri}::MAPAI`;

        // A MAP price can be no more certain than the CPAI it is built on: if
        // the CPAI row is blocked (closed, too small, no extra-bed rate, or
        // on-request), the derived row is blocked too, for the same reason.
        if (!isQuotable(cpaiRow)) {
          derivedRows.push({
            key, roomName: room.name, planLabel: 'MAPAI', quotable: false,
            blockedReason: cpaiRow.blockedReason,
          });
        } else {
          const q = quoteStay({
            hotel, room, plan: 'CPAI', checkIn: input.checkIn, nights: input.nights,
            rooms: input.rooms, extraPersons: extraPerRoom * input.rooms,
            markupMode: input.markupMode, markupValue: input.markupValue,
          });

          // Per meal, per person — MAP adds exactly one meal per guest per
          // night, so this uses the total party size (input.pax), not a
          // per-room or per-room-capacity count.
          const supplementNet = supplementAmount * input.pax * input.nights;
          const netTotal = q.netCost + supplementNet;
          // A percent markup is a percentage of the net room rate, so adding
          // the supplement into that base changes the markup amount too. A
          // flat ₹/room-night markup does not depend on the net at all, so it
          // carries over unchanged from the CPAI quote.
          const markupAmount = input.markupMode === 'percent'
            ? Math.round((q.netRoomTotal + supplementNet) * input.markupValue / 100)
            : q.markupAmount;
          const sellingTotal = netTotal + markupAmount;

          derivedRows.push({
            key, roomName: room.name, planLabel: 'MAPAI', quotable: true,
            netTotal,
            markupAmount,
            sellingTotal,
            sellingPerNight: Math.round(sellingTotal / Math.max(1, input.nights)),
            derivedNote: `+₹${supplementAmount}/meal`,
          });
        }
      }

      return [...publishedRows, ...derivedRows];
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

    // The chip answers "why this rate", which for Rajarshi is now just the
    // date tier — a hotel spans several meal plans at once, each printed on
    // its own row, so the chip can no longer name a single plan. Pax is
    // deliberately not mentioned: it drives extra beds, not rate selection,
    // and room capacity varies (a quad room holds 4 with no extra bed), so a
    // hotel-level chip cannot state it accurately. The extra-bed cost is
    // already visible in the money on each row.
    //
    // This carries the supplier's raw wording, including any rupee figure in a
    // tier label. That is correct here: the agent should see it. The client
    // export sanitises it separately, and never prints this field at all.
    return {
      hotelId: hotel.id,
      hotelName: hotel.name,
      starLabel: hotel.descriptor,
      resolutionChip: festiveFlag ? festiveFlag : 'standard dates',
      resolutionOk: true,   // Rajarshi is fully date-driven; nothing is inferred
      inclusions: 'GST included',
      festiveFlag,
      closedReason,
      rows,
      cheapestSelling,
    };
  });
}

// ── Festive jump chips, derived from the sheet's own windows ──────────────
//
// Deduping by the window's `from` date (the obvious rule) does NOT work on this
// data: eight hotels each print their own Diwali start between 05 and 08 Nov,
// so a from-date dedupe yields four chips all reading 'Diwali Date' and the
// agent never reaches Christmas or Uttrayan. Dedupe by FESTIVAL instead —
// first matching token in the label wins — and take the earliest window for
// each. That is the question the chip actually answers: "jump me to Diwali".
const FESTIVALS: { re: RegExp; label: string }[] = [
  { re: /diwali/i, label: 'Diwali' },
  { re: /christmas/i, label: 'Christmas' },
  { re: /new year/i, label: 'New Year' },
  { re: /uttrayan/i, label: 'Uttrayan' },
  { re: /republic/i, label: 'Republic Day' },
  { re: /full moon/i, label: 'Full Moon' },
];

// Which festival a label names is decided by whichever token appears EARLIEST
// in the printed text, not by the order of the table above: 'Christmas Date &
// Dec 2026 Full Moon' is a Christmas window, and 'Uttrayan, Republic Day & Jan
// 2027 Full Moon' is an Uttrayan one.
function festivalOf(label: string): string | null {
  let best: { at: number; label: string } | null = null;
  for (const f of FESTIVALS) {
    const at = label.search(f.re);
    if (at < 0) continue;
    if (!best || at < best.at) best = { at, label: f.label };
  }
  return best ? best.label : null;
}

export function rajarshiJumpChips(): { label: string; date: string }[] {
  const earliest = new Map<string, string>();
  for (const h of RAJARSHI_HOTELS) {
    for (const t of h.tiers) {
      for (const w of t.windows) {
        const fest = festivalOf(w.label || t.label);
        if (!fest) continue;
        const prev = earliest.get(fest);
        if (!prev || w.from < prev) earliest.set(fest, w.from);
      }
    }
  }
  return Array.from(earliest, ([label, date]) => ({ label, date }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(0, 4);
}
