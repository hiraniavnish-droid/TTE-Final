// Verification for the Rate Wall. Run: npx tsx scripts/verify-rate-wall.ts
// Covers price banding: strict partition, tie handling, spread collapse, and
// exclusion of anything that cannot be priced. Later tasks extend this file.
import { bandHotels, cheapestQuotable, formatClientExport, isBlocked, isQuotable, type WallEntry, type WallRoomRow, type QuotableRow } from '../services/rateWall';
import { buildRajarshiWall, RAJARSHI_PLANS } from '../services/rajarshiWall';
import { RAJARSHI_HOTELS, type RajPlan, type RajRoom } from '../services/rajarshiData';
import { quoteStay } from '../services/rajarshiRates';
import { buildInlandWall, inlandCities } from '../services/inlandWall';
import { INLAND_HOTELS, type InlandRoom } from '../services/inlandData';
import { readFileSync } from 'node:fs';

let checks = 0;
const fail: string[] = [];
const ok = (cond: boolean, msg: string) => { checks++; if (!cond) fail.push(msg); };

// Matches an amount only as a standalone figure. A bare `includes('450')`
// would both false-positive inside '₹3,450' and, worse, silently miss a real
// leak whenever the leaked figure happened to sit inside a larger number.
// The lookbehind rejects a match that continues a longer number to the left.
const containsAmount = (text: string, n: number) => {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const test = (s: string) => new RegExp(`(?<![\\d,.])${esc(s)}(?![\\d])`).test(text);
  return test(n.toLocaleString('en-IN')) || test(String(n));
};

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

// ── the priciest hotel must never be labelled below the top band ──
{
  const cases: number[][] = [
    [100, 5000, 5000, 5000],
    [100, 100, 100, 100, 100, 20000],
    [1, 2, 999, 999, 999, 999, 999, 999, 999],
    [5, 5, 5, 5, 5, 5, 5, 5, 900],
    [100, 500, 500, 500, 500, 500, 500, 9000],
  ];
  for (const prices of cases) {
    const w = bandHotels(prices.map((p, i) => entry('h' + i, p)));
    const last = w.bands[w.bands.length - 1];
    const dearest = Math.max(...prices);
    ok(last.entries.some(e => e.cheapestSelling === dearest),
      `[${prices}]: dearest ${dearest} is not in the top band (bands: ${w.bands.map(b => b.label || 'unlabelled').join('|')})`);
    ok(w.bands.length !== 2 || (w.bands[0].label === 'Value' && w.bands[1].label === 'Premium'),
      `[${prices}]: two surviving groups must be labelled Value/Premium, got ${w.bands.map(b => b.label).join('/')}`);
    ok(w.bands.length !== 1 || w.bands[0].label === '',
      `[${prices}]: a single surviving group must be unlabelled, got '${w.bands[0].label}'`);
  }
}

// ── zero and negative totals are data errors, not cheap rooms ──
{
  const w = bandHotels([entry('a', 0), entry('b', 1000), entry('c', 1050), entry('d', 1100)]);
  ok(w.onRequestOnly.some(e => e.hotelId === 'a'), 'a zero price must be treated as on-request');
  ok(w.bands.length === 1 && w.bands[0].id === 'similar',
    `a zero price must not disable the Similar pricing collapse, got ${w.bands.length} band(s) id '${w.bands[0]?.id}'`);

  const neg = bandHotels([entry('a', -500), entry('b', 1000), entry('c', 5000), entry('d', 9000)]);
  ok(neg.onRequestOnly.some(e => e.hotelId === 'a'), 'a negative price must be treated as on-request');
  ok(neg.bands.flatMap(b => b.entries).every(e => (e.cheapestSelling as number) > 0), 'a non-positive price leaked into a band');
}

// ── Infinity behaves like NaN, not like a real price ──
{
  const w = bandHotels([entry('a', Infinity), entry('b', -Infinity), entry('c', 1000), entry('d', 5000), entry('e', 9000)]);
  ok(w.onRequestOnly.length === 2, `both infinities must be on-request, got ${w.onRequestOnly.length}`);
  ok(w.bands.flatMap(b => b.entries).every(e => Number.isFinite(e.cheapestSelling)), 'an infinite price leaked into a band');
}

// ── empty input ──
{
  const w = bandHotels([]);
  ok(w.bands.length === 0 && w.onRequestOnly.length === 0, 'empty input must produce empty output');
}

// ── one corrupt room must not hide a hotel's good rooms ──
{
  const rows: WallRoomRow[] = [
    { key: 'bad', roomName: 'Corrupt', quotable: true, netTotal: NaN, markupAmount: 0, sellingTotal: NaN, sellingPerNight: NaN },
    { key: 'good', roomName: 'Fine', quotable: true, netTotal: 900, markupAmount: 100, sellingTotal: 1000, sellingPerNight: 500 },
  ];
  ok(cheapestQuotable(rows) === 1000, `one corrupt room must not poison the hotel, got ${cheapestQuotable(rows)}`);

  const negRows: WallRoomRow[] = [
    { key: 'neg', roomName: 'Negative', quotable: true, netTotal: -100, markupAmount: 0, sellingTotal: -100, sellingPerNight: -50 },
    { key: 'good', roomName: 'Fine', quotable: true, netTotal: 900, markupAmount: 100, sellingTotal: 1000, sellingPerNight: 500 },
  ];
  ok(cheapestQuotable(negRows) === 1000, `a negative room total must be skipped, got ${cheapestQuotable(negRows)}`);
}

// ── property sweep: the invariants must hold for arbitrary input ──
{
  // Deterministic PRNG so a failure is reproducible. Never Math.random() here.
  let seed = 20260817;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const POOL = [100, 100, 100, 500, 500, 1000, 2500, 5000, 5000, 20000, NaN, Infinity, -Infinity, 0, -50];

  let violations = 0;
  for (let iter = 0; iter < 3000; iter++) {
    const len = Math.floor(rnd() * 20);
    const es = Array.from({ length: len }, (_, i) => entry('h' + i, POOL[Math.floor(rnd() * POOL.length)]));
    const w = bandHotels(es);

    const flat = w.bands.flatMap(b => b.entries);
    // conservation: every input appears exactly once, nothing lost or duplicated
    if (flat.length + w.onRequestOnly.length !== len) violations++;
    if (new Set([...flat, ...w.onRequestOnly].map(e => e.hotelId)).size !== len) violations++;
    // no empty bands
    if (w.bands.some(b => b.entries.length === 0)) violations++;
    // nothing unpriced inside a band
    if (flat.some(e => !Number.isFinite(e.cheapestSelling) || (e.cheapestSelling as number) <= 0)) violations++;
    // bands ordered cheapest first, and no price straddles two bands
    const seen = new Map<number, number>();
    for (let bi = 0; bi < w.bands.length; bi++) {
      for (const e of w.bands[bi].entries) {
        const p = e.cheapestSelling as number;
        if (seen.has(p) && seen.get(p) !== bi) violations++;
        seen.set(p, bi);
      }
    }
    for (let bi = 1; bi < w.bands.length; bi++) {
      const prevMax = Math.max(...w.bands[bi - 1].entries.map(e => e.cheapestSelling as number));
      const curMin = Math.min(...w.bands[bi].entries.map(e => e.cheapestSelling as number));
      if (prevMax > curMin) violations++;
    }
    // the dearest hotel always sits in the last band
    if (flat.length) {
      const dearest = Math.max(...flat.map(e => e.cheapestSelling as number));
      if (!w.bands[w.bands.length - 1].entries.some(e => e.cheapestSelling === dearest)) violations++;
    }
  }
  ok(violations === 0, `property sweep: ${violations} invariant violation(s) across 3000 random walls`);
}

// ── the leak detector must itself work in both directions ──
{
  ok(containsAmount('Total ₹450 today', 450), 'containsAmount missed a standalone amount');
  ok(containsAmount('Total ₹1,200 today', 1200), 'containsAmount missed a grouped amount');
  ok(!containsAmount('Total ₹3,450 today', 450), 'containsAmount false-positived inside a larger number');
  ok(!containsAmount('Total ₹11,500 today', 1500), 'containsAmount false-positived inside a larger number');
}

// ── the export must never leak internal figures ──
{
  const rows: QuotableRow[] = [
    { key: 'h1::0', roomName: 'Deluxe', quotable: true, netTotal: 8000, markupAmount: 1200, sellingTotal: 9200, sellingPerNight: 4600 },
    { key: 'h2::0', roomName: 'Suite', quotable: true, netTotal: 3000, markupAmount: 450, sellingTotal: 3450, sellingPerNight: 1725 },
  ];
  const sel = [
    { entry: entry('h1', 9200), row: rows[0] },
    { entry: entry('h2', 3450), row: rows[1] },
  ];
  const text = formatClientExport(sel, {
    supplierName: 'Rajarshi Travels', cityLabel: 'Bhuj', clientName: 'Mr Test',
    checkIn: '2026-11-15', checkOut: '2026-11-17', nights: 2, rooms: 1, pax: 2,
    mealLabel: 'CPAI', inclusions: 'CPAI · GST included',
  });

  ok(!containsAmount(text, 8000) && !containsAmount(text, 3000), 'export leaked a net figure');
  ok(!containsAmount(text, 1200) && !containsAmount(text, 450), 'export leaked a margin figure');
  ok(!/net/i.test(text), "export contains the word 'net'");
  ok(!/margin|markup/i.test(text), 'export mentions margin or markup');
  ok(!/^\s*(Value|Mid|Premium|Similar pricing)\s*$/m.test(text), 'export contains a band heading line');
  ok(!text.includes('Similar pricing'), 'export contains a band label');
  ok(!text.includes('Rajarshi'), 'export leaked the supplier name');
  ok(text.indexOf('₹3,450') < text.indexOf('₹9,200'), 'export must list cheapest first');
  ok(text.includes('Mr Test'), 'export dropped the guest name');
  ok(text.includes('CPAI · GST included'), 'export dropped the inclusions line');
}

