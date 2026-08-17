// ============================================================
// POST /api/rann-enquiry — the Interakt "Rann Utsav Inquiry" workflow's webhook.
//
// Drop-in replacement for /api/rann-quote in that workflow: it returns the exact
// same { ok, reply, ... } shape (so the final "Send a Message {{1}}" node keeps
// working), but ALSO lands the enquiry in the CRM.
//
// Why this exists: the workflow qualified customers beautifully — tent, date,
// nights, pax — and then that data died inside Interakt, because inbound WhatsApp
// messages from an unknown number are intentionally dropped (see whatsapp-webhook.ts).
// A *completed* Rann flow is a strong signal, unlike a bare "hi", so this is the
// one place a lead should be auto-created.
//
// Pricing is NOT reimplemented here — it delegates to /api/rann-quote so there is
// exactly one source of rate truth.
//
// Body (all strings, straight from the workflow's variables):
//   phone   — REQUIRED, the customer's WhatsApp number
//   name    — optional
//   product, tent, date, nights, pax, rooms — same as /api/rann-quote
// ============================================================

// ── Rann quote engine (duplicated from api/rann-quote.ts; keep in sync) ──
const GST_RATE = 0.18;
const rng = (a: number, b: number) => { const r: number[] = []; for (let i = a; i <= b; i++) r.push(i); return r; };

// ── Resort ──
const RESORT_NIGHTLY: Record<string, number> = { Premium: 18000, Regular: 14000, Economy: 11000 };
const RESORT_EXTRA_PAX = 4500;
const RESORT_ECONOMY: Record<number, number[]> = { 11: [12,16,17,18,19,26,30], 2: [1,2,3,4,8,9,10,11,15,16,17,18,22,23,24,25] };
const RESORT_PREMIUM: Record<number, number[]> = { 12: rng(19,31), 1: [1,2,14,15,21,22,23], 2: [19,20,21] };
function resortTier(dt: Date): 'Premium'|'Regular'|'Economy' {
  const m = dt.getUTCMonth() + 1, d = dt.getUTCDate();
  if ((RESORT_PREMIUM[m]||[]).includes(d)) return 'Premium';
  if ((RESORT_ECONOMY[m]||[]).includes(d)) return 'Economy';
  return 'Regular';
}

// ── Tent City ──
type TCTier = 'none'|'s1'|'s2';
const TC_BASE: Record<string, Record<number, number>> = {
  'Super Premium Tent': {1:10300,2:20600,3:30900},
  'Premium Tent': {1:9300,2:18600,3:27900},
  'Deluxe AC Swiss Cottage': {1:8300,2:16600,3:24900},
  'Non-AC Swiss Cottage': {1:6300,2:12600,3:18900},
};
const TC_SUITE: Record<string, { rates: Record<number, number>; pax: number }> = {
  'Darbari Suite': { rates: {1:70000,2:140000,3:210000}, pax:4 },
  'Rajwadi Suite': { rates: {1:35000,2:70000,3:105000}, pax:2 },
};
const TC_SURCHARGE: Record<TCTier, Record<number, number>> = { none:{1:0,2:0,3:0}, s1:{1:2000,2:3500,3:4500}, s2:{1:4000,2:6000,3:8000} };
const TC_MATTRESS: Record<TCTier, { ac: number; nonac: number }> = { none:{ac:5500,nonac:4500}, s1:{ac:6000,nonac:5000}, s2:{ac:6000,nonac:5000} };
const SUITE_MATTRESS = 7750;
const TC_TENT_TYPES = ['Super Premium Tent','Premium Tent','Deluxe AC Swiss Cottage','Non-AC Swiss Cottage','Rajwadi Suite','Darbari Suite'];
const TC_TIER_LABEL: Record<TCTier, string> = { none:'Season Rate', s1:'Peak (Diwali / Full-Moon)', s2:'Christmas / New-Year Peak' };
const isSuite = (t: string) => !!TC_SUITE[t];
function tcTier(dt: Date): TCTier {
  const m = dt.getUTCMonth() + 1, d = dt.getUTCDate();
  if (m === 12 && d >= 18) return 's2';
  if (m === 1 && d <= 2) return 's2';
  if (m === 1 && d >= 20 && d <= 23) return 's2';
  if (m === 11 && ((d>=8&&d<=14)||(d>=22&&d<=25))) return 's1';
  if (m === 2 && d >= 18 && d <= 21) return 's1';
  if (m === 12 && d <= 17) return 's1';
  if (m === 1) return 's1';
  return 'none';
}

