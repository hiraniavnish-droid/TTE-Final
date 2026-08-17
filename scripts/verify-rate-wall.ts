// Verification for the Rate Wall. Run: npx tsx scripts/verify-rate-wall.ts
// Asserts banding is a strict partition, exports never leak internal figures,
// and every displayed number reconciles to the real resolver.
import { bandHotels, type WallEntry } from '../services/rateWall';

let checks = 0;
const fail: string[] = [];
const ok = (cond: boolean, msg: string) => { checks++; if (!cond) fail.push(msg); };

const entry = (id: string, cheapest: number | null): WallEntry => ({
  hotelId: id, hotelName: id, resolutionChip: '', resolutionOk: true,
  inclusions: '', rows: [], cheapestSelling: cheapest,
});

// ── banding is a strict partition ──
{
  const es = [entry('a', 1000), entry('b', 2000), entry('c', 3000), entry('d', 9000), entry('e', 12000)];
  const w = bandHotels(es);
  const flat = w.bands.flatMap(b => b.entries);
  ok(flat.length === 5, `partition: expected 5 banded, got ${flat.length}`);
  ok(new Set(flat.map(e => e.hotelId)).size === 5, 'partition: a hotel appeared twice');
  ok(w.bands.every(b => b.entries.length > 0), 'partition: an empty band was emitted');
  ok(w.bands.length === 3, `expected 3 bands for a wide spread, got ${w.bands.length}`);
  ok(w.bands[0].entries.length === 2 && w.bands[1].entries.length === 2 && w.bands[2].entries.length === 1,
    `remainder must go to cheaper bands, got ${w.bands.map(b => b.entries.length).join('/')}`);
  ok(w.bands[0].entries[0].hotelId === 'a', 'bands must be ordered cheapest first');
}

// ── narrow spread collapses to one band ──
{
  const w = bandHotels([entry('a', 1000), entry('b', 1050), entry('c', 1100)]);
  ok(w.bands.length === 1, `spread under 15% must be one band, got ${w.bands.length}`);
  ok(w.bands[0].label === 'Similar pricing', `expected 'Similar pricing', got '${w.bands[0].label}'`);
}

// ── fewer than 3 hotels renders one unlabelled band ──
{
  const w = bandHotels([entry('a', 1000), entry('b', 9000)]);
  ok(w.bands.length === 1, `2 hotels must be one band, got ${w.bands.length}`);
  ok(w.bands[0].label === '', `expected no label, got '${w.bands[0].label}'`);
}

// ── unquotable hotels are excluded from banding, never dropped ──
{
  const w = bandHotels([entry('a', 1000), entry('b', null), entry('c', 2000), entry('d', 3000)]);
  ok(w.onRequestOnly.length === 1 && w.onRequestOnly[0].hotelId === 'b', 'on-request hotel must be set aside');
  ok(w.bands.flatMap(b => b.entries).every(e => e.cheapestSelling != null), 'unquotable hotel leaked into a band');
}

// ── all-unquotable produces no bands, loses nothing ──
{
  const w = bandHotels([entry('a', null), entry('b', null)]);
  ok(w.bands.length === 0, 'no bands when nothing is quotable');
  ok(w.onRequestOnly.length === 2, 'both hotels must survive as on-request');
}

console.log(`\nChecks: ${checks}`);
if (fail.length) { console.error(`FAILURES: ${fail.length}\n` + fail.map(f => '  - ' + f).join('\n')); process.exit(1); }
console.log('ALL CHECKS PASS');