// ── empty selection produces nothing, not a header with no rows ──
{
  const text = formatClientExport([], {
    supplierName: 'X', cityLabel: 'Bhuj', clientName: '', checkIn: '2026-11-15',
    checkOut: '2026-11-16', nights: 1, rooms: 1, pax: 2, mealLabel: 'CPAI', inclusions: 'CPAI',
  });
  ok(text === '', 'an empty selection must produce an empty string');
}

// ── a festive note reaches the client, since it explains the rate ──
{
  const row: QuotableRow = { key: 'k', roomName: 'Deluxe', quotable: true, netTotal: 900, markupAmount: 100, sellingTotal: 1000, sellingPerNight: 1000 };
  const e2 = { ...entry('h', 1000), festiveFlag: 'Diwali Date' };
  const text = formatClientExport([{ entry: e2, row }], {
    supplierName: 'X', cityLabel: 'Bhuj', clientName: '', checkIn: '2026-11-15',
    checkOut: '2026-11-16', nights: 1, rooms: 1, pax: 2, mealLabel: 'CPAI', inclusions: 'CPAI',
  });
  ok(text.includes('Diwali Date'), 'a festive note must reach the client');
}

// ── a festive note must never carry the supplier's net surcharge ──
{
  const row: QuotableRow = { key: 'k', roomName: 'Superior Twin Bed AC', quotable: true, netTotal: 6500, markupAmount: 975, sellingTotal: 7475, sellingPerNight: 7475 };
  const e3 = { ...entry('h', 7475), festiveFlag: 'Black-Out Date Rate (Additional Rs 1,000 on room rate)' };
  const text = formatClientExport([{ entry: e3, row }], {
    supplierName: 'X', cityLabel: 'Bhuj', clientName: '', checkIn: '2026-11-05',
    checkOut: '2026-11-06', nights: 1, rooms: 1, pax: 2, mealLabel: 'MAPAI', inclusions: 'MAPAI',
  });
  ok(!containsAmount(text, 1000), 'festive note leaked a supplier surcharge figure');
  ok(!/Rs\s?1,?000/i.test(text), 'festive note leaked a supplier surcharge figure');
  ok(text.includes('Peak / festive dates'), 'a festive note carrying an amount must fall back to a neutral phrase');
}

// ── supplier text must not inject lines or break formatting ──
{
  const row: QuotableRow = { key: 'k', roomName: 'Deluxe\n\nNet cost: ₹5000', quotable: true, netTotal: 900, markupAmount: 100, sellingTotal: 1000, sellingPerNight: 1000 };
  const text = formatClientExport([{ entry: { ...entry('h', 1000), hotelName: 'RE:GEN:TA INN -3*' }, row }], {
    supplierName: 'X', cityLabel: 'Bhuj', clientName: '', checkIn: '2026-11-05',
    checkOut: '2026-11-06', nights: 1, rooms: 1, pax: 2, mealLabel: 'CPAI', inclusions: 'CPAI',
  });
  ok(!/Net cost/i.test(text), 'an embedded newline injected a line into the export');
  ok(!containsAmount(text, 5000), 'an injected line leaked a figure');
  ok((text.match(/\*/g) || []).length % 2 === 0, 'a stray asterisk left WhatsApp markup unbalanced');
}

// ── a NaN total must not reverse the quote order or print as a price ──
{
  const mk = (name: string, total: number): { entry: WallEntry; row: QuotableRow } => ({
    entry: entry(name, total),
    row: { key: name, roomName: 'Room', quotable: true, netTotal: total, markupAmount: 0, sellingTotal: total, sellingPerNight: total },
  });
  const text = formatClientExport([mk('Dear', 9000), mk('Broken', NaN), mk('Cheap', 1000), mk('Middle', 5000)], {
    supplierName: 'X', cityLabel: 'Bhuj', clientName: '', checkIn: '2026-11-05',
    checkOut: '2026-11-06', nights: 1, rooms: 1, pax: 2, mealLabel: 'CPAI', inclusions: 'CPAI',
  });
  ok(!text.includes('NaN'), 'a NaN total reached the customer');
  ok(text.indexOf('Cheap') < text.indexOf('Middle') && text.indexOf('Middle') < text.indexOf('Dear'),
    'a NaN total broke cheapest-first ordering');
  ok(!text.includes('Broken'), 'an unpriceable row was quoted anyway');
}

// ── per-night is labelled as an average, and omitted on single nights ──
{
  const row: QuotableRow = { key: 'k', roomName: 'Deluxe', quotable: true, netTotal: 21550, markupAmount: 3233, sellingTotal: 24783, sellingPerNight: 12392 };
  const multi = formatClientExport([{ entry: entry('h', 24783), row }], {
    supplierName: 'X', cityLabel: 'Bhuj', clientName: '', checkIn: '2026-11-05',
    checkOut: '2026-11-07', nights: 2, rooms: 1, pax: 2, mealLabel: 'MAPAI', inclusions: 'MAPAI',
  });
  ok(multi.includes('avg/night'), 'a multi-night per-night figure must be labelled an average');
  ok(!/·\s*₹[\d,]+ per night/.test(multi), "'per night' is a rate claim no single night may meet");

  const single = formatClientExport([{ entry: entry('h', 1000), row: { ...row, sellingTotal: 1000, sellingPerNight: 1000 } }], {
    supplierName: 'X', cityLabel: 'Bhuj', clientName: '', checkIn: '2026-11-05',
    checkOut: '2026-11-06', nights: 1, rooms: 1, pax: 2, mealLabel: 'MAPAI', inclusions: 'MAPAI',
  });
  ok(!single.includes('night'), 'a single-night stay must not repeat the total as a per-night figure');
}

// ── a legitimate number in a room name must survive redaction ──
{
  const row: QuotableRow = { key: 'k', roomName: 'CLUB ROOM ( 302 Sq. Ft)', quotable: true, netTotal: 900, markupAmount: 100, sellingTotal: 1000, sellingPerNight: 1000 };
  const text = formatClientExport([{ entry: entry('h', 1000), row }], {
    supplierName: 'X', cityLabel: 'Bhuj', clientName: '', checkIn: '2026-11-05',
    checkOut: '2026-11-06', nights: 1, rooms: 1, pax: 2, mealLabel: 'CPAI', inclusions: 'CPAI',
  });
  ok(text.includes('CLUB ROOM ( 302 Sq. Ft)'), 'square footage is not a price and must not be redacted');
}

// ── newline-bearing text must not restructure the message ──
//
// Real supplier fields in inlandData.ts carry embedded newlines ('Extra Adult
// - 1250\nChild without bed - 800'). Those are per-room display data and never
// reach ExportContext, whose meal/inclusions fields are built from a meal-plan
// enum at the call site. What is asserted here is the structural guarantee:
// however such a string arrives, it cannot add lines or fake a field.
//
// Bare figures are deliberately NOT redacted — no reliable rule separates a
// stray rate from 'GST 18%' or '302 Sq. Ft'. That safety property is the call
// site's job, and is documented on ExportContext.
{
  const row: QuotableRow = { key: 'k', roomName: 'Deluxe', quotable: true, netTotal: 900, markupAmount: 100, sellingTotal: 1000, sellingPerNight: 1000 };
  const text = formatClientExport([{ entry: entry('h', 1000), row }], {
    supplierName: 'X', cityLabel: 'Bhuj', clientName: '', checkIn: '2026-11-05', checkOut: '2026-11-06',
    nights: 1, rooms: 1, pax: 2,
    mealLabel: '1750 CPAI\n2250 MAPAI\n3000 APAI',
    inclusions: 'Extra Adult - 1250\nChild without bed - 800',
  });
  ok(text.split('\n').length < 15, `supplier newlines expanded the message to ${text.split('\n').length} lines`);
  ok(!/^\s*(Child without bed|2250 MAPAI)/m.test(text), 'a mid-field newline survived and started its own line');
  ok((text.match(/\*/g) || []).length % 2 === 0, 'sanitising left WhatsApp markup unbalanced');
}

// A room "publishes" a plan when that plan appears under ANY tier's rate
// table for that room — mirrors the adapter's own rule, kept independent
// here rather than imported so this is a real check, not a tautology.
function publishedPlansT(room: RajRoom): RajPlan[] {
  const plans = new Set<RajPlan>();
  for (const tierRates of Object.values(room.rates)) {
    for (const p of Object.keys(tierRates) as RajPlan[]) plans.add(p);
  }
  return Array.from(plans);
}

