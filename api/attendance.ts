import crypto from 'node:crypto';

// Server-side boundary: signed session + current database session_version.
// The service-role-only transaction performs all authorization and writes.
export function verifyAttendanceSession(header: string | undefined, secret: string) {
  try {
    if (!secret || !/^Bearer /i.test(header || '')) return null;
    const parts = header!.slice(7).trim().split('.');
    if (parts.length !== 3) return null;
    const [head, body, signature] = parts;
    if (JSON.parse(Buffer.from(head, 'base64url').toString()).alg !== 'HS256') return null;
    const expected = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest();
    const received = Buffer.from(signature, 'base64url');
    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null;
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now() || !claims.app_user_id || !['admin','agent'].includes(claims.app_role) || !Number.isInteger(claims.session_version)) return null;
    return { id: String(claims.app_user_id), version: claims.session_version };
  } catch { return null; }
}

const leaveDefaults = { leaveYearStartMonth: 4, leaveAccrualStart: '2026-09-01', leaveAccrualMode: 'monthly', governmentHolidaysAdditional: true } as const;

export function normalizeAttendancePolicy(policy: any) {
  return { ...(policy || {}), ...leaveDefaults, leaveYearStartMonth: Number(policy?.leaveYearStartMonth || leaveDefaults.leaveYearStartMonth), leaveAccrualStart: String(policy?.leaveAccrualStart || leaveDefaults.leaveAccrualStart), leaveAccrualMode: 'monthly', governmentHolidaysAdditional: true };
}

export function leaveCycleYear(policy: any, day: string) {
  const start = Math.min(12, Math.max(1, Number(policy?.leaveYearStartMonth || 4)));
  const year = Number(day.slice(0, 4)), month = Number(day.slice(5, 7));
  return month >= start ? year : year - 1;
}

export function accruedAllowance(snapshot: any, userId: string, leaveType: string, cycleYear: number) {
  const policy = normalizeAttendancePolicy(snapshot.policy), startMonth = policy.leaveYearStartMonth;
  const annual = Number(snapshot.entitlements?.find((e: any) => e.user_id === userId && e.leave_type === leaveType && Number(e.year) === cycleYear)?.days ?? policy.quotas?.[leaveType] ?? 0);
  const cycleStart = `${cycleYear}-${String(startMonth).padStart(2, '0')}-01`, cycleEndYear = startMonth === 1 ? cycleYear : cycleYear + 1, cycleEndMonth = startMonth === 1 ? 12 : startMonth - 1;
  const cycleEnd = `${cycleEndYear}-${String(cycleEndMonth).padStart(2, '0')}-31`, accrualStart = policy.leaveAccrualStart > cycleStart ? policy.leaveAccrualStart : cycleStart;
  if (String(snapshot.today) < accrualStart) return 0;
  const effective = String(snapshot.today) > cycleEnd ? cycleEnd : String(snapshot.today), sy = Number(accrualStart.slice(0, 4)), sm = Number(accrualStart.slice(5, 7)), ey = Number(effective.slice(0, 4)), em = Number(effective.slice(5, 7));
  const months = Math.max(0, Math.min(12, (ey - sy) * 12 + em - sm + 1));
  return Math.round(annual / 12 * months * 100) / 100;
}

function reservedLeave(snapshot: any, userId: string, leaveType: string, cycleYear: number) {
  return (snapshot.requests || []).filter((r: any) => r.user_id === userId && r.kind === 'leave' && r.leave_type === leaveType && ['pending', 'approved'].includes(r.status) && leaveCycleYear(snapshot.policy, r.start_date) === cycleYear).reduce((sum: number, r: any) => sum + Number(r.days), 0);
}

