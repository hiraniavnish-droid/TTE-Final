// ============================================================
// /api/team-summary — daily / weekly / monthly business summary → admin's WhatsApp
//
// GET  ?edition=evening|morning   ← Vercel Cron (Bearer CRON_SECRET when configured)
//        evening (9 PM IST): today-so-far DETAILED daily; + weekly (deep) on Sunday;
//                            + monthly (deep) on the month's last evening
//        morning (8 AM IST): yesterday's complete DEEP-DIVE daily; + monthly (deep) on the 1st
// POST { period: 'daily'|'weekly'|'monthly', level?: 'detailed'|'deep' }  ← "Send now" button
//
// Levels: 'detailed' = named leads/deals/payments + stale + outstanding + departures + pace.
//         'deep'     = detailed + sources + lost + vendor cash-out + pipeline moves + snapshot.
//
// All figures reuse the Dashboard's exact attribution rules so the summary can
// never disagree with the app: deals belong to the month they were WON (won_at,
// createdAt fallback); collected cash = payment records with status 'paid';
// profit-collected is per-lead, capped at that lead's own margin. Period
// boundaries are IST calendar days, not UTC. Item lists are capped so the
// message always stays within WhatsApp's size limit.
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const INTERAKT_API_KEY = process.env.INTERAKT_API_KEY || '';
const CRON_SECRET = process.env.CRON_SECRET || '';

// Agents broken out by name in the summary; everyone else rolls into "Others".
const FOCUS_AGENTS = ['Sonali', 'Prakash', 'Jigar'];
const ACTIVE_STAGES = ['New', 'Contacted', 'Proposal Sent', 'Discussion'];
const LIST_CAP = 8;       // max named items per section
const STALE_HOURS = 48;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function corsOrigin(origin: string): string | null {
  if (!origin) return null;
  if (origin === 'https://ttecrm.vercel.app') return origin;
  if (/^https:\/\/[a-z0-9-]+-avnishs-projects-[a-z0-9]+\.vercel\.app$/.test(origin)) return origin;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return origin;
  return null;
}

// IST "wall clock" — a Date whose UTC getters read as IST components.
const istNow = () => new Date(Date.now() + IST_OFFSET_MS);
function istDayStartMs(offsetDays: number): number {
  const n = istNow();
  return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + offsetDays) - IST_OFFSET_MS;
}
function istMonthStartMs(monthOffset: number): number {
  const n = istNow();
  return Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + monthOffset, 1) - IST_OFFSET_MS;
}
const istDateLabel = (ms: number) =>
  new Date(ms + IST_OFFSET_MS).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
// yyyy-mm-dd of an instant, in IST — used to match vendor-payment date strings.
const istYmd = (ms: number) => new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);

const fmtINR = (n: number) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const fmtCompact = (n: number) => {
  const v = Math.abs(Number(n) || 0);
  const sign = n < 0 ? '-' : '';
  if (v >= 10000000) return `${sign}₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `${sign}₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `${sign}₹${(v / 1000).toFixed(0)}k`;
  return `${sign}₹${Math.round(v)}`;
};

const sb = async (path: string) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  });
  return res.json().catch(() => []);
};