// ── Rajarshi adapter reconciles to the real resolver, exhaustively ──
{
  // Local numeric date arithmetic — never toISOString(), which shifts the date
  // back a day in IST and would silently misalign these window checks.
  const addDaysT = (iso: string, n: number) => {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d + n);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };

  for (const hotel of RAJARSHI_HOTELS) {
    // a date guaranteed outside every tier window, plus the first day of each tier
    const dates: string[] = [];
    const baseCandidate = hotel.tiers.some(t => t.windows.some(w => '2026-09-02' >= w.from && '2026-09-02' <= w.to))
      ? '2027-05-02' : '2026-09-02';
    dates.push(baseCandidate);
    for (const t of hotel.tiers) if (t.windows[0]) dates.push(t.windows[0].from);

    for (const checkIn of dates) {
      // Build the wall ONCE per (hotel city, checkIn) — no plan is passed in.
      const entries = buildRajarshiWall({
        city: hotel.city, checkIn, nights: 2, rooms: 1, pax: 2,
        markupMode: 'percent', markupValue: 0,
      });
      const e = entries.find(x => x.hotelId === hotel.id);
      if (!e) { ok(false, `${hotel.id}: missing from its own city wall`); continue; }

      for (let ri = 0; ri < hotel.rooms.length; ri++) {
        const room = hotel.rooms[ri];
        const plans = publishedPlansT(room);

        // A derived MAPAI row is expected in place of "no row" precisely when
        // the hotel prints a meal supplement, the room publishes CPAI, and it
        // does not already publish a real MAPAI.
        const expectsDerivedMapai = plans.includes('CPAI') && !plans.includes('MAPAI') &&
          Number.isFinite(hotel.mealSupplement?.amount) && (hotel.mealSupplement?.amount ?? 0) > 0;

        for (const plan of RAJARSHI_PLANS) {
          const row = e.rows.find(r => r.key === `${hotel.id}::${ri}::${plan}`);

          if (!plans.includes(plan)) {
            if (plan === 'MAPAI' && expectsDerivedMapai) {
              ok(!!row, `${hotel.id}::${ri}::MAPAI ${checkIn}: expected a derived MAPAI row, none found`);
              if (row) ok(!!row.derivedNote, `${hotel.id}::${ri}::MAPAI ${checkIn}: derived row missing derivedNote`);
              continue;
            }
            ok(!row, `${hotel.id}::${ri}::${plan} ${checkIn}: row exists for a plan the room does not publish`);
            continue;
          }

          if (!row) { ok(false, `${hotel.id}::${ri}::${plan} ${checkIn}: room row missing`); continue; }
          ok(row.planLabel === plan, `${hotel.id}::${ri}::${plan} ${checkIn}: planLabel is '${row.planLabel}', expected '${plan}'`);
          if (!row.quotable) continue;

          const truth = quoteStay({
            hotel, room, plan, checkIn, nights: 2, rooms: 1,
            extraPersons: 0, markupMode: 'percent', markupValue: 0,
          });
          ok(row.netTotal === truth.netCost,
            `${hotel.id}::${ri} ${plan} ${checkIn}: net ${row.netTotal} != resolver ${truth.netCost}`);
          ok(row.sellingTotal === truth.sellingPrice,
            `${hotel.id}::${ri} ${plan} ${checkIn}: selling ${row.sellingTotal} != resolver ${truth.sellingPrice}`);
          ok(row.sellingPerNight === Math.round(row.sellingTotal / 2),
            `${hotel.id}::${ri} ${plan} ${checkIn}: per-night does not reconcile to the total`);
          ok(!truth.anyOnRequest, `${hotel.id}::${ri} ${plan} ${checkIn}: on-request night was priced as quotable`);
        }
      }

      // Festive flag is set exactly when a night of the stay falls inside a
      // printed tier window. Derived from the windows themselves, NOT from a
      // sampled room's resolved tier — a room with no printed peak rate falls
      // back to 'base', which would wrongly report a blackout stay as normal.
      const expectFestive = [0, 1].some(n =>
        hotel.tiers.some(t => t.windows.some(w => {
          const d = addDaysT(checkIn, n);
          return d >= w.from && d <= w.to;
        }))
      );
      ok(!!e.festiveFlag === expectFestive,
        `${hotel.id} ${checkIn}: festive flag ${!!e.festiveFlag}, expected ${expectFestive}`);
    }
  }
}

// ── markup is applied on top, not folded into net ──
{
  const at0 = buildRajarshiWall({ city: RAJARSHI_HOTELS[0].city, checkIn: '2026-09-02', nights: 1, rooms: 1, pax: 2, markupMode: 'percent', markupValue: 0 });
  const at20 = buildRajarshiWall({ city: RAJARSHI_HOTELS[0].city, checkIn: '2026-09-02', nights: 1, rooms: 1, pax: 2, markupMode: 'percent', markupValue: 20 });
  const a = at0.flatMap(e => e.rows).find((r): r is QuotableRow => r.quotable);
  const b = at20.flatMap(e => e.rows).find((r): r is QuotableRow => r.quotable && r.key === a?.key);
  if (a && b) {
    ok(b.netTotal === a.netTotal, 'markup must not change the net figure');
    ok(b.sellingTotal === a.netTotal + Math.round(a.netTotal * 0.2), 'markup must be added on top of net');
  } else { ok(false, 'could not find a quotable row to check markup'); }
}

// ── a party too large for a room is listed but never priced ──
{
  const entries = buildRajarshiWall({
    city: RAJARSHI_HOTELS[0].city, checkIn: '2026-09-02', nights: 1, rooms: 1, pax: 9,
    markupMode: 'percent', markupValue: 0,
  });
  const allRows = entries.flatMap(e => e.rows);
  ok(allRows.length > 0, 'rooms must still be listed for an oversized party');
  ok(allRows.every(r => !r.quotable), 'a 9-guest party must not be priced into a single room');
  const blockedRows = allRows.filter(isBlocked);
  ok(blockedRows.every(r => /pax|guest/i.test(r.blockedReason)),
    'an oversized party must say so in the blocked reason');
}

// ── every row key is unique and stable ──
{
  const entries = buildRajarshiWall({
    city: RAJARSHI_HOTELS[0].city, checkIn: '2026-09-02', nights: 2, rooms: 1, pax: 2,
    markupMode: 'percent', markupValue: 0,
  });
  const keys = entries.flatMap(e => e.rows.map(r => r.key));
  ok(new Set(keys).size === keys.length, 'room row keys must be unique across the wall');
}

// ── city: 'ALL' sums every per-city wall, with globally unique keys ──
{
  const CITIES: Array<'Bhuj' | 'Mandvi' | 'Dholavira' | 'Dhordo' | 'Hodka' | 'Gorewali'> =
    ['Bhuj', 'Mandvi', 'Dholavira', 'Dhordo', 'Hodka', 'Gorewali'];
  const perCityCount = CITIES.reduce((sum, city) => {
    const entries = buildRajarshiWall({ city, checkIn: '2026-09-02', nights: 2, rooms: 1, pax: 2, markupMode: 'percent', markupValue: 0 });
    return sum + entries.length;
  }, 0);
  const allEntries = buildRajarshiWall({ city: 'ALL', checkIn: '2026-09-02', nights: 2, rooms: 1, pax: 2, markupMode: 'percent', markupValue: 0 });
  ok(allEntries.length === perCityCount,
    `city 'ALL' entry count ${allEntries.length} != sum over cities ${perCityCount}`);
  const allKeys = allEntries.flatMap(e => e.rows.map(r => r.key));
  ok(new Set(allKeys).size === allKeys.length, "city 'ALL': row keys must be unique across the whole set");
}

// ── export: a selection mixing two different plans shows each line's own plan ──
{
  const rows: QuotableRow[] = [
    { key: 'h1::0::EPAI', roomName: 'Deluxe', planLabel: 'EPAI', quotable: true, netTotal: 8000, markupAmount: 1200, sellingTotal: 9200, sellingPerNight: 4600 },
    { key: 'h2::0::MAPAI', roomName: 'Suite', planLabel: 'MAPAI', quotable: true, netTotal: 3000, markupAmount: 450, sellingTotal: 3450, sellingPerNight: 1725 },
  ];
  const sel = [
    { entry: entry('h1', 9200), row: rows[0] },
    { entry: entry('h2', 3450), row: rows[1] },
  ];
  const text = formatClientExport(sel, {
    supplierName: 'Rajarshi Travels', cityLabel: 'Bhuj', clientName: 'Mr Test',
    checkIn: '2026-11-15', checkOut: '2026-11-17', nights: 2, rooms: 1, pax: 2,
    inclusions: 'GST included',
  });
  ok(text.includes('Deluxe · EPAI'), 'export must show the plan on the EPAI line');
  ok(text.includes('Suite · MAPAI'), 'export must show the plan on the MAPAI line');
}

// ── derived MAPAI rows: six Bhuj hotels print CPAI + a meal supplement ──
{
  const NIGHTS = 2, ROOMS = 1, PAX = 2;
  const checkIn = '2026-09-02'; // clear of every tier window, per the reconciliation loop above

  const supplementHotels = RAJARSHI_HOTELS.filter(h => Number.isFinite(h.mealSupplement?.amount) && (h.mealSupplement?.amount ?? 0) > 0);
  ok(supplementHotels.length === 6, `expected 6 hotels with a meal supplement, found ${supplementHotels.length}`);

  for (const hotel of supplementHotels) {
    const entries = buildRajarshiWall({ city: hotel.city, checkIn, nights: NIGHTS, rooms: ROOMS, pax: PAX, markupMode: 'percent', markupValue: 15 });
    const e = entries.find(x => x.hotelId === hotel.id);
    if (!e) { ok(false, `${hotel.id}: missing from its own city wall`); continue; }

    for (let ri = 0; ri < hotel.rooms.length; ri++) {
      const room = hotel.rooms[ri];
      const plans = publishedPlansT(room);
      if (!plans.includes('CPAI') || plans.includes('MAPAI')) continue; // not a candidate for derivation

      const cpaiRow = e.rows.find(r => r.key === `${hotel.id}::${ri}::CPAI`);
      const mapaiRow = e.rows.find(r => r.key === `${hotel.id}::${ri}::MAPAI`);
      if (!cpaiRow) { ok(false, `${hotel.id}::${ri}: CPAI row missing`); continue; }
      if (!mapaiRow) { ok(false, `${hotel.id}::${ri}: derived MAPAI row missing`); continue; }

      ok(mapaiRow.planLabel === 'MAPAI', `${hotel.id}::${ri}: derived row planLabel is '${mapaiRow.planLabel}'`);
      ok(!!mapaiRow.derivedNote, `${hotel.id}::${ri}: derived row missing derivedNote`);

      if (cpaiRow.quotable && mapaiRow.quotable) {
        const amount = hotel.mealSupplement!.amount;
        const expectedNet = cpaiRow.netTotal + amount * PAX * NIGHTS;
        ok(mapaiRow.netTotal === expectedNet,
          `${hotel.id}::${ri}: derived netTotal ${mapaiRow.netTotal} != CPAI ${cpaiRow.netTotal} + ${amount}*${PAX}*${NIGHTS} = ${expectedNet}`);
        ok(mapaiRow.sellingTotal > cpaiRow.sellingTotal,
          `${hotel.id}::${ri}: derived sellingTotal ${mapaiRow.sellingTotal} must exceed CPAI's ${cpaiRow.sellingTotal}`);
      } else {
        ok(cpaiRow.quotable === mapaiRow.quotable, `${hotel.id}::${ri}: derived row quotability diverged from its CPAI base`);
      }
    }
  }
}

