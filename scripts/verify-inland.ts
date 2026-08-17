// Exhaustive permutation check of the Inland resolver: for EVERY hotel, EVERY
// room, EVERY rate column (1 and 2, when present), we call the REAL
// quoteInlandStay() with markup forced to 0% and confirm netRoomTotal exactly
// equals the raw stored rate × nights × rooms, and that on-request flagging
// matches the stored onRequest1/2 exactly. Then a second pass checks the
// extra-person math independently. Any mismatch is a real resolver bug.
import { INLAND_HOTELS } from '../services/inlandData';
import { quoteInlandStay } from '../services/inlandRates';

let total = 0;
const mismatches: string[] = [];
let onRequestChecks = 0, cleanChecks = 0;

for (const hotel of INLAND_HOTELS) {
  for (const room of hotel.rooms) {
    const columns: (1 | 2)[] = [1];
    if (room.axisLabels[1] !== undefined || room.rate2 != null || room.onRequest2) columns.push(2);

    for (const col of columns) {
      total++;
      const rate = col === 1 ? room.rate1 : room.rate2;
      const onReq = col === 1 ? room.onRequest1 : room.onRequest2;

      const result = quoteInlandStay({ hotel, room, column: col, nights: 1, rooms: 1, extraPersons: 0, markupMode: 'percent', markupValue: 0 });

      if (onReq || rate == null) {
        onRequestChecks++;
        if (!result.isOnRequest) mismatches.push(`${hotel.name} / ${room.name} / col${col}: expected ON-REQUEST, engine gave netRoomTotal=${result.netRoomTotal}`);
        continue;
      }
      cleanChecks++;
      if (result.isOnRequest) {
        mismatches.push(`${hotel.name} / ${room.name} / col${col}: engine says ON-REQUEST, expected rate=${rate}`);
        continue;
      }
      if (result.baseRate !== rate) mismatches.push(`${hotel.name} / ${room.name} / col${col}: baseRate=${result.baseRate}, expected ${rate}`);
      if (result.netRoomTotal !== rate) mismatches.push(`${hotel.name} / ${room.name} / col${col}: netRoomTotal=${result.netRoomTotal}, expected ${rate} (1 night x 1 room)`);

      // multi-night/multi-room multiplication check
      const multi = quoteInlandStay({ hotel, room, column: col, nights: 3, rooms: 2, extraPersons: 0, markupMode: 'percent', markupValue: 0 });
      const expectedMulti = rate * 3 * 2;
      if (multi.netRoomTotal !== expectedMulti) mismatches.push(`${hotel.name} / ${room.name} / col${col}: 3N x 2 rooms netRoomTotal=${multi.netRoomTotal}, expected ${expectedMulti}`);
    }

    // extra person math, when a numeric supplement exists
    if (typeof room.childAdult === 'number') {
      total++;
      const withExtra = quoteInlandStay({ hotel, room, column: 1, nights: 2, rooms: 1, extraPersons: 1, markupMode: 'percent', markupValue: 0 });
      const withoutExtra = quoteInlandStay({ hotel, room, column: 1, nights: 2, rooms: 1, extraPersons: 0, markupMode: 'percent', markupValue: 0 });
      if (!withoutExtra.isOnRequest) {
        const diff = withExtra.netCost - withoutExtra.netCost;
        const expected = room.childAdult * 1 * 2; // rate x persons x nights
        if (diff !== expected) mismatches.push(`${hotel.name} / ${room.name} / extraPerson: netCost delta=${diff}, expected ${expected}`);
      }
    }
  }
}

// markup math, sampled on one real room
const sampleHotel = INLAND_HOTELS.find(h => h.rooms.some(r => !r.onRequest1 && r.rate1 != null));
if (sampleHotel) {
  const room = sampleHotel.rooms.find(r => !r.onRequest1 && r.rate1 != null)!;
  total++;
  const pct = quoteInlandStay({ hotel: sampleHotel, room, column: 1, nights: 1, rooms: 1, extraPersons: 0, markupMode: 'percent', markupValue: 20 });
  const expectedMarkup = Math.round(room.rate1! * 0.20);
  if (pct.markupAmount !== expectedMarkup) mismatches.push(`markup% sample (${sampleHotel.name}): markupAmount=${pct.markupAmount}, expected ${expectedMarkup}`);
  if (pct.sellingPrice !== pct.netCost + expectedMarkup) mismatches.push(`markup% sample: sellingPrice inconsistent with netCost+markup`);

  total++;
  const flat = quoteInlandStay({ hotel: sampleHotel, room, column: 1, nights: 2, rooms: 3, extraPersons: 0, markupMode: 'flat', markupValue: 500 });
  const expectedFlatMarkup = 500 * 2 * 3;
  if (flat.markupAmount !== expectedFlatMarkup) mismatches.push(`markup-flat sample: markupAmount=${flat.markupAmount}, expected ${expectedFlatMarkup}`);
}

console.log(`Hotels: ${INLAND_HOTELS.length}`);
console.log(`Total checks: ${total} (${cleanChecks} clean-rate checks, ${onRequestChecks} on-request checks)`);
console.log(`Mismatches: ${mismatches.length}`);
if (mismatches.length) {
  console.log('\n--- MISMATCHES ---');
  mismatches.slice(0, 60).forEach(m => console.log('  ' + m));
  if (mismatches.length > 60) console.log(`  … and ${mismatches.length - 60} more`);
  process.exitCode = 1;
} else {
  console.log('\nALL CHECKS MATCH — Inland resolver verified against raw data with zero discrepancies.');
}
