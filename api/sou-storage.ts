// ============================================================
// Vercel Serverless Function — SOU Builder storage writes
// POST { action: 'upload', path, ext, contentType, dataBase64 } → returns { url }
// POST { action: 'save-settings', hotels, defaultCoverUrl }      → returns { ok }
//
// Holds the Supabase SERVICE ROLE key server-side ONLY. The browser
// never sees it — it just calls this endpoint. Reads stay client-side
// via the bucket's public URL (no key needed).
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET = 'sou-images';
const SETTINGS_PATH = 'settings/data.json';

// Object paths: letters/numbers/dash/underscore/slash only — no dots, so no `..` traversal.
const PATH_RE = /^[A-Za-z0-9_\-/]{1,120}$/;
const EXT_RE = /^[a-z0-9]{1,5}$/;
const MAX_IMAGE_BYTES = 6_000_000;   // ~6 MB decoded
const MAX_SETTINGS_BYTES = 3_000_000; // ~3 MB JSON

function corsOrigin(origin: string): string | null {
  if (!origin) return null;
  if (origin === 'https://ttecrm.vercel.app') return origin;
  if (/^https:\/\/[a-z0-9-]+-avnishs-projects-[a-z0-9]+\.vercel\.app$/.test(origin)) return origin;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return origin;
  return null;
}

async function uploadObject(fullPath: string, body: Buffer, contentType: string): Promise<void> {
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${fullPath}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      apikey: SUPABASE_SERVICE_KEY,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Storage upload failed (${res.status}): ${t}`);
  }
}

const publicUrl = (fullPath: string) =>
  `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${fullPath}`;

export default async function handler(req: any, res: any) {
  const allowed = corsOrigin(req.headers?.origin || '');
  if (allowed) res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Storage is not configured on the server.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

    if (body.action === 'upload') {
      const path = String(body.path || '');
      if (!PATH_RE.test(path)) return res.status(400).json({ error: 'Invalid upload path.' });
      const ext = EXT_RE.test(String(body.ext || '')) ? String(body.ext) : 'jpg';
      if (!body.dataBase64) return res.status(400).json({ error: 'Missing file data.' });
      const buffer = Buffer.from(String(body.dataBase64), 'base64');
      if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
        return res.status(400).json({ error: 'Image is empty or too large (max 6 MB).' });
      }
      const contentType = /^image\/[a-z0-9.+-]+$/i.test(String(body.contentType || ''))
        ? String(body.contentType)
        : 'image/jpeg';
      const fullPath = `${path}.${ext}`;
      await uploadObject(fullPath, buffer, contentType);
      return res.status(200).json({ url: publicUrl(fullPath) });
    }

    if (body.action === 'save-settings') {
      const payload = JSON.stringify({
        hotels: Array.isArray(body.hotels) ? body.hotels : [],
        defaultCoverUrl: typeof body.defaultCoverUrl === 'string' ? body.defaultCoverUrl : '',
      });
      if (payload.length > MAX_SETTINGS_BYTES) {
        return res.status(400).json({ error: 'Settings payload too large.' });
      }
      await uploadObject(SETTINGS_PATH, Buffer.from(payload), 'application/json');
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action.' });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
}