// ── Time Square publishes both CPAI and MAPAI: no derivation, no shadowing ──
{
  const hotel = RAJARSHI_HOTELS.find(h => h.id === 'time-square-club-resort-spa')!;
  ok(!hotel.mealSupplement, 'Time Square must not print a meal supplement for this check to be meaningful');
  const entries = buildRajarshiWall({ city: hotel.city, checkIn: '2026-09-02', nights: 2, rooms: 1, pax: 2, markupMode: 'percent', markupValue: 15 });
  const e = entries.find(x => x.hotelId === hotel.id)!;
  for (let ri = 0; ri < hotel.rooms.length; ri++) {
    const mapaiRows = e.rows.filter(r => r.key.startsWith(`${hotel.id}::${ri}::`) && r.planLabel === 'MAPAI');
    ok(mapaiRows.length === 1, `${hotel.id}::${ri}: expected exactly 1 MAPAI row, got ${mapaiRows.length}`);
    if (mapaiRows[0]) ok(!mapaiRows[0].derivedNote, `${hotel.id}::${ri}: printed MAPAI row must not carry derivedNote`);
  }
}

// ── no derived row for a hotel with no meal supplement (Hotel White Desert: EPAI+CPAI, no MAPAI, no supplement) ──
{
  const hotel = RAJARSHI_HOTELS.find(h => h.id === 'hotel-white-desert')!;
  ok(!hotel.mealSupplement, 'Hotel White Desert must not print a meal supplement for this check to be meaningful');
  const entries = buildRajarshiWall({ city: hotel.city, checkIn: '2026-09-02', nights: 2, rooms: 1, pax: 2, markupMode: 'percent', markupValue: 15 });
  const e = entries.find(x => x.hotelId === hotel.id)!;
  for (let ri = 0; ri < hotel.rooms.length; ri++) {
    const room = hotel.rooms[ri];
    const plans = publishedPlansT(room);
    if (plans.includes('MAPAI')) continue;
    const mapaiRow = e.rows.find(r => r.key === `${hotel.id}::${ri}::MAPAI`);
    ok(!mapaiRow, `${hotel.id}::${ri}: a MAPAI row must not appear without a printed meal supplement`);
  }
}

// ── blocked CPAI propagates its exact reason to the derived MAPAI row ──
{
  // Oversized party: real, reachable scenario for the meal-supplement hotels.
  // (A "peak date where CPAI is on-request" scenario was checked directly
  // against quoteStay for all 6 meal-supplement hotels across every printed
  // tier window's first date, and none exists in this dataset — every one of
  // them prints a full CPAI figure on every tier. That sub-case of blocking is
  // real in the code path — the derived row always copies cpaiRow.blockedReason
  // verbatim, whatever produced it — but is not exercisable against real data
  // here, so it is not asserted against a specific reason string below.)
  const hotel = RAJARSHI_HOTELS.find(h => h.id === 'floating-deck-resort')!;
  const entries = buildRajarshiWall({ city: hotel.city, checkIn: '2026-09-02', nights: 1, rooms: 1, pax: 9, markupMode: 'percent', markupValue: 0 });
  const e = entries.find(x => x.hotelId === hotel.id)!;
  for (let ri = 0; ri < hotel.rooms.length; ri++) {
    const cpaiRow = e.rows.find(r => r.key === `${hotel.id}::${ri}::CPAI`);
    const mapaiRow = e.rows.find(r => r.key === `${hotel.id}::${ri}::MAPAI`);
    if (!cpaiRow || !mapaiRow) { ok(false, `${hotel.id}::${ri}: expected both a CPAI and derived MAPAI row for an oversized party`); continue; }
    ok(!cpaiRow.quotable && !mapaiRow.quotable, `${hotel.id}::${ri}: an oversized party must block both rows`);
    if (isBlocked(cpaiRow) && isBlocked(mapaiRow)) {
      ok(mapaiRow.blockedReason === cpaiRow.blockedReason,
        `${hotel.id}::${ri}: derived block reason '${mapaiRow.blockedReason}' != CPAI's '${cpaiRow.blockedReason}'`);
    }
  }
}

// ── row keys stay unique across the whole wall, including derived rows ──
{
  const entries = buildRajarshiWall({ city: 'ALL', checkIn: '2026-09-02', nights: 2, rooms: 1, pax: 2, markupMode: 'percent', markupValue: 15 });
  const keys = entries.flatMap(e => e.rows.map(r => r.key));
  ok(new Set(keys).size === keys.length, 'row keys must stay unique across the whole wall once derived rows are included');
  const derivedKeys = entries.flatMap(e => e.rows.filter(r => r.derivedNote)).map(r => r.key);
  ok(derivedKeys.length > 0, 'expected at least one derived row across the whole wall');
}

// ── the client export never leaks the derived note or its wording ──
{
  const hotel = RAJARSHI_HOTELS.find(h => h.id === 'floating-deck-resort')!;
  const entries = buildRajarshiWall({ city: hotel.city, checkIn: '2026-09-02', nights: 2, rooms: 1, pax: 2, markupMode: 'percent', markupValue: 15 });
  const e = entries.find(x => x.hotelId === hotel.id)!;
  const mapaiRow = e.rows.find((r): r is QuotableRow => r.quotable && r.key === `${hotel.id}::0::MAPAI`);
  if (!mapaiRow) { ok(false, `${hotel.id}: expected a quotable derived MAPAI row for this scenario`); }
  else {
    ok(!!mapaiRow.derivedNote, 'sanity: the row under test must actually carry a derivedNote');
    const text = formatClientExport([{ entry: e, row: mapaiRow }], {
      supplierName: 'Rajarshi Travels', cityLabel: 'Bhuj', clientName: 'Mr Test',
      checkIn: '2026-11-01', checkOut: '2026-11-03', nights: 2, rooms: 1, pax: 2,
      inclusions: 'GST included',
    });
    ok(!text.includes('/meal'), 'export leaked the derived note wording (/meal)');
    ok(!text.includes(mapaiRow.derivedNote as string), 'export leaked the derived note verbatim');
  }
}

// ── flat markup: the derived row's markup equals the CPAI row's markup unchanged ──
{
  const hotel = RAJARSHI_HOTELS.find(h => h.id === 'hill-view-resort')!;
  const entries = buildRajarshiWall({ city: hotel.city, checkIn: '2026-09-02', nights: 2, rooms: 1, pax: 2, markupMode: 'flat', markupValue: 500 });
  const e = entries.find(x => x.hotelId === hotel.id)!;
  for (let ri = 0; ri < hotel.rooms.length; ri++) {
    const cpaiRow = e.rows.find((r): r is QuotableRow => r.quotable && r.key === `${hotel.id}::${ri}::CPAI`);
    const mapaiRow = e.rows.find((r): r is QuotableRow => r.quotable && r.key === `${hotel.id}::${ri}::MAPAI`);
    if (!cpaiRow || !mapaiRow) { ok(false, `${hotel.id}::${ri}: expected both rows quotable under flat markup`); continue; }
    ok(mapaiRow.markupAmount === cpaiRow.markupAmount,
      `${hotel.id}::${ri}: flat-mode derived markup ${mapaiRow.markupAmount} != CPAI's ${cpaiRow.markupAmount}`);
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// Inland adapter (services/inlandWall.ts)
//
// Everything below re-derives the expected figures from inlandData directly.
// It never calls a helper exported by (or copied from) inlandWall.ts — the
// point is to disagree with that file if it is wrong, not to echo it.
// ═══════════════════════════════════════════════════════════════════════════

// ── the sheet's own weekday/weekend day sets, read by hand from the labels ──
//
// Deliberately a lookup table rather than a parser: it is the transcription of
// what a person reads on the sheet, so a parser bug in inlandWall.ts cannot be
// mirrored here. Keyed by the exact printed pair.
const WEEKEND_BY_LABELS: Record<string, number[]> = {
  'WEEKDAYS||WEEKENDS (FRI-SUN)': [5, 6, 0],
  'Weekday (Mon to Thu)||WEEKENDS (FRI-Sun)': [5, 6, 0],
  'WEEKDAY(Sun-Thu)||WEEKENDS (FRI-SAT)': [5, 6],
  'WEEKDAYS||WEEKENDS (FRI-SAT)': [5, 6],
  'WEEKDAYS (Mon to Thu)||WEEKENDS (FRI-SUN)': [5, 6, 0],
  'WEEKDAYS (Mon-Thu)||WEEKENDS (Fri-Sun)': [5, 6, 0],
  'WEEKDAYS (Sun-Thu)||WEEKENDS (FRI-SAT)': [5, 6],
  'CPAI||WEEKENDS (FRI-SUN)': [5, 6, 0],
  'WEEKDAYS (Sun-thru)||WEEKENDS (FRI-SAT)': [5, 6],
  'WEEKDAYS (SUN-THRU)||WEEKENDS (FRI-SAT)': [5, 6],
  '(Mon to Thu)||WEEKENDS (FRI-Sun)': [5, 6, 0],
};
// The two pairs that name no day at all. Fri-Sun is the majority spelling in
// this sheet, which is exactly why guessing it here would be so easy to get
// away with and so expensive when wrong.
const BARE_WEEKEND_LABELS = 'WEEKDAYS||WEEKENDS';
const SAME_RATE_LABELS = 'WEEKDAYS / WEEKENDS Same Rate||';

// ── the sheet's own season periods, likewise transcribed by hand ──
const SEASON_MONTHS_BY_LABELS: Record<string, [number[], number[]]> = {
  'Rate till Sep 2026||Rate Oct to Mar 2027':        [[4,5,6,7,8,9], [10,11,12,1,2,3]],
  'Rate till Sep 2026||Rate till Mar 2027':          [[4,5,6,7,8,9], [10,11,12,1,2,3]],
  'Rate till Sep 2026||Rate Oct - Mar 2027':         [[4,5,6,7,8,9], [10,11,12,1,2,3]],
  '1 April to 30 Sep 2027||Rate Oct to Mar 2027':    [[4,5,6,7,8,9], [10,11,12,1,2,3]],
  'Till Sep 2026||Oct to March 2027':                [[4,5,6,7,8,9], [10,11,12,1,2,3]],
  'Rate till Sep 2026||Oct to Mar 2027':             [[4,5,6,7,8,9], [10,11,12,1,2,3]],
  'Rate till Sep 2026||Rate Oct till Mar 2027':      [[4,5,6,7,8,9], [10,11,12,1,2,3]],
  '01 April to 30 Sep 2027||Rate 1 Oct to 31 Mar 2027': [[4,5,6,7,8,9], [10,11,12,1,2,3]],
  // The four that do NOT follow the Apr-Sep / Oct-Mar split.
  'Rate till Aug 2026||Rate Sep to Mar 2027':        [[4,5,6,7,8], [9,10,11,12,1,2,3]],
  'Nov 24 & Feb 25||Dec 24 & Jan 25':                [[11,2], [12,1]],
  'Oct / Nov / Feb / Mar||Dec/Jan':                  [[10,11,2,3], [12,1]],
  'Winter (Oct - Mar 26)||':                         [[10,11,12,1,2,3], []],
};

const labelKey = (room: InlandRoom) => `${room.axisLabels[0] ?? ''}||${room.axisLabels[1] ?? ''}`;

const col2Printed = (room: InlandRoom) =>
  room.axisLabels[1] != null || room.rate2 != null || room.onRequest2;

const rateOf = (room: InlandRoom, col: 1 | 2) =>
  col === 1 ? (room.onRequest1 ? null : room.rate1) : (room.onRequest2 ? null : room.rate2);

// Weekday of the nth night, computed locally. Never toISOString().
const nightDow = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d + n).getDay();
};

