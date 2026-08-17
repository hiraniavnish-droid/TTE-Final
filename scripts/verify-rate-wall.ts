// Verification for the Rate Wall. Run: npx tsx scripts/verify-rate-wall.ts
// Covers price banding: strict partition, tie handling, spread collapse, and
// exclusion of anything that cannot be priced. Later tasks extend this file.
import { bandHotels, cheapestQuotable, type WallEntry, type WallRoomRow } from '../services/rateWall';

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
  ok(w.bands[0].id === 'similar', `expected id 'similar', got '${w.bands[0].id}'`);
}

// ── fewer than 3 hotels renders one unlabelled band ──
{
  const w = bandHotels([entry('a', 1000), entry('b', 9000)]);
  ok(w.bands.length === 1, `2 hotels must be one band, got ${w.bands.length}`);
  ok(w.bands[0].label === '', `expected no label, got '${w.bands[0].label}'`);
  ok(w.bands[0].id === 'single', `expected id 'single', got '${w.bands[0].id}'`);
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

// ── a band boundary must never split hotels sharing one price ──
{
  const w = bandHotels([entry('a', 1000), entry('b', 1000), entry('c', 1000), entry('d', 1000), entry('e', 5000)]);
  const flat = w.bands.flatMap(b => b.entries);
  ok(flat.length === 5, `tie: expected all 5 banded, got ${flat.length}`);
  ok(w.bands.every(b => b.entries.length > 0), 'tie: an empty band was emitted');
  for (const b of w.bands) {
    const prices = b.entries.map(e => e.cheapestSelling);
    ok(new Set(prices).size === prices.length || prices.every(p => p === prices[0]),
      'tie: a band mixes a tie group with another price');
  }
  const bandOf = (id: string) => w.bands.findIndex(b => b.entries.some(e => e.hotelId === id));
  ok(bandOf('a') === bandOf('b') && bandOf('b') === bandOf('c') && bandOf('c') === bandOf('d'),
    'tie: equally priced hotels were split across bands');
}

// ── the spread threshold is inclusive at exactly 15% ──
{
  const w = bandHotels([entry('a', 1000), entry('b', 1075), entry('c', 1150)]);
  ok(w.bands.length === 1 && w.bands[0].id === 'similar',
    `exactly 15% must collapse, got ${w.bands.length} band(s) id '${w.bands[0]?.id}'`);
}

// ── three distinct prices split one apiece ──
{
  const w = bandHotels([entry('a', 1000), entry('b', 5000), entry('c', 9000)]);
  ok(w.bands.length === 3, `expected 3 bands, got ${w.bands.length}`);
  ok(w.bands.every(b => b.entries.length === 1), `expected 1/1/1, got ${w.bands.map(b => b.entries.length).join('/')}`);
}

// ── a malformed price degrades to On request, never renders as NaN ──
{
  const w = bandHotels([entry('a', 1000), entry('b', NaN), entry('c', 5000), entry('d', 9000)]);
  ok(w.onRequestOnly.some(e => e.hotelId === 'b'), 'NaN price must be treated as on-request');
  ok(w.bands.flatMap(b => b.entries).every(e => Number.isFinite(e.cheapestSelling)), 'a non-finite price leaked into a band');
}

// ── banding must not mutate the caller's array ──
{
  const input = [entry('z', 9000), entry('y', 1000), entry('x', 5000)];
  bandHotels(input);
  ok(input.map(e => e.hotelId).join(',') === 'z,y,x', 'bandHotels mutated the input array order');
}

// ── cheapestQuotable ignores blocked rows ──
{
  const rows: WallRoomRow[] = [
    { key: 'k1', roomName: 'Blocked', quotable: false, blockedReason: 'On request' },
    { key: 'k2', roomName: 'Cheap', quotable: true, netTotal: 900, markupAmount: 100, sellingTotal: 1000, sellingPerNight: 500 },
    { key: 'k3', roomName: 'Dear', quotable: true, netTotal: 1800, markupAmount: 200, sellingTotal: 2000, sellingPerNight: 1000 },
  ];
  ok(cheapestQuotable(rows) === 1000, `expected 1000, got ${cheapestQuotable(rows)}`);
  ok(cheapestQuotable([rows[0]]) === null, 'all-blocked rows must yield null');
}

console.log(`\nChecks: ${checks}`);
if (fail.length) { console.error(`FAILURES: ${fail.length}\n` + fail.map(f => '  - ' + f).join('\n')); process.exit(1); }
console.log('ALL CHECKS PASS');
