import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, CalendarCheck, CalendarRange, Moon, Sun, Droplets, BookUser, Handshake, CreditCard, LogOut, ShieldCheck, Compass, Map, Building2, Search, ChevronLeft, ChevronRight, GraduationCap, Plus, Menu, Bell, ArrowUpRight } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useLeads } from '../contexts/LeadContext';
import { useTasks } from '../contexts/TaskContext';
import { cn } from '../utils/helpers';
import { localStore } from '../lib/browserStorage';
import { AddLeadModal } from './AddLeadModal';
import { GlobalSearch } from './GlobalSearch';
import { UserAvatar } from './ui/UserAvatar';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { useReminderNotifications } from '../hooks/useReminderNotifications';

const navigation = [
  { path: '/', label: 'Overview', icon: LayoutDashboard, group: 'Workspace' },
  { path: '/leads', label: 'Leads', icon: Users, group: 'Workspace' },
  { path: '/reminders', label: 'Tasks & follow-ups', icon: CalendarCheck, group: 'Workspace' },
  { path: '/customers', label: 'Customers', icon: BookUser, group: 'Workspace' },
  { path: '/builder', label: 'Itinerary hub', icon: Map, group: 'Sales tools' },
  { path: '/availability', label: 'Availability', icon: CalendarRange, group: 'Sales tools' },
  { path: '/blocked-rates', label: 'Blocked rates', icon: Building2, group: 'Sales tools' },
  { path: '/payments', label: 'Payments', icon: CreditCard, group: 'Operations' },
  { path: '/suppliers', label: 'Suppliers', icon: Handshake, group: 'Operations' },
  { path: '/attendance', label: 'Attendance', icon: CalendarCheck, group: 'Operations' },
  { path: '/quote-trainer', label: 'Quote trainer', icon: GraduationCap, group: 'Operations' },
  { path: '/team-settings', label: 'Team settings', icon: ShieldCheck, group: 'Operations', admin: true },
];