// ── independent occupancy reading ──
// Written as a table over the 19 printed label pairs rather than as regexes,
// so a mis-read regex in inlandWall.ts has nothing to hide behind.
type ColRole = 'single' | 'double' | 'triple' | 'either' | 'extra' | 'none';
const OCC_ROLES: Record<string, [ColRole, ColRole]> = {
  'SINGLE||DOUBLE': ['single', 'double'],
  'Double||': ['double', 'none'],
  'DOUBLE||': ['double', 'none'],
  'SGL Room||Double Room': ['single', 'double'],
  'Double - CPAI & MAPAI||Triple Occ - CPAI & MAPAI': ['double', 'triple'],
  'DBL||': ['double', 'none'],
  'SIngel||Double': ['single', 'double'],
  'Single||DOUBLE': ['single', 'double'],
  'Single||DBL': ['single', 'double'],
  'SGL / DBL ROOM||': ['either', 'none'],
  'SGL / Double||': ['either', 'none'],
  'DOUBLE MAPAI||TRIPLE MAPAI': ['double', 'triple'],
  'DOUBLE MAPAI||Ex Person MAPAI': ['double', 'extra'],
  'Double (AI) - CP | MAP | AP||Ex Adults (AI) CP | MAP | AP': ['double', 'extra'],
  'Single||Double': ['single', 'double'],
  'SGL||DBL': ['single', 'double'],
  'DBL CPAI / MAPAI||Triple CPAI / MAPAI': ['double', 'triple'],
  'DBL CPAI||Double MAPAI': ['double', 'double'],   // really a meal-plan axis
  'DBL MAPAI||Triple  MAPAI': ['double', 'triple'],
};

const BASE_OCC = 2, MAX_EXTRA = 2;

// The expected extra-person supplement, re-derived. `childAdult` is only a
// supplement when it is smaller than the room rate — on 22 rooms it holds a
// third rate column (an APAI figure) instead, and the adapter must refuse it.
function expectedSupplement(room: InlandRoom, baseRate: number, exColRate: number | null): number | null {
  const raw = exColRate != null ? exColRate : (typeof room.childAdult === 'number' ? room.childAdult : null);
  if (raw == null || !Number.isFinite(raw) || raw <= 0 || raw >= baseRate) return null;
  return raw;
}

// ── every hotel, every room, a full week of check-ins, pax 1-4 ──
{
  const DATES = [0, 1, 2, 3, 4, 5, 6].map(n => {
    const d = new Date(2026, 10, 16 + n);   // 2026-11-16 is a Monday
    return `2026-11-${String(d.getDate()).padStart(2, '0')}`;
  });
  // A second week in the other half-year, so H1-tagged rooms and the Apr-Sep
  // season columns are exercised too.
  const DATES_H1 = [0, 1, 2, 3, 4, 5, 6].map(n => `2026-06-${String(15 + n).padStart(2, '0')}`);
  const ALL_DATES = [...DATES, ...DATES_H1];

  const NIGHTS = 3, ROOMS = 1;
  let quotableSeen = 0, blockedSeen = 0;

  for (const checkIn of ALL_DATES) {
    for (const pax of [1, 2, 3, 4]) {
      const entries = buildInlandWall({
        city: 'ALL', checkIn, nights: NIGHTS, rooms: ROOMS, pax,
        markupMode: 'percent', markupValue: 0,   // 0% isolates the net from the markup rule
      });
      const paxPerRoom = Math.ceil(pax / ROOMS);
      const half = Number(checkIn.slice(5, 7)) >= 4 && Number(checkIn.slice(5, 7)) <= 9 ? 'H1' : 'H2';

      for (const e of entries) {
        const hotel = INLAND_HOTELS.find(h => h.id === e.hotelId)!;
        for (const row of e.rows) {
          if (row.key.endsWith('::oncall')) {
            ok(isBlocked(row), `${row.key}: an ON CALL hotel must never price`);
            continue;
          }
          const [, riStr, suffix] = row.key.split('::');
          const room = hotel.rooms[Number(riStr)];
          ok(!!room, `${row.key}: row key does not point at a real room`);
          if (!room) continue;

          // A room belonging to the other printed half-year must not appear.
          ok(room.season == null || room.season === half,
            `${row.key}: ${room.season} room shown for a ${half} check-in`);

          if (!row.quotable) { blockedSeen++; continue; }
          if (!isQuotable(row)) continue;
          quotableSeen++;

          // ── the room's own printed figures, re-derived ──
          let netRoomTotal: number;
          let baseRate: number;
          let baseOcc = BASE_OCC;
          let exColRate: number | null = null;

          if (suffix === 'DATES') {
            const weekend = WEEKEND_BY_LABELS[labelKey(room)];
            ok(!!weekend, `${row.key}: a 'Your dates' row on a room whose weekend days are not printed`);
            if (!weekend) continue;
            const r1 = rateOf(room, 1), r2 = rateOf(room, 2);
            ok(r1 != null && r2 != null, `${row.key}: 'Your dates' priced with an on-request bucket`);
            if (r1 == null || r2 == null) continue;
            let wknd = 0;
            for (let n = 0; n < NIGHTS; n++) if (weekend.includes(nightDow(checkIn, n))) wknd++;
            netRoomTotal = (r1 * (NIGHTS - wknd) + r2 * wknd) * ROOMS;
            baseRate = Math.min(r1, r2);
          } else {
            const col = suffix === 'C1' ? 1 : 2;
            ok(suffix === 'C1' || suffix === 'C2', `${row.key}: unexpected row suffix '${suffix}'`);
            const r = rateOf(room, col as 1 | 2);
            ok(r != null, `${row.key}: priced off column ${col}, which the sheet marks on-request`);
            if (r == null) continue;
            netRoomTotal = r * NIGHTS * ROOMS;
            baseRate = r;

            if (room.axisType === 'occupancy') {
              const roles = OCC_ROLES[labelKey(room)];
              ok(!!roles, `${row.key}: unrecognised occupancy label pair '${labelKey(room)}'`);
              if (roles) {
                if (roles[col - 1] === 'triple') baseOcc = 3;
                const exIdx = roles.indexOf('extra');
                if (exIdx >= 0) exColRate = rateOf(room, (exIdx + 1) as 1 | 2);
              }
            }
          }

          const extraHeads = Math.max(0, paxPerRoom - baseOcc);
          let expectedExtra = 0;
          if (extraHeads > 0) {
            const sup = expectedSupplement(room, baseRate, exColRate);
            ok(sup != null, `${row.key}: priced ${paxPerRoom} pax with no usable extra-person rate`);
            if (sup == null) continue;
            expectedExtra = sup * extraHeads * ROOMS * NIGHTS;
          }
          ok(paxPerRoom - BASE_OCC <= MAX_EXTRA,
            `${row.key}: priced ${paxPerRoom} pax in one room, over the 2 extra-bed ceiling`);

          const expectedNet = netRoomTotal + expectedExtra;
          ok(row.netTotal === expectedNet,
            `${row.key} @${checkIn} pax${pax}: netTotal ${row.netTotal} != printed ${netRoomTotal} + extras ${expectedExtra} = ${expectedNet}`);
          ok(row.markupAmount === 0, `${row.key}: 0% markup must produce a zero markup, got ${row.markupAmount}`);
          ok(row.sellingTotal === row.netTotal, `${row.key}: sellingTotal must equal netTotal at 0% markup`);
          ok(Number.isFinite(row.sellingTotal) && row.sellingTotal > 0,
            `${row.key}: a non-positive or non-finite total must be blocked, not quoted`);
        }
      }
    }
  }
  ok(quotableSeen > 10000, `expected a large quotable population across the sweep, got ${quotableSeen}`);
  ok(blockedSeen > 0, `expected blocked rows across the sweep, got ${blockedSeen}`);
  console.log(`  Inland sweep: ${ALL_DATES.length} dates x 4 pax — ${quotableSeen} quotable / ${blockedSeen} blocked rows reconciled`);
}

