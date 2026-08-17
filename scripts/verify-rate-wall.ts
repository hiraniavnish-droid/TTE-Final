// Verification for the Rate Wall. Run: npx tsx scripts/verify-rate-wall.ts
// Covers price banding: strict partition, tie handling, spread collapse, and
// exclusion of anything that cannot be priced. Later tasks extend this file.
import { bandHotels, cheapestQuotable, formatClientExport, type WallEntry, type WallRoomRow, type QuotableRow } from '../services/rateWall';
import { buildRajarshiWall } from '../services/rajarshiWall';
import { RAJARSHI_HOTELS, type RajPlan } from '../services/rajarshiData';
import { quoteStay } from '../services/rajarshiRates';

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
      for (const plan of ['EPAI', 'CPAI', 'MAPAI'] as RajPlan[]) {
        const entries = buildRajarshiWall({
          city: hotel.city, checkIn, nights: 2, rooms: 1, pax: 2,
          plan, markupMode: 'percent', markupValue: 0,
        });
        const e = entries.find(x => x.hotelId === hotel.id);
        if (!e) { ok(false, `${hotel.id}: missing from its own city wall`); continue; }

        for (let ri = 0; ri < hotel.rooms.length; ri++) {
          const row = e.rows.find(r => r.key === `${hotel.id}::${ri}`);
          if (!row) { ok(false, `${hotel.id}::${ri}: room row missing`); continue; }
          if (!row.quotable) continue;

          const truth = quoteStay({
            hotel, room: hotel.rooms[ri], plan, checkIn, nights: 2, rooms: 1,
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
          `${hotel.id} ${plan} ${checkIn}: festive flag ${!!e.festiveFlag}, expected ${expectFestive}`);
      }
    }
  }
}

// ── markup is applied on top, not folded into net ──
{
  const at0 = buildRajarshiWall({ city: RAJARSHI_HOTELS[0].city, checkIn: '2026-09-02', nights: 1, rooms: 1, pax: 2, plan: 'CPAI', markupMode: 'percent', markupValue: 0 });
  const at20 = buildRajarshiWall({ city: RAJARSHI_HOTELS[0].city, checkIn: '2026-09-02', nights: 1, rooms: 1, pax: 2, plan: 'CPAI', markupMode: 'percent', markupValue: 20 });
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
    plan: 'CPAI', markupMode: 'percent', markupValue: 0,
  });
  const allRows = entries.flatMap(e => e.rows);
  ok(allRows.length > 0, 'rooms must still be listed for an oversized party');
  ok(allRows.every(r => !r.quotable), 'a 9-guest party must not be priced into a single room');
  const blockedRows = allRows.filter((r): r is Extract<WallRoomRow, { quotable: false }> => !r.quotable);
  ok(blockedRows.every(r => /pax|guest/i.test(r.blockedReason)),
    'an oversized party must say so in the blocked reason');
}

// ── every row key is unique and stable ──
{
  const entries = buildRajarshiWall({
    city: RAJARSHI_HOTELS[0].city, checkIn: '2026-09-02', nights: 2, rooms: 1, pax: 2,
    plan: 'CPAI', markupMode: 'percent', markupValue: 0,
  });
  const keys = entries.flatMap(e => e.rows.map(r => r.key));
  ok(new Set(keys).size === keys.length, 'room row keys must be unique across the wall');
}

console.log(`\nChecks: ${checks}`);
if (fail.length) { console.error(`FAILURES: ${fail.length}\n` + fail.map(f => '  - ' + f).join('\n')); process.exit(1); }
console.log('ALL CHECKS PASS');