const fmtINR = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
const addDays = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));

function quoteResort(checkIn: Date, nights: number, rooms: number, single: boolean, extraPax: number, disc: number) {
  const perNight: { date: Date; tier: string; rate: number }[] = [];
  let one = 0;
  for (let n = 0; n < nights; n++) { const date = addDays(checkIn, n); const tier = resortTier(date); const rate = RESORT_NIGHTLY[tier]; perNight.push({ date, tier, rate }); one += rate; }
  let roomRent = one * rooms; if (single) roomRent *= 0.75;
  const discountAmount = Math.round(roomRent * disc / 100);
  const extras: { label: string; amount: number }[] = [];
  const eAmt = extraPax * RESORT_EXTRA_PAX * nights;
  if (eAmt) extras.push({ label: `Extra person x ${extraPax} x ${nights} night(s)`, amount: eAmt });
  const taxable = (roomRent - discountAmount) + extras.reduce((s,e)=>s+e.amount,0);
  const gst = Math.round(taxable * GST_RATE);
  return { perNight, roomRent, discountAmount, discountPct: disc, extras, gst, grandTotal: taxable + gst };
}
function quoteTC(tent: string, checkIn: Date, nights: number, rooms: number, single: boolean, extraMattress: number, disc: number) {
  const tier = tcTier(checkIn); const suite = isSuite(tent);
  let roomRent: number;
  if (suite) roomRent = TC_SUITE[tent].rates[nights] * rooms;
  else { const pp = TC_BASE[tent][nights] + TC_SURCHARGE[tier][nights]; roomRent = pp * 2 * rooms; if (single) roomRent *= 0.75; }
  const discountAmount = Math.round(roomRent * disc / 100);
  const extras: { label: string; amount: number }[] = [];
  const mRate = suite ? SUITE_MATTRESS : TC_MATTRESS[tier][tent.includes('Non-AC') ? 'nonac' : 'ac'];
  const mAmt = extraMattress * mRate * nights;
  if (mAmt) extras.push({ label: `Extra mattress x ${extraMattress} x ${nights} night(s)`, amount: mAmt });
  const taxable = (roomRent - discountAmount) + extras.reduce((s,e)=>s+e.amount,0);
  const gst = Math.round(taxable * GST_RATE);
  return { tier, perNight: null as any, roomRent, discountAmount, discountPct: disc, extras, gst, grandTotal: taxable + gst };
}

const MONTHS: Record<string, number> = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
function parseDate(raw: string): Date | null {
  const s = String(raw || '').trim().toLowerCase(); if (!s) return null;
  let d = 0, m = 0, y = 0, mm: RegExpMatchArray | null;
  if ((mm = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) { y = +mm[1]; m = +mm[2]; d = +mm[3]; }
  else if ((mm = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/))) { d = +mm[1]; m = +mm[2]; y = +mm[3]; }
  else if ((mm = s.match(/^(\d{1,2})\s*([a-z]{3,})\.?\s*(\d{2,4})?$/))) { d = +mm[1]; m = MONTHS[mm[2].slice(0,3)] || 0; y = mm[3] ? +mm[3] : 0; }
  else if ((mm = s.match(/^([a-z]{3,})\.?\s*(\d{1,2}),?\s*(\d{2,4})?$/))) { m = MONTHS[mm[1].slice(0,3)] || 0; d = +mm[2]; y = mm[3] ? +mm[3] : 0; }
  else return null;
  if (!d || !m) return null;
  if (y && y < 100) y += 2000;
  if (!y) y = m >= 11 ? 2026 : 2027;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return isNaN(dt.getTime()) ? null : dt;
}
const fmtDate = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const norm = (s: any) => String(s || '').trim().toLowerCase();

// The WhatsApp bot sends the *button label* ("Rann Tent Resort(2)" / "Tent City(1)"),
// never a clean slug. This used to be `norm(src.product) === 'resort'`, an exact match
// that nothing the bot could send ever satisfied — so every Resort enquiry silently
// fell through to Tent City pricing under a "The Tent City" header. Match fuzzily, the
// same way resolveTent() already does.
function resolveProduct(raw: any): 'resort' | 'tentcity' {
  const q = norm(raw);
  if (!q) return 'tentcity';
  if (q.includes('resort')) return 'resort';
  if (q === '2') return 'resort';   // buttons are labelled "Tent City(1)" / "Rann Tent Resort(2)"
  return 'tentcity';
}