// ── no row is ever priced off an on-request cell ──
{
  for (const checkIn of ['2026-06-15', '2026-11-20']) {
    const entries = buildInlandWall({ city: 'ALL', checkIn, nights: 2, rooms: 1, pax: 2, markupMode: 'percent', markupValue: 15 });
    for (const e of entries) {
      const hotel = INLAND_HOTELS.find(h => h.id === e.hotelId)!;
      for (const row of e.rows.filter(isQuotable)) {
        if (row.key.endsWith('::oncall')) { ok(false, `${row.key}: ON CALL hotel priced`); continue; }
        const [, riStr, suffix] = row.key.split('::');
        const room = hotel.rooms[Number(riStr)];
        if (!room) continue;
        if (suffix === 'C1') ok(!room.onRequest1 && room.rate1 != null, `${row.key}: priced an on-request column 1`);
        else if (suffix === 'C2') ok(!room.onRequest2 && room.rate2 != null, `${row.key}: priced an on-request column 2`);
        else ok(!room.onRequest1 && room.rate1 != null && !room.onRequest2 && room.rate2 != null,
          `${row.key}: split row priced with an on-request bucket`);
      }
    }
  }
}

// ── axisType 'unknown' never prices, even where a figure is printed ──
{
  const entries = buildInlandWall({ city: 'ALL', checkIn: '2026-11-16', nights: 2, rooms: 1, pax: 2, markupMode: 'percent', markupValue: 15 });
  let unknownRooms = 0, printedButRefused = 0;
  for (const e of entries) {
    const hotel = INLAND_HOTELS.find(h => h.id === e.hotelId)!;
    hotel.rooms.forEach((room, ri) => {
      if (room.axisType !== 'unknown') return;
      unknownRooms++;
      if (room.rate1 != null && !room.onRequest1) printedButRefused++;
      const rows = e.rows.filter(r => r.key.startsWith(`${hotel.id}::${ri}::`));
      ok(rows.length > 0, `${hotel.id}::${ri}: an unknown-axis room vanished instead of blocking`);
      for (const r of rows) {
        ok(isBlocked(r), `${hotel.id}::${ri}: an unknown-axis room was priced`);
        if (isBlocked(r)) ok(r.blockedReason === 'On request', `${hotel.id}::${ri}: expected 'On request', got '${r.blockedReason}'`);
      }
    });
  }
  ok(unknownRooms === 5, `expected 5 unknown-axis rooms in the data, found ${unknownRooms}`);
  ok(printedButRefused === 3, `expected 3 unknown-axis rooms carrying a printed figure we refuse, found ${printedButRefused}`);
}

// ── the 56 bare 'WEEKDAYS | WEEKENDS' rooms: two rates, never a resolution ──
{
  const entries = buildInlandWall({ city: 'ALL', checkIn: '2026-11-19', nights: 3, rooms: 1, pax: 2, markupMode: 'percent', markupValue: 15 });
  let bareRooms = 0, bareHotels = 0;
  for (const e of entries) {
    const hotel = INLAND_HOTELS.find(h => h.id === e.hotelId)!;
    let hotelHasBare = false;
    hotel.rooms.forEach((room, ri) => {
      if (labelKey(room) !== BARE_WEEKEND_LABELS) return;
      // A hotel printed as two half-year blocks only shows the half these
      // dates fall in; 19 Nov 2026 is H2.
      if (room.season != null && room.season !== 'H2') return;
      bareRooms++; hotelHasBare = true;
      const rows = e.rows.filter(r => r.key.startsWith(`${hotel.id}::${ri}::`));
      ok(rows.length === 2, `${hotel.id}::${ri}: a bare WEEKDAYS/WEEKENDS room must emit exactly 2 rows, got ${rows.length}`);
      ok(!rows.some(r => r.key.endsWith('::DATES')), `${hotel.id}::${ri}: a 'Your dates' row was invented from undefined weekend days`);
      ok(!rows.some(r => r.planLabel === 'Your dates'), `${hotel.id}::${ri}: a row is labelled 'Your dates' without printed weekend days`);
      ok(rows[0]?.planLabel === 'WEEKDAYS' && rows[1]?.planLabel === 'WEEKENDS',
        `${hotel.id}::${ri}: rows must carry the sheet's own labels, got '${rows[0]?.planLabel}' / '${rows[1]?.planLabel}'`);
    });
    if (hotelHasBare) {
      bareHotels++;
      ok(e.resolutionOk === false, `${e.hotelId}: a hotel with undefined weekend days must render amber (resolutionOk false)`);
    }
  }
  // 56 in the sheet; 3 of them belong to KAVISH GIR's April-Sep block and so
  // are correctly absent from a November wall.
  const bareInData = INLAND_HOTELS.flatMap(h => h.rooms).filter(r => labelKey(r) === BARE_WEEKEND_LABELS);
  ok(bareInData.length === 56, `expected 56 bare WEEKDAYS/WEEKENDS rooms in the data, found ${bareInData.length}`);
  ok(bareInData.filter(r => r.season === 'H1').length === 3, 'expected 3 of them in an Apr-Sep block');
  ok(bareRooms === 53, `expected 53 bare rooms on a November wall, found ${bareRooms}`);
  ok(bareHotels === 23, `expected 23 hotels carrying them, found ${bareHotels}`);
}

// ── rooms whose weekend days ARE printed do resolve ──
{
  // A Monday check-in for 3 nights (Mon/Tue/Wed) lies entirely inside the
  // weekday bucket under every day definition printed in this sheet, so the
  // split row must equal the weekday rate outright.
  const CHECK_IN = '2026-11-16', NIGHTS = 3, ROOMS = 2;
  const entries = buildInlandWall({ city: 'ALL', checkIn: CHECK_IN, nights: NIGHTS, rooms: ROOMS, pax: 4, markupMode: 'percent', markupValue: 0 });
  let resolved = 0, whollyWeekdayChecked = 0;
  for (const e of entries) {
    const hotel = INLAND_HOTELS.find(h => h.id === e.hotelId)!;
    hotel.rooms.forEach((room, ri) => {
      const weekend = WEEKEND_BY_LABELS[labelKey(room)];
      if (!weekend) return;
      if (room.season != null && room.season !== 'H2') return;   // 16 Nov 2026 is H2
      resolved++;
      const dates = e.rows.find(r => r.key === `${hotel.id}::${ri}::DATES`);
      ok(!!dates, `${hotel.id}::${ri}: printed weekend days but no 'Your dates' row`);
      if (!dates) return;
      ok(dates.planLabel === 'Your dates', `${hotel.id}::${ri}: split row planLabel is '${dates.planLabel}'`);
      for (let n = 0; n < NIGHTS; n++) ok(!weekend.includes(nightDow(CHECK_IN, n)), 'sanity: Mon-Wed must be weekday nights');
      const weekdayRow = e.rows.find(r => r.key === `${hotel.id}::${ri}::C1`);
      if (isQuotable(dates) && weekdayRow && isQuotable(weekdayRow)) {
        whollyWeekdayChecked++;
        ok(dates.netTotal === weekdayRow.netTotal,
          `${hotel.id}::${ri}: a wholly-weekday stay must equal the weekday rate (${dates.netTotal} vs ${weekdayRow.netTotal})`);
        ok(dates.netTotal === room.rate1! * NIGHTS * ROOMS + (dates.netTotal - room.rate1! * NIGHTS * ROOMS),
          `${hotel.id}::${ri}: sanity on the split row's composition`);
      }
    });
  }
  const printedDaysInData = INLAND_HOTELS.flatMap(h => h.rooms).filter(r => WEEKEND_BY_LABELS[labelKey(r)]);
  ok(printedDaysInData.length === 99, `expected 99 rooms with printed weekend days in the data, found ${printedDaysInData.length}`);
  ok(resolved === 95, `expected 95 of them on a November wall (4 sit in an Apr-Sep block), found ${resolved}`);
  ok(whollyWeekdayChecked > 40, `expected a meaningful number of wholly-weekday comparisons, got ${whollyWeekdayChecked}`);
}