async function sendWhatsApp(fullPhoneNumber: string, message: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.interakt.ai/v1/public/message/', {
      method: 'POST',
      headers: { Authorization: `Basic ${INTERAKT_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullPhoneNumber, type: 'Text', data: { message } }),
    });
    const data = await res.json().catch(() => ({}));
    const ok = res.ok && data?.result !== false;
    if (!ok) {
      // Keep provider feedback available in Vercel logs without emitting a recipient
      // number, API credential, or message content.
      console.warn('[team-summary] WhatsApp delivery rejected', JSON.stringify({
        status: res.status,
        error: String(data?.message || data?.error || data?.detail || 'No provider error returned.').slice(0, 300),
      }));
    }
    return ok;
  } catch (e: any) {
    console.warn('[team-summary] WhatsApp delivery request failed', String(e?.message || 'Unknown network error').slice(0, 300));
    return false;
  }
}

function toFullPhone(raw: string): string | null {
  const digits = String(raw || '').replace(/[^0-9]/g, '');
  if (digits.length === 10) return '91' + digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return '91' + digits.slice(1);
  return digits.length >= 10 ? digits : null;
}

// ─── Summary computation ───────────────────────────────────────

type Level = 'detailed' | 'deep';
interface Windowed { startMs: number; endMs: number; label: string }

const agentBucket = (name: string | null) =>
  name && FOCUS_AGENTS.includes(name) ? name : (name ? 'Others' : 'Unassigned');
const agentLine = (obj: Record<string, any>, fmt: (v: any) => string) =>
  [...FOCUS_AGENTS, 'Others', 'Unassigned'].filter(a => obj[a]).map(a => `${a}: ${fmt(obj[a])}`).join(' · ');
const capNote = (total: number) => (total > LIST_CAP ? `\n…and ${total - LIST_CAP} more` : '');

function buildSummary(leads: any[], payments: any[], logs: any[], win: Windowed, level: Level): string {
  const inWin = (iso: string | null) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= win.startMs && t < win.endMs;
  };
  const nowMs = Date.now();

  // ── New leads ──
  const newLeads = leads.filter(l => inWin(l.created_at));
  const newByAgent: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  for (const l of newLeads) {
    newByAgent[agentBucket(l.assigned_to)] = (newByAgent[agentBucket(l.assigned_to)] || 0) + 1;
    bySource[l.source || 'Other'] = (bySource[l.source || 'Other'] || 0) + 1;
  }

  // ── Won (by won_at, createdAt fallback — same as Dashboard) ──
  const wonLeads = leads
    .filter(l => l.status === 'Won' && !l.legacy && inWin(l.won_at || l.created_at))
    .sort((a, b) => (b.commercials?.sellingPrice || 0) - (a.commercials?.sellingPrice || 0));
  const wonValue = wonLeads.reduce((s, l) => s + (l.commercials?.sellingPrice || 0), 0);

  // ── Cash collected (paid_at) — matches bank/Razorpay ──
  const paidInWin = payments.filter(p => p.status === 'paid' && inWin(p.paid_at))
    .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0));
  const collected = paidInWin.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  // ── Stale active leads per agent (48h+ untouched) ──
  const staleByAgent: Record<string, number> = {};
  for (const l of leads) {
    if (!ACTIVE_STAGES.includes(l.status)) continue;
    const touched = new Date(l.last_status_update || l.created_at).getTime();
    if (nowMs - touched < STALE_HOURS * 3600e3) continue;
    staleByAgent[agentBucket(l.assigned_to)] = (staleByAgent[agentBucket(l.assigned_to)] || 0) + 1;
  }

  // ── Top outstanding balances (all Won deals, lifetime) ──
  const collectedByLead: Record<string, number> = {};
  for (const p of payments) {
    if (!p.lead_id || p.status !== 'paid') continue;
    collectedByLead[p.lead_id] = (collectedByLead[p.lead_id] || 0) + (Number(p.amount) || 0);
  }
  const outstanding = leads
    .filter(l => l.status === 'Won' && !l.legacy && (l.commercials?.sellingPrice || 0) > (collectedByLead[l.id] || 0))
    .map(l => ({ name: l.name, due: (l.commercials?.sellingPrice || 0) - (collectedByLead[l.id] || 0) }))
    .sort((a, b) => b.due - a.due)
    .slice(0, 5);

  // ── Trips: ongoing now + departing in the next 3 IST days (Won trips only) ──
  // Trip length = the lead's "nights" field; no nights set = 1-day trip. Never assume longer.
  const depStart = istDayStartMs(0), depEnd = istDayStartMs(3);
  const wonWithDate = leads.filter(l => l.status === 'Won' && !l.legacy && l.trip_details?.startDate);
  const tripDayStart = (iso: string) => {
    const d = new Date(new Date(iso).getTime() + IST_OFFSET_MS);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - IST_OFFSET_MS;
  };
  // Started before today and not yet past checkout day (today's starts show under "Departing").
  const ongoing = wonWithDate.filter(l => {
    const s = tripDayStart(l.trip_details.startDate);
    const nights = Number(l.trip_details.nights) || 0;
    const endExclusive = s + (nights + 1) * 24 * 3600e3; // through the checkout day
    return s < istDayStartMs(0) && nowMs < endExclusive;
  }).slice(0, 6);
  const departures = wonWithDate
    .filter(l => {
      const t = tripDayStart(l.trip_details.startDate);
      return t >= depStart && t < depEnd;
    })
    .sort((a, b) => new Date(a.trip_details.startDate).getTime() - new Date(b.trip_details.startDate).getTime())
    .slice(0, 6);

  // ── Pace: revenue MTD vs last month same-elapsed-time ──
  const mtdStart = istMonthStartMs(0);
  const elapsed = nowMs - mtdStart;
  const lastStart = istMonthStartMs(-1);
  const revIn = (s: number, e: number) => leads
    .filter(l => l.status === 'Won' && !l.legacy)
    .filter(l => { const t = new Date(l.won_at || l.created_at).getTime(); return t >= s && t < e; })
    .reduce((sum, l) => sum + (l.commercials?.sellingPrice || 0), 0);
  const mtdRev = revIn(mtdStart, nowMs);
  const lastRev = revIn(lastStart, Math.min(lastStart + elapsed, mtdStart));
  const paceLine = lastRev > 0
    ? `${fmtCompact(mtdRev)} MTD vs ${fmtCompact(lastRev)} same time last month (${mtdRev >= lastRev ? '↑' : '↓'}${Math.abs(Math.round(((mtdRev - lastRev) / lastRev) * 100))}%)`
    : `${fmtCompact(mtdRev)} MTD (no comparable revenue last month)`;

  // ─── Assemble ───
  let msg = `📊 *${win.label}*\n`;

  msg += `\n🆕 *New Leads: ${newLeads.length}*`;
  if (newLeads.length > 0) {
    msg += `\n${agentLine(newByAgent, v => String(v))}`;
    for (const l of newLeads.slice(0, LIST_CAP)) {
      msg += `\n• ${l.name}${l.trip_details?.destination ? ` — ${l.trip_details.destination}` : ''} · ${l.source || 'Other'} · ${l.assigned_to || 'unassigned'}`;
    }
    msg += capNote(newLeads.length);
    if (level === 'deep') {
      msg += `\n_Sources: ${Object.entries(bySource).map(([s, n]) => `${s} ${n}`).join(' · ')}_`;
    }
  }

  msg += `\n\n🏆 *Won: ${wonLeads.length} deal${wonLeads.length === 1 ? '' : 's'} · ${fmtCompact(wonValue)}*`;
  for (const l of wonLeads.slice(0, LIST_CAP)) {
    const v = l.commercials?.sellingPrice || 0;
    const margin = v - (l.commercials?.netCost || 0);
    msg += `\n• ${l.name} — ${fmtINR(v)} (margin ${fmtCompact(margin)}) · ${l.assigned_to || 'unassigned'}`;
  }
  msg += capNote(wonLeads.length);

  if (level === 'deep') {
    // Lost in window — approximated by last_status_update since there's no lost_at column.
    const lostLeads = leads.filter(l => l.status === 'Lost' && inWin(l.last_status_update));
    if (lostLeads.length > 0) {
      msg += `\n\n❌ *Lost: ${lostLeads.length}*`;
      for (const l of lostLeads.slice(0, 5)) msg += `\n• ${l.name} · ${l.assigned_to || 'unassigned'}`;
      if (lostLeads.length > 5) msg += `\n…and ${lostLeads.length - 5} more`;
    }
  }

  msg += `\n\n💰 *Collected: ${fmtINR(collected)}*`;
  for (const p of paidInWin.slice(0, LIST_CAP)) {
    const m = p.source === 'razorpay' ? 'Razorpay' : (p.method || 'Manual');
    msg += `\n• ${fmtINR(Number(p.amount) || 0)} — ${p.customer_name || p.lead_name || 'Customer'} · ${m}${p.created_by ? ` · by ${p.created_by}` : ''}`;
  }
  msg += capNote(paidInWin.length);

  if (level === 'deep') {
    // Vendor cash paid out in window (vendor payment dates are plain yyyy-mm-dd strings).
    const winDays = new Set<string>();
    for (let t = win.startMs; t < win.endMs; t += 24 * 3600e3) winDays.add(istYmd(t));
    winDays.add(istYmd(win.endMs - 1));
    let vendorOut = 0, vendorOwed = 0;
    for (const l of leads) {
      for (const v of (l.vendors || [])) {
        let paid = 0;
        for (const vp of (v.payments || [])) {
          paid += Number(vp.amount) || 0;
          if (vp.date && winDays.has(String(vp.date).slice(0, 10))) vendorOut += Number(vp.amount) || 0;
        }
        if (l.status === 'Won' && !l.legacy) vendorOwed += Math.max((v.cost || 0) - paid, 0);
      }
      if (l.status === 'Won' && !l.legacy && (!l.vendors || l.vendors.length === 0)) vendorOwed += l.commercials?.netCost || 0;
    }
    msg += `\n\n🏭 *Vendors:* paid out ${fmtINR(vendorOut)} · total owed ${fmtCompact(vendorOwed)}`;

    // Pipeline moves per agent (STATUS_CHANGE activity in window)
    const movesByAgent: Record<string, number> = {};
    for (const g of logs) {
      if (g.action_type !== 'STATUS_CHANGE' || !inWin(g.timestamp)) continue;
      movesByAgent[agentBucket(g.agent_name)] = (movesByAgent[agentBucket(g.agent_name)] || 0) + 1;
    }
    const totalMoves = Object.values(movesByAgent).reduce((s, n) => s + n, 0);
    msg += `\n🔄 *Pipeline moves: ${totalMoves}*${totalMoves > 0 ? ` — ${agentLine(movesByAgent, v => String(v))}` : ''}`;

    // Current pipeline snapshot
    const snap: Record<string, number> = {};
    let pipeValue = 0;
    for (const l of leads) {
      if (!ACTIVE_STAGES.includes(l.status)) continue;
      snap[l.status] = (snap[l.status] || 0) + 1;
      pipeValue += l.trip_details?.budget || 0;
    }
    msg += `\n📦 Now: ${ACTIVE_STAGES.map(s => `${s === 'Proposal Sent' ? 'Proposal' : s} ${snap[s] || 0}`).join(' · ')}${pipeValue > 0 ? ` · ${fmtCompact(pipeValue)}` : ''}`;
  }

  const staleTotal = Object.values(staleByAgent).reduce((s, n) => s + n, 0);
  if (staleTotal > 0) {
    msg += `\n\n⚠️ *Stale (${STALE_HOURS}h+ untouched): ${staleTotal}*\n${agentLine(staleByAgent, v => String(v))}`;
  }

  if (outstanding.length > 0) {
    msg += `\n\n💸 *Top Outstanding:*\n${outstanding.map(o => `• ${o.name} — ${fmtCompact(o.due)}`).join('\n')}`;
  }

  if (ongoing.length > 0) {
    msg += `\n\n🧳 *Ongoing trips: ${ongoing.length}*`;
    for (const l of ongoing) {
      const nights = Number(l.trip_details.nights) || 0;
      msg += `\n• ${l.name}${l.trip_details?.destination ? ` (${l.trip_details.destination})` : ''}${nights > 0 ? ` — ${nights}N` : ''}`;
    }
  }

  if (departures.length > 0) {
    msg += `\n\n✈️ *Departing soon:*`;
    for (const l of departures) {
      msg += `\n• ${l.name}${l.trip_details?.destination ? ` (${l.trip_details.destination})` : ''} — ${istDateLabel(new Date(l.trip_details.startDate).getTime())}`;
    }
  }

  msg += `\n\n📈 *Pace:* ${paceLine}`;
  return msg;
}

// Month-to-date business status — Dashboard "This Month" formulas verbatim.
function buildBusinessStatus(leads: any[], payments: any[]): string {
  const startMs = istMonthStartMs(0);
  const endMs = Date.now();

  const collectedByLead: Record<string, number> = {};
  for (const p of payments) {
    if (!p.lead_id || p.status !== 'paid') continue;
    collectedByLead[p.lead_id] = (collectedByLead[p.lead_id] || 0) + (Number(p.amount) || 0);
  }

  let totalRevenue = 0, revenueCollected = 0, totalCost = 0, costPaid = 0, profitCollected = 0;
  for (const l of leads) {
    if (l.status !== 'Won' || l.legacy) continue;
    const t = new Date(l.won_at || l.created_at).getTime();
    if (t < startMs || t >= endMs) continue;
    const rev = l.commercials?.sellingPrice || 0;
    const cost = l.commercials?.netCost || 0;
    const revCollected = Math.min(collectedByLead[l.id] || 0, rev || (collectedByLead[l.id] || 0));
    let vendorPaid = 0;
    for (const v of (l.vendors || [])) {
      const paid = (v.payments || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
      vendorPaid += Math.min(paid, v.cost || 0);
    }
    totalRevenue += rev;
    revenueCollected += revCollected;
    totalCost += cost;
    costPaid += Math.min(vendorPaid, cost || vendorPaid);
    profitCollected += Math.max(0, revCollected - cost);
  }
  const netProfit = totalRevenue - totalCost;
  const monthName = new Date(Date.now() + IST_OFFSET_MS).toLocaleDateString('en-IN', { month: 'long', timeZone: 'UTC' });

  return (
    `━━━━━━━━━━\n📈 *Business Status (${monthName} so far)*\n` +
    `Revenue: ${fmtCompact(totalRevenue)} — collected ${fmtCompact(revenueCollected)} · pending ${fmtCompact(Math.max(totalRevenue - revenueCollected, 0))}\n` +
    `Profit: ${fmtCompact(netProfit)} — collected ${fmtCompact(profitCollected)} · pending ${fmtCompact(netProfit - profitCollected)}\n` +
    `Owed to vendors: ${fmtCompact(Math.max(totalCost - costPaid, 0))}`
  );
}

// ─── Quick commands (single-topic, on-demand — no period window) ──────────
// Each reuses the exact same per-lead formulas as the Dashboard/buildSummary
// so a quick command can never disagree with the app or the daily summary.

type QuickKind = 'revenue' | 'profit' | 'pending' | 'vendors' | 'leaderboard' | 'stale' | 'pipeline' | 'hot' | 'trips' | 'agent';

function outstandingList(leads: any[], payments: any[]): { name: string; due: number }[] {
  const collectedByLead: Record<string, number> = {};
  for (const p of payments) {
    if (!p.lead_id || p.status !== 'paid') continue;
    collectedByLead[p.lead_id] = (collectedByLead[p.lead_id] || 0) + (Number(p.amount) || 0);
  }
  return leads
    .filter(l => l.status === 'Won' && !l.legacy && (l.commercials?.sellingPrice || 0) > (collectedByLead[l.id] || 0))
    .map(l => ({ name: l.name, due: (l.commercials?.sellingPrice || 0) - (collectedByLead[l.id] || 0) }))
    .sort((a, b) => b.due - a.due);
}

function tripLists(leads: any[]) {
  const nowMs = Date.now();
  const depStart = istDayStartMs(0), depEnd = istDayStartMs(3);
  const wonWithDate = leads.filter(l => l.status === 'Won' && !l.legacy && l.trip_details?.startDate);
  const tripDayStart = (iso: string) => {
    const d = new Date(new Date(iso).getTime() + IST_OFFSET_MS);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - IST_OFFSET_MS;
  };
  const ongoing = wonWithDate.filter(l => {
    const s = tripDayStart(l.trip_details.startDate);
    const nights = Number(l.trip_details.nights) || 0;
    const endExclusive = s + (nights + 1) * 24 * 3600e3;
    return s < istDayStartMs(0) && nowMs < endExclusive;
  });
  const departures = wonWithDate
    .filter(l => { const t = tripDayStart(l.trip_details.startDate); return t >= depStart && t < depEnd; })
    .sort((a, b) => new Date(a.trip_details.startDate).getTime() - new Date(b.trip_details.startDate).getTime());
  return { ongoing, departures };
}

function buildQuick(kind: QuickKind, agent: string | undefined, leads: any[], payments: any[], logs: any[]): string {
  const nowMs = Date.now();
  const monthName = new Date(nowMs + IST_OFFSET_MS).toLocaleDateString('en-IN', { month: 'long', timeZone: 'UTC' });
  const startMs = istMonthStartMs(0);

  if (kind === 'revenue' || kind === 'profit') {
    const collectedByLead: Record<string, number> = {};
    for (const p of payments) {
      if (!p.lead_id || p.status !== 'paid') continue;
      collectedByLead[p.lead_id] = (collectedByLead[p.lead_id] || 0) + (Number(p.amount) || 0);
    }
    let totalRevenue = 0, revenueCollected = 0, totalCost = 0, costPaid = 0, profitCollected = 0;
    for (const l of leads) {
      if (l.status !== 'Won' || l.legacy) continue;
      const t = new Date(l.won_at || l.created_at).getTime();
      if (t < startMs || t >= nowMs) continue;
      const rev = l.commercials?.sellingPrice || 0;
      const cost = l.commercials?.netCost || 0;
      const revCollected = Math.min(collectedByLead[l.id] || 0, rev || (collectedByLead[l.id] || 0));
      let vendorPaid = 0;
      for (const v of (l.vendors || [])) {
        const paid = (v.payments || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
        vendorPaid += Math.min(paid, v.cost || 0);
      }
      totalRevenue += rev; revenueCollected += revCollected;
      totalCost += cost; costPaid += Math.min(vendorPaid, cost || vendorPaid);
      profitCollected += Math.max(0, revCollected - cost);
    }
    const netProfit = totalRevenue - totalCost;
    const lifetimePending = outstandingList(leads, payments).reduce((s, o) => s + o.due, 0);
    if (kind === 'revenue') {
      return `💰 *Revenue — ${monthName}*\nTotal: ${fmtINR(totalRevenue)}\nCollected: ${fmtINR(revenueCollected)}\nPending: ${fmtINR(Math.max(totalRevenue - revenueCollected, 0))}\n\nLifetime pending (all Won deals): ${fmtINR(lifetimePending)}`;
    }
    return `📈 *Profit — ${monthName}*\nNet profit: ${fmtINR(netProfit)}\nCollected: ${fmtINR(profitCollected)}\nPending: ${fmtINR(netProfit - profitCollected)}`;
  }

  if (kind === 'pending') {
    const list = outstandingList(leads, payments);
    const total = list.reduce((s, o) => s + o.due, 0);
    let msg = `💸 *Pending Collections — ${fmtINR(total)} total*`;
    for (const o of list.slice(0, 15)) msg += `\n• ${o.name} — ${fmtCompact(o.due)}`;
    if (list.length > 15) msg += `\n…and ${list.length - 15} more`;
    if (list.length === 0) msg += `\nNothing pending — fully collected.`;
    return msg;
  }

  if (kind === 'vendors') {
    const owedByVendor: Record<string, number> = {};
    let totalOwed = 0, totalPaid = 0;
    for (const l of leads) {
      if (l.status !== 'Won' || l.legacy) continue;
      for (const v of (l.vendors || [])) {
        const paid = (v.payments || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
        const owed = Math.max((v.cost || 0) - paid, 0);
        totalPaid += Math.min(paid, v.cost || paid);
        totalOwed += owed;
        if (owed > 0) owedByVendor[v.name || 'Unnamed vendor'] = (owedByVendor[v.name || 'Unnamed vendor'] || 0) + owed;
      }
      if (!l.vendors || l.vendors.length === 0) totalOwed += l.commercials?.netCost || 0;
    }
    const rows = Object.entries(owedByVendor).sort((a, b) => b[1] - a[1]).slice(0, 10);
    let msg = `🏭 *Vendors — ${fmtINR(totalOwed)} owed total*\nPaid out so far: ${fmtINR(totalPaid)}`;
    if (rows.length > 0) msg += `\n\n*Top owed:*` + rows.map(([n, v]) => `\n• ${n} — ${fmtCompact(v)}`).join('');
    return msg;
  }

  if (kind === 'leaderboard') {
    const rows: Record<string, { revenue: number; count: number }> = {};
    for (const l of leads) {
      if (l.status !== 'Won' || l.legacy) continue;
      const t = new Date(l.won_at || l.created_at).getTime();
      if (t < startMs || t >= nowMs) continue;
      const b = agentBucket(l.assigned_to);
      if (!rows[b]) rows[b] = { revenue: 0, count: 0 };
      rows[b].revenue += l.commercials?.sellingPrice || 0;
      rows[b].count += 1;
    }
    const ranked = Object.entries(rows).sort((a, b) => b[1].revenue - a[1].revenue);
    let msg = `🏆 *Leaderboard — ${monthName}*`;
    if (ranked.length === 0) msg += `\nNo deals won yet this month.`;
    ranked.forEach(([name, r], i) => { msg += `\n${i + 1}. ${name} — ${fmtCompact(r.revenue)} (${r.count} deal${r.count === 1 ? '' : 's'})`; });
    return msg;
  }

  if (kind === 'stale') {
    const rows = leads
      .filter(l => ACTIVE_STAGES.includes(l.status))
      .map(l => ({ l, hrs: (nowMs - new Date(l.last_status_update || l.created_at).getTime()) / 3600e3 }))
      .filter(r => r.hrs >= STALE_HOURS)
      .sort((a, b) => b.hrs - a.hrs);
    let msg = `⚠️ *Stale leads (${STALE_HOURS}h+ untouched): ${rows.length}*`;
    for (const r of rows.slice(0, 15)) msg += `\n• ${r.l.name} — ${Math.floor(r.hrs / 24)}d untouched · ${r.l.assigned_to || 'unassigned'} · ${r.l.status}`;
    if (rows.length > 15) msg += `\n…and ${rows.length - 15} more`;
    if (rows.length === 0) msg += `\nNothing stale — pipeline is fresh.`;
    return msg;
  }

  if (kind === 'pipeline') {
    const snap: Record<string, { count: number; value: number }> = {};
    for (const l of leads) {
      if (!ACTIVE_STAGES.includes(l.status)) continue;
      if (!snap[l.status]) snap[l.status] = { count: 0, value: 0 };
      snap[l.status].count += 1;
      snap[l.status].value += l.trip_details?.budget || 0;
    }
    let msg = `📦 *Pipeline snapshot*`;
    for (const s of ACTIVE_STAGES) {
      const r = snap[s] || { count: 0, value: 0 };
      msg += `\n• ${s}: ${r.count}${r.value > 0 ? ` — ${fmtCompact(r.value)}` : ''}`;
    }
    return msg;
  }

  if (kind === 'hot') {
    const hot = leads.filter(l => l.temperature === 'Hot' && l.status !== 'Won' && l.status !== 'Lost');
    let msg = `🔥 *Hot leads: ${hot.length}*`;
    for (const l of hot.slice(0, 15)) msg += `\n• ${l.name}${l.trip_details?.destination ? ` — ${l.trip_details.destination}` : ''} · ${l.assigned_to || 'unassigned'} · ${l.status}`;
    if (hot.length > 15) msg += `\n…and ${hot.length - 15} more`;
    if (hot.length === 0) msg += `\nNo hot leads right now.`;
    return msg;
  }

  if (kind === 'trips') {
    const { ongoing, departures } = tripLists(leads);
    let msg = `✈️ *Trips*`;
    msg += `\n\n🧳 Ongoing now: ${ongoing.length}`;
    for (const l of ongoing.slice(0, 10)) {
      const nights = Number(l.trip_details.nights) || 0;
      msg += `\n• ${l.name}${l.trip_details?.destination ? ` (${l.trip_details.destination})` : ''}${nights > 0 ? ` — ${nights}N` : ''}`;
    }
    msg += `\n\n🛫 Departing (next 3 days): ${departures.length}`;
    for (const l of departures.slice(0, 10)) {
      msg += `\n• ${l.name}${l.trip_details?.destination ? ` (${l.trip_details.destination})` : ''} — ${istDateLabel(new Date(l.trip_details.startDate).getTime())}`;
    }
    return msg;
  }

  // agent
  const name = agent || 'Unknown';
  const mine = leads.filter(l => l.assigned_to === name);
  const activeByStage: Record<string, number> = {};
  for (const l of mine) if (ACTIVE_STAGES.includes(l.status)) activeByStage[l.status] = (activeByStage[l.status] || 0) + 1;
  const wonThisMonth = mine.filter(l => l.status === 'Won' && !l.legacy && new Date(l.won_at || l.created_at).getTime() >= startMs);
  const wonValue = wonThisMonth.reduce((s, l) => s + (l.commercials?.sellingPrice || 0), 0);
  const stale = mine.filter(l => ACTIVE_STAGES.includes(l.status) && (nowMs - new Date(l.last_status_update || l.created_at).getTime()) >= STALE_HOURS * 3600e3).length;
  const pending = outstandingList(mine, payments);
  const pendingTotal = pending.reduce((s, o) => s + o.due, 0);

  let msg = `👤 *${name} — ${monthName}*`;
  msg += `\n\n📦 Active pipeline: ${mine.filter(l => ACTIVE_STAGES.includes(l.status)).length}`;
  for (const s of ACTIVE_STAGES) if (activeByStage[s]) msg += `\n• ${s}: ${activeByStage[s]}`;
  msg += `\n\n🏆 Won this month: ${wonThisMonth.length} — ${fmtCompact(wonValue)}`;
  msg += `\n⚠️ Stale (${STALE_HOURS}h+): ${stale}`;
  msg += `\n💸 Pending collections: ${fmtINR(pendingTotal)}`;
  return msg;
}

function windowFor(period: 'daily' | 'weekly' | 'monthly', complete: boolean): Windowed {
  if (period === 'weekly') {
    const endMs = complete ? istDayStartMs(0) : Date.now();
    const startMs = istDayStartMs(complete ? -7 : -6);
    return { startMs, endMs, label: `TTE Weekly Summary — ${istDateLabel(startMs)} to ${istDateLabel(endMs - 1)}` };
  }
  if (period === 'monthly') {
    const endMs = complete ? istMonthStartMs(0) : Date.now();
    const startMs = complete ? istMonthStartMs(-1) : istMonthStartMs(0);
    const m = new Date(startMs + IST_OFFSET_MS).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return { startMs, endMs, label: `TTE Monthly Summary — ${m}` };
  }
  if (complete) {
    const startMs = istDayStartMs(-1);
    return { startMs, endMs: istDayStartMs(0), label: `TTE Daily Summary — ${istDateLabel(startMs)} (full day)` };
  }
  const startMs = istDayStartMs(0);
  return { startMs, endMs: Date.now(), label: `TTE Daily Summary — ${istDateLabel(startMs)}` };
}

export default async function handler(req: any, res: any) {
  const allowed = corsOrigin(req.headers?.origin || '');
  if (allowed) res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !INTERAKT_API_KEY) {
    return res.status(500).json({ error: 'Summary is not configured on the server.' });
  }

  if (req.method === 'GET' && CRON_SECRET) {
    if ((req.headers?.authorization || '') !== `Bearer ${CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
  }

  try {
    const runs: { period: 'daily' | 'weekly' | 'monthly'; complete: boolean; level: Level }[] = [];
    let quick: { kind: QuickKind; agent?: string } | null = null;
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const QUICK_KINDS = ['revenue', 'profit', 'pending', 'vendors', 'leaderboard', 'stale', 'pipeline', 'hot', 'trips', 'agent'];
      if (QUICK_KINDS.includes(body.kind)) {
        quick = { kind: body.kind, agent: body.agent };
      } else {
        const period = ['daily', 'weekly', 'monthly'].includes(body.period) ? body.period : 'daily';
        const level: Level = body.level === 'deep' ? 'deep' : 'detailed';
        runs.push({ period, complete: false, level });
      }
    } else {
      const edition = req.query?.edition === 'morning' ? 'morning' : 'evening';
      const n = istNow();
      if (edition === 'morning') {
        runs.push({ period: 'daily', complete: true, level: 'deep' });
        if (n.getUTCDate() === 1) runs.push({ period: 'monthly', complete: true, level: 'deep' });
      } else {
        runs.push({ period: 'daily', complete: false, level: 'detailed' });
        if (n.getUTCDay() === 0) runs.push({ period: 'weekly', complete: false, level: 'deep' });
        const tomorrow = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1));
        if (tomorrow.getUTCDate() === 1) runs.push({ period: 'monthly', complete: false, level: 'deep' });
      }
    }

    const logSinceIso = new Date(istDayStartMs(-8)).toISOString();
    const [leads, payments, logs, admins] = await Promise.all([
      sb('leads?select=id,name,status,source,assigned_to,created_at,last_status_update,won_at,commercials,vendors,trip_details,legacy,temperature'),
      sb('payments?select=amount,status,paid_at,lead_id,method,source,customer_name,lead_name,created_by'),
      sb(`activity_logs?select=agent_name,action_type,timestamp&timestamp=gte.${encodeURIComponent(logSinceIso)}`),
      sb('users?select=name,phone&role=eq.admin&phone=not.is.null'),
    ]);
    const phones = (Array.isArray(admins) ? admins : []).map((u: any) => toFullPhone(u.phone)).filter(Boolean) as string[];
    if (phones.length === 0) return res.status(200).json({ ok: true, sent: 0, skipped: 'no admin phone on file' });

    const messages = quick
      ? [buildQuick(quick.kind, quick.agent, leads, payments, logs)]
      : (() => {
          const status = buildBusinessStatus(leads, payments);
          return runs.map(r => {
            const win = windowFor(r.period, r.complete);
            const full = buildSummary(leads, payments, logs, win, r.level) + '\n\n' + status;
            // WhatsApp text cap is 4096 chars — trim defensively rather than fail the send.
            return full.length > 3900 ? full.slice(0, 3880) + '\n…(truncated)' : full;
          });
        })();

    let sent = 0;
    for (const msg of messages) {
      const results = await Promise.all(phones.map(p => sendWhatsApp(p, msg)));
      sent += results.filter(Boolean).length;
    }
    console.log('[team-summary]', JSON.stringify({ runs, quick, recipients: phones.length, sent }));
    return res.status(200).json({ ok: true, runs, quick, recipients: phones.length, sent });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
}
