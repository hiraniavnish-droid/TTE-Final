// ============================================================
// Vercel Serverless Function — passcode login
// POST /api/login { passcode } → { user, token }
//
// Verifies the passcode against the `users` table server-side (service role),
// then mints a Supabase-compatible HS256 session token signed with the project's
// legacy JWT secret (role=authenticated), so the client can talk to the DB under
// RLS. The passcode and JWT secret never reach the browser.
// ============================================================

import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || '';
const SESSION_DAYS = 30;

function corsOrigin(origin: string): string | null {
  if (!origin) return null;
  if (origin === 'https://ttecrm.vercel.app') return origin;
  if (/^https:\/\/[a-z0-9-]+-avnishs-projects-[a-z0-9]+\.vercel\.app$/.test(origin)) return origin;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return origin;
  return null;
}

const b64url = (buf: Buffer | string) =>
  (Buffer.isBuffer(buf) ? buf : Buffer.from(buf))
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function mintToken(user: { id: string; name: string; role: string; session_version: number }): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    aud: 'authenticated',
    role: 'authenticated',     // PostgREST maps this to the "authenticated" Postgres role (satisfies RLS)
    iss: 'supabase',
    sub: String(user.id),
    iat: now,
    exp: now + SESSION_DAYS * 24 * 60 * 60,
    // custom claims the app reads
    app_user_id: String(user.id),
    name: user.name,
    app_role: user.role,       // 'admin' | 'agent'
    session_version: user.session_version, // bumping this on the user row instantly invalidates this token everywhere
  };
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = b64url(crypto.createHmac('sha256', JWT_SECRET).update(data).digest());
  return `${data}.${sig}`;
}

export default async function handler(req: any, res: any) {
  const allowed = corsOrigin(req.headers?.origin || '');
  if (allowed) res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !JWT_SECRET) {
    return res.status(500).json({ error: 'Auth is not configured on the server.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const passcode = String(body.passcode || '');
    if (!passcode) return res.status(400).json({ error: 'Passcode required.' });

    // Look up the passcode server-side (service role bypasses RLS).
    const url = `${SUPABASE_URL}/rest/v1/users?select=id,name,role,passcode,session_version&passcode=eq.${encodeURIComponent(passcode)}`;
    const r = await fetch(url, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    });
    const rows = await r.json();
    const match = Array.isArray(rows) ? rows[0] : null;
    if (!match) return res.status(401).json({ error: 'Invalid passcode.' });

    const user = { id: match.id, name: match.name, role: match.role };
    const token = mintToken({ ...user, session_version: Number(match.session_version) || 1 });
    return res.status(200).json({ user, token });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
}
