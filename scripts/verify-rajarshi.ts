// Exhaustive permutation check of the Rajarshi resolver: for EVERY hotel,
// EVERY room, EVERY meal plan the room offers, EVERY tier (base + each
// peak/blackout window), we call the REAL quoteStay() function with markup
// forced to 0% so sellingPrice === netCost === netRoomTotal exactly, then
// independently re-derive the expected number straight from the raw data
// object (mirroring the resolver's own fallback rule) and assert equality.
// Any mismatch is a genuine bug in the resolver, not a transcription issue.
import { RAJARSHI_HOTELS } from '../services/rajarshiData';
import { quoteStay } from '../services/rajarshiRates';

let total = 0, mismatches: string[] = [], onRequestChecks = 0;

for (const hotel of RAJARSHI_HOTELS) {
  for (const room of hotel.rooms) {
    const plans = new Set<string>();
    Object.values(room.rates).forEach(tierRates => Object.keys(tierRates || {}).forEach(p => plans.add(p)));

    for (const plan of plans) {
      // one check for base (a date outside every tier window), plus one check per tier
      const testDates: { label: string; date: string }[] = [{ label: 'base', date: '2026-11-01' }];
      for (const tier of hotel.tiers) {
        const w = tier.windows[0];
        if (w) testDates.push({ label: tier.id, date: w.from });
      }
      // guard: '2026-11-01' must not accidentally fall inside a tier window
      const baseDateInsideTier = hotel.tiers.some(t => t.windows.some(w => '2026-11-01' >= w.from && '2026-11-01' <= w.to));
      if (baseDateInsideTier) testDates[0] = { label: 'base', date: '2027-05-01' };

      for (const { label, date } of testDates) {
        total++;
        const result = quoteStay({ hotel, room, plan: plan as any, checkIn: date, nights: 1, rooms: 1, extraPersons: 0, markupMode: 'percent', markupValue: 0 });
        const night = result.perNight[0];

        // Independently re-derive expected value from raw data (mirrors resolver's fallback rule)
        const tier = hotel.tiers.find(t => t.windows.some(w => date >= w.from && date <= w.to));
        let expected: number | undefined;
        let expectedOnRequest = false;
        if (!tier) {
          expected = room.rates.base?.[plan as any];
        } else if (tier.mode === 'surcharge') {
          const base = room.rates.base?.[plan as any];
          expected = base != null ? base + (tier.surcharge || 0) : undefined;
        } else {
          expected = room.rates[tier.id]?.[plan as any] ?? room.rates.base?.[plan as any];
        }
        if (expected == null) expectedOnRequest = true;

        if (expectedOnRequest) {
          onRequestChecks++;
          if (!night.isOnRequest) mismatches.push(`${hotel.name} / ${room.name} / ${plan} / ${label}: expected ON-REQUEST but got rate=${night.rate}`);
          continue;
        }
        if (night.isOnRequest) {
          mismatches.push(`${hotel.name} / ${room.name} / ${plan} / ${label}: got ON-REQUEST but expected rate=${expected}`);
          continue;
        }
        if (night.rate !== expected) {
          mismatches.push(`${hotel.name} / ${room.name} / ${plan} / ${label}: engine returned ${night.rate}, expected ${expected} (tierId used=${night.tierId})`);
        }
        // also cross-check net cost math for this single night/room/no-markup call
        if (result.netRoomTotal !== expected) {
          mismatches.push(`${hotel.name} / ${room.name} / ${plan} / ${label}: netRoomTotal=${result.netRoomTotal} != expected room rate ${expected}`);
        }
      }
    }

    // extra person charge sanity: if hotel.extraPerson.base[plan] exists, check quoteStay with 1 extra person adds exactly that amount
    for (const plan of plans) {
      const extraRate = hotel.extraPerson?.base?.[plan as any];
      if (extraRate == null) continue;
      total++;
      const withExtra = quoteStay({ hotel, room, plan: plan as any, checkIn: '2027-05-01', nights: 1, rooms: 1, extraPersons: 1, markupMode: 'percent', markupValue: 0 });
      const withoutExtra = quoteStay({ hotel, room, plan: plan as any, checkIn: '2027-05-01', nights: 1, rooms: 1, extraPersons: 0, markupMode: 'percent', markupValue: 0 });
      const diff = withExtra.netCost - withoutExtra.netCost;
      if (diff !== extraRate) {
        mismatches.push(`${hotel.name} / ${room.name} / ${plan} / extraPerson: netCost delta=${diff}, expected ${extraRate}`);
      }
    }
  }
}

console.log(`Hotels: ${RAJARSHI_HOTELS.length}`);
console.log(`Total permutations checked: ${total} (of which ${onRequestChecks} expected-on-request)`);
console.log(`Mismatches: ${mismatches.length}`);
if (mismatches.length) {
  console.log('\n--- MISMATCHES ---');
  mismatches.forEach(m => console.log('  ' + m));
  process.exitCode = 1;
} else {
  console.log('\nALL PERMUTATIONS MATCH — resolver logic verified against raw data with zero discrepancies.');
}