export const Layout = () => {
  const { theme, setTheme } = useTheme();
  const { user, logout, logoutAllDevices } = useAuth();
  const { reminders, loadError, retryLoad, isLoading, setAddLeadModalOpen } = useLeads();
  const { getPendingCount } = useTasks();
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStore.getItem('tte:sidebar-collapsed') === 'true');
  useReminderNotifications();
  const navItems = navigation.filter(item => !item.admin || user?.role === 'admin');
  const active = (path: string) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
  const current = navItems.find(item => active(item.path));
  const pageTitle = current?.label || (location.pathname.startsWith('/leads/') ? 'Lead details' : 'Quotation workspace');
  const isBoard = location.pathname === '/leads';
  const isWide = isBoard || location.pathname.startsWith('/leads/') || /builder|quote-trainer/.test(location.pathname);
  const taskCount = useMemo(() => reminders.filter(r => !r.isCompleted && new Date(r.dueDate) < new Date()).length, [reminders]) + getPendingCount(user?.name || '');
  const search = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'ocean' : 'light');
  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Droplets;

  useEffect(() => {
    if (!isBoard) mainRef.current?.scrollTo({ top: 0 });
    setMenuOpen(false);
    document.title = `${pageTitle} · TTE CRM`;
  }, [location.pathname]);

  const signOut = () => { logout(); navigate('/login'); };
  const signOutEverywhere = () => {
    if (user && window.confirm('Sign out of every browser and device, including this one?')) logoutAllDevices(user.id);
  };
  const toggleSidebar = () => setCollapsed(previous => {
    localStore.setItem('tte:sidebar-collapsed', String(!previous));
    return !previous;
  });
  const navLink = (item: typeof navigation[number], mobile = false) => (
    <Link key={item.path} to={item.path} aria-current={active(item.path) ? 'page' : undefined}
      className={cn('crm-nav-link', active(item.path) && 'is-active', collapsed && !mobile && 'is-collapsed')}
      title={!mobile && collapsed ? item.label : undefined} onClick={() => setMenuOpen(false)}>
      <item.icon size={19} strokeWidth={1.8} aria-hidden="true" />
      {(mobile || !collapsed) && <span>{item.label}</span>}
      {item.path === '/reminders' && taskCount > 0 && <span className="crm-count">{taskCount > 99 ? '99+' : taskCount}</span>}
    </Link>
  );

  return (
    <div className="crm-app" data-theme={theme}>
      <a className="crm-skip-link" href="#crm-main" onClick={e => { e.preventDefault(); mainRef.current?.focus(); }}>Skip to content</a>
      <AddLeadModal />
      <GlobalSearch />
      <aside className={cn('crm-sidebar', collapsed && 'is-collapsed')} aria-label="Main navigation">
        <div className="crm-brand-row">
          <Link to="/" className="crm-brand" aria-label="The Tourism Experts home">
            <span className="crm-brand-mark"><Compass size={23} strokeWidth={1.8} /></span>
            {!collapsed && <span>The Tourism<br /><strong>Experts</strong><small>TRAVEL WORKSPACE</small></span>}
          </Link>
          <button className="crm-icon-button crm-collapse" onClick={toggleSidebar} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed}>
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
        <button className="crm-sidebar-search" onClick={search} aria-label="Search leads"><Search size={17} />{!collapsed && <><span>Search anything</span><kbd>⌘ K</kbd></>}</button>
        <nav className="crm-sidebar-nav">
          {['Workspace', 'Sales tools', 'Operations'].map(group => <div className="crm-nav-group" key={group}>
            {!collapsed && <p className="crm-nav-label">{group}</p>}
            {navItems.filter(item => item.group === group).map(item => navLink(item))}
          </div>)}
        </nav>
        <div className="crm-sidebar-footer">
          <button className="crm-account" onClick={() => setMenuOpen(true)} aria-label="Open account and workspace menu">
            <UserAvatar name={user?.name || 'Expert'} size={34} />
            {!collapsed && <><span><strong>{user?.name}</strong><small>{user?.role === 'admin' ? 'Administrator' : 'Travel consultant'}</small></span><ChevronRight size={15} /></>}
          </button>
        </div>
      </aside>

      <div className="crm-workspace">
        <header className="crm-topbar">
          <Link to="/" className="crm-mobile-brand" aria-label="The Tourism Experts home"><span className="crm-brand-mark"><Compass size={20}/></span><span>The Tourism<strong>Experts</strong></span></Link>
          <div className="crm-breadcrumb"><span>Workspace</span><ChevronRight size={14}/><strong>{pageTitle}</strong></div>
          <div className="crm-topbar-actions">
            <button className="crm-icon-button" onClick={search} aria-label="Search leads" title="Search leads"><Search size={20}/></button>
            <button className="crm-icon-button crm-theme-toggle" onClick={toggleTheme} aria-label={`Change theme, current ${theme}`} title={`Theme: ${theme}`}><ThemeIcon size={19}/></button>
            <Button onClick={() => setAddLeadModalOpen(true)} className="crm-new-lead"><Plus size={18}/><span>New lead</span></Button>
          </div>
        </header>
        <main id="crm-main" ref={mainRef} tabIndex={-1} className={cn('crm-main', isBoard && 'crm-main-board')}>
          <div className={cn('crm-page', isWide && 'crm-page-wide', isBoard && 'crm-page-board')}>
            {!isBoard && (loadError || isLoading) && <div role="status" className={cn('crm-data-status', loadError && 'has-error')}>
              <span>{loadError || 'Loading your workspace…'}</span>{loadError && <button onClick={retryLoad}>Try again <ArrowUpRight size={14}/></button>}
            </div>}
            <Outlet />
          </div>
        </main>
        <nav className="crm-bottom-nav" aria-label="Mobile navigation">
          {navigation.slice(0,4).map(item => <NavLink key={item.path} to={item.path} end={item.path === '/'} className={({isActive}) => cn('crm-bottom-link', isActive && 'is-active')}>
            <span className="relative"><item.icon size={21}/>{item.path === '/reminders' && taskCount > 0 && <i className="crm-notification-dot"/>}</span>
            <span>{item.path === '/' ? 'Overview' : item.path === '/reminders' ? 'Tasks' : item.label}</span>
          </NavLink>)}
          <button className={cn('crm-bottom-link', menuOpen && 'is-active')} onClick={() => setMenuOpen(true)} aria-haspopup="dialog" aria-expanded={menuOpen}><Menu size={21}/><span>More</span></button>
        </nav>
      </div>
      <Modal isOpen={menuOpen} onClose={() => setMenuOpen(false)} title="Your workspace">
        <div className="crm-menu-account"><UserAvatar name={user?.name || 'Expert'} size={40}/><div><strong>{user?.name}</strong><p>{user?.role === 'admin' ? 'Administrator' : 'Travel consultant'}</p></div></div>
        <nav className="crm-menu-grid" aria-label="All workspace sections">{navItems.map(item => navLink(item,true))}</nav>
        <div className="crm-menu-settings">
          <button onClick={toggleTheme}><ThemeIcon size={18}/><span>Appearance: {theme}</span><ChevronRight size={16}/></button>
          {'Notification' in window && Notification.permission !== 'granted' && <button onClick={async () => {
            try { const result = await Notification.requestPermission(); setNotificationMessage(result === 'granted' ? 'Reminder alerts enabled' : 'Browser alerts are not enabled'); }
            catch { setNotificationMessage('This browser does not support reminder alerts'); }
          }}><Bell size={18}/>{notificationMessage || 'Enable reminder alerts'}</button>}
          <button onClick={signOut}><LogOut size={18}/>Sign out</button>
          <button onClick={signOutEverywhere}><ShieldCheck size={18}/>Sign out of all devices</button>
        </div>
      </Modal>
    </div>
  );
};
