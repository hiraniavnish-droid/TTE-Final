import { IncrementalList, useDesktopLayout } from '../components/ui/IncrementalList';

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useLeads } from '../contexts/LeadContext';
import { useAuth } from '../contexts/AuthContext';
import { usePaymentSummary, LeadPaymentSummary } from '../hooks/usePaymentSummary';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { ServiceSelector } from '../components/ServiceSelector';
import { PaxSelector } from '../components/PaxSelector';
import { TravelPreferences } from '../components/TravelPreferences';
import { Lead, LeadStatus, LeadTemperature, LeadSource, PaxConfig, TravelPreferences as TravelPreferencesType, Commercials, User } from '../types';
import { STATUS_COLUMNS } from '../constants';
import { formatCurrency, formatCompactCurrency, generateId, cn, formatDate, timeAgo } from '../utils/helpers';
import Papa from 'papaparse';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  useDraggable,
  useDroppable,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DropAnimation
} from '@dnd-kit/core';
import {
  Plus,
  Filter,
  UploadCloud,
  IndianRupee,
  MapPin,
  SearchX,
  Search,
  Bookmark,
  Users,
  Calendar,
  Phone,
  MessageCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CalendarClock,
  CalendarOff,
  Hourglass,
  Palmtree,
  Plane,
  BedDouble,
  FileCheck,
  AlertOctagon,
  Download,
  CheckCircle2,
  X,
  ClipboardList,
  Copy,
  Check,
} from 'lucide-react';

import { businessDate, dateBoundary, getPeriodRange } from '../lib/dashboardPeriods';
const EmbeddedLeadDetails = React.lazy(()=>import('./LeadDetails').then(module=>({default:module.LeadDetails})));
const LeadWorkspaceOpen = React.createContext<(id: string) => void>(() => {});
const getLeadPeriodRange = (period: 'This Month'|'Last Month') => {
  const range=getPeriodRange(period);
  if(period==='This Month'){const [year,month]=businessDate().split('-').map(Number);range.end=dateBoundary(new Date(Date.UTC(year,month,0)).toISOString().slice(0,10),true);}
  return range;
};

// ─── Shared Helpers ───────────────────────────────────────────────────────────

const jumpToBuilder = (lead: Lead) => {
  try {
    localStorage.setItem('tte_pending_lead', JSON.stringify({
      name: lead.name,
      pax: lead.tripDetails.paxConfig.adults || 2,
      startDate: lead.tripDetails.startDate || '',
    }));
  } catch (_) {}
  window.location.hash = '#/builder';
};

import { Link, useNavigate } from 'react-router-dom';
import { LeadCodeChip } from '../components/ui/LeadCodeChip';

// ─── Payment status — only meaningful once a deal is Won ──────────────────────
type PayState = 'unpaid' | 'partial' | 'paid' | null;
const getPayState = (lead: Lead, payment: LeadPaymentSummary | undefined, paymentLoaded: boolean): PayState => {
  if (lead.legacy) return null; // legacy deals carry no payment state — settled outside this company's books
  if (lead.status !== 'Won' || !paymentLoaded) return null;
  const expectedAmount = lead.commercials?.sellingPrice || 0;
  const collected = payment?.collected || 0;
  if (!payment?.hasAny || collected <= 0) return 'unpaid';
  if (expectedAmount > 0 && collected < expectedAmount) return 'partial';
  return 'paid';
};

// ─── Urgency Logic ───────────────────────────────────────────────────────────

const getLeadUrgency = (lead: Lead): { colorClass: string; tooltip: string } => {
  const defaultRes = { colorClass: '', tooltip: '' };
  const lastUpdate = lead.lastStatusUpdate ? new Date(lead.lastStatusUpdate) : new Date(lead.createdAt);
  const diffMs = Date.now() - lastUpdate.getTime();
  const diffMins = diffMs / (1000 * 60);
  const diffHours = diffMs / (1000 * 60 * 60);

  if (lead.status === 'Won' || lead.status === 'Lost') return defaultRes;
  if (lead.status === 'New') {
    if (diffMins > 20) return { colorClass: 'red', tooltip: `New Lead ignored for ${Math.round(diffMins)} mins!` };
    if (diffMins > 10) return { colorClass: 'orange', tooltip: `New Lead ignored for ${Math.round(diffMins)} mins!` };
  } else if (lead.status === 'Contacted') {
    if (diffHours > 2) return { colorClass: 'red', tooltip: `No movement for ${Math.round(diffHours)} hours!` };
    if (diffHours > 1) return { colorClass: 'orange', tooltip: `No movement for ${Math.round(diffHours)} hours!` };
  } else if (lead.status === 'Proposal Sent') {
    if (diffHours > 24) return { colorClass: 'red', tooltip: `Proposal stale for ${Math.round(diffHours / 24)} days!` };
    if (diffHours > 4) return { colorClass: 'orange', tooltip: `Proposal stale for ${Math.round(diffHours)} hours!` };
  } else if (lead.status === 'Discussion') {
    if (diffHours > 96) return { colorClass: 'red', tooltip: `Discussion stale for ${Math.round(diffHours / 24)} days!` };
    if (diffHours > 24) return { colorClass: 'orange', tooltip: `Discussion stale for ${Math.round(diffHours / 24)} days!` };
  }
  return defaultRes;
};

// ─── Avatar Helpers ───────────────────────────────────────────────────────────

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #6366f1, #8b5cf6)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
  'linear-gradient(135deg, #22c55e, #0ea5e9)',
  'linear-gradient(135deg, #f43f5e, #ec4899)',
  'linear-gradient(135deg, #38bdf8, #6366f1)',
  'linear-gradient(135deg, #0ea5e9, #22c55e)',
  'linear-gradient(135deg, #a78bfa, #f472b6)',
  'linear-gradient(135deg, #fb923c, #fbbf24)',
];

const getAvatarGradient = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
};

const AGENT_COLORS = [
  'bg-indigo-500 text-white border-indigo-300',
  'bg-amber-500 text-white border-amber-300',
  'bg-emerald-500 text-white border-emerald-300',
  'bg-rose-500 text-white border-rose-300',
  'bg-sky-500 text-white border-sky-300',
  'bg-violet-500 text-white border-violet-300',
  'bg-orange-500 text-white border-orange-300',
  'bg-teal-500 text-white border-teal-300',
];
export const getAgentColor = (name: string | undefined | null): string => {
  if (!name) return AGENT_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) >>> 0;
  }
  return AGENT_COLORS[hash % AGENT_COLORS.length];
};

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const getBandStyle = (lead: Lead, urgencyColor: string): string => {
  if (urgencyColor === 'red') return 'linear-gradient(90deg, #ef4444, #f97316)';
  if (urgencyColor === 'orange') return 'linear-gradient(90deg, #f97316, #fbbf24)';
  if (lead.temperature === 'Hot') return 'linear-gradient(90deg, #f43f5e, #ec4899)';
  if (lead.temperature === 'Warm') return 'linear-gradient(90deg, #fbbf24, #f59e0b)';
  return 'linear-gradient(90deg, #38bdf8, #818cf8)';
};

// ─── Column Styles ────────────────────────────────────────────────────────────