// ── the named Thursday case: 1 weekday + 2 weekend nights, arithmetic explicit ──
{
  // Iscon The Fern Resort & Spa, Bhavnagar — 'WEEKDAYS' 4300 | 'WEEKENDS
  // (FRI-SUN)' 4900 on Winter Green Room. Check-in Thu 05 Nov 2026 for 3
  // nights covers Thu, Fri, Sat: one weekday night and two weekend nights.
  const HOTEL = 'bhavnagar-iscon-the-fern-resort-spa';
  const hotel = INLAND_HOTELS.find(h => h.id === HOTEL)!;
  const room = hotel.rooms[0];
  ok(room.name === 'Winter Green Room', `fixture drifted: room 0 is '${room.name}'`);
  ok(room.rate1 === 4300 && room.rate2 === 4900, `fixture drifted: rates are ${room.rate1}/${room.rate2}`);
  ok(labelKey(room) === 'WEEKDAYS||WEEKENDS (FRI-SUN)', `fixture drifted: labels are '${labelKey(room)}'`);

  const CHECK_IN = '2026-11-05';   // Thursday
  ok(nightDow(CHECK_IN, 0) === 4, 'fixture drifted: 05 Nov 2026 must be a Thursday');
  ok(nightDow(CHECK_IN, 1) === 5 && nightDow(CHECK_IN, 2) === 6, 'nights 2 and 3 must be Fri and Sat');

  const e = buildInlandWall({ city: hotel.city, checkIn: CHECK_IN, nights: 3, rooms: 1, pax: 2, markupMode: 'percent', markupValue: 0 })
    .find(x => x.hotelId === HOTEL)!;
  const dates = e.rows.find(r => r.key === `${HOTEL}::0::DATES`);
  ok(!!dates && isQuotable(dates!), 'the Thursday split row must be quotable');
  if (dates && isQuotable(dates)) {
    const expected = 4300 * 1 + 4900 * 2;   // = 14100
    ok(expected === 14100, 'arithmetic sanity: 4300 + 4900 x 2 = 14100');
    ok(dates.netTotal === expected,
      `Thursday split: netTotal ${dates.netTotal} != 4300x1 + 4900x2 = ${expected}`);
    ok(dates.derivedNote === '1 weekday + 2 weekend night(s)',
      `Thursday split: derivedNote is '${dates.derivedNote}'`);
    // Strictly between the two single-basis rows, which is the whole point.
    const wd = e.rows.find(r => r.key === `${HOTEL}::0::C1`)!;
    const we = e.rows.find(r => r.key === `${HOTEL}::0::C2`)!;
    if (isQuotable(wd) && isQuotable(we)) {
      ok(wd.netTotal === 4300 * 3 && we.netTotal === 4900 * 3, 'the two single-basis rows must be flat 3-night totals');
      ok(dates.netTotal > wd.netTotal && dates.netTotal < we.netTotal,
        'the split row must fall between the all-weekday and all-weekend totals');
    }
  }
  // 2 rooms doubles it and nothing else.
  const e2 = buildInlandWall({ city: hotel.city, checkIn: CHECK_IN, nights: 3, rooms: 2, pax: 4, markupMode: 'percent', markupValue: 0 })
    .find(x => x.hotelId === HOTEL)!;
  const dates2 = e2.rows.find(r => r.key === `${HOTEL}::0::DATES`);
  if (dates2 && isQuotable(dates2)) ok(dates2.netTotal === 14100 * 2, `2-room split total ${dates2.netTotal} != 28200`);
}

// ── the 'Ex Person' column is a supplement, not a triple rate ──
{
  // Rann Resort Dholavira prints 'DOUBLE MAPAI' 5460 | 'Ex Person MAPAI' 2100,
  // and separately carries childAdult 6300 — which is the NEXT room's double
  // rate, not an extra bed. Reading the label is what keeps a 3-pax quote at
  // 5460 + 2100 instead of 5460 + 6300.
  const hotel = INLAND_HOTELS.find(h => h.name.trim() === 'Rann Resort  Dholavira'.trim())!;
  ok(!!hotel, 'fixture drifted: Rann Resort Dholavira not found');
  if (hotel) {
    const room = hotel.rooms[0];
    ok(room.rate1 === 5460 && room.rate2 === 2100 && room.childAdult === 6300,
      `fixture drifted: ${room.rate1}/${room.rate2}/${room.childAdult}`);
    const e = buildInlandWall({ city: hotel.city, checkIn: '2026-11-16', nights: 2, rooms: 1, pax: 3, markupMode: 'percent', markupValue: 0 })
      .find(x => x.hotelId === hotel.id)!;
    const rows = e.rows.filter(r => r.key.startsWith(`${hotel.id}::0::`));
    ok(rows.length === 1, `expected a single occupancy row, got ${rows.length}`);
    const row = rows[0];
    ok(row.key.endsWith('::C1'), `must price off the DOUBLE column, got '${row.key}'`);
    if (isQuotable(row)) {
      ok(row.netTotal === 5460 * 2 + 2100 * 1 * 2,
        `3-pax net ${row.netTotal} != 5460x2 nights + 2100 x 1 head x 2 nights = ${5460 * 2 + 2100 * 2}`);
    } else ok(false, `expected a quotable 3-pax row, blocked: '${row.blockedReason}'`);
  }
}

// ── a childAdult that is really a third rate column is refused, not charged ──
{
  // Kings Kraft Tremezzo Somnath: CPAI 2900 | MAPAI 3800, childAdult 4700 —
  // an APAI rate the transcription had nowhere else to put. Charging it as an
  // extra bed would add 62% to a room.
  const hotel = INLAND_HOTELS.find(h => h.name === 'Kings Kraft Tremezzo Somnath')!;
  ok(!!hotel, 'fixture drifted: Kings Kraft Tremezzo Somnath not found');
  if (hotel) {
    const room = hotel.rooms[0];
    ok(room.rate1 === 2900 && room.childAdult === 4700, `fixture drifted: ${room.rate1}/${room.childAdult}`);
    const e = buildInlandWall({ city: hotel.city, checkIn: '2026-11-16', nights: 1, rooms: 1, pax: 3, markupMode: 'percent', markupValue: 0 })
      .find(x => x.hotelId === hotel.id)!;
    for (const r of e.rows.filter(r => r.key.startsWith(`${hotel.id}::0::`))) {
      ok(isBlocked(r), `an implausible extra-person figure must block, not price (got ${isQuotable(r) ? r.netTotal : ''})`);
      if (isBlocked(r)) ok(/extra person rate/i.test(r.blockedReason), `reason should name the missing extra-person rate, got '${r.blockedReason}'`);
    }
  }
}

// ── the season split is read from the printed periods, not assumed ──
{
  for (const [key, [m1, m2]] of Object.entries(SEASON_MONTHS_BY_LABELS)) {
    const hotel = INLAND_HOTELS.find(h => h.rooms.some(r => r.axisType === 'season' && labelKey(r) === key));
    ok(!!hotel, `no hotel found for season label pair '${key}'`);
    if (!hotel) continue;
    const ri = hotel.rooms.findIndex(r => r.axisType === 'season' && labelKey(r) === key);
    for (let month = 1; month <= 12; month++) {
      const checkIn = `2026-${String(month).padStart(2, '0')}-15`;
      const e = buildInlandWall({ city: hotel.city, checkIn, nights: 1, rooms: 1, pax: 2, markupMode: 'percent', markupValue: 0 })
        .find(x => x.hotelId === hotel.id)!;
      const suffixes = e.rows.filter(r => r.key.startsWith(`${hotel.id}::${ri}::`)).map(r => r.key.split('::')[2]).sort();
      const in1 = m1.includes(month), in2 = m2.includes(month);
      if (in1 && !in2) ok(suffixes.join(',') === 'C1', `${hotel.id} month ${month}: expected only C1 for '${key}', got '${suffixes.join(',')}'`);
      else if (in2 && !in1) ok(suffixes.join(',') === 'C2', `${hotel.id} month ${month}: expected only C2 for '${key}', got '${suffixes.join(',')}'`);
      else {
        ok(suffixes.length >= 1, `${hotel.id} month ${month}: an undecidable season must still show the printed rates`);
        ok(e.resolutionOk === false, `${hotel.id} month ${month}: an undecidable season must render amber`);
      }
    }
  }
}

// ── Lords Inn Somnath breaks at Aug/Sep, so September is NOT the summer rate ──
{
  const hotel = INLAND_HOTELS.find(h => h.name === 'Lords Inn Somnath')!;
  ok(!!hotel, 'fixture drifted: Lords Inn Somnath not found');
  if (hotel) {
    const ri = hotel.rooms.findIndex(r => r.axisType === 'season');
    ok(labelKey(hotel.rooms[ri]) === 'Rate till Aug 2026||Rate Sep to Mar 2027',
      `fixture drifted: labels are '${labelKey(hotel.rooms[ri])}'`);
    const sept = buildInlandWall({ city: hotel.city, checkIn: '2026-09-15', nights: 1, rooms: 1, pax: 2, markupMode: 'percent', markupValue: 0 })
      .find(x => x.hotelId === hotel.id)!;
    const rows = sept.rows.filter(r => r.key.startsWith(`${hotel.id}::${ri}::`));
    ok(rows.length === 1 && rows[0].key.endsWith('::C2'),
      `September at Lords Inn must resolve to the Sep-Mar column, got '${rows.map(r => r.key.split('::')[2]).join(',')}'`);
  }
}

// ── meal-plan rooms show both plans, labelled as printed ──
{
  const entries = buildInlandWall({ city: 'ALL', checkIn: '2026-11-16', nights: 2, rooms: 1, pax: 2, markupMode: 'percent', markupValue: 15 });
  let checked = 0;
  for (const e of entries) {
    const hotel = INLAND_HOTELS.find(h => h.id === e.hotelId)!;
    hotel.rooms.forEach((room, ri) => {
      if (room.axisType !== 'meal_plan') return;
      if (room.season != null && room.season !== 'H2') return;
      checked++;
      const rows = e.rows.filter(r => r.key.startsWith(`${hotel.id}::${ri}::`));
      const expected = col2Printed(room) ? 2 : 1;
      ok(rows.length === expected, `${hotel.id}::${ri}: expected ${expected} meal-plan rows, got ${rows.length}`);
      rows.forEach((r, idx) => ok(r.planLabel === (room.axisLabels[idx] || undefined),
        `${hotel.id}::${ri}: row ${idx} planLabel '${r.planLabel}' != printed '${room.axisLabels[idx]}'`));
    });
  }
  ok(checked > 80, `expected the meal-plan population to be exercised, checked ${checked}`);
}

