
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User } from '../types';
import { generateId } from '../utils/helpers';

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

// Initial User Set
const DEFAULT_USERS: User[] = [
  { id: '1', name: 'Admin', role: 'admin', passcode: 'admin999' },
  { id: '2', name: 'Sonali', role: 'agent', passcode: 'sonali123' },
  { id: '3', name: 'Vraj', role: 'agent', passcode: 'vraj123' }
];

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>(DEFAULT_USERS);

  // Initialize: Load users and current session from localStorage
  useEffect(() => {
    // 1. Load Users List (Admin settings persistence)
    const storedUsers = localStorage.getItem('voyageos_users_list');
    if (storedUsers) {
      setUsers(JSON.parse(storedUsers));
    } else {
      // First run: save defaults
      localStorage.setItem('voyageos_users_list', JSON.stringify(DEFAULT_USERS));
    }

    // 2. Load Session (Persist Login with Expiry)
    const isAuthenticated = localStorage.getItem('is_authenticated') === 'true';
    const storedUser = localStorage.getItem('voyageos_user');
    const expiry = localStorage.getItem('auth_expiry');
    const now = new Date().getTime();

    if (isAuthenticated && storedUser && expiry && parseInt(expiry) > now) {
      // Session is valid and not expired
      setUser(JSON.parse(storedUser));
    } else {
      // Session invalid or expired: Clean up
      localStorage.removeItem('voyageos_user');
      localStorage.removeItem('is_authenticated');
      localStorage.removeItem('auth_expiry');
      setUser(null);
    }
  }, []);

  // Sync users to local storage whenever they change
  useEffect(() => {
    localStorage.setItem('voyageos_users_list', JSON.stringify(users));
  }, [users]);

  const login = (passcode: string): boolean => {
    // Dynamic lookup instead of hardcoded config
    const matchedUser = users.find(u => u.passcode === passcode);
    
    if (matchedUser) {
      setUser(matchedUser);
      
      // Calculate Expiry (7 Days)
      const now = new Date();
      const expiryTime = now.getTime() + (7 * 24 * 60 * 60 * 1000); 

      // Save Session
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
    // Ensure name is unique
    if (users.some(u => u.name.toLowerCase() === name.toLowerCase())) {
        alert('User with this name already exists.');
        return;
    }

    const newUser: User = {
      id: generateId(),
      name,
      role: 'agent', // Default role
      passcode
    };
    setUsers(prev => [...prev, newUser]);
  };

  const removeUser = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  const updateUserPasscode = (id: string, newPasscode: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, passcode: newPasscode } : u));
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