function resolveTent(raw: any): string {
  const q = norm(raw); if (!q) return 'Super Premium Tent';
  const exact = TC_TENT_TYPES.find(t => norm(t) === q); if (exact) return exact;
  if (q.includes('super')) return 'Super Premium Tent';
  if (q.includes('darbari')) return 'Darbari Suite';
  if (q.includes('rajwadi')) return 'Rajwadi Suite';
  if (q.includes('non')) return 'Non-AC Swiss Cottage';
  if (q.includes('deluxe') || q.includes('swiss')) return 'Deluxe AC Swiss Cottage';
  if (q.includes('premium')) return 'Premium Tent';
  return 'Super Premium Tent';
}

// Exported so /api/rann-enquiry can price an enquiry without an HTTP hop back to
// this route (Vercel protects the raw deployment URL, and a bot mid-conversation
// shouldn't pay a network round-trip). This is the single source of rate truth —
// don't reimplement pricing anywhere else.
export function computeQuote(src: any): any {
  try {
    const product = resolveProduct(src.product);
    const checkIn = parseDate(src.date);
    const nights = Math.min(Math.max(parseInt(src.nights, 10) || 2, 1), product === 'resort' ? 2 : 3);
    const pax = Math.max(parseInt(src.pax, 10) || 2, 1);
    const rooms = Math.max(parseInt(src.rooms, 10) || 1, 1);
    const discount = Math.max(Math.min(parseFloat(src.discount) || 0, 50), 0);

    if (!checkIn) {
      return { ok: false, reply: "Sorry, I couldn't read that date. Please send your check-in date like *15/12/2026*." };
    }

    const perRoom = Math.ceil(pax / rooms);
    const single = perRoom === 1;
    const extra = Math.max(0, pax - 2 * rooms);

    let quote: any, tent = 'Premium AC Tent', tierNote = '';
    if (product === 'resort') {
      quote = quoteResort(checkIn, nights, rooms, single, extra, discount);
    } else {
      tent = resolveTent(src.tent);
      quote = quoteTC(tent, checkIn, nights, rooms, single && !isSuite(tent), extra, discount);
      tierNote = TC_TIER_LABEL[quote.tier as TCTier];
    }

    const productLabel = product === 'resort' ? 'Rann Tent Resort' : 'Rann Utsav — The Tent City';
    const L: string[] = [];
    L.push(`*${productLabel}*`);
    L.push(`${tent}  |  ${nights}N/${nights + 1}D`);
    L.push(`Check-in: ${fmtDate(checkIn)}  |  ${pax} guest(s), ${rooms} room(s)`);
    if (product === 'tentcity' && tierNote) L.push(`Rate period: ${tierNote}`);
    L.push('');
    if (quote.perNight) quote.perNight.forEach((p: any) => L.push(`${fmtDate(p.date)} — ${p.tier}: ${fmtINR(p.rate)}`));
    L.push(`Room rent: ${fmtINR(quote.roomRent)}`);
    if (quote.discountAmount) L.push(`Discount (${quote.discountPct}%): -${fmtINR(quote.discountAmount)}`);
    quote.extras.forEach((e: any) => L.push(`${e.label}: ${fmtINR(e.amount)}`));
    L.push(`GST @18%: ${fmtINR(quote.gst)}`);
    L.push(`*Total: ${fmtINR(quote.grandTotal)}*`);
    L.push('');
    L.push('_Indicative rate. Our team will confirm availability & share the final quote._');

    return {
      ok: true, reply: L.join('\n'),
      product, tent, nights, pax, rooms, checkIn: fmtDate(checkIn),
      ratePeriod: tierNote || undefined,
      roomRent: quote.roomRent, discount: quote.discountAmount, gst: quote.gst,
      grandTotal: quote.grandTotal, grandTotalText: fmtINR(quote.grandTotal),
    };
  } catch (e: any) {
    return { ok: false, reply: 'Something went wrong generating the quote. Our team will get back to you shortly.', error: e?.message };
  }
}


