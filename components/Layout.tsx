
import React, { useMemo, useRef, useEffect, useState } from 'react';
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
  Building2,
  Search,
  Command,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../utils/helpers';
import { AddLeadModal } from './AddLeadModal';
import { DraggableFab } from './DraggableFab';
import { SmartNudge } from './SmartNudge';
import { GridBackground } from './ui/GridBackground';
import { UserAvatar } from './ui/UserAvatar';
import { GlobalSearch } from './GlobalSearch';
import { useReminderNotifications } from '../hooks/useReminderNotifications';
import { NavigationBar } from './ui/PageLoader';

export const Layout = () => {
  const { theme, setTheme, getTextColor } = useTheme();
  const { user, logout } = useAuth();
  const { reminders } = useLeads();
  const navigate = useNavigate();
  useReminderNotifications();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const MotionDiv = motion.div as any;
  const MotionAside = motion.aside as any;

  const overdueCount = useMemo(() => {
    const now = new Date();
    return reminders.filter(r => !r.isCompleted && new Date(r.dueDate) < now).length;
  }, [reminders]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    // Show progress bar briefly on every route change
    setIsNavigating(true);
    if (navTimer.current) clearTimeout(navTimer.current);
    navTimer.current = setTimeout(() => setIsNavigating(false), 600);
    return () => { if (navTimer.current) clearTimeout(navTimer.current); };
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getBackground = () => {
    switch (theme) {
      case 'ocean': return 'bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950';
      case 'dark':  return 'bg-slate-900 bg-dot-pattern-dark';
      default:      return 'bg-transparent';
    }
  };

  const navItems = [
    { path: '/',              label: 'Dashboard',    icon: LayoutDashboard },
    { path: '/leads',         label: 'Leads',        icon: Users },
    { path: '/builder',       label: 'Itinerary Hub',icon: Map },
    { path: '/blocked-rates', label: 'Blocked Rates',icon: Building2 },
    { path: '/reminders',     label: 'Tasks',        icon: CalendarCheck },
    { path: '/suppliers',     label: 'Suppliers',    icon: Handshake },
    { path: '/customers',     label: 'Customers',    icon: BookUser },
  ];
  if (user?.role === 'admin') navItems.push({ path: '/team-settings', label: 'Team Settings', icon: ShieldCheck });

  const handleMobileThemeToggle = () => {
    if (theme === 'ocean') setTheme('light');
    else if (theme === 'light') setTheme('dark');
    else setTheme('ocean');
  };
  const MobileThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Droplets;

  return (
    <GridBackground className={cn('transition-colors duration-300 ease-in-out font-sans', getBackground())}>
      {/* Top navigation progress bar — shows on every page transition */}
      {isNavigating && <NavigationBar />}
      <AddLeadModal />
      <SmartNudge />
      <DraggableFab />
      <GlobalSearch />

      {/* Mobile header */}
      <header className={cn(
        "md:hidden flex items-center justify-between p-3 sticky top-0 z-30 border-b transition-colors",
        theme === 'light' ? "bg-white/90 backdrop-blur-md border-slate-200" : "bg-slate-900/90 border-slate-700/50"
      )}>
        <div className="flex items-center gap-2">
          <div className={cn("p-1.5 rounded-lg", theme === 'light' ? 'bg-gradient-to-br from-indigo-500 to-blue-500' : 'bg-white')}>
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

      {/* Desktop sidebar */}
      <MotionAside
        animate={{ width: collapsed ? 68 : 256 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={cn(
          'hidden md:flex flex-shrink-0 flex-col z-20 h-screen sticky top-0 overflow-hidden',
          theme === 'light' ? 'bg-white border-r border-slate-200'
            : theme === 'ocean' ? 'bg-gradient-to-b from-blue-950 to-slate-900 border-r border-blue-800/40'
            : 'bg-slate-900 border-r border-slate-700/50'
        )}
      >
        {/* Logo + collapse button */}
        <div className="p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className={cn("p-2 rounded-xl shadow-sm shrink-0", theme === 'light' ? 'bg-gradient-to-br from-indigo-500 to-blue-500' : 'bg-white')}>
              <Compass className="h-4 w-4 text-white" />
            </div>
            <AnimatePresence>
              {!collapsed && (
                <MotionDiv
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  <span className={cn("text-sm font-extrabold tracking-tight", theme === 'light' ? 'text-slate-800' : 'text-slate-100')}>
                    The Tourism Experts
                  </span>
                </MotionDiv>
              )}
            </AnimatePresence>
          </div>
          <button
            onClick={() => setCollapsed(c => !c)}
            className={cn(
              "p-1.5 rounded-lg shrink-0 transition-colors",
              theme === 'light' ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-600' : 'text-slate-500 hover:bg-slate-700/50 hover:text-slate-300'
            )}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        <div className={cn("mx-4 mb-3 h-px shrink-0", theme === 'light' ? 'bg-slate-100' : theme === 'ocean' ? 'bg-blue-800/40' : 'bg-slate-700/50')} />

        {/* Search button (hidden when collapsed) */}
        <AnimatePresence>
          {!collapsed && (
            <MotionDiv
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="px-4 mb-3 shrink-0"
            >
              <button
                onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all',
                  theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600'
                    : theme === 'ocean' ? 'bg-blue-900/30 border-blue-800/40 text-slate-500 hover:text-slate-300'
                    : 'bg-slate-800/40 border-slate-700/50 text-slate-500 hover:text-slate-300'
                )}
              >
                <Search size={14} className="shrink-0" />
                <span className="flex-1 text-left text-[12px]">Search leads…</span>
                <span className="hidden md:flex items-center gap-0.5 text-[10px] font-mono opacity-60">
                  <Command size={10} />K
                </span>
              </button>
            </MotionDiv>
          )}
        </AnimatePresence>

        {/* Collapsed search icon */}
        {collapsed && (
          <div className="px-3 mb-3 shrink-0">
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))}
              className={cn(
                'w-full flex items-center justify-center p-2 rounded-xl border transition-all',
                theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600' : 'bg-slate-800/40 border-slate-700/50 text-slate-500 hover:text-slate-300'
              )}
              title="Search (⌘K)"
            >
              <Search size={15} />
            </button>
          </div>
        )}

        {/* User card */}
        <AnimatePresence>
          {!collapsed && (
            <MotionDiv
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="px-4 mb-4 shrink-0"
            >
              <div className={cn(
                "p-3 rounded-xl flex items-center gap-3 border",
                theme === 'light' ? 'bg-slate-50 border-slate-200 shadow-sm'
                  : theme === 'ocean' ? 'bg-blue-900/40 border-blue-800/40'
                  : 'bg-slate-800/60 border-slate-700/50'
              )}>
                <UserAvatar name={user?.name || 'A'} size={30} />
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-bold truncate", theme === 'light' ? 'text-slate-800' : 'text-slate-100')}>{user?.name}</p>
                  <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-400">{user?.role}</p>
                </div>
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>
        {collapsed && (
          <div className="px-3 mb-4 shrink-0 flex justify-center">
            <UserAvatar name={user?.name || 'A'} size={30} />
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-hidden">
          {navItems.map((item) => {
            const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className="relative block group"
                title={collapsed ? item.label : undefined}
              >
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
                    'relative z-10 flex items-center rounded-xl transition-all duration-200',
                    collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-4 py-2.5',
                    isActive
                      ? (theme === 'light' ? 'text-indigo-700 font-bold' : 'text-indigo-300 font-bold')
                      : (theme === 'light' ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                          : theme === 'ocean' ? 'text-slate-300 hover:text-white hover:bg-blue-800/30'
                          : 'text-slate-400 hover:text-white hover:bg-slate-700/50')
                  )}
                >
                  <div className="relative shrink-0">
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
                  <AnimatePresence>
                    {!collapsed && (
                      <MotionDiv
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.12 }}
                        className="overflow-hidden whitespace-nowrap"
                      >
                        <span className="text-sm font-medium">{item.label}</span>
                      </MotionDiv>
                    )}
                  </AnimatePresence>
                </MotionDiv>
              </Link>
            );
          })}
        </nav>

        {/* Footer: theme + logout */}
        <div className={cn("p-3 border-t space-y-2 shrink-0", theme === 'light' ? 'border-slate-100' : theme === 'ocean' ? 'border-blue-800/40' : 'border-slate-700/50')}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <button onClick={handleMobileThemeToggle} className={cn("p-2 rounded-lg transition-colors", theme === 'light' ? 'text-slate-400 hover:bg-slate-100' : 'text-slate-500 hover:bg-slate-700/50')} title="Toggle theme">
                <MobileThemeIcon size={15} />
              </button>
              <button onClick={handleLogout} className={cn("p-2 rounded-lg transition-colors", theme === 'light' ? 'text-slate-400 hover:text-red-500 hover:bg-red-50' : 'text-slate-500 hover:text-red-400 hover:bg-red-500/15')} title="Logout">
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <>
              <div className={cn("flex gap-1 p-1 rounded-xl border", theme === 'light' ? 'bg-slate-100 border-slate-200' : theme === 'ocean' ? 'bg-blue-950/60 border-blue-800/40' : 'bg-slate-800 border-slate-700/50')}>
                {[{ id: 'light', icon: Sun }, { id: 'dark', icon: Moon }, { id: 'ocean', icon: Droplets }].map((t) => (
                  <button key={t.id} onClick={() => setTheme(t.id as any)} className={cn(
                    "flex-1 p-1.5 rounded-lg flex justify-center transition-all duration-200",
                    theme === t.id
                      ? (t.id === 'light' ? 'bg-white shadow text-indigo-600 border border-slate-200'
                          : theme === 'ocean' ? 'bg-blue-900 text-indigo-300 shadow' : 'bg-slate-700 text-indigo-300 shadow')
                      : (theme === 'light' ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300')
                  )}>
                    <t.icon size={15} />
                  </button>
                ))}
              </div>
              <button onClick={handleLogout} className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium",
                theme === 'light' ? 'text-slate-500 hover:text-red-600 hover:bg-red-50' : 'text-slate-400 hover:text-red-400 hover:bg-red-500/15'
              )}>
                <LogOut size={16} /> Logout
              </button>
            </>
          )}
        </div>
      </MotionAside>

      {/* Main content with route transitions */}
      <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden h-[calc(100vh-64px)] md:h-screen relative z-10 pb-24 md:pb-12 scroll-smooth">
        <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-6 md:space-y-8 text-sm md:text-base">
          <AnimatePresence mode="wait">
            <MotionDiv
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <Outlet />
            </MotionDiv>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile bottom nav */}
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