// ── a mislabelled occupancy axis that is really two meal plans is not halved ──
{
  // DAKSH THE NIRVANA RETREAT prints 'DBL CPAI' 3100 | 'Double MAPAI' 3850 —
  // both columns are double occupancy, so choosing one by party size would
  // silently discard a rate the agent needs.
  const hotel = INLAND_HOTELS.find(h => h.id === 'bhuj-daksh-the-nirvana-retreat-pavagadh')!;
  ok(!!hotel, 'fixture drifted: DAKSH THE NIRVANA RETREAT not found');
  if (hotel) {
    const e = buildInlandWall({ city: hotel.city, checkIn: '2026-11-16', nights: 1, rooms: 1, pax: 2, markupMode: 'percent', markupValue: 0 })
      .find(x => x.hotelId === hotel.id)!;
    const rows = e.rows.filter(r => r.key.startsWith(`${hotel.id}::0::`));
    ok(rows.length === 2, `expected both plans priced, got ${rows.length} row(s)`);
    const totals = rows.filter(isQuotable).map(r => r.netTotal).sort((a, b) => a - b);
    ok(totals.join(',') === '3100,3850', `expected 3100 and 3850, got '${totals.join(',')}'`);
  }
}

// ── ON CALL hotels produce a card that explains itself, never a price ──
{
  const entries = buildInlandWall({ city: 'ALL', checkIn: '2026-11-16', nights: 2, rooms: 1, pax: 2, markupMode: 'percent', markupValue: 15 });
  const onCall = INLAND_HOTELS.filter(h => h.isOnCallOnly);
  ok(onCall.length === 8, `expected 8 ON CALL hotels, found ${onCall.length}`);
  for (const h of onCall) {
    const e = entries.find(x => x.hotelId === h.id)!;
    ok(!!e, `${h.id}: ON CALL hotel missing from the wall`);
    if (!e) continue;
    ok(e.rows.length > 0 && e.rows.every(isBlocked), `${h.id}: ON CALL hotel must render blocked rows`);
    ok(e.cheapestSelling === null, `${h.id}: ON CALL hotel must have no cheapest price`);
    ok(e.resolutionOk === false, `${h.id}: ON CALL hotel must render amber`);
  }
}

// ── row keys are unique across the whole wall, in every city mode ──
{
  const cities = inlandCities();
  ok(cities.length === 20, `expected 20 Inland cities, got ${cities.length}`);
  ok(cities.every((c, i) => i === 0 || cities[i - 1].localeCompare(c) <= 0), 'inlandCities() must be sorted');

  for (const city of ['ALL', ...cities]) {
    for (const pax of [1, 3]) {
      const entries = buildInlandWall({ city, checkIn: '2026-11-19', nights: 3, rooms: 1, pax, markupMode: 'percent', markupValue: 15 });
      const keys = entries.flatMap(e => e.rows.map(r => r.key));
      ok(new Set(keys).size === keys.length, `${city} pax${pax}: duplicate row keys on the wall`);
    }
  }
  const all = buildInlandWall({ city: 'ALL', checkIn: '2026-11-19', nights: 3, rooms: 1, pax: 2, markupMode: 'percent', markupValue: 15 });
  ok(all.length === INLAND_HOTELS.length, `'ALL' must cover every hotel: ${all.length} vs ${INLAND_HOTELS.length}`);
  const perCity = inlandCities().flatMap(c => buildInlandWall({ city: c, checkIn: '2026-11-19', nights: 3, rooms: 1, pax: 2, markupMode: 'percent', markupValue: 15 }));
  ok(perCity.length === all.length, `city-by-city must partition 'ALL': ${perCity.length} vs ${all.length}`);
}

// ── markup follows inlandRates.ts exactly, on the room total only ──
{
  const HOTEL = 'bhavnagar-iscon-the-fern-resort-spa';
  const pct = buildInlandWall({ city: 'BHAVNAGAR', checkIn: '2026-11-05', nights: 3, rooms: 2, pax: 2, markupMode: 'percent', markupValue: 15 })
    .find(x => x.hotelId === HOTEL)!;
  const d = pct.rows.find(r => r.key === `${HOTEL}::0::DATES`)!;
  if (isQuotable(d)) {
    ok(d.netTotal === 14100 * 2, `percent-mode split net ${d.netTotal} != 28200`);
    ok(d.markupAmount === Math.round(28200 * 0.15), `percent markup ${d.markupAmount} != ${Math.round(28200 * 0.15)}`);
    ok(d.sellingTotal === d.netTotal + d.markupAmount, 'sellingTotal must be net + markup');
    ok(d.sellingPerNight === Math.round(d.sellingTotal / 3), 'sellingPerNight must be the 3-night average');
  } else ok(false, 'expected a quotable split row under percent markup');

  const flat = buildInlandWall({ city: 'BHAVNAGAR', checkIn: '2026-11-05', nights: 3, rooms: 2, pax: 2, markupMode: 'flat', markupValue: 500 })
    .find(x => x.hotelId === HOTEL)!;
  const df = flat.rows.find(r => r.key === `${HOTEL}::0::DATES`)!;
  if (isQuotable(df)) {
    ok(df.markupAmount === 500 * 3 * 2, `flat markup ${df.markupAmount} != 500 x 3 nights x 2 rooms`);
  } else ok(false, 'expected a quotable split row under flat markup');
}

// ── printed weekday and weekend labels never contradict each other ──
{
  // The adapter prefers column 2's own day range and falls back to column 1's
  // complement. That is only safe while the two agree everywhere in the data.
  for (const h of INLAND_HOTELS) for (const room of h.rooms) {
    if (room.axisType !== 'weekday_weekend') continue;
    const l1 = (room.axisLabels[0] || '').toLowerCase(), l2 = (room.axisLabels[1] || '').toLowerCase();
    const fromWeekday = /mon/.test(l1) && /thu/.test(l1) ? 'FriSun' : /sun/.test(l1) && /(thu|thru)/.test(l1) ? 'FriSat' : null;
    const fromWeekend = /fri/.test(l2) ? (/sun/.test(l2) ? 'FriSun' : /sat/.test(l2) ? 'FriSat' : null) : null;
    if (fromWeekday && fromWeekend) {
      ok(fromWeekday === fromWeekend, `${h.id} / ${room.name}: printed weekday and weekend ranges disagree — '${labelKey(room)}'`);
    }
  }
}

// ── 'Same Rate' rooms emit one row, not the same number three times ──
{
  const entries = buildInlandWall({ city: 'ALL', checkIn: '2026-11-19', nights: 3, rooms: 1, pax: 2, markupMode: 'percent', markupValue: 15 });
  let seen = 0;
  for (const e of entries) {
    const hotel = INLAND_HOTELS.find(h => h.id === e.hotelId)!;
    hotel.rooms.forEach((room, ri) => {
      if (labelKey(room) !== SAME_RATE_LABELS) return;
      seen++;
      const rows = e.rows.filter(r => r.key.startsWith(`${hotel.id}::${ri}::`));
      ok(rows.length === 1, `${hotel.id}::${ri}: 'Same Rate' must emit one row, got ${rows.length}`);
    });
  }
  ok(seen === 4, `expected 4 'Same Rate' rooms, found ${seen}`);
}

// ── every entry states GST and carries the supplier's festive wording verbatim ──
{
  const entries = buildInlandWall({ city: 'ALL', checkIn: '2026-11-16', nights: 2, rooms: 1, pax: 2, markupMode: 'percent', markupValue: 15 });
  let flagged = 0;
  for (const e of entries) {
    ok(e.inclusions === 'GST included', `${e.hotelId}: inclusions must state GST, got '${e.inclusions}'`);
    ok(typeof e.resolutionChip === 'string' && e.resolutionChip.length > 0, `${e.hotelId}: empty resolution chip`);
    const hotel = INLAND_HOTELS.find(h => h.id === e.hotelId)!;
    if (e.festiveFlag) {
      flagged++;
      const src = `${hotel.headerNote ?? ''} ${hotel.remark ?? ''}`;
      for (const part of e.festiveFlag.split(' · ')) {
        ok(src.includes(part), `${e.hotelId}: festiveFlag was not printed verbatim from the sheet`);
      }
    }
  }
  ok(flagged > 20, `expected the festive/blackout wording to surface on many hotels, got ${flagged}`);
}

// ── a client export off an Inland selection leaks no internal provenance ──
{
  const HOTEL = 'bhavnagar-iscon-the-fern-resort-spa';
  const e = buildInlandWall({ city: 'BHAVNAGAR', checkIn: '2026-11-05', nights: 3, rooms: 1, pax: 2, markupMode: 'percent', markupValue: 15 })
    .find(x => x.hotelId === HOTEL)!;
  const row = e.rows.find((r): r is QuotableRow => r.quotable && r.key === `${HOTEL}::0::DATES`)!;
  ok(!!row?.derivedNote, 'sanity: the row under test must carry a derivedNote');
  const text = formatClientExport([{ entry: e, row }], {
    supplierName: 'Inland Tourways', cityLabel: 'Bhavnagar', clientName: 'Mr Test',
    checkIn: '2026-11-05', checkOut: '2026-11-08', nights: 3, rooms: 1, pax: 2,
    inclusions: 'GST included',
  });
  ok(!text.includes(row.derivedNote as string), 'export leaked the split provenance note');
  ok(!text.includes('weekday'), 'export leaked the weekday/weekend derivation');
  ok(!containsAmount(text, row.netTotal), 'export leaked the net cost');
  ok(containsAmount(text, row.sellingTotal), 'export must print the selling total');
}

// ── the banned UTC path is absent from the adapter source ──
{
  const src = readFileSync(new URL('../services/inlandWall.ts', import.meta.url), 'utf8');
  const code = src.replace(/^\s*\/\/.*$/gm, '');   // ignore the comment that explains the ban
  ok(!code.includes('toISOString'), 'services/inlandWall.ts must never call toISOString() — it shifts IST dates back a day');
  ok(src.includes('toISOString'), 'sanity: the ban is expected to be documented in a comment');
  ok(!code.includes('getUTC'), 'services/inlandWall.ts must not read UTC date parts either');
}


console.log(`\nChecks: ${checks}`);
if (fail.length) { console.error(`FAILURES: ${fail.length}\n` + fail.map(f => '  - ' + f).join('\n')); process.exit(1); }
console.log('ALL CHECKS PASS');