const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const sb = (path: string, init: any = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

const last10 = (raw: any) => String(raw || '').replace(/[^0-9]/g, '').slice(-10);

// Interakt may name the phone field any of these depending on how the variable is
// wired in the workflow — accept them all rather than fail silently.
function extractPhone(b: any): string {
  return last10(
    b.phone || b.phoneNumber || b.fullPhoneNumber || b.customerPhone ||
    b.phone_number || b.channel_phone_number || b.from || ''
  );
}

// yyyy-mm-dd for the lead's travel_date, from the dd/mm/yyyy the bot collects.
function toISODate(raw: any): string | null {
  const s = String(raw || '').trim();
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  const yy = y.length === 2 ? `20${y}` : y;
  const iso = `${yy}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

async function findLeadIdsByPhone(phone10: string): Promise<string[]> {
  const res = await sb(`leads?select=id&phone=ilike.*${phone10}&order=created_at.desc`);
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? rows.map((r: any) => r.id) : [];
}

async function insertInteraction(leadId: string, contentObj: any) {
  await sb('interactions', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      id: `wa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      lead_id: leadId,
      type: 'WhatsApp',
      content: JSON.stringify(contentObj),
      sentiment: null,
      timestamp: new Date().toISOString(),
    }),
  });
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const src = req.method === 'POST'
    ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {})
    : (req.query || {});

  // 1. Price it — same engine the bot already uses, called in-process.
  const quote = computeQuote(src);

  // Bad date etc. — hand the bot's own error text straight back, and don't create a
  // half-formed lead off an enquiry the customer hasn't actually completed.
  if (!quote?.ok) return res.status(200).json(quote);

  // 2. Capture it. Never let a CRM failure cost the customer their quote.
  let leadIds: string[] = [];
  let created = false;
  try {
    const phone10 = extractPhone(src);
    if (phone10.length === 10 && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      leadIds = await findLeadIdsByPhone(phone10);

      if (leadIds.length === 0) {
        const iso = toISODate(src.date);
        const pax = Math.max(parseInt(String(src.pax), 10) || 2, 1);
        const name = String(src.name || '').trim() || `WhatsApp — ${phone10}`;
        const row = {
          name,
          phone: phone10,
          email: '',
          contact: { phone: phone10, email: '' },
          status: 'New',
          temperature: 'Hot',                 // they completed a full quote flow — that's a hot signal
          source: 'WhatsApp',
          destination: 'Rann Utsav',
          pax,
          travel_date: iso,
          budget: quote.grandTotal || 0,
          trip_details: {
            destination: 'Rann Utsav',
            budget: quote.grandTotal || 0,
            startDate: iso || '',
            nights: quote.nights,
            paxConfig: { adults: pax, children: 0, childAges: [] },
          },
          preferences: {},
          vendors: [],
          tags: ['Rann Utsav', 'WhatsApp Inbound', 'Bot Qualified'],
          interested_services: ['Holiday Package'],
          reference_name: null,
          assigned_to: null,
          notes: `Auto-captured from the WhatsApp Rann bot.\n${quote.product === 'resort' ? 'Rann Tent Resort' : 'Tent City'} · ${quote.tent} · ${quote.checkIn} · ${quote.nights}N · ${quote.pax} pax · ${quote.rooms ?? '?'} room(s)\nQuoted: ${quote.grandTotalText}`,
        };
        const ins = await sb('leads', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(row),
        });
        const data = await ins.json().catch(() => null);
        const newLead = Array.isArray(data) ? data[0] : data;
        if (ins.ok && newLead?.id) {
          leadIds = [newLead.id];
          created = true;
        }
      }

      // Log the enquiry + the exact quote the customer was sent, so the agent opening
      // the lead sees what the bot promised rather than a bare "6".
      const summary = [
        `📩 Rann bot enquiry`,
        `${quote.product === 'resort' ? 'Rann Tent Resort' : 'Tent City'} · ${quote.tent}`,
        `${quote.checkIn} · ${quote.nights}N · ${quote.pax} pax${quote.rooms ? ` · ${quote.rooms} room(s)` : ''}`,
        `Quoted: ${quote.grandTotalText}`,
      ].join('\n');
      await Promise.all(leadIds.map(id => insertInteraction(id, {
        direction: 'in',
        text: summary,
        status: 'received',
        phone: phone10,
        rannEnquiry: {
          product: quote.product, tent: quote.tent, checkIn: quote.checkIn,
          nights: quote.nights, pax: quote.pax, rooms: quote.rooms,
          grandTotal: quote.grandTotal,
        },
      })));
    }
  } catch (e: any) {
    console.error('rann-enquiry capture failed (quote still sent):', e?.message);
  }

  // Same shape as /api/rann-quote so the workflow's "Send a Message {{1}}" is unchanged.
  return res.status(200).json({ ...quote, leadIds, leadCreated: created });
}