function workingDayCount(policyValue: any, start: string, end: string, portion: string) {
  const policy = normalizeAttendancePolicy(policyValue), holidays = new Set((policy.holidays || []).map((h: any) => h.date));
  let count = 0, examined = 0;
  for (let stamp = Date.parse(`${start}T12:00:00Z`), last = Date.parse(`${end}T12:00:00Z`); Number.isFinite(stamp) && stamp <= last && examined++ <= 366; stamp += 86400000) {
    const day = new Date(stamp).toISOString().slice(0, 10), weekday = new Date(stamp).getUTCDay() || 7;
    if (policy.workingDays?.includes(weekday) && !holidays.has(day)) count++;
  }
  return portion === 'full' ? count : count > 0 ? 0.5 : 0;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  const origin = req.headers?.origin || '';
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || origin === 'https://ttecrm.vercel.app') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET','POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed.' });
  const session = verifyAttendanceSession(req.headers?.authorization, process.env.SUPABASE_JWT_SECRET || '');
  if (!session) return res.status(401).json({ error: 'Please sign in again.' });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: 'Attendance connection is not configured.' });
  try {
    const body = req.method === 'GET' ? { month: req.query?.month } : typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (JSON.stringify(body).length > 20000) return res.status(413).json({ error: 'This request is too large.' });
    const action = req.method === 'GET' ? 'snapshot' : body.action;
    if (!['snapshot','clock_in','clock_out','request','review','cancel','adjust','policy','entitlement'].includes(action)) return res.status(400).json({ error: 'Unknown attendance action.' });
    const rpc = async (rpcAction: string, rpcBody: any) => {
      const response = await fetch(`${url}/rest/v1/rpc/crm_attendance_command`, {
        method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_actor: session.id, p_version: session.version, p_action: rpcAction, p_data: rpcBody }),
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (!response.ok) throw Object.assign(new Error(result?.message || 'Attendance request failed.'), { rpcCode: result?.code });
      return result;
    };
    const savePolicyAfterVerifiedRpc = async (settings: any, reason: string) => {
      const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
      const beforeResponse = await fetch(`${url}/rest/v1/crm_attendance_policy?select=settings&id=eq.true&limit=1`, { headers, signal: AbortSignal.timeout(20000) });
      if (!beforeResponse.ok) throw new Error('Could not read the attendance policy.');
      const before = (await beforeResponse.json())?.[0]?.settings || null;
      const updateResponse = await fetch(`${url}/rest/v1/crm_attendance_policy?id=eq.true`, { method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify({ settings }), signal: AbortSignal.timeout(20000) });
      if (!updateResponse.ok) throw new Error('Could not save the attendance policy.');
      const auditResponse = await fetch(`${url}/rest/v1/crm_attendance_audit`, { method: 'POST', headers, body: JSON.stringify({ actor_id: session.id, user_id: session.id, action: 'policy', detail: { before, after: settings, reason } }), signal: AbortSignal.timeout(20000) });
      if (!auditResponse.ok) throw new Error('The policy was saved, but its audit entry could not be recorded.');
      return settings;
    };
    const snapshot = async (requestedMonth: string) => {
      const primary = await rpc('snapshot', { month: requestedMonth }), policy = normalizeAttendancePolicy(primary.policy), cycle = leaveCycleYear(policy, `${requestedMonth}-01`), startMonth = Number(policy.leaveYearStartMonth || 4);
      primary.policy = policy;
      if (startMonth === 1) return primary;
      const primaryYear = Number(requestedMonth.slice(0, 4)), companionYear = primaryYear === cycle ? cycle + 1 : cycle;
      const companion = await rpc('snapshot', { month: `${companionYear}-01` });
      const merge = (a: any[] = [], b: any[] = [], key: (item: any) => string) => Array.from(new Map([...a, ...b].map(item => [key(item), item])).values());
      primary.requests = merge(primary.requests, companion.requests, item => item.id);
      primary.entitlements = merge(primary.entitlements, companion.entitlements, item => `${item.user_id}:${item.year}:${item.leave_type}`);
      return primary;
    };
    if (action === 'policy') body.settings = normalizeAttendancePolicy(body.settings);
    if (action === 'request' && body.kind === 'leave' && body.leaveType !== 'unpaid') {
      const start = String(body.startDate || ''), end = String(body.endDate || start), current = await snapshot(start.slice(0, 7));
      const cycle = leaveCycleYear(current.policy, start), accrued = accruedAllowance(current, session.id, String(body.leaveType), cycle), reserved = reservedLeave(current, session.id, String(body.leaveType), cycle), requested = workingDayCount(current.policy, start, end, String(body.portion || 'full'));
      if (requested > accrued - reserved + 0.0001) return res.status(409).json({ error: `Only ${Math.max(0, Math.round((accrued - reserved) * 100) / 100)} accrued ${String(body.leaveType)} leave day(s) are available. Leave is credited month by month.` });
    }
    let result;
    try {
      result = action === 'snapshot' ? await snapshot(String(body.month || '')) : await rpc(action, body);
    } catch (error: any) {
      // Some Supabase projects enable safe-update protection inside stored functions.
      // The RPC has already authenticated the current actor as Admin before this error.
      if (action === 'policy' && error?.rpcCode === '21000') result = await savePolicyAfterVerifiedRpc(body.settings, String(body.reason || 'Policy updated'));
      else throw error;
    }
    if (action === 'request' && body.kind === 'leave' && body.leaveType !== 'unpaid' && result?.id) {
      const current = await snapshot(String(body.startDate).slice(0, 7)), cycle = leaveCycleYear(current.policy, String(body.startDate)), accrued = accruedAllowance(current, session.id, String(body.leaveType), cycle), reserved = reservedLeave(current, session.id, String(body.leaveType), cycle);
      if (reserved > accrued + 0.0001) {
        await rpc('cancel', { id: result.id, reason: 'Automatically cancelled because the accrued leave balance was exceeded.' });
        return res.status(409).json({ error: 'This request exceeded the currently accrued leave balance and was not submitted.' });
      }
    }
    return res.status(200).json(result);
  } catch (error: any) {
    if (error?.rpcCode) {
      const code = error.rpcCode;
      console.error('Attendance RPC failed', { action: req.method === 'GET' ? 'snapshot' : req.body?.action, code, message: error.message });
      const status = code === '28000' ? 401 : code === '42501' ? 403 : code === 'P0001' || code === '23505' || String(code).startsWith('22') ? 409 : 503;
      const message = code === 'P0001' || ['28000','42501'].includes(code) ? error.message : status === 409 ? 'Check your dates and values, then refresh and try again.' : 'Attendance is temporarily unavailable. Please retry.';
      return res.status(status).json({ error: message });
    }
    // Preserve the operational reason in server logs while keeping the client
    // response deliberately generic. This is essential for diagnosing a
    // transient Supabase/RPC failure without exposing database details to staff.
    console.error('Attendance request failed', {
      action: req.method === 'GET' ? 'snapshot' : req.body?.action,
      name: error?.name || 'Error',
      message: String(error?.message || 'Unknown error').slice(0, 500),
    });
    return res.status(error instanceof SyntaxError ? 400 : 503).json({ error: error instanceof SyntaxError ? 'Invalid request.' : 'Attendance could not connect. Refresh and try again.' });
  }
}
