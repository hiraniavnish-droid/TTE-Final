
import React, { useMemo, useRef, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { useLeads } from '../contexts/LeadContext';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Moon,
  Sun,
  Droplets,
  BookUser,
  Handshake,
  LogOut,
  ShieldCheck,
  Compass,
  Map,
  Building2 // Added icon for Blocked Rates
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../utils/helpers';
import { AddLeadModal } from './AddLeadModal';
import { DraggableFab } from './DraggableFab';
import { SmartNudge } from './SmartNudge';
import { GridBackground } from './ui/GridBackground';
import { UserAvatar } from './ui/UserAvatar';

export const Layout = () => {
  const { theme, setTheme, getTextColor } = useTheme();
  const { user, logout } = useAuth();
  const { reminders } = useLeads();
  const navigate = useNavigate();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  const MotionDiv = motion.div as any;

  const overdueCount = useMemo(() => {
    const now = new Date();
    return reminders.filter(r => !r.isCompleted && new Date(r.dueDate) < now).length;
  }, [reminders]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  const handleLogout = () => {
      logout();
      navigate('/login');
  };

  const getBackground = () => {
    switch (theme) {
      case 'ocean':
        return 'bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950';
      case 'dark':
        return 'bg-slate-900 bg-dot-pattern-dark';
      case 'light':
        return 'bg-transparent';
      default:
        return 'bg-transparent';
    }
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/leads', label: 'Leads', icon: Users },
    { path: '/builder', label: 'Itinerary Hub', icon: Map },
    { path: '/blocked-rates', label: 'Blocked Rates', icon: Building2 }, // New Nav Item
    { path: '/reminders', label: 'Tasks', icon: CalendarCheck },
    { path: '/suppliers', label: 'Suppliers', icon: Handshake },
    { path: '/customers', label: 'Customers', icon: BookUser },
  ];

  if (user?.role === 'admin') {
      navItems.push({ path: '/team-settings', label: 'Team Settings', icon: ShieldCheck });
  }

  const handleMobileThemeToggle = () => {
      if (theme === 'ocean') setTheme('light');
      else if (theme === 'light') setTheme('dark');
      else setTheme('ocean');
  };

  const MobileThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Droplets;

  return (
    <GridBackground className={cn('transition-colors duration-300 ease-in-out font-sans', getBackground())}>
      <AddLeadModal />
      <SmartNudge />
      <DraggableFab />

      <header className={cn(
        "md:hidden flex items-center justify-between p-3 sticky top-0 z-30 border-b transition-colors",
        theme === 'light' ? "bg-white/90 backdrop-blur-md border-slate-200" : "bg-slate-900/90 border-slate-700/50"
      )}>
        <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-lg", theme === 'light' ? 'bg-gradient-to-br from-indigo-500 to-blue-500' : 'bg-white text-slate-900')}>
              <Compass className="h-4 w-4 text-white" />
            </div>
            <span className={cn("text-base font-extrabold tracking-tight", theme === 'light' ? 'text-slate-800' : 'text-slate-100')}>
              The Tourism Experts
            </span>
        </div>

        <div className="flex items-center gap-2">
            <button onClick={handleMobileThemeToggle} className={cn("p-2 rounded-lg", theme === 'light' ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:bg-slate-700/50')}>
                <MobileThemeIcon size={18} />
            </button>
            <button onClick={handleLogout} className={cn("p-2 rounded-lg", theme === 'light' ? 'text-red-500 hover:bg-red-50' : 'text-red-400 hover:bg-red-500/15')}>
                <LogOut size={18} />
            </button>
        </div>
      </header>

      <aside className={cn(
        'hidden md:flex w-64 flex-shrink-0 flex-col z-20 h-screen sticky top-0',
        theme === 'light' ? 'bg-white border-r border-slate-200'
          : theme === 'ocean' ? 'bg-gradient-to-b from-blue-950 to-slate-900 border-r border-blue-800/40'
          : 'bg-slate-900 border-r border-slate-700/50'
      )}>
        {/* Logo */}
        <div className="p-6 pb-4 flex items-center gap-3">
          <div className={cn("p-2 rounded-xl shadow-sm", theme === 'light' ? 'bg-gradient-to-br from-indigo-500 to-blue-500' : 'bg-white text-slate-900')}>
            <Compass className="h-5 w-5 text-white" />
          </div>
          <span className={cn("text-sm font-extrabold tracking-tight", theme === 'light' ? 'text-slate-800' : 'text-slate-100')}>
            The Tourism Experts
          </span>
        </div>

        {/* Thin divider */}
        <div className={cn("mx-6 mb-5 h-px", theme === 'light' ? 'bg-slate-100' : theme === 'ocean' ? 'bg-blue-800/40' : 'bg-slate-700/50')} />

        {/* User card */}
        <div className="px-4 mb-5">
            <div className={cn(
              "p-3 rounded-xl flex items-center gap-3 border transition-all duration-200",
              theme === 'light' ? 'bg-slate-50 border-slate-200 shadow-sm'
                : theme === 'ocean' ? 'bg-blue-900/40 border-blue-800/40'
                : 'bg-slate-800/60 border-slate-700/50'
            )}>
                <UserAvatar name={user?.name || 'A'} size={32} />
                <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-bold truncate", theme === 'light' ? 'text-slate-800' : 'text-slate-100')}>{user?.name}</p>
                    <p className={cn("text-[10px] uppercase tracking-widest font-semibold", theme === 'light' ? 'text-slate-400' : 'text-slate-400')}>{user?.role}</p>
                </div>
            </div>
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
            return (
              <Link key={item.path} to={item.path} className="relative block group" style={{ position: 'relative' }}>
                {isActive && (
                  <MotionDiv
                    layoutId="active-bg"
                    className={cn(
                      "absolute inset-0 rounded-xl z-0",
                      theme === 'light' ? "bg-indigo-50 border border-indigo-100 shadow-sm" : "bg-indigo-500/20 border border-indigo-500/30"
                    )}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <MotionDiv
                    animate={{ scale: isActive ? 1.02 : 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    className={cn(
                      'relative z-10 flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200',
                      isActive
                        ? (theme === 'light' ? 'text-indigo-700 font-bold' : 'text-indigo-300 font-bold')
                        : (theme === 'light' ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                            : theme === 'ocean' ? 'text-slate-300 hover:text-white hover:bg-blue-800/30'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700/50')
                    )}
                >
                    <div className="relative">
                      <item.icon
                        size={17}
                        className={cn("transition-colors duration-200", isActive ? (theme === 'light' ? 'text-indigo-600' : 'text-indigo-300') : 'opacity-60 group-hover:opacity-100')}
                        strokeWidth={isActive ? 2.5 : 2}
                      />
                      {item.path === '/reminders' && overdueCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none shadow-sm">
                          {overdueCount > 9 ? '9+' : overdueCount}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-medium">{item.label}</span>
                </MotionDiv>
              </Link>
            );
          })}
        </nav>

        <div className={cn("p-4 border-t space-y-2", theme === 'light' ? 'border-slate-100' : theme === 'ocean' ? 'border-blue-800/40' : 'border-slate-700/50')}>
          {/* Theme toggle */}
          <div className={cn("flex gap-1 p-1 rounded-xl border", theme === 'light' ? 'bg-slate-100 border-slate-200' : theme === 'ocean' ? 'bg-blue-950/60 border-blue-800/40' : 'bg-slate-800 border-slate-700/50')}>
            {[{ id: 'light', icon: Sun }, { id: 'dark', icon: Moon }, { id: 'ocean', icon: Droplets }].map((t) => (
              <button key={t.id} onClick={() => setTheme(t.id as any)} className={cn(
                "flex-1 p-1.5 rounded-lg flex justify-center transition-all duration-200",
                theme === t.id
                  ? (t.id === 'light' ? 'bg-white shadow text-indigo-600 border border-slate-200'
                      : theme === 'ocean' ? 'bg-blue-900 text-indigo-300 shadow'
                      : 'bg-slate-700 text-indigo-300 shadow')
                  : (theme === 'light' ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300')
              )}>
                <t.icon size={15} />
              </button>
            ))}
          </div>
          {/* Logout */}
          <button onClick={handleLogout} className={cn(
            "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium",
            theme === 'light' ? 'text-slate-500 hover:text-red-600 hover:bg-red-50' : 'text-slate-400 hover:text-red-400 hover:bg-red-500/15'
          )}>
              <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden h-[calc(100vh-64px)] md:h-screen relative z-10 pb-24 md:pb-12 scroll-smooth">
        <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-6 md:space-y-8 text-sm md:text-base">
            <div key={location.pathname} className="animate-in fade-in duration-200">
              <Outlet />
            </div>
        </div>
      </main>

      <nav className={cn(
        "md:hidden fixed bottom-0 left-0 right-0 z-40 px-6 pb-6 pt-4 border-t transition-all",
         theme === 'light' ? 'bg-white/90 backdrop-blur-md border-slate-200' : 'bg-slate-900 border-slate-700/50'
      )}>
        <div className="flex justify-around items-center">
            {navItems.slice(0, 5).map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => cn(
                    'flex flex-col items-center gap-0.5 transition-all relative',
                    isActive
                      ? (theme === 'light' ? 'text-blue-600 font-bold scale-105' : 'text-indigo-300 font-bold scale-105')
                      : (theme === 'light' ? 'text-slate-400' : 'text-slate-500')
                  )}
                >
                    {({ isActive }) => (
                      <>
                        <div className="relative">
                          <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                          {item.path === '/reminders' && overdueCount > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 bg-rose-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                              {overdueCount > 9 ? '9+' : overdueCount}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-semibold leading-none">{item.label}</span>
                      </>
                    )}
                </NavLink>
            ))}
        </div>
      </nav>
    </GridBackground>
  );
};
