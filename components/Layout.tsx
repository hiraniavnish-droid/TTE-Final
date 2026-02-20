
import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
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

export const Layout = () => {
  const { theme, setTheme, getTextColor } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const MotionDiv = motion.div as any;

  const handleLogout = () => {
      logout();
      navigate('/login');
  };

  const getBackground = () => {
    switch (theme) {
      case 'ocean':
        return 'bg-gradient-to-br from-teal-900 to-slate-900'; 
      case 'dark':
        return 'bg-slate-950 bg-dot-pattern-dark';
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
        theme === 'light' ? "bg-white/80 backdrop-blur-md border-slate-200" : "bg-slate-900/90 border-white/10"
      )}>
        <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-lg", theme === 'light' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900')}>
              <Compass className="h-5 w-5" />
            </div>
            <span className={cn("text-lg font-semibold tracking-tight font-sans", getTextColor())}>
              The Tourism Experts
            </span>
        </div>
        
        <div className="flex items-center gap-2">
            <button onClick={handleMobileThemeToggle} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100">
                <MobileThemeIcon size={20} />
            </button>
            <button onClick={handleLogout} className="p-2 rounded-lg text-red-500 hover:bg-red-50">
                <LogOut size={20} />
            </button>
        </div>
      </header>

      <aside className={cn(
        'hidden md:flex w-64 flex-shrink-0 flex-col z-20 h-screen sticky top-0',
        theme === 'light' ? 'bg-white/60 backdrop-blur-md border-r border-slate-200/50' : 'bg-slate-900 border-r border-slate-800'
      )}>
        <div className="p-6 flex items-center gap-3">
          <div className={cn("p-2 rounded-lg shadow-sm", theme === 'light' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900')}>
            <Compass className="h-5 w-5" />
          </div>
          <span className={cn("text-sm font-bold tracking-tight uppercase", getTextColor())}>
            The Tourism Experts
          </span>
        </div>

        <div className="px-6 mb-6">
            <div className={cn(
                "p-3 rounded-lg flex items-center gap-3 border transition-all duration-200", 
                theme === 'light' ? 'bg-white/50 border-slate-200/50 shadow-sm' : 'bg-white/5 border-white/10'
            )}>
                <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm",
                    theme === 'light' ? 'bg-white text-slate-700 border border-slate-200' : 'bg-slate-700 text-white'
                )}>
                    {user?.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-semibold truncate", getTextColor())}>{user?.name}</p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">{user?.role}</p>
                </div>
            </div>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => {
            const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
            return (
              <Link key={item.path} to={item.path} className="relative block group">
                {isActive && (
                  <MotionDiv
                    layoutId="active-bg"
                    className={cn(
                      "absolute inset-0 rounded-xl z-0",
                      theme === 'light' ? "bg-blue-50 border border-blue-100 shadow-md shadow-blue-100/50" : "bg-blue-500/10 border border-blue-500/20 shadow-none"
                    )}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <MotionDiv
                    animate={{ scale: isActive ? 1.02 : 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    className={cn(
                      'relative z-10 flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                      isActive 
                        ? (theme === 'light' ? "text-blue-600 font-bold" : "text-blue-400 font-bold") 
                        : (theme === 'light' ? "text-slate-500 hover:text-slate-900 hover:bg-slate-50/50" : "text-slate-400 hover:text-white hover:bg-white/5")
                    )}
                >
                    <item.icon size={18} className={cn("transition-colors duration-200", isActive ? "text-current" : "opacity-70 group-hover:opacity-100 group-hover:text-current")} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-sm tracking-tight">{item.label}</span>
                </MotionDiv>
              </Link>
            );
          })}
        </nav>

        <div className={cn("p-6 border-t", theme === 'light' ? 'border-slate-100' : 'border-slate-800', "space-y-2")}>
          <button onClick={handleLogout} className={cn("w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-sm font-medium", theme === 'light' ? "text-slate-500 hover:text-red-600 hover:bg-red-50" : "text-slate-400 hover:text-red-400 hover:bg-white/5")}>
              <LogOut size={18} /> Logout
          </button>
          <div className="flex gap-1 p-1 rounded-lg bg-slate-100 border border-slate-200 mt-2">
            {[{ id: 'light', icon: Sun }, { id: 'dark', icon: Moon }, { id: 'ocean', icon: Droplets }].map((t) => (
              <button key={t.id} onClick={() => setTheme(t.id as any)} className={cn("flex-1 p-1.5 rounded-md flex justify-center transition-all duration-200", theme === t.id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600')}>
                <t.icon size={16} />
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto overflow-x-hidden h-[calc(100vh-64px)] md:h-screen relative z-10 pb-24 md:pb-12 scroll-smooth">
        <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-6 md:space-y-8 text-sm md:text-base">
            <Outlet />
        </div>
      </main>

      <nav className={cn(
        "md:hidden fixed bottom-0 left-0 right-0 z-40 px-6 pb-6 pt-4 border-t transition-all",
         theme === 'light' ? 'bg-white/90 backdrop-blur-md border-slate-200' : 'bg-slate-900 border-white/10'
      )}>
        <div className="flex justify-around items-center">
            {navItems.slice(0, 5).map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => cn(
                    'flex flex-col items-center gap-1 transition-all',
                    isActive 
                      ? (theme === 'light' ? 'text-blue-600 font-bold scale-110' : 'text-blue-400 font-bold scale-110') 
                      : (theme === 'light' ? 'text-slate-400' : 'text-slate-600')
                  )}
                >
                    {({ isActive }) => <><item.icon size={24} strokeWidth={isActive ? 2.5 : 2} /></>}
                </NavLink>
            ))}
        </div>
      </nav>
    </GridBackground>
  );
};