const COLUMN_STYLES: Record<string, {
  headerBg: string; dot: string; title: string; badge: string; isOver: string; accent: string;
}> = {
  'New':          { headerBg: 'bg-blue-50/70',    dot: 'bg-blue-400',    title: 'text-blue-600',    badge: 'bg-blue-100 text-blue-600',    isOver: 'ring-2 ring-blue-300 bg-blue-50',    accent: 'bg-gradient-to-r from-blue-400 to-sky-400'       },
  'Contacted':    { headerBg: 'bg-amber-50/70',   dot: 'bg-amber-400',   title: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700',   isOver: 'ring-2 ring-amber-300 bg-amber-50',   accent: 'bg-gradient-to-r from-amber-400 to-yellow-400'    },
  'Proposal Sent':{ headerBg: 'bg-purple-50/70',  dot: 'bg-purple-400',  title: 'text-purple-700',  badge: 'bg-purple-100 text-purple-700',  isOver: 'ring-2 ring-purple-300 bg-purple-50',  accent: 'bg-gradient-to-r from-purple-400 to-fuchsia-400'  },
  'Discussion':   { headerBg: 'bg-indigo-50/70',  dot: 'bg-indigo-400',  title: 'text-indigo-700',  badge: 'bg-indigo-100 text-indigo-700',  isOver: 'ring-2 ring-indigo-300 bg-indigo-50',  accent: 'bg-gradient-to-r from-indigo-400 to-violet-400'   },
  'Won':          { headerBg: 'bg-emerald-50/70', dot: 'bg-emerald-400', title: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', isOver: 'ring-2 ring-emerald-300 bg-emerald-50', accent: 'bg-gradient-to-r from-emerald-400 to-teal-400'    },
  'Lost':         { headerBg: 'bg-rose-50/70',    dot: 'bg-rose-400',    title: 'text-rose-700',    badge: 'bg-rose-100 text-rose-700',    isOver: 'ring-2 ring-rose-300 bg-rose-50',    accent: 'bg-gradient-to-r from-rose-400 to-red-400'        },
};

// ─── Kanban: Lead Card ────────────────────────────────────────────────────────

const LeadCard: React.FC<{ lead: Lead; isOverlay?: boolean; isDragging?: boolean; compact?: boolean; payment?: LeadPaymentSummary; paymentLoaded?: boolean }> = ({ lead, isOverlay, isDragging, compact, payment, paymentLoaded }) => {
  const { theme } = useTheme();
  const { colorClass: urgencyColor, tooltip: urgencyTooltip } = getLeadUrgency(lead);
  const isRed = urgencyColor === 'red';
  const isOrange = urgencyColor === 'orange';
  const hasUrgency = isRed || isOrange;

  const leftBorder = isRed ? 'border-l-red-500'
    : isOrange ? 'border-l-orange-500'
    : lead.temperature === 'Hot' ? 'border-l-rose-400'
    : lead.temperature === 'Warm' ? 'border-l-amber-400'
    : 'border-l-sky-400';

  const bgTint = isRed
    ? (theme === 'light' ? 'bg-red-50' : 'bg-red-500/10')
    : isOrange
    ? (theme === 'light' ? 'bg-orange-50' : 'bg-orange-500/10')
    : theme === 'light' ? 'bg-white' : 'bg-white/5';

  const getServiceIcon = () => {
    if (lead.interestedServices.includes('Holiday Package')) return Palmtree;
    if (lead.interestedServices.includes('Flight Booking')) return Plane;
    if (lead.interestedServices.includes('Hotel Booking')) return BedDouble;
    if (lead.interestedServices.includes('Visa Service')) return FileCheck;
    return null;
  };
  const ServiceIcon = getServiceIcon();

  const destPax = [
    lead.tripDetails.destination,
    [lead.tripDetails.paxConfig.adults > 0 ? `${lead.tripDetails.paxConfig.adults}A` : '',
     lead.tripDetails.paxConfig.children > 0 ? `${lead.tripDetails.paxConfig.children}C` : '']
      .filter(Boolean).join(' '),
  ].filter(Boolean).join(' · ');

  const waLink = `https://wa.me/${lead.contact.phone.replace(/[^0-9]/g, '')}`;
  const budget = lead.tripDetails.budget > 0 ? formatCompactCurrency(lead.tripDetails.budget) : null;
  const profit = lead.commercials ? lead.commercials.sellingPrice - lead.commercials.netCost : null;
  const initials = getInitials(lead.name);
  const avatarGradient = getAvatarGradient(lead.name);

  const tempDot = lead.temperature === 'Hot' ? 'bg-rose-500' : lead.temperature === 'Warm' ? 'bg-amber-500' : 'bg-sky-500';

  const tempBadge = {
    light: { Hot: 'bg-rose-100 text-rose-700', Warm: 'bg-amber-100 text-amber-700', Cold: 'bg-sky-100 text-sky-700' },
    dark:  { Hot: 'bg-rose-500/20 text-rose-300', Warm: 'bg-amber-500/20 text-amber-300', Cold: 'bg-sky-500/20 text-sky-300' },
  };

  // ── Payment flag — only meaningful once a deal is Won ──────────────────────
  const expectedAmount = lead.commercials?.sellingPrice || 0;
  const collected = payment?.collected || 0;
  const payState = getPayState(lead, payment, !!paymentLoaded);
  const payRingClass = payState === 'unpaid'
    ? 'ring-2 ring-rose-400 animate-pulse'
    : payState === 'partial'
    ? 'ring-2 ring-amber-400'
    : '';

  return (
    // ── Double-Bezel outer shell ────────────────────────────────────────────
    <div className={cn(
      'p-[1.5px] rounded-[1.25rem] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] select-none',
      isOverlay ? 'scale-105 rotate-2 cursor-grabbing' : 'cursor-grab',
      isDragging && 'opacity-30 grayscale',
      theme === 'light' && !isOverlay
        ? cn(
            'bg-gradient-to-br from-slate-200/70 to-slate-100/20',
            'shadow-[0_2px_10px_-2px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)]',
            'hover:shadow-[0_8px_24px_-4px_rgba(15,23,42,0.11),0_2px_6px_rgba(15,23,42,0.05)] hover:-translate-y-0.5'
          )
        : isOverlay ? 'ring-2 ring-blue-500/50 shadow-2xl bg-white/10' : 'bg-white/5',
      payRingClass,
    )}>
    {/* ── Inner core ──────────────────────────────────────────────────────── */}
    <div
      className={cn(
        'relative rounded-[calc(1.25rem-1.5px)] border-l-[3px] group',
        compact ? 'p-2' : 'p-2.5',
        bgTint,
        leftBorder,
        theme === 'light'
          ? 'bg-white border-slate-200/0 shadow-[inset_0_1px_0_rgba(255,255,255,1)]'
          : 'border-white/10',
        !isOverlay && theme === 'light' && 'hover:border-l-indigo-400',
      )}
      title={urgencyTooltip}
    >
      <div className="flex items-start gap-2.5">
        {/* Monogram avatar — unique colour per lead for fast scanning */}
        <div
          className={cn(
            'rounded-xl flex items-center justify-center font-black text-white shrink-0 shadow-sm ring-1 ring-black/5',
            compact ? 'w-7 h-7 text-[9.5px]' : 'w-9 h-9 text-[12px]'
          )}
          style={{ background: avatarGradient }}
        >
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          {/* Name — its own full-width line so it's never squeezed by the
              timestamp; icons still ride alongside since they're cheap. */}
          <div className="flex items-center gap-1 min-w-0" title={lead.name}>
            <span className={cn('font-bold tracking-tight truncate', compact ? 'text-[12px]' : 'text-[13px]', theme === 'light' ? 'text-slate-900' : 'text-white')}>
              {lead.name}
            </span>
            {ServiceIcon && !compact && <ServiceIcon size={11} className="shrink-0 opacity-40 text-slate-400" />}
            {hasUrgency && <AlertOctagon size={11} className={cn('shrink-0', isRed ? 'text-red-500' : 'text-orange-500')} />}
          </div>

          {/* Lead code + destination + pax, timestamp pushed down here so it
              never competes with the name for space. */}
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <div className={cn('truncate min-w-0', compact ? 'text-[10px]' : 'text-[11px]', theme === 'light' ? 'text-slate-500' : 'text-white/50')}>
              {lead.leadCode && (
                <span className={cn('font-mono font-bold mr-1.5', theme === 'light' ? 'text-slate-400' : 'text-white/35')}>{lead.leadCode}</span>
              )}
              {destPax || <span className="italic opacity-50">No details</span>}
            </div>
            <span className={cn('whitespace-nowrap shrink-0 tracking-wide', compact ? 'text-[9px]' : 'text-[10px]', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>
              {timeAgo(lead.createdAt)}
            </span>
          </div>

          {/* Meta row — temperature dot + agent + budget (hidden when compact) */}
          {!compact && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className={cn(
                'inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md',
                theme === 'light' ? tempBadge.light[lead.temperature] : tempBadge.dark[lead.temperature]
              )}>
                <span className={cn('w-1.5 h-1.5 rounded-full', tempDot)} />
                {lead.temperature}
              </span>
              {lead.legacy && (
                <span className={cn('text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md', theme === 'light' ? 'bg-slate-200 text-slate-500' : 'bg-white/10 text-white/40')}>
                  Legacy
                </span>
              )}
              {lead.assignedTo && (
                <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap truncate max-w-[76px]', theme === 'light' ? 'bg-violet-50 text-violet-600' : 'bg-violet-500/20 text-violet-300')}>
                  {lead.assignedTo}
                </span>
              )}
              {(budget || profit !== null) && (
                <div className="ml-auto flex items-center gap-1 shrink-0">
                  {profit !== null && (
                    <span className={cn('text-[9.5px] font-bold font-mono px-1.5 py-0.5 rounded-md shrink-0', profit >= 0 ? (theme === 'light' ? 'bg-indigo-50 text-indigo-600' : 'bg-indigo-500/15 text-indigo-300') : (theme === 'light' ? 'bg-rose-50 text-rose-600' : 'bg-rose-500/15 text-rose-300'))}>
                      {profit < 0 ? '-' : ''}{formatCompactCurrency(Math.abs(profit)) || '₹0'}
                    </span>
                  )}
                  {budget && (
                    <span className={cn('text-[9.5px] font-bold font-mono px-1.5 py-0.5 rounded-md shrink-0', theme === 'light' ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/15 text-emerald-300')}>
                      {budget}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {!compact && <div className="flex flex-wrap gap-1 mt-1.5">
            {['rannutsav.in', 'rannutsavtickets.in'].filter(site => lead.tags.includes(site) || lead.source?.includes(site)).map(site => <span key={site} title={lead.source} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md border border-sky-200 text-sky-700 bg-sky-50">{site}</span>)}
          </div>}
          {/* Payment flag — only rendered once a lead is Won. Realized (collected) is bold; unrealized (still owed) is small & faded. */}
          {!compact && payState && (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              <div className={cn('flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md w-fit',
                payState === 'unpaid' ? 'bg-rose-100 text-rose-700 animate-pulse'
                : payState === 'partial' ? 'bg-amber-100 text-amber-700'
                : 'bg-emerald-100 text-emerald-700')}>
                <IndianRupee size={9} />
                {payState === 'unpaid' ? 'No Payment' : payState === 'partial' ? `${formatCompactCurrency(collected)} realized` : 'Paid'}
              </div>
              {payState !== 'paid' && expectedAmount > collected && (
                <span className={cn('text-[8.5px] font-semibold opacity-40', theme === 'light' ? 'text-slate-500' : 'text-white/50')}>
                  + {formatCompactCurrency(expectedAmount - collected)} unrealized
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hover actions (hidden when compact) */}
      {!compact && (
        <div className={cn(
          'overflow-hidden transition-all duration-200 max-h-0 opacity-0 mt-0',
          'group-hover:max-h-12 group-hover:opacity-100 group-hover:mt-2 group-hover:pt-2',
          theme === 'light' ? 'group-hover:border-t group-hover:border-slate-100' : 'group-hover:border-t group-hover:border-white/10'
        )}>
          <div className="flex gap-1.5">
            <a
              href={`tel:${lead.contact.phone}`}
              onClick={e => e.stopPropagation()}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold border transition-colors',
                theme === 'light' ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'
              )}
            >
              <Phone size={10} /> Call
            </a>
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              onClick={e => e.stopPropagation()}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold border transition-colors',
                theme === 'light' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
              )}
            >
              <MessageCircle size={10} /> WA
            </a>
            <button
              onClick={e => { e.stopPropagation(); jumpToBuilder(lead); }}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold border transition-colors',
                theme === 'light' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20'
              )}
            >
              <ClipboardList size={10} /> Quote
            </button>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

// ─── Mobile Lead Card ─────────────────────────────────────────────────────────

interface MobileLeadCardProps {
  lead: Lead;
  onStatusChange?: (id: string, status: LeadStatus) => void;
}

const MobileLeadCard: React.FC<MobileLeadCardProps> = ({ lead, onStatusChange }) => {
  const { theme, getTextColor, getSecondaryTextColor } = useTheme();
  const { colorClass: urgencyColor } = getLeadUrgency(lead);

  const statusColors: Record<string, string> = {
    'New': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'Contacted': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    'Proposal Sent': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    'Discussion': 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    'Won': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    'Lost': 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  };

  const urgencyBorder = urgencyColor === 'red' ? 'border-l-4 border-l-red-500 bg-red-50/50'
    : urgencyColor === 'orange' ? 'border-l-4 border-l-orange-500 bg-orange-50/50' : '';

  const waLink = `https://wa.me/${lead.contact.phone.replace(/[^0-9]/g, '')}`;

  return (
    <div className={cn(
      'p-4 rounded-xl border transition-all shadow-sm',
      theme === 'light' ? 'bg-white border-slate-100' : 'bg-white/5 border-white/10',
      urgencyBorder
    )}>
      <div className="flex justify-between items-start mb-3">
        <Link to={`/leads/${lead.id}`} className={cn('font-bold text-lg truncate flex-1 mr-2', getTextColor())}>
          {lead.name}
        </Link>
        <div className="relative shrink-0">
          <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold uppercase border flex items-center gap-1', statusColors[lead.status] || 'bg-slate-500/10 text-slate-500 border-slate-500/20')}>
            {lead.status}
            {onStatusChange && <ChevronDown size={12} strokeWidth={3} />}
          </span>
          {onStatusChange && (
            <select value={lead.status} onChange={e => onStatusChange(lead.id, e.target.value as LeadStatus)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
              {STATUS_COLUMNS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>
      </div>
      <Link to={`/leads/${lead.id}`} className="block space-y-2 mb-4">
        <div className={cn('flex items-center gap-2 text-sm', getSecondaryTextColor())}>
          <MapPin size={16} className="opacity-70 text-blue-400" />
          <span>{lead.tripDetails.destination}</span>
        </div>
        <div className={cn('flex items-center gap-2 text-sm', getSecondaryTextColor())}>
          <Calendar size={16} className="opacity-70 text-purple-400" />
          <span>{formatDate(lead.tripDetails.startDate)}</span>
        </div>
      </Link>
      <div className="flex flex-wrap gap-1.5 mb-3 text-[10px]">
        {lead.source && <span className="rounded-md border border-slate-200 px-2 py-1">{lead.source}</span>}
        {['rannutsav.in', 'rannutsavtickets.in'].filter(site => lead.tags.includes(site) && !lead.source?.includes(site)).map(site => <span key={site} className="rounded-md border border-sky-200 px-2 py-1 text-sky-700">{site}</span>)}
      </div>
      <div className="grid grid-cols-2 gap-3 mt-2">
        <a href={`tel:${lead.contact.phone}`} className={cn('flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors border', theme === 'light' ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-green-500/10 text-green-400 border-green-500/20')}>
          <Phone size={16} /> Call
        </a>
        <a href={waLink} target="_blank" rel="noreferrer" className={cn('flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors border', theme === 'light' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20')}>
          <MessageCircle size={16} /> WhatsApp
        </a>
      </div>
    </div>
  );
};

// ─── DND Wrappers ─────────────────────────────────────────────────────────────

const DraggableCard: React.FC<{ lead: Lead; compact?: boolean; payment?: LeadPaymentSummary; paymentLoaded?: boolean }> = ({ lead, compact, payment, paymentLoaded }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  const openLead = React.useContext(LeadWorkspaceOpen);
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="touch-none outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-2xl cursor-grab active:cursor-grabbing"
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); openLead(lead.id); } }}
      onClick={() => { if (!isDragging) openLead(lead.id); }}
    >
      <LeadCard lead={lead} isDragging={isDragging} compact={compact} payment={payment} paymentLoaded={paymentLoaded} />
    </div>
  );
};

const DroppableColumn: React.FC<{ status: string; children: React.ReactNode; totalCount?: number; collapsed?: boolean; onToggle?: () => void }> = ({ status, children, totalCount, collapsed, onToggle }) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const { theme } = useTheme();
  const cs = COLUMN_STYLES[status] || COLUMN_STYLES['New'];
  const count = totalCount ?? React.Children.count(children);

  // ── Collapsed rail (used for the Lost column) ──────────────────────────────
  if (collapsed) {
    return (
      <button
        ref={setNodeRef}
        onClick={onToggle}
        title={`Show ${status} (${count})`}
        className={cn(
          'flex-none w-11 h-full p-[1.5px] rounded-[1.375rem] transition-all duration-500 group',
          theme === 'light'
            ? cn('bg-gradient-to-b from-slate-200/60 to-slate-100/20', isOver && 'from-rose-300/60 to-rose-200/30')
            : cn('border border-white/10', isOver && 'bg-white/10')
        )}
      >
        <div className={cn(
          'h-full rounded-[calc(1.375rem-1.5px)] flex flex-col items-center justify-between py-3 transition-colors',
          theme === 'light' ? 'bg-white/60 group-hover:bg-white' : 'bg-black/20 group-hover:bg-white/5'
        )}>
          <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', theme === 'light' ? cs.badge : 'bg-white/20 text-white/70')}>{count}</span>
          <div className="flex items-center gap-1.5 [writing-mode:vertical-rl] rotate-180">
            <div className={cn('w-1.5 h-1.5 rounded-full', theme === 'light' ? cs.dot : 'bg-white/50')} />
            <span className={cn('font-semibold text-[10px] uppercase tracking-[0.16em]', theme === 'light' ? cs.title : 'text-white/70')}>{status}</span>
          </div>
          <ChevronLeft size={14} className="opacity-40 group-hover:opacity-100 transition-opacity" />
        </div>
      </button>
    );
  }

  return (
    // ── Double-Bezel outer shell (owns flex dimensions) ──────────────────────
    <div className={cn(
      'p-[1.5px] rounded-[1.375rem] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]',
      onToggle ? 'flex-none w-[228px]' : 'flex-1 min-w-[224px]',
      'h-full',
      theme === 'light'
        ? cn(
            isOver
              ? 'bg-gradient-to-b from-blue-300/60 to-blue-200/30 shadow-[0_0_0_2px_rgba(147,197,253,0.5)]'
              : 'bg-gradient-to-b from-slate-200/60 to-slate-100/20 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06),0_1px_4px_rgba(15,23,42,0.03)]'
          )
        : cn('border border-white/10', isOver ? 'bg-white/10' : 'bg-black/20')
    )}>
    {/* ── Inner core ──────────────────────────────────────────────────────── */}
    <div ref={setNodeRef} className={cn(
      'h-full rounded-[calc(1.375rem-1.5px)] flex flex-col overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]',
      theme === 'light'
        ? cn('bg-white/70', isOver && 'bg-blue-50/80')
        : cn('bg-black/20', isOver && 'bg-white/10')
    )}>
      {/* Stage accent strip — peripheral colour identity for each column */}
      <div className={cn('h-[3px] shrink-0', cs.accent, isOver && 'opacity-100')} />
      <div className={cn(
        'px-3.5 py-2.5 flex items-center justify-between border-b',
        theme === 'light'
          ? cn(isOver ? 'bg-blue-50 border-blue-200/50' : cs.headerBg, 'border-slate-200/40')
          : cn(isOver ? 'bg-white/15 border-white/15' : 'bg-white/5 border-white/10')
      )}>
        <div className="flex items-center gap-2 min-w-0">
          {onToggle && (
            <span onClick={(e) => { e.stopPropagation(); onToggle(); }} className="cursor-pointer opacity-50 hover:opacity-100 transition-opacity" title="Collapse">
              <ChevronRight size={14} />
            </span>
          )}
          <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', theme === 'light' ? cs.dot : 'bg-white/50')} />
          <h3 className={cn('font-semibold text-[10px] uppercase tracking-[0.14em] truncate', theme === 'light' ? cs.title : 'text-white/70')}>
            {status}
          </h3>
        </div>
        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', theme === 'light' ? (isOver ? 'bg-blue-500 text-white' : cs.badge) : 'bg-white/20 text-white/70')}>
          {count}
        </span>
      </div>
      {count === 0 ? (
        <div className={cn(
          'flex-1 flex flex-col items-center justify-center px-4 gap-2 rounded-b-2xl border-2 border-dashed m-2',
          theme === 'light' ? 'border-slate-200 text-slate-400' : 'border-white/10 text-white/30'
        )}>
          <div className="text-2xl opacity-50">⋯</div>
          <span className="text-[10px] font-medium tracking-wide text-center">Drop leads here</span>
        </div>
      ) : (
        <div data-workspace-scroll={`column-${status}`} className="flex-1 overflow-y-auto custom-scrollbar p-2 pb-2 space-y-2 min-h-0">
          {children}
        </div>
      )}
    </div>
    </div>
  );
};

// ─── Pipeline Stats Bar (Kanban) ──────────────────────────────────────────────

// Five active pipeline stages fill the board; "Lost" lives in a collapsible rail.
const ACTIVE_COLUMNS = STATUS_COLUMNS.filter(s => s !== 'Lost');

const PILL_STYLES: Record<string, string> = {
  'New':           'bg-blue-50 text-blue-700 border-blue-200',
  'Contacted':     'bg-amber-50 text-amber-700 border-amber-200',
  'Proposal Sent': 'bg-purple-50 text-purple-700 border-purple-200',
  'Discussion':    'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Won':           'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Lost':          'bg-rose-50 text-rose-700 border-rose-200',
};

const PipelineStatsBar: React.FC<{ leads: Lead[] }> = ({ leads }) => {
  const { theme } = useTheme();
  return (
    <div className="flex items-center gap-2 flex-wrap shrink-0">
      <span className={cn('text-[9px] font-semibold uppercase tracking-[0.16em]', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>
        Pipeline
      </span>
      {STATUS_COLUMNS.map(status => {
        const count = leads.filter(l => l.status === status).length;
        return (
          <div key={status} className={cn(
            'flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border',
            theme === 'light' ? PILL_STYLES[status] : 'bg-white/10 text-white/60 border-white/10'
          )}>
            <span className="font-black">{count}</span>
            <span className="opacity-70">{status === 'Proposal Sent' ? 'Proposal' : status}</span>
          </div>
        );
      })}
    </div>
  );
};

// ─── Overview: Lead Card ──────────────────────────────────────────────────────

const OverviewLeadCard: React.FC<{
  lead: Lead;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ lead, isSelected, onSelect }) => {
  const { theme } = useTheme();
  const { colorClass: urgencyColor, tooltip: urgencyTooltip } = getLeadUrgency(lead);
  const isRed = urgencyColor === 'red';
  const hasUrgency = !!urgencyColor;
  const bandStyle = getBandStyle(lead, urgencyColor);
  const initials = getInitials(lead.name);
  const avatarGradient = getAvatarGradient(lead.name);

  const { adults, children } = lead.tripDetails.paxConfig;
  const paxStr = [adults > 0 ? `${adults}A` : '', children > 0 ? `${children}C` : ''].filter(Boolean).join(' · ') || null;
  const budget = lead.tripDetails.budget > 0 ? formatCompactCurrency(lead.tripDetails.budget) : null;
  const profit = lead.commercials ? lead.commercials.sellingPrice - lead.commercials.netCost : null;
  const waLink = `https://wa.me/${lead.contact.phone.replace(/[^0-9]/g, '')}`;

  return (
    <div
      onClick={onSelect}
      role="button" tabIndex={0} aria-label={`Open lead ${lead.name}`}
      onKeyDown={e=>{if(e.target===e.currentTarget && (e.key==='Enter' || e.key===' ')){e.preventDefault();onSelect();}}}
      title={urgencyTooltip}
      className={cn(
        'p-[2px] rounded-[1.375rem] focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]',
        theme === 'light'
          ? isSelected
            ? 'bg-gradient-to-br from-indigo-300/80 to-indigo-200/40 shadow-[0_0_0_3px_rgba(99,102,241,0.12),0_12px_32px_-6px_rgba(99,102,241,0.2)] -translate-y-0.5'
            : cn(
                'bg-gradient-to-br from-slate-200/70 to-slate-100/20',
                'shadow-[0_2px_10px_-2px_rgba(15,23,42,0.06)] hover:shadow-[0_10px_28px_-4px_rgba(15,23,42,0.12)] hover:-translate-y-0.5',
                isRed ? 'from-red-200/60 to-red-100/20' : ''
              )
          : isSelected
            ? 'bg-indigo-400/30 shadow-lg -translate-y-0.5'
            : 'bg-white/[0.07] hover:bg-white/[0.12] hover:-translate-y-0.5',
      )}
    >
    {/* Inner core */}
    <div className={cn(
      'rounded-[calc(1.375rem-2px)] overflow-hidden',
      theme === 'light'
        ? isSelected ? 'bg-white shadow-[inset_0_1px_0_rgba(255,255,255,1)]' : 'bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]'
        : isSelected ? 'bg-white/10' : 'bg-white/5'
    )}>
      {/* Color band */}
      <div className="h-[3px] w-full" style={{ background: bandStyle }} />

      {/* Card body */}
      <div className="p-4 pb-3">
        {/* Row 1: Avatar + Name + Time */}
        <div className="flex items-start gap-2.5 mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[13px] font-black text-white shrink-0"
            style={{ background: avatarGradient }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className={cn('text-[14px] font-bold tracking-tight truncate leading-tight', theme === 'light' ? 'text-slate-900' : 'text-white')}>
              {lead.name}
            </div>
            <div className={cn('text-[10px] mt-0.5', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>
              {lead.leadCode && <span className="font-mono font-bold mr-1.5">{lead.leadCode}</span>}
              {lead.contact.phone}
            </div>
          </div>
          <div className={cn('text-[10px] shrink-0 pt-0.5', theme === 'light' ? 'text-slate-300' : 'text-white/30')}>
            {timeAgo(lead.createdAt)}
          </div>
        </div>

        {/* Row 2: Info chips */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {lead.tripDetails.destination && (
            <span className={cn('flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold', theme === 'light' ? 'bg-slate-50 text-slate-600' : 'bg-white/10 text-white/60')}>
              📍 {lead.tripDetails.destination}
            </span>
          )}
          {budget && (
            <span className={cn('flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold font-mono', theme === 'light' ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-500/10 text-emerald-400')}>
              ₹ {budget}
            </span>
          )}
          {paxStr && (
            <span className={cn('flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold', theme === 'light' ? 'bg-slate-50 text-slate-600' : 'bg-white/10 text-white/60')}>
              👥 {paxStr}
            </span>
          )}
          {profit !== null && (
            <span className={cn('flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold font-mono', profit >= 0 ? (theme === 'light' ? 'bg-indigo-50 text-indigo-700' : 'bg-indigo-500/10 text-indigo-400') : (theme === 'light' ? 'bg-rose-50 text-rose-700' : 'bg-rose-500/10 text-rose-400'))}>
              📈 {formatCompactCurrency(Math.abs(profit)) || '₹0'} profit
            </span>
          )}
          {hasUrgency && (
            <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-red-50 text-red-600">
              ⚠ {isRed ? 'Urgent' : 'Follow up'}
            </span>
          )}
        </div>

        {/* Row 3: Tags */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn(
            'text-[9px] font-black uppercase tracking-wide px-2 py-1 rounded-md',
            lead.temperature === 'Hot' ? 'bg-rose-100 text-rose-600' : lead.temperature === 'Warm' ? 'bg-amber-100 text-amber-600' : 'bg-sky-100 text-sky-600'
          )}>
            {lead.temperature}
          </span>
          {lead.legacy && (
            <span className={cn('text-[9px] font-bold uppercase px-2 py-1 rounded-md', theme === 'light' ? 'bg-slate-200 text-slate-500' : 'bg-white/10 text-white/40')}>
              Legacy
            </span>
          )}
          {lead.source && (
            <span className={cn('text-[9px] font-bold uppercase px-2 py-1 rounded-md border', theme === 'light' ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-white/10 text-white/40 border-white/10')}>
              {lead.source}
            </span>
          )}
          {['rannutsav.in', 'rannutsavtickets.in'].filter(site => lead.tags.includes(site) && !lead.source?.includes(site)).map(site => (
            <span key={site} className="text-[9px] font-bold px-2 py-1 rounded-md bg-sky-50 text-sky-700 border border-sky-200">{site}</span>
          ))}
          {lead.interestedServices[0] && (
            <span className={cn('text-[9px] font-bold uppercase px-2 py-1 rounded-md', theme === 'light' ? 'bg-indigo-50 text-indigo-500' : 'bg-indigo-500/10 text-indigo-400')}>
              {lead.interestedServices[0].replace(' Package', '').replace(' Booking', '').replace(' Service', '')}
            </span>
          )}
          {lead.assignedTo && (
            <span className={cn('text-[9px] font-bold px-2 py-1 rounded-full ml-auto', theme === 'light' ? 'bg-violet-50 text-violet-500' : 'bg-violet-500/10 text-violet-400')}>
              {lead.assignedTo}
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className={cn(
        'flex gap-1.5 px-3 py-2.5 border-t',
        isSelected
          ? (theme === 'light' ? 'bg-indigo-50/50 border-indigo-100' : 'bg-indigo-500/10 border-indigo-500/20')
          : (theme === 'light' ? 'bg-slate-50/60 border-slate-100' : 'bg-white/5 border-white/10')
      )}>
        <a href={`tel:${lead.contact.phone}`} onClick={e => e.stopPropagation()} className={cn('flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold border transition-colors', theme === 'light' ? 'bg-white text-green-700 border-green-200 hover:bg-green-50' : 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20')}>
          📞 Call
        </a>
        <a href={waLink} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className={cn('flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold border transition-colors', theme === 'light' ? 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20')}>
          💬 WA
        </a>
        <button onClick={e => { e.stopPropagation(); jumpToBuilder(lead); }} className={cn('flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold border transition-colors', theme === 'light' ? 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20')}>
          📋 Quote
        </button>
      </div>
    </div>
    </div>
  );
};

// ─── Overview Grid ─────────────────────────────────────────────────────────────

const OverviewGrid: React.FC<{
  allLeads: Lead[];
  leads: Lead[];
  updateLeadStatus: (id: string, status: LeadStatus) => void;
  updateLead: (id: string, updates: Partial<Lead>) => void;
  users: User[];
  stageFilter: string;
  onStageFilterChange: (f: string) => void;
  dateLabel?: string;
  onClearDateFilter?: () => void;
}> = ({ allLeads, leads, updateLeadStatus, updateLead, users, stageFilter, onStageFilterChange, dateLabel, onClearDateFilter }) => {
  const { theme } = useTheme();
  const openLead = React.useContext(LeadWorkspaceOpen);
  const [overviewParams,setOverviewParams]=useSearchParams();
  const groupBy=(overviewParams.get('group') || 'none') as 'none'|'agent'|'temperature';
  const sortBy=(overviewParams.get('sort') || 'newest') as 'newest'|'budget'|'name';
  const setGroupBy=(fn:(v:typeof groupBy)=>typeof groupBy)=>setOverviewParams(p=>{const n=new URLSearchParams(p);n.set('group',fn(groupBy));return n;},{replace:true});
  const setSortBy=(fn:(v:typeof sortBy)=>typeof sortBy)=>setOverviewParams(p=>{const n=new URLSearchParams(p);n.set('sort',fn(sortBy));return n;},{replace:true});

  const stats = useMemo(() => {
    const now = new Date();
    const active = allLeads.filter(l => l.status !== 'Won' && l.status !== 'Lost');
    const pipelineValue = active.reduce((sum, l) => sum + l.tripDetails.budget, 0);
    const needAction = allLeads.filter(l => !!getLeadUrgency(l).colorClass).length;
    const wonThisMonth = allLeads.filter(l => {
      if (l.status !== 'Won') return false;
      const d = new Date(l.lastStatusUpdate || l.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    return { active: active.length, pipelineValue, needAction, wonThisMonth };
  }, [allLeads]);

  const stageCounts = useMemo(() => {
    const c: Record<string, number> = { '': leads.length };
    STATUS_COLUMNS.forEach(s => { c[s] = leads.filter(l => l.status === s).length; });
    return c;
  }, [leads]);

  const filtered = useMemo(() => stageFilter ? leads.filter(l => l.status === stageFilter) : leads, [leads, stageFilter]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sortBy === 'budget') return b.tripDetails.budget - a.tripDetails.budget;
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }), [filtered, sortBy]);

  const groups = useMemo(() => {
    if (groupBy === 'agent') {
      const map = new Map<string, Lead[]>();
      sorted.forEach(l => {
        const key = l.assignedTo || 'Unassigned';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(l);
      });
      return Array.from(map.entries()).map(([key, gLeads]) => ({ key, label: key, leads: gLeads }));
    }
    if (groupBy === 'temperature') {
      return ['Hot', 'Warm', 'Cold']
        .map(t => ({ key: t, label: t, leads: sorted.filter(l => l.temperature === t) }))
        .filter(g => g.leads.length > 0);
    }
    return [{ key: 'all', label: null as string | null, leads: sorted }];
  }, [sorted, groupBy]);

  const sortLabels = { newest: 'Newest', budget: 'Budget', name: 'A–Z' };
  const groupLabels = { none: 'No Group', agent: 'By Agent', temperature: 'By Temp' };

  const containerBg = theme === 'light' ? 'bg-[#f4f6f9]' : 'bg-slate-900/30';

  return (
    <div className={cn('h-[65dvh] md:h-auto md:flex-1 flex flex-col overflow-hidden min-h-0', containerBg)}>

      {/* Stats Strip */}
      <div className={cn('flex items-stretch border-b shrink-0', theme === 'light' ? 'bg-white border-slate-100' : 'bg-white/5 border-white/10')}>
        {([
          { icon: '👥', num: stats.active,        label: 'Active leads',    color: theme === 'light' ? 'text-slate-900' : 'text-white', iconBg: 'bg-indigo-50' },
          { icon: '₹',  num: stats.pipelineValue > 0 ? `₹${formatCompactCurrency(stats.pipelineValue)}` : '₹0', label: 'Pipeline value', color: 'text-emerald-600', iconBg: 'bg-emerald-50' },
          { icon: '🔥', num: stats.needAction,    label: 'Need action',     color: 'text-rose-600',    iconBg: 'bg-rose-50'    },
          { icon: '🏆', num: stats.wonThisMonth,  label: 'Won this month',  color: 'text-amber-600',   iconBg: 'bg-amber-50'   },
        ] as { icon: string; num: string | number; label: string; color: string; iconBg: string }[]).map((s, i) => (
          <div key={i} className={cn('flex-1 flex items-center gap-3 px-5 py-4', i > 0 && (theme === 'light' ? 'border-l border-slate-100' : 'border-l border-white/10'))}>
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0', s.iconBg)}>{s.icon}</div>
            <div>
              <div className={cn('text-xl font-bold leading-none tracking-tight', s.color)}>{s.num}</div>
              <div className="text-[9px] text-slate-400 font-semibold uppercase tracking-[0.12em] mt-1">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className={cn('flex items-center gap-1.5 px-5 py-2.5 shrink-0 overflow-x-auto', theme === 'light' ? 'bg-[#f4f6f9]' : 'bg-white/5')}>
        <button
          onClick={() => onStageFilterChange('')}
          className={cn(
            'px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap border transition-all',
            !stageFilter
              ? (theme === 'light' ? 'bg-white border-slate-200 text-slate-900 shadow-sm' : 'bg-white/20 border-white/20 text-white')
              : (theme === 'light' ? 'bg-transparent border-transparent text-slate-500 hover:bg-white hover:border-slate-200' : 'bg-transparent border-transparent text-white/50 hover:bg-white/10')
          )}
        >
          All{' '}
          <span className={cn('ml-1 text-[9px] font-black px-1.5 py-0.5 rounded-full', !stageFilter ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400')}>
            {leads.length}
          </span>
        </button>

        {STATUS_COLUMNS.map(stage => (
          <button
            key={stage}
            onClick={() => onStageFilterChange(stageFilter === stage ? '' : stage)}
            className={cn(
              'px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap border transition-all',
              stageFilter === stage
                ? (theme === 'light' ? 'bg-white border-slate-200 text-slate-900 shadow-sm' : 'bg-white/20 border-white/20 text-white')
                : (theme === 'light' ? 'bg-transparent border-transparent text-slate-500 hover:bg-white hover:border-slate-200' : 'bg-transparent border-transparent text-white/50 hover:bg-white/10')
            )}
          >
            {stage === 'Proposal Sent' ? 'Proposal' : stage}{' '}
            <span className={cn(
              'ml-1 text-[9px] font-black px-1.5 py-0.5 rounded-full',
              stageFilter === stage ? 'bg-indigo-100 text-indigo-600' : (stageCounts[stage] > 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400')
            )}>
              {stageCounts[stage] || 0}
            </span>
          </button>
        ))}

        <div className="flex-1 min-w-[16px]" />

        <button
          onClick={() => setSortBy(s => s === 'newest' ? 'budget' : s === 'budget' ? 'name' : 'newest')}
          className={cn('text-[11px] font-semibold flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors whitespace-nowrap', theme === 'light' ? 'text-slate-500 hover:text-slate-700' : 'text-white/50 hover:text-white/80')}
        >
          ↕ Sort: {sortLabels[sortBy]}
        </button>

        <button
          onClick={() => setGroupBy(g => g === 'none' ? 'agent' : g === 'agent' ? 'temperature' : 'none')}
          className={cn(
            'text-[11px] font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap',
            theme === 'light'
              ? (groupBy !== 'none' ? 'bg-white border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300')
              : 'bg-white/10 border-white/10 text-white/60 hover:bg-white/20'
          )}
        >
          ⊞ Group: {groupLabels[groupBy]}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Grid scroll */}
        <div data-workspace-scroll="overview" className="flex-1 overflow-y-auto p-5 min-w-0 custom-scrollbar">
          {groups.map(group => (
            <div key={group.key} className="mb-6">
              {group.label && (
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black text-white shrink-0" style={{ background: getAvatarGradient(group.key) }}>
                    {group.label[0].toUpperCase()}
                  </div>
                  <span className={cn('text-xs font-black', theme === 'light' ? 'text-slate-700' : 'text-white/80')}>{group.label}</span>
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', theme === 'light' ? 'bg-slate-100 text-slate-400' : 'bg-white/10 text-white/40')}>
                    {group.leads.length} leads
                  </span>
                  <div className={cn('flex-1 h-px', theme === 'light' ? 'bg-slate-200' : 'bg-white/10')} />
                </div>
              )}

              <div className={cn('grid gap-3', 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3')}>
                <IncrementalList items={group.leads} batchSize={36} resetKey={`${stageFilter}:${sortBy}:${groupBy}`} renderItem={lead => (
                  <OverviewLeadCard key={lead.id} lead={lead} isSelected={false} onSelect={() => openLead(lead.id)} />
                )} />
              </div>
            </div>
          ))}

          {sorted.length === 0 && (
            <div className={cn('flex flex-col items-center justify-center h-40 opacity-40', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>
              <SearchX size={32} className="mb-2" />
              <p className="text-sm font-medium">No leads match this filter</p>
            </div>
          )}
        </div>


      </div>
    </div>
  );
};

// ─── Export ─────────────────────────────────────────────────────────────────
// CSV export of the currently filtered leads — plain numbers (no ₹/formatting) so
// the sheet is ready for accounting/reconciliation math in Excel, not just display.

type ExportRow = Record<string, string | number>;
interface ExportColumn { key: string; label: string; get: (l: Lead, pay: LeadPaymentSummary | undefined) => string | number; }

const vendorTotals = (l: Lead) => {
  let cost = 0, paid = 0;
  for (const v of (l.vendors || [])) {
    cost += v.cost || 0;
    const vPaid = (v.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
    paid += Math.min(vPaid, v.cost || vPaid);
  }
  if ((!l.vendors || l.vendors.length === 0) && l.commercials) cost = l.commercials.netCost || 0;
  return { cost, paid, owed: Math.max(cost - paid, 0) };
};

// Cheque no. / UTR / UPI txn ID entered against each vendor payment — a lead
// can have several vendors, each with several payments, so this joins every
// reference across all of them rather than picking one.
const vendorPaymentRefs = (l: Lead): string =>
  (l.vendors || [])
    .flatMap(v => (v.payments || []).map(p => p.reference).filter((r): r is string => !!r))
    .join('; ');

const EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'leadCode', label: 'Lead Code', get: l => l.leadCode || '' },
  { key: 'name', label: 'Guest Name', get: l => l.name },
  { key: 'phone', label: 'Phone', get: l => l.contact?.phone || '' },
  { key: 'email', label: 'Email', get: l => l.contact?.email || '' },
  { key: 'status', label: 'Stage', get: l => l.status },
  { key: 'temperature', label: 'Temperature', get: l => l.temperature },
  { key: 'assignedTo', label: 'Assigned To', get: l => l.assignedTo || 'Unassigned' },
  { key: 'destination', label: 'Destination', get: l => l.tripDetails?.destination || '' },
  { key: 'travelDate', label: 'Travel Date', get: l => l.tripDetails?.startDate ? formatDate(l.tripDetails.startDate) : '' },
  { key: 'nights', label: 'Nights', get: l => l.tripDetails?.nights || 0 },
  { key: 'pax', label: 'Pax', get: l => `${l.tripDetails?.paxConfig?.adults || 0}A ${l.tripDetails?.paxConfig?.children || 0}C` },
  { key: 'reference', label: 'Reference', get: l => l.referenceName || '' },
  { key: 'sellingPrice', label: 'Selling Price', get: l => l.commercials?.sellingPrice || 0 },
  { key: 'netCost', label: 'Net Cost', get: l => l.commercials?.netCost || 0 },
  { key: 'profit', label: 'Profit', get: l => (l.commercials?.sellingPrice || 0) - (l.commercials?.netCost || 0) },
  { key: 'collected', label: 'Collected', get: (l, pay) => pay?.collected || 0 },
  { key: 'paymentReference', label: 'Payment Reference(s)', get: (l, pay) => (pay?.referenceIds || []).join('; ') },
  { key: 'pending', label: 'Pending', get: (l, pay) => Math.max((l.commercials?.sellingPrice || 0) - (pay?.collected || 0), 0) },
  { key: 'paymentStatus', label: 'Payment Status', get: (l, pay) => { const s = getPayState(l, pay, true); return s ? s[0].toUpperCase() + s.slice(1) : ''; } },
  { key: 'vendorNames', label: 'Vendor(s)', get: l => (l.vendors || []).map(v => v.name).join('; ') || (l.commercials?.manualVendorName || '') },
  { key: 'vendorCost', label: 'Vendor Cost', get: l => vendorTotals(l).cost },
  { key: 'vendorPaid', label: 'Vendor Paid', get: l => vendorTotals(l).paid },
  { key: 'vendorPaymentReference', label: 'Vendor Payment Reference(s)', get: l => vendorPaymentRefs(l) },
  { key: 'vendorOwed', label: 'Vendor Owed', get: l => vendorTotals(l).owed },
  { key: 'hotel', label: 'Hotel Pref', get: l => l.preferences?.hotel || '' },
  { key: 'mealPlan', label: 'Meal Plan', get: l => l.preferences?.mealPlan || '' },
  { key: 'source', label: 'Source', get: l => l.source },
  { key: 'legacy', label: 'Legacy', get: l => l.legacy ? 'Yes' : 'No' },
  { key: 'createdAt', label: 'Created', get: l => l.createdAt ? formatDate(l.createdAt) : '' },
  { key: 'wonAt', label: 'Won Date', get: l => l.wonAt ? formatDate(l.wonAt) : '' },
];

const EXPORT_PRESETS: { label: string; keys: string[] }[] = [
  { label: 'Booking / Vendor Sheet', keys: ['leadCode', 'name', 'phone', 'destination', 'travelDate', 'nights', 'pax', 'assignedTo', 'vendorNames', 'vendorCost', 'vendorPaid', 'vendorPaymentReference', 'vendorOwed', 'status'] },
  { label: 'Reconciliation Sheet', keys: ['leadCode', 'name', 'phone', 'sellingPrice', 'collected', 'paymentReference', 'pending', 'paymentStatus', 'vendorCost', 'vendorPaid', 'vendorPaymentReference', 'vendorOwed', 'profit'] },
  { label: 'Everything', keys: EXPORT_COLUMNS.map(c => c.key) },
];

const ExportPanel: React.FC<{
  leads: Lead[];
  paymentSummary: Record<string, LeadPaymentSummary>;
  onClose: () => void;
}> = ({ leads, paymentSummary, onClose }) => {
  const { theme, getTextColor, getBorderClass } = useTheme();
  const [stage, setStage] = useState('');
  const [selected, setSelected] = useState<string[]>(EXPORT_PRESETS[0].keys);
  const [copied, setCopied] = useState(false);

  const rows = useMemo(() => (stage ? leads.filter(l => l.status === stage) : leads), [leads, stage]);
  const cols = useMemo(() => EXPORT_COLUMNS.filter(c => selected.includes(c.key)), [selected]);

  const toCsvRows = () => rows.map(l => {
    const row: ExportRow = {};
    for (const c of cols) row[c.label] = c.get(l, paymentSummary[l.id]);
    return row;
  });

  const handleDownload = () => {
    const csv = Papa.unparse(toCsvRows());
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tte-leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    // Tab-separated so a direct paste into Excel/Sheets lands in the right columns.
    const header = cols.map(c => c.label).join('\t');
    const body = rows.map(l => cols.map(c => String(c.get(l, paymentSummary[l.id]))).join('\t')).join('\n');
    try {
      await navigator.clipboard.writeText(`${header}\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  const toggleCol = (key: string) => setSelected(p => p.includes(key) ? p.filter(k => k !== key) : [...p, key]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden', theme === 'dark' ? 'bg-slate-900 border border-white/10' : 'bg-white')}>
        <div className={cn('flex items-center justify-between px-5 py-4 border-b shrink-0', getBorderClass())}>
          <div>
            <h2 className={cn('text-lg font-bold', getTextColor())}>Export Leads</h2>
            <p className={cn('text-[12px]', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>{rows.length} lead{rows.length === 1 ? '' : 's'} will be exported</p>
          </div>
          <button onClick={onClose} className={cn('p-2 rounded-full', theme === 'light' ? 'hover:bg-slate-100 text-slate-400' : 'hover:bg-white/10 text-white/50')}><X size={18} /></button>
        </div>

        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          {/* Stage filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-[11px] font-bold uppercase tracking-wide', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>Stage</span>
            {['', ...STATUS_COLUMNS].map(s => (
              <button
                key={s || 'all'}
                onClick={() => setStage(s)}
                className={cn('px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all',
                  stage === s ? 'bg-slate-900 border-slate-900 text-white' : (theme === 'light' ? 'bg-white border-slate-200 text-slate-500' : 'bg-white/5 border-white/10 text-white/50'))}
              >
                {s || 'All'}
              </button>
            ))}
          </div>

          {/* Presets */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-[11px] font-bold uppercase tracking-wide', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>Presets</span>
            {EXPORT_PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => setSelected(p.keys)}
                className={cn('px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all',
                  theme === 'light' ? 'bg-white border-slate-200 text-slate-600 hover:border-slate-400' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/30')}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Column picker */}
          <div>
            <span className={cn('text-[11px] font-bold uppercase tracking-wide', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>Columns ({selected.length})</span>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {EXPORT_COLUMNS.map(c => (
                <label key={c.key} className={cn('flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[12px] cursor-pointer select-none', theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-white/5')}>
                  <input type="checkbox" checked={selected.includes(c.key)} onChange={() => toggleCol(c.key)} className="w-3.5 h-3.5 accent-slate-900 cursor-pointer shrink-0" />
                  <span className={getTextColor()}>{c.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div>
            <span className={cn('text-[11px] font-bold uppercase tracking-wide', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>Preview</span>
            <div className={cn('mt-2 overflow-auto rounded-xl border max-h-56', getBorderClass())}>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className={theme === 'light' ? 'bg-slate-50' : 'bg-white/5'}>
                    {cols.map(c => <th key={c.key} className={cn('px-2.5 py-2 text-left font-bold whitespace-nowrap', getTextColor())}>{c.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 25).map(l => (
                    <tr key={l.id} className={cn('border-t', getBorderClass())}>
                      {cols.map(c => <td key={c.key} className={cn('px-2.5 py-1.5 whitespace-nowrap', theme === 'light' ? 'text-slate-600' : 'text-white/70')}>{String(c.get(l, paymentSummary[l.id]))}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 25 && <div className={cn('px-2.5 py-2 text-[11px] text-center', theme === 'light' ? 'text-slate-400 bg-slate-50' : 'text-white/30 bg-white/5')}>…and {rows.length - 25} more rows in the export</div>}
              {rows.length === 0 && <div className={cn('px-2.5 py-6 text-[11px] text-center', theme === 'light' ? 'text-slate-400' : 'text-white/30')}>No leads match this stage.</div>}
            </div>
          </div>
        </div>

        <div className={cn('flex items-center justify-end gap-2 px-5 py-4 border-t shrink-0', getBorderClass())}>
          <button
            onClick={handleCopy}
            disabled={rows.length === 0 || cols.length === 0}
            className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all disabled:opacity-40',
              theme === 'light' ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-400' : 'bg-white/5 border-white/10 text-white/80 hover:border-white/30')}
          >
            {copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
          <button
            onClick={handleDownload}
            disabled={rows.length === 0 || cols.length === 0}
            className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40',
              theme === 'light' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-slate-900 hover:bg-white/90')}
          >
            <Download size={15} /> Download CSV
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export const Leads = () => {
  const { leads, addLead, addLeads, updateLeadStatus, updateLead, isLoading, loadError, retryLoad } = useLeads();
  const isDesktop = useDesktopLayout();
  const { user, users } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { theme, getTextColor, getInputClass, getBorderClass, getSecondaryTextColor } = useTheme();
  const { paymentSummary, paymentSummaryLoaded } = usePaymentSummary();
  const [searchParams, setSearchParams] = useSearchParams();

  const workspaceKey = `tte-lead-workspace:${user?.id || 'anonymous'}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelDirty=useRef(false);
  const reportDirty=React.useCallback((dirty:boolean)=>{panelDirty.current=dirty;},[]);
  const allowPanelChange=()=>!panelDirty.current || window.confirm('Discard unsaved lead changes?');
  const movePanel=(id:string)=>{if(allowPanelChange()){panelDirty.current=false;setPanelId(id);}};
  const returnFocus = useRef<HTMLElement | null>(null);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [moreFilters, setMoreFilters] = useState(false);
  const [customDates, setCustomDates] = useState(false);
  const [savedViews, setSavedViews] = useState<{name:string; query:string}[]>(() => {
    try { return JSON.parse(localStorage.getItem(`${workspaceKey}:views`) || '[]'); } catch { return []; }
  });
  const [savingView, setSavingView] = useState(false);
  const [viewName, setViewName] = useState('');
  const changeQuery = (changes: Record<string,string>) => setSearchParams(previous => {
    const next = new URLSearchParams(previous);
    Object.entries(changes).forEach(([key,value]) => value ? next.set(key,value) : next.delete(key));
    if (!next.has('view')) next.set('view', previous.get('status') || previous.get('from') ? 'overview' : 'kanban');
    return next;
  }, {replace:true});
  const view = (searchParams.get('view') || (searchParams.get('status') || searchParams.get('from') ? 'overview' : 'kanban')) as 'kanban' | 'overview';
  const setView = (value: 'kanban' | 'overview') => changeQuery({view:value});
  const stageFilter = searchParams.get('status') || '';
  const setStageFilter = (value:string) => changeQuery({status:value});
  const createdFrom = searchParams.get('from') || '';
  const createdTo = searchParams.get('to') || '';
  const setCreatedFrom = (value:string) => changeQuery({from:value});
  const setCreatedTo = (value:string) => changeQuery({to:value});
  const filters = {assignedTo:searchParams.get('agent') || '', paymentStatus:searchParams.get('pay') || ''};
  const setFilters = (next: any) => { const value = typeof next === 'function' ? next(filters) : next; changeQuery({agent:value.assignedTo, pay:value.paymentStatus}); };
  const search = searchParams.get('q') || '';
  const destination = searchParams.get('destination') || '';
  const temperature = searchParams.get('temperature') || '';
  const [activeMobileStatus, setActiveMobileStatus] = useState<LeadStatus>((searchParams.get('mobile') as LeadStatus) || 'New');
  const [lostExpanded, setLostExpanded] = useState(searchParams.get('lost') === '1');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newLeadServices, setNewLeadServices] = useState<string[]>([]);
  const [newLeadPax, setNewLeadPax] = useState<PaxConfig>({ adults: 2, children: 0, childAges: [] });
  const [newLeadPrefs, setNewLeadPrefs] = useState<TravelPreferencesType>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showToast, setShowToast] = useState<{message:string;type:'success'|'error'} | null>(null);
  const [showExport, setShowExport] = useState(false);
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      if (!searchParams.toString()) {
        const saved = sessionStorage.getItem(workspaceKey);
        if (saved) { setSearchParams(saved,{replace:true}); return; }
      }
    }
    sessionStorage.setItem(workspaceKey, searchParams.toString());
    sessionStorage.setItem(`${workspaceKey}:return`, `/leads?${searchParams.toString()}`);
  }, [searchParams,workspaceKey]);
  useEffect(() => {
    const key = `${workspaceKey}:scroll:${searchParams.toString()}`;
    let positions: Record<string,{top:number;left:number}> = {};
    try { positions = JSON.parse(sessionStorage.getItem(key) || '{}'); } catch {}
    const root = rootRef.current;
    if (!root) return;
    const main=root.closest('main');
    const nodes = [...(main ? [main] : []),root,...Array.from(root.querySelectorAll<HTMLElement>('[data-workspace-scroll]'))];
    nodes.forEach((node,i) => { const pos=positions[node.dataset.workspaceScroll || `root${i}`]; if(pos){node.scrollTop=pos.top;node.scrollLeft=pos.left;} });
    const save = () => {
      const values: Record<string,{top:number;left:number}> = {};
      nodes.forEach((node,i) => { values[node.dataset.workspaceScroll || `root${i}`]={top:node.scrollTop,left:node.scrollLeft}; });
      sessionStorage.setItem(key,JSON.stringify(values));
    };
    (main || root).addEventListener('scroll',save,true);
    return () => { (main || root).removeEventListener('scroll',save,true); };
  }, [searchParams.toString(),leads.length,view,lostExpanded]);
  const openLead = (id:string) => { returnFocus.current=document.activeElement as HTMLElement; setPanelId(id); };
  const closePanel = () => { if(!allowPanelChange())return; panelDirty.current=false;setPanelId(null); returnFocus.current?.focus(); };
  useEffect(() => {
    if (!panelId) return;
    const panel=panelRef.current;
    panel?.focus();
    const onKey=(e:KeyboardEvent)=>{
      const fixed=(e.target as HTMLElement)?.closest('.fixed'); if(fixed && fixed!==panel?.parentElement)return;
      if(e.key==='Escape'){e.preventDefault();closePanel();}
      if(e.key==='Tab' && panel){
        const nodes: HTMLElement[]=Array.from(panel.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex="0"]'));
        const first=nodes[0],last=nodes[nodes.length-1];
        if(e.shiftKey && (document.activeElement===first || document.activeElement===panel)){e.preventDefault();last?.focus();}
        else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first?.focus();}
      }
    };
    document.addEventListener('keydown',onKey);
    return()=>document.removeEventListener('keydown',onKey);
  },[panelId]);
  const clearFilters = () => { changeQuery({agent:'',pay:'',from:'',to:'',status:'',q:'',destination:'',temperature:''}); setCustomDates(false); };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (over && active.id !== over.id) {
      const newStatus = over.id as LeadStatus;
      if (STATUS_COLUMNS.includes(newStatus)) updateLeadStatus(active.id as string, newStatus);
    }
  };

  const filteredLeads = leads.filter(l => {
    if (search && ![l.name,l.leadCode,l.contact.phone,l.contact.email,l.tripDetails.destination].join(' ').toLowerCase().includes(search.toLowerCase())) return false;
    if (stageFilter && l.status !== stageFilter) return false;
    if (destination && l.tripDetails.destination !== destination) return false;
    if (temperature && l.temperature !== temperature) return false;
    if (filters.assignedTo) {
      if (filters.assignedTo === 'Unassigned') {
        if (l.assignedTo) return false;
      } else if (l.assignedTo !== filters.assignedTo) return false;
    }
    // Payment status — only Won leads have one, so this naturally excludes everything else
    if (filters.paymentStatus) {
      if (getPayState(l, paymentSummary[l.id], paymentSummaryLoaded) !== filters.paymentStatus) return false;
    }
    // Date range filter on createdAt (manual picker or quick month/time chip)
    if (createdFrom || createdTo) {
      const t = new Date(l.createdAt).getTime();
      if (createdFrom && t < dateBoundary(createdFrom).getTime()) return false;
      if (createdTo && t > dateBoundary(createdTo,true).getTime()) return false;
    }
    return true;
  });

  const hasActiveFilters = !!(filters.assignedTo || filters.paymentStatus || createdFrom || createdTo || search || stageFilter || destination || temperature);

  const applyTimePreset = (preset:string) => {
    setCustomDates(false);
    if (preset==='All Time') { changeQuery({from:'',to:''}); return; }
    const range=getLeadPeriodRange(preset as 'This Month'|'Last Month');
    changeQuery({from:businessDate(range.start!),to:businessDate(range.end!)});
  };
  const activeTimePreset = !createdFrom && !createdTo ? 'All Time' : (['This Month','Last Month'].find(p => {
    const r=getLeadPeriodRange(p as 'This Month'|'Last Month');
    return createdFrom===businessDate(r.start!) && createdTo===businessDate(r.end!);
  }) || 'Custom');
  useEffect(()=>{if(stageFilter==='Lost')setLostExpanded(true);},[stageFilter]);
  const filterLabelClass=cn('block text-[11px] font-semibold uppercase tracking-[0.07em]',theme==='light'?'text-slate-500':'text-slate-400');
  const filterControlClass=cn('w-full h-10 min-w-0 rounded-xl border px-3 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus:border-indigo-400',theme==='light'?'bg-white border-slate-200 text-slate-700 hover:border-slate-300':'bg-slate-800 border-slate-700 text-slate-200 hover:border-slate-500');
  const advancedFilterCount=[stageFilter,filters.paymentStatus,destination,temperature].filter(Boolean).length;
  const panelLead=leads.find(l=>l.id===panelId);
  const panelIndex=filteredLeads.findIndex(l=>l.id===panelId);
  const destinations=Array.from(new Set(leads.map(l=>l.tripDetails.destination).filter(Boolean))).sort();
  const saveView=()=>{ const name=viewName.trim(); if(!name)return; const next=[...savedViews.filter(v=>v.name!==name),{name,query:searchParams.toString()}]; setSavedViews(next);localStorage.setItem(`${workspaceKey}:views`,JSON.stringify(next));setSavingView(false);setViewName(''); };
  const dateLabel = (createdFrom && createdTo)
    ? `${new Date(createdFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${new Date(createdTo).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : createdFrom ? `From ${new Date(createdFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : createdTo ? `Until ${new Date(createdTo).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : '';
  const activeLead = activeId ? leads.find(l => l.id === activeId) : null;

  const handleOpenModal = () => {
    setNewLeadServices([]);
    setNewLeadPax({ adults: 2, children: 0, childAges: [] });
    setNewLeadPrefs({});
    setIsModalOpen(true);
  };

  const downloadSampleCsv = () => {
    const headers = ['Name', 'Phone', 'Email', 'Destination', 'Budget', 'Travel Date', 'Status', 'Source'];
    const row = ['John Doe', '+919876543210', 'john@example.com', 'Bali', '50000', '2025-10-01', 'New', 'Instagram'];
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), row.join(',')].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', 'voyageos_lead_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processImportedData = (data: any[]) => {
    const validLeads: Lead[] = [];
    let skippedCount = 0;
    const mappings = {
      name: ['name', 'client', 'customer', 'passenger'],
      phone: ['phone', 'mobile', 'contact', 'number'],
      email: ['email', 'mail'],
      destination: ['destination', 'loc', 'place', 'dest'],
      budget: ['budget', 'price', 'cost'],
      startDate: ['date', 'travel date', 'start', 'start date'],
      status: ['status', 'stage'],
      source: ['source', 'channel'],
    };
    const findField = (row: any, keys: string[]) => {
      for (const key of keys) {
        const found = Object.keys(row).find(k => k.toLowerCase().trim() === key);
        if (found && row[found]) return row[found];
      }
      return null;
    };
    data.forEach(row => {
      const name = findField(row, mappings.name);
      const phone = findField(row, mappings.phone);
      if (!name || !phone) { skippedCount++; return; }
      validLeads.push({
        id: generateId(), name, contact: { phone, email: findField(row, mappings.email) || '' },
        tripDetails: { destination: findField(row, mappings.destination) || 'TBD', budget: Number(findField(row, mappings.budget)) || 0, paxConfig: { adults: 2, children: 0, childAges: [] }, startDate: findField(row, mappings.startDate) || new Date().toISOString() },
        status: (findField(row, mappings.status) as LeadStatus) || 'New', temperature: 'Hot',
        source: (findField(row, mappings.source) as LeadSource) || 'Other',
        interestedServices: [], tags: ['Imported'], createdAt: new Date().toISOString(), lastStatusUpdate: new Date().toISOString(),
      });
    });
    if (validLeads.length > 0) {
      addLeads(validLeads);
      setShowToast({ message: `Imported ${validLeads.length} leads.${skippedCount > 0 ? ` Skipped ${skippedCount} rows.` : ''}`, type: 'success' });
      setIsModalOpen(false);
    } else {
      setShowToast({ message: `No valid leads found. Skipped ${skippedCount} rows.`, type: 'error' });
    }
    setTimeout(() => setShowToast(null), 5000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, { header: true, skipEmptyLines: true, complete: r => processImportedData(r.data), error: () => { setShowToast({ message: 'Failed to parse CSV.', type: 'error' }); setTimeout(() => setShowToast(null), 3000); } });
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'text/csv') {
      Papa.parse(file, { header: true, skipEmptyLines: true, complete: r => processImportedData(r.data), error: () => { setShowToast({ message: 'Failed to parse CSV.', type: 'error' }); setTimeout(() => setShowToast(null), 3000); } });
    } else if (file) {
      setShowToast({ message: 'Please upload a valid .csv file', type: 'error' });
      setTimeout(() => setShowToast(null), 3000);
    }
  };

  const handleAddLead = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    addLead({
      id: generateId(),
      name: formData.get('name') as string,
      contact: { phone: (formData.get('phone') as string) || '', email: (formData.get('email') as string) || '' },
      tripDetails: { destination: formData.get('destination') as string, budget: Number(formData.get('budget') || 0), paxConfig: newLeadPax, startDate: formData.get('startDate') as string, nights: formData.get('nights') ? Number(formData.get('nights')) : undefined },
      preferences: newLeadPrefs,
      status: 'New',
      temperature: formData.get('temperature') as LeadTemperature,
      source: formData.get('source') as LeadSource,
      interestedServices: newLeadServices,
      referenceName: formData.get('reference') as string,
      tags: [],
      createdAt: new Date().toISOString(),
      lastStatusUpdate: new Date().toISOString(),
    });
    setIsModalOpen(false);
  };

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }),
  };

  return (
    <LeadWorkspaceOpen.Provider value={openLead}><div ref={rootRef} onClickCapture={e=>{const link=(e.target as HTMLElement).closest('a[href]');if(link && !link.hasAttribute('data-full-page') && !e.ctrlKey && !e.metaKey){const match=link.getAttribute('href')?.match(/#\/leads\/([^?]+)/);if(match){e.preventDefault();e.stopPropagation();openLead(match[1]);}}}} className={cn('md:h-full flex flex-col animate-in fade-in duration-500 relative', view === 'kanban' ? 'gap-3' : 'gap-0')}>

      {/* Toast */}
      {showToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 md:top-6 md:right-6 md:translate-x-0 md:left-auto z-50 animate-in slide-in-from-top-2 fade-in duration-300 w-full max-w-sm px-4">
          <div className={cn('flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl border', theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-800 border-white/10', showToast.type === 'success' ? 'text-green-500' : 'text-red-500')}>
            <CheckCircle2 size={18} className="shrink-0" />
            <span className={cn('font-medium text-sm', theme === 'light' ? 'text-slate-800' : 'text-white')}>{showToast.message}</span>
          </div>
        </div>
      )}

      {/* Header — compact single toolbar row: title | filter chips | buttons */}
      <div className={cn('flex flex-col md:flex-row md:items-center gap-3', view === 'overview' && 'shrink-0')}>
        {/* Title block */}
        <div className="shrink-0 flex items-baseline gap-2.5">
          <h1 className={cn('text-2xl font-bold tracking-tight leading-none', getTextColor())}>Leads</h1>
          <span className={cn('text-[11px] font-semibold tabular-nums', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>
            {filteredLeads.length} in pipeline
          </span>
        </div>

        <div className="flex-1" />
        {/* Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex gap-1.5 items-center"><select aria-label="Saved views" value="" onChange={e=>{if(!e.target.value)return;const v=savedViews[Number(e.target.value)];if(v)setSearchParams(v.query || 'view=kanban',{replace:true});}} className={cn(filterControlClass,'w-[148px] text-xs')}><option value="">Saved views ({savedViews.length})</option>{savedViews.map((v,i)=><option key={v.name} value={i}>{v.name}</option>)}</select><button title="Save current view" aria-label="Save view" onClick={()=>setSavingView(true)} className={cn('h-10 w-10 rounded-xl border flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500',theme==='light'?'border-slate-200 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200':'border-slate-700 text-slate-300 hover:bg-slate-800')}><Bookmark size={17}/></button></div>
          <div className={cn('flex items-center rounded-xl p-1 border', theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10')}>
            <button
              onClick={() => setView('kanban')}
              className={cn(
                'px-4 py-2 rounded-lg text-[12px] font-bold transition-all min-h-[36px]',
                view === 'kanban'
                  ? (theme === 'light' ? 'bg-slate-100 text-indigo-600' : 'bg-white/20 text-white')
                  : (theme === 'light' ? 'text-slate-400 hover:text-slate-600' : 'text-white/40 hover:text-white/70')
              )}
            >
              ⊞ Kanban
            </button>
            <button
              onClick={() => setView('overview')}
              className={cn(
                'px-4 py-2 rounded-lg text-[12px] font-bold transition-all min-h-[36px]',
                view === 'overview'
                  ? (theme === 'light' ? 'bg-slate-100 text-indigo-600' : 'bg-white/20 text-white')
                  : (theme === 'light' ? 'text-slate-400 hover:text-slate-600' : 'text-white/40 hover:text-white/70')
              )}
            >
              ⊟ Overview
            </button>
          </div>
          <button
            disabled={isLoading || !!loadError} onClick={() => setShowExport(true)}
            className={cn(
              'hidden md:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all',
              theme === 'light' ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-400' : 'bg-white/5 border-white/10 text-white/80 hover:border-white/30'
            )}
          >
            <Download size={15} /> Export
          </button>
          <button
            onClick={handleOpenModal}
            className={cn(
              'hidden md:flex items-center gap-2 rounded-full pl-5 pr-2 py-2 text-sm font-semibold',
              'transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97]',
              theme === 'light'
                ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-[0_4px_16px_-4px_rgba(15,23,42,0.4),0_1px_4px_rgba(15,23,42,0.2)] hover:shadow-[0_8px_24px_-4px_rgba(15,23,42,0.5)]'
                : 'bg-white text-slate-900 hover:bg-white/90 shadow-lg'
            )}
          >
            Add Lead
            <span className={cn('w-7 h-7 rounded-full flex items-center justify-center', theme === 'light' ? 'bg-white/15' : 'bg-black/10')}>
              <Plus size={14} />
            </span>
          </button>
        </div>
      </div>

      <section aria-label="Lead filters" className={cn('shrink-0 rounded-2xl border shadow-sm', theme==='light'?'bg-white/95 border-slate-200/80':'bg-slate-900 border-slate-700')}>
        <div className="flex flex-wrap items-end gap-3 p-3 md:p-4">
          <label className="flex-1 min-w-[220px] space-y-1.5">
            <span className={filterLabelClass}>Find a lead</span>
            <span className="relative block"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/><input aria-label="Search leads" placeholder="Name, phone or lead ID…" value={search} onChange={e=>changeQuery({q:e.target.value})} className={cn(filterControlClass,'pl-9 pr-8')}/>{search && <button type="button" aria-label="Clear search" onClick={()=>changeQuery({q:''})} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-indigo-600 focus-visible:ring-2 rounded"><X size={13}/></button>}</span>
          </label>
          {isAdmin && <label className="w-full sm:w-[168px] space-y-1.5"><span className={filterLabelClass}>Lead owner</span><span className="relative block"><Users size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/><select aria-label="Employee" value={filters.assignedTo} onChange={e=>changeQuery({agent:e.target.value})} className={cn(filterControlClass,'pl-9 pr-7 appearance-none')}><option value="">All employees</option><option value="Unassigned">Unassigned</option>{users.map(u=><option key={u.id} value={u.name}>{u.name}</option>)}</select><ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/></span></label>}
          <div className="space-y-1.5 max-w-full"><span className={filterLabelClass}>Created date</span><div className={cn('flex items-center gap-1 p-1 rounded-xl h-10 border',theme==='light'?'bg-slate-100/80 border-slate-200/60':'bg-slate-800 border-slate-700')} role="group" aria-label="Lead creation period">
            {['This Month','Last Month','Custom','All Time'].map(label=>{const selected=label==='Custom'?customDates || activeTimePreset==='Custom':!customDates && activeTimePreset===label;return <button key={label} aria-pressed={selected} onClick={()=>label==='Custom'?setCustomDates(true):applyTimePreset(label)} className={cn('px-2.5 md:px-3 h-8 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',selected?(theme==='light'?'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/60':'bg-indigo-600 text-white shadow-sm'):(theme==='light'?'text-slate-500 hover:text-slate-800 hover:bg-white/50':'text-slate-400 hover:text-white'))}>{label}</button>})}
          </div></div>
          <div className="space-y-1.5"><span className={filterLabelClass}>Refine</span><Button variant="secondary" onClick={()=>setMoreFilters(v=>!v)} aria-expanded={moreFilters} aria-controls="advanced-lead-filters" className={cn('h-10 rounded-xl px-3 text-xs focus-visible:ring-2 focus-visible:ring-indigo-500',moreFilters?(theme==='light'?'bg-indigo-50 border-indigo-200 text-indigo-700':'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'):(theme==='light'?'border-slate-200 text-slate-600 shadow-none':'border-slate-700 text-slate-200 shadow-none'))}><Filter size={15}/> More filters {advancedFilterCount>0 && <span className="rounded-full bg-indigo-600 text-white px-1.5 py-0.5 text-[10px]">{advancedFilterCount}</span>}<ChevronDown size={13} className={moreFilters?'rotate-180':''}/></Button></div>

        </div>
        {(customDates || activeTimePreset==='Custom') && <div className={cn('mx-3 md:mx-4 mb-3 rounded-xl px-3 py-2.5 flex flex-wrap items-center gap-3 text-xs',theme==='light'?'bg-indigo-50/60 text-slate-600':'bg-slate-800 text-slate-300')}><Calendar size={16} className="text-indigo-500"/><span className="font-semibold">Custom creation dates</span><label className="flex items-center gap-2">From<input aria-label="Lead start date" type="date" value={createdFrom} onChange={e=>changeQuery({from:e.target.value,to:createdTo && e.target.value>createdTo?e.target.value:createdTo})} className={cn(filterControlClass,'h-8 w-auto px-2 text-xs')}/></label><label className="flex items-center gap-2">To<input aria-label="Lead end date" type="date" value={createdTo} onChange={e=>changeQuery({to:e.target.value,from:createdFrom && e.target.value<createdFrom?e.target.value:createdFrom})} className={cn(filterControlClass,'h-8 w-auto px-2 text-xs')}/></label></div>}
        {moreFilters && <div id="advanced-lead-filters" className={cn('px-3 md:px-4 py-3 border-t',theme==='light'?'bg-slate-50/60 border-slate-100':'bg-slate-800/40 border-slate-700')}>
          <div className="flex items-center justify-between mb-2.5"><span className={cn('text-xs font-semibold',getTextColor())}>Refine your results</span>{advancedFilterCount>0 && <button onClick={()=>changeQuery({status:'',pay:'',destination:'',temperature:''})} className="text-xs text-indigo-600 font-semibold focus-visible:ring-2 rounded">Reset advanced</button>}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.4fr_1fr] gap-3">
            <label className="space-y-1.5"><span className={filterLabelClass}>Pipeline stage</span><select aria-label="Stage" value={stageFilter} onChange={e=>setStageFilter(e.target.value)} className={filterControlClass}><option value="">All stages</option>{STATUS_COLUMNS.map(v=><option key={v}>{v}</option>)}</select></label>
            <label className="space-y-1.5"><span className={filterLabelClass}>Payment status</span><select aria-label="Payment status" value={filters.paymentStatus} onChange={e=>changeQuery({pay:e.target.value})} className={filterControlClass}><option value="">Any payment status</option><option value="unpaid">Won · No payment</option><option value="partial">Won · Part paid</option><option value="paid">Won · Paid</option></select></label>
            <label className="space-y-1.5"><span className={filterLabelClass}>Destination</span><select aria-label="Destination" value={destination} onChange={e=>changeQuery({destination:e.target.value})} className={filterControlClass}><option value="">All destinations</option>{destinations.map(v=><option key={v}>{v}</option>)}</select></label>
            <label className="space-y-1.5"><span className={filterLabelClass}>Lead temperature</span><select aria-label="Temperature" value={temperature} onChange={e=>changeQuery({temperature:e.target.value})} className={filterControlClass}><option value="">Any temperature</option>{['Hot','Warm','Cold'].map(v=><option key={v}>{v}</option>)}</select></label>
          </div>
        </div>}
        {hasActiveFilters && <div className={cn('flex flex-wrap items-center gap-2 px-3 md:px-4 py-2.5 border-t text-xs',theme==='light'?'border-slate-100':'border-slate-700')} aria-label="Active filters">
          <span className={cn('font-semibold mr-1',getSecondaryTextColor())}>{filteredLeads.length} results</span>
          {[[search,'Search: '+search,'q'],[filters.assignedTo,filters.assignedTo,'agent'],[dateLabel,dateLabel,'dates'],[stageFilter,stageFilter,'status'],[filters.paymentStatus,'Payment: '+filters.paymentStatus,'pay'],[destination,destination,'destination'],[temperature,temperature,'temperature']].filter(v=>v[0]).map(([value,label,key])=><button key={key} aria-label={`Remove ${label} filter`} onClick={()=>{if(key==='dates'){setCustomDates(false);changeQuery({from:'',to:''});}else changeQuery({[key]:''});}} className={cn('flex items-center gap-1.5 rounded-lg px-2 py-1 border max-w-full focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors',theme==='light'?'bg-indigo-50/60 border-indigo-100 text-indigo-700 hover:bg-indigo-100':'bg-indigo-500/10 border-indigo-500/20 text-indigo-300')}><span className="truncate max-w-[220px]">{label}</span><X size={12} className="shrink-0"/></button>)}
          <button onClick={clearFilters} className="ml-auto text-slate-500 hover:text-rose-600 font-semibold px-2 py-1 focus-visible:ring-2 rounded">Clear filters</button>
        </div>}
      </section>
      {/* Content */}
      {(isLoading || loadError) && <div role="status" className="shrink-0 flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-xs mb-2">{loadError || (leads.length ? `Loaded ${leads.length} leads. Loading older leads; counts and filters will update…` : 'Loading your leads…')}{loadError && <button className="font-bold underline" onClick={retryLoad}>Retry</button>}</div>}
      {isLoading && filteredLeads.length === 0 ? <div role="status">Loading leads…</div> : loadError && leads.length === 0 ? <div>Unable to load leads. Use Retry above.</div> : filteredLeads.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] animate-in fade-in zoom-in-95 duration-500">
          <div className={cn('w-24 h-24 rounded-full flex items-center justify-center mb-6', theme === 'light' ? 'bg-blue-50 text-blue-400' : 'bg-white/5 text-white/30')}>
            {hasActiveFilters ? <SearchX size={48} /> : <Users size={48} />}
          </div>
          <h2 className={cn('text-2xl font-bold tracking-tight mb-2', getTextColor())}>{hasActiveFilters ? 'No matches found' : 'No leads yet'}</h2>
          <p className={cn('max-w-xs mx-auto mb-8 text-center', getSecondaryTextColor())}>
            {hasActiveFilters ? "We couldn't find any leads matching your filters." : 'Your pipeline is looking empty. Add your first potential client.'}
          </p>
          {hasActiveFilters
            ? <Button onClick={clearFilters} variant="secondary">Clear Filters</Button>
            : <Button onClick={handleOpenModal} className="hidden md:flex shadow-xl shadow-blue-500/20"><Plus size={18} /> Create First Lead</Button>
          }
        </div>
      ) : view === 'overview' ? (
        <OverviewGrid
          allLeads={leads}
          leads={filteredLeads}
          updateLeadStatus={updateLeadStatus}
          updateLead={updateLead}
          users={users}
          stageFilter={stageFilter}
          onStageFilterChange={setStageFilter}
          dateLabel={dateLabel}
          onClearDateFilter={() => { setCreatedFrom(''); setCreatedTo(''); }}
        />
      ) : (
        <>
          {/* Desktop Kanban */}
          {isDesktop && <div className="flex flex-col flex-1 overflow-hidden min-h-0">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div data-workspace-scroll="board" className="flex gap-3 overflow-x-auto flex-1 items-stretch min-h-0 snap-x pb-1">
                {ACTIVE_COLUMNS.map(status => (
                  <DroppableColumn key={status} status={status} totalCount={filteredLeads.filter(l => l.status === status).length}>
                    <IncrementalList items={filteredLeads.filter(l => l.status === status)} resetKey={searchParams.toString()} renderItem={lead => (
                      <DraggableCard key={lead.id} lead={lead} payment={paymentSummary[lead.id]} paymentLoaded={paymentSummaryLoaded} />
                    )} />
                  </DroppableColumn>
                ))}
                {/* Lost — collapsible rail with compact cards */}
                <DroppableColumn
                  status="Lost"
                  totalCount={filteredLeads.filter(l => l.status === 'Lost').length}
                  collapsed={!lostExpanded}
                  onToggle={() => {setLostExpanded(v => !v);changeQuery({lost:lostExpanded?'':'1'});}}
                >
                  {lostExpanded && <IncrementalList items={filteredLeads.filter(l => l.status === 'Lost')} resetKey={searchParams.toString()} renderItem={lead => (
                    <DraggableCard key={lead.id} lead={lead} compact />
                  )} />}
                </DroppableColumn>
              </div>
              <DragOverlay dropAnimation={dropAnimation}>
                {activeLead ? <LeadCard lead={activeLead} isOverlay payment={paymentSummary[activeLead.id]} paymentLoaded={paymentSummaryLoaded} /> : null}
              </DragOverlay>
            </DndContext>
          </div>}

          {/* Mobile Kanban */}
          {!isDesktop && <div className="flex flex-col h-[65dvh] min-h-0">
            <div className="flex gap-2 overflow-x-auto pb-4 px-1 no-scrollbar">
              {STATUS_COLUMNS.map(status => (
                <button
                  key={status}
                  onClick={() => {setActiveMobileStatus(status as LeadStatus);changeQuery({mobile:status});}}
                  className={cn('whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold border transition-all min-h-[44px]',
                    activeMobileStatus === status
                      ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30'
                      : (theme === 'light' ? 'bg-white text-slate-500 border-slate-200' : 'bg-white/5 text-white/60 border-white/10')
                  )}
                >
                  {status}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pb-20 custom-scrollbar">
              <IncrementalList items={filteredLeads.filter(l => l.status === activeMobileStatus)} resetKey={`${searchParams.toString()}:${activeMobileStatus}`} renderItem={lead => (
                <MobileLeadCard key={lead.id} lead={lead} onStatusChange={updateLeadStatus} />
              )} />
              {filteredLeads.filter(l => l.status === activeMobileStatus).length === 0 && (
                <div className="text-center opacity-50 py-10 flex flex-col items-center gap-2">
                  <div className={cn('w-12 h-12 rounded-full flex items-center justify-center', theme === 'light' ? 'bg-slate-100' : 'bg-white/5')}>
                    <Users size={24} />
                  </div>
                  <p className="text-sm">No leads in {activeMobileStatus}</p>
                </div>
              )}
            </div>
          </div>}
        </>
      )}

      {/* Mobile FAB */}
      <button
        onClick={handleOpenModal}
        className="md:hidden fixed bottom-24 right-6 h-14 w-14 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center z-50 hover:scale-105 active:scale-95 transition-all"
        aria-label="Add Lead"
      >
        <Plus size={28} />
      </button>

      {/* Add Lead Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Lead">
        <form onSubmit={handleAddLead} className="space-y-5">
          <div className="space-y-2">
            <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Service Requirements</label>
            <ServiceSelector selectedServices={newLeadServices} onChange={setNewLeadServices} />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Client Name</label>
              <input name="name" required className={cn('w-full rounded-lg p-3 outline-none transition-all border', getInputClass())} placeholder="John Doe" />
            </div>
            <div className="space-y-1.5">
              <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Source</label>
              <select name="source" className={cn('w-full rounded-lg p-3 outline-none transition-all border', getInputClass(), '[&>option]:text-black')}>
                <option value="Instagram">Instagram</option>
                <option value="Walk-in">Walk-in</option>
                <option value="Referral">Referral</option>
                <option value="Website">Website</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Phone</label>
              <input name="phone" defaultValue="+91 " className={cn('w-full rounded-lg p-3 outline-none transition-all border', getInputClass())} placeholder="+91 ..." />
            </div>
            <div className="space-y-1.5">
              <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Email <span className="text-[10px] opacity-50 font-normal normal-case ml-1">(Optional)</span></label>
              <input name="email" type="email" className={cn('w-full rounded-lg p-3 outline-none transition-all border', getInputClass())} placeholder="email@example.com" />
            </div>
          </div>
          <div className={cn('p-4 rounded-xl border border-dashed space-y-3', getBorderClass(), theme === 'light' ? 'bg-slate-50' : 'bg-white/5')}>
            <p className={cn('text-xs font-bold uppercase tracking-wide opacity-50', getTextColor())}>Trip Details</p>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className={cn('text-[10px] font-bold uppercase opacity-60', getTextColor())}>Destination</label>
                <input name="destination" required placeholder="Where to?" className={cn('w-full bg-transparent border-b p-2 outline-none text-base transition-colors', getBorderClass(), 'focus:border-blue-500', getTextColor())} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={cn('text-[10px] font-bold uppercase opacity-60', getTextColor())}>Start Date</label>
                  <input name="startDate" type="date" required className={cn('w-full bg-transparent border-b p-2 outline-none text-base transition-colors', getBorderClass(), 'focus:border-blue-500', getTextColor())} />
                </div>
                <div className="space-y-1">
                  <label className={cn('text-[10px] font-bold uppercase opacity-60', getTextColor())}>Nights</label>
                  <input name="nights" type="number" min={1} placeholder="e.g. 3" className={cn('w-full bg-transparent border-b p-2 outline-none text-base font-mono transition-colors', getBorderClass(), 'focus:border-blue-500', getTextColor())} />
                </div>
              </div>
              <PaxSelector value={newLeadPax} onChange={setNewLeadPax} />
              <div className="pt-2">
                <TravelPreferences value={newLeadPrefs} onChange={setNewLeadPrefs} />
              </div>
              <div className="space-y-1">
                <label className={cn('text-[10px] font-bold uppercase opacity-60', getTextColor())}>Total Budget</label>
                <input name="budget" type="number" placeholder="Budget (₹) - Optional" className={cn('w-full bg-transparent border-b p-2 outline-none text-lg font-mono transition-colors', getBorderClass(), 'focus:border-blue-500', getTextColor())} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Temperature</label>
              <select name="temperature" className={cn('w-full rounded-lg p-3 outline-none transition-all border', getInputClass(), '[&>option]:text-black')}>
                <option value="Hot">Hot (Ready to buy)</option>
                <option value="Warm">Warm (Interested)</option>
                <option value="Cold">Cold (Future)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={cn('text-xs font-bold uppercase tracking-wider opacity-60', getTextColor())}>Reference Name</label>
              <input name="reference" className={cn('w-full rounded-lg p-3 outline-none transition-all border', getInputClass())} placeholder="Optional" />
            </div>
          </div>
          <div className="pt-4 flex justify-between items-center border-t border-gray-500/10">
            <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
            <div className="flex flex-col gap-1">
              <div
                className={cn('text-xs font-medium flex items-center gap-2 cursor-pointer transition-colors px-3 py-2 rounded-lg border border-dashed hover:bg-blue-500/10', getTextColor(), getBorderClass())}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
              >
                <UploadCloud size={16} className="text-blue-500" /> Import CSV
              </div>
              <button type="button" onClick={downloadSampleCsv} className={cn('text-[10px] opacity-50 hover:opacity-100 flex items-center gap-1 ml-1', getSecondaryTextColor())}>
                <Download size={10} /> Download Sample
              </button>
            </div>
            <Button type="submit">Create Lead</Button>
          </div>
        </form>
      </Modal>

      {showExport && !isLoading && !loadError && (
        <ExportPanel
          leads={filteredLeads}
          paymentSummary={paymentSummary}
          onClose={() => setShowExport(false)}
        />
      )}
      {savingView && <Modal isOpen={savingView} onClose={()=>setSavingView(false)} title="Save this lead view"><form onSubmit={e=>{e.preventDefault();saveView();}} className="space-y-3"><input autoFocus aria-label="View name" placeholder="e.g. Sonali this month" value={viewName} onChange={e=>setViewName(e.target.value)} maxLength={60} className={cn('w-full border rounded-lg px-3 py-2',getInputClass())}/><Button type="submit" disabled={!viewName.trim()}>Save view</Button></form>{savedViews.map(v=><div key={v.name} className="flex justify-between items-center py-2 text-sm"><span>{v.name}</span><button aria-label={`Delete saved view ${v.name}`} onClick={()=>{const next=savedViews.filter(x=>x.name!==v.name);setSavedViews(next);localStorage.setItem(`${workspaceKey}:views`,JSON.stringify(next));}}><X size={14}/></button></div>)}</Modal>}
      {panelLead && createPortal(<div className="fixed inset-0 z-[100] flex justify-end">
        <div className="absolute inset-0 bg-slate-900/20" aria-label="Close lead panel backdrop" onClick={closePanel} role="button" tabIndex={-1}/>
        <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`Lead details: ${panelLead.name}`} tabIndex={-1} className={cn('relative w-full sm:w-[min(1180px,calc(100vw-64px))] max-w-full h-full flex flex-col shadow-2xl focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none',theme==='light'?'bg-white text-slate-900':'bg-slate-900 text-white')}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 shrink-0"><button aria-label="Previous lead" disabled={panelIndex<=0} onClick={()=>movePanel(filteredLeads[panelIndex-1].id)} className="p-2 disabled:opacity-30 focus-visible:ring-2"><ChevronLeft size={18}/></button><span className="text-xs flex-1">{panelIndex>=0?`${panelIndex+1} of ${filteredLeads.length} matching leads`:'Lead no longer matches this view'}</span><button aria-label="Next lead" disabled={panelIndex<0 || panelIndex>=filteredLeads.length-1} onClick={()=>movePanel(filteredLeads[panelIndex+1].id)} className="p-2 disabled:opacity-30 focus-visible:ring-2"><ChevronRight size={18}/></button><button aria-label="Close lead details" onClick={closePanel} className="p-2 focus-visible:ring-2"><X size={18}/></button></div>
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 md:p-6" key={panelLead.id}><React.Suspense fallback={<div role="status" className="p-8 text-center text-sm">Loading complete lead details…</div>}><EmbeddedLeadDetails key={panelLead.id} leadId={panelLead.id} embedded onClose={closePanel} onDirtyChange={reportDirty}/></React.Suspense></div>
          <div className="shrink-0 border-t border-slate-200 px-4 py-3 flex justify-end"><Link to={`/leads/${panelLead.id}`} onClick={e=>{if(!allowPanelChange())e.preventDefault();}} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold focus-visible:ring-2">Open Full View →</Link></div>
        </div>
      </div>,document.body)}
    </div></LeadWorkspaceOpen.Provider>
  );
};
