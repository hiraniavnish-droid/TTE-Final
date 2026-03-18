
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User } from '../types';
import { generateId } from '../utils/helpers';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  users: User[];
  login: (passcode: string) => boolean;
  logout: () => void;
  addUser: (name: string, passcode: string) => void;
  removeUser: (id: string) => void;
  updateUserPasscode: (id: string, newPasscode: string) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default users — used only to seed Supabase on very first run
const DEFAULT_USERS: User[] = [
  { id: '1', name: 'Admin', role: 'admin', passcode: 'admin999' },
  { id: '2', name: 'Sonali', role: 'agent', passcode: 'sonali123' },
  { id: '3', name: 'Vraj', role: 'agent', passcode: 'vraj123' }
];

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>(DEFAULT_USERS);

  // Initialize: Load users from Supabase, restore session from localStorage
  useEffect(() => {
    const init = async () => {
      // 1. Load Users from Supabase
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        const mapped: User[] = data.map((u: any) => ({
          id: u.id,
          name: u.name,
          role: u.role as 'admin' | 'agent',
          passcode: u.passcode,
        }));
        setUsers(mapped);
      } else if (!error && data && data.length === 0) {
        // First run: seed Supabase with default users
        await supabase.from('users').insert(
          DEFAULT_USERS.map(u => ({
            id: u.id,
            name: u.name,
            role: u.role,
            passcode: u.passcode,
          }))
        );
        setUsers(DEFAULT_USERS);
      }

      // 2. Restore Session from localStorage
      const isAuth = localStorage.getItem('is_authenticated') === 'true';
      const storedUser = localStorage.getItem('voyageos_user');
      const expiry = localStorage.getItem('auth_expiry');
      const now = new Date().getTime();

      if (isAuth && storedUser && expiry && parseInt(expiry) > now) {
        setUser(JSON.parse(storedUser));
      } else {
        localStorage.removeItem('voyageos_user');
        localStorage.removeItem('is_authenticated');
        localStorage.removeItem('auth_expiry');
        setUser(null);
      }
    };

    init();
  }, []);

  const login = (passcode: string): boolean => {
    const matchedUser = users.find(u => u.passcode === passcode);
    if (matchedUser) {
      setUser(matchedUser);
      const expiryTime = new Date().getTime() + 7 * 24 * 60 * 60 * 1000;
      localStorage.setItem('voyageos_user', JSON.stringify(matchedUser));
      localStorage.setItem('is_authenticated', 'true');
      localStorage.setItem('auth_expiry', expiryTime.toString());
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('voyageos_user');
    localStorage.removeItem('is_authenticated');
    localStorage.removeItem('auth_expiry');
  };

  const addUser = (name: string, passcode: string) => {
    if (users.some(u => u.name.toLowerCase() === name.toLowerCase())) {
      alert('User with this name already exists.');
      return;
    }
    const newUser: User = {
      id: generateId(),
      name,
      role: 'agent',
      passcode,
    };
    // Optimistic update
    setUsers(prev => [...prev, newUser]);
    // Persist to Supabase
    supabase.from('users').insert([{
      id: newUser.id,
      name: newUser.name,
      role: newUser.role,
      passcode: newUser.passcode,
    }]).then(({ error }) => {
      if (error) console.error('Failed to add user to Supabase:', error);
    });
  };

  const removeUser = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
    supabase.from('users').delete().eq('id', id).then(({ error }) => {
      if (error) console.error('Failed to remove user from Supabase:', error);
    });
  };

  const updateUserPasscode = (id: string, newPasscode: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, passcode: newPasscode } : u));
    supabase.from('users').update({ passcode: newPasscode }).eq('id', id).then(({ error }) => {
      if (error) console.error('Failed to update passcode in Supabase:', error);
    });
  };

  return (
    <AuthContext.Provider value={{
      user,
      users,
      login,
      logout,
      addUser,
      removeUser,
      updateUserPasscode,
      isAuthenticated: !!user
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
