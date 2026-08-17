
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// After passcode login we store a server-minted session token. When present,
// send it as the Authorization bearer so every DB/realtime call runs as an
// authenticated user (required once RLS is enabled). The anon key stays as the
// apikey. No token (logged out) → anon, which RLS blocks — but the login screen
// makes no data calls, so that's fine.
export const TTE_TOKEN_KEY = 'tte_token';
const storedToken = (() => {
  try { return localStorage.getItem(TTE_TOKEN_KEY) || null; } catch { return null; }
})();

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: storedToken ? { headers: { Authorization: `Bearer ${storedToken}` } } : {},
});

// Authenticate realtime with the same token so subscriptions pass RLS.
if (storedToken) {
  try { supabase.realtime.setAuth(storedToken); } catch {}
}
