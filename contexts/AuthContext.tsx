
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User } from '../types';
import { generateId } from '../utils/helpers';
import { supabase, TTE_TOKEN_KEY } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  users: User[];
  login: (passcode: string) => Promise<boolean>;
  logout: () => void;
  addUser: (name: string, passcode: string) => void;
  removeUser: (id: string) => void;
  updateUserPasscode: (id: string, newPasscode: string) => void;
  updateUserPhone: (id: string, phone: string) => void;
  logoutAllDevices: (id: string) => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// In `vite dev` there is no local serverless runtime, so hit the deployed API.
const API_BASE = (import.meta as any).env?.DEV ? 'https://ttecrm.vercel.app' : '';

const DEFAULT_USERS: User[] = [
  { id: '1', name: 'Admin', role: 'admin', passcode: 'admin999' },
  { id: '2', name: 'Sonali', role: 'agent', passcode: 'sonali123' },
  { id: '3', name: 'Vraj', role: 'agent', passcode: 'vraj123' },
];

// Read-only decode of a JWT's payload — no signature check (Supabase already validates that
// server-side on every request); this is purely for the client to read its own claims.
const decodeJwtPayload = (token: string): any | null => {
  try {
    const part = token.split('.')[1];
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch { return null; }
};

// A session is valid only when we hold BOTH a server-minted token and the user record.
const getStoredUser = (): User | null => {
  try {
    const token = localStorage.getItem(TTE_TOKEN_KEY);
    const isAuth = localStorage.getItem('is_authenticated') === 'true';
    const storedUser = localStorage.getItem('voyageos_user');
    const expiry = localStorage.getItem('auth_expiry');
    const now = new Date().getTime();
    const claims = token ? decodeJwtPayload(token) : null;
    if (token && claims?.exp && claims.exp * 1000 > now && isAuth && storedUser && expiry && parseInt(expiry) > now) {
      return JSON.parse(storedUser);
    }
  } catch {}
  return null;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(getStoredUser);
  const [users, setUsers] = useState<User[]>(DEFAULT_USERS);

  // Load the team list — only when authenticated (RLS blocks anonymous reads).
  useEffect(() => {
    if (!user) return;
    const init = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: true });
      if (!error && data && data.length > 0) {
        setUsers(data.map((u: any) => ({ id: u.id, name: u.name, role: u.role, passcode: u.passcode, phone: u.phone || '' })));
      }
    };
    init();
  }, [user]);

  // "Log out everywhere" enforcement — a bumped session_version must kick THIS tab out even
  // if it's sitting open and idle, not just at next login. A mount-only check would only catch
  // it on refresh, so also poll periodically and re-check whenever the tab regains focus —
  // that's what makes another open browser actually get logged out live, not just on revisit.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const checkSession = async () => {
      const token = localStorage.getItem(TTE_TOKEN_KEY);
      const claims = token ? decodeJwtPayload(token) : null;
      if (!claims?.exp || claims.exp * 1000 <= Date.now()) { logout(); return; }
      // Tokens minted before this feature existed carry no claim — nothing to compare, leave them be.
      if (!claims || claims.session_version == null) return;
      const { data, error } = await supabase.from('users').select('session_version').eq('id', user.id).single();
      if (cancelled || error || !data) return;
      if (Number(data.session_version) !== Number(claims.session_version)) logout();
    };

    checkSession();
    const interval = setInterval(checkSession, 30_000);
    const onFocus = () => { if (document.visibilityState === 'visible') checkSession(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [user]);

  const login = async (passcode: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) return false;
      const { user: u, token } = await res.json();
      if (!u || !token) return false;

      const matchedUser: User = { id: u.id, name: u.name, role: u.role, passcode };
      const expiryTime = new Date().getTime() + 30 * 24 * 60 * 60 * 1000;
      localStorage.setItem(TTE_TOKEN_KEY, token);
      localStorage.setItem('voyageos_user', JSON.stringify(matchedUser));
      localStorage.setItem('is_authenticated', 'true');
      localStorage.setItem('auth_expiry', expiryTime.toString());
      setUser(matchedUser);
      // Reload so the Supabase client is re-created with the auth token attached.
      window.location.hash = '#/';
      window.location.reload();
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(TTE_TOKEN_KEY);
    localStorage.removeItem('voyageos_user');
    localStorage.removeItem('is_authenticated');
    localStorage.removeItem('auth_expiry');
    window.location.hash = '#/login';
    window.location.reload();
  };

  useEffect(() => {
    const onExpired = () => logout();
    window.addEventListener('tte:session-expired', onExpired);
    return () => window.removeEventListener('tte:session-expired', onExpired);
  }, []);

  const addUser = (name: string, passcode: string) => {
    if (users.some(u => u.name.toLowerCase() === name.toLowerCase())) {
      alert('User with this name already exists.');
      return;
    }
    const newUser: User = { id: generateId(), name, role: 'agent', passcode };
    setUsers(prev => [...prev, newUser]);
    supabase.from('users').insert([{ id: newUser.id, name: newUser.name, role: newUser.role, passcode: newUser.passcode }])
      .then(({ error }) => { if (error) console.error('Failed to add user:', error); });
  };

  const removeUser = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
    supabase.from('users').delete().eq('id', id)
      .then(({ error }) => { if (error) console.error('Failed to remove user:', error); });
  };

  const updateUserPasscode = (id: string, newPasscode: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, passcode: newPasscode } : u));
    supabase.from('users').update({ passcode: newPasscode }).eq('id', id)
      .then(({ error }) => { if (error) console.error('Failed to update passcode:', error); });
  };

  const updateUserPhone = (id: string, phone: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, phone } : u));
    supabase.from('users').update({ phone: phone || null }).eq('id', id)
      .then(({ error }) => { if (error) console.error('Failed to update phone:', error); });
  };

  // Invalidates every session currently logged in as this user, on every device/browser —
  // by bumping session_version, any already-issued token stops matching on its next check.
  const logoutAllDevices = async (id: string): Promise<void> => {
    const { data, error: fetchError } = await supabase.from('users').select('session_version').eq('id', id).single();
    if (fetchError) { console.error('Failed to read session_version:', fetchError); return; }
    const nextVersion = (Number(data?.session_version) || 1) + 1;
    const { error } = await supabase.from('users').update({ session_version: nextVersion }).eq('id', id);
    if (error) { console.error('Failed to log out other sessions:', error); return; }
    if (id === user?.id) logout(); // this session's own token is now stale too
  };

  return (
    <AuthContext.Provider value={{
      user, users, login, logout, addUser, removeUser, updateUserPasscode, updateUserPhone, logoutAllDevices,
      isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
