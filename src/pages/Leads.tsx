
import React, { useState, useRef, useMemo } from 'react';
import { useLeads } from '../contexts/LeadContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { ServiceSelector } from '../components/ServiceSelector';
import { PaxSelector } from '../components/PaxSelector';
import { TravelPreferences } from '../components/TravelPreferences';
import { Lead, LeadStatus, LeadTemperature, LeadSource, PaxConfig, TravelPreferences as TravelPreferencesType } from '../types';
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
  MapPin,
  SearchX,
  Users,
  Calendar,
  Phone,
  MessageCircle,
  ChevronDown,
  Palmtree,
  Plane,
  BedDouble,
  FileCheck,
  AlertOctagon,
  Download,
  CheckCircle2,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';

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
  headerBg: string; dot: string; title: string; badge: string; isOver: string;
}> = {
  'New':          { headerBg: 'bg-blue-50',    dot: 'bg-blue-500',    title: 'text-blue-700',    badge: 'bg-blue-100 text-blue-700',    isOver: 'ring-2 ring-blue-300 bg-blue-50'    },
  'Contacted':    { headerBg: 'bg-amber-50',   dot: 'bg-amber-500',   title: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700',   isOver: 'ring-2 ring-amber-300 bg-amber-50'   },
  'Proposal Sent':{ headerBg: 'bg-purple-50',  dot: 'bg-purple-500',  title: 'text-purple-700',  badge: 'bg-purple-100 text-purple-700',  isOver: 'ring-2 ring-purple-300 bg-purple-50'  },
  'Discussion':   { headerBg: 'bg-indigo-50',  dot: 'bg-indigo-500',  title: 'text-indigo-700',  badge: 'bg-indigo-100 text-indigo-700',  isOver: 'ring-2 ring-indigo-300 bg-indigo-50'  },
  'Won':          { headerBg: 'bg-emerald-50', dot: 'bg-emerald-500', title: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', isOver: 'ring-2 ring-emerald-300 bg-emerald-50' },
  'Lost':         { headerBg: 'bg-rose-50',    dot: 'bg-rose-500',    title: 'text-rose-700',    badge: 'bg-rose-100 text-rose-700',    isOver: 'ring-2 ring-rose-300 bg-rose-50'    },
};

// ─── Kanban: Lead Card ────────────────────────────────────────────────────────

const LeadCard: React.FC<{ lead: Lead; isOverlay?: boolean; isDragging?: boolean }> = ({ lead, isOverlay, isDragging }) => {
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

  const tempBadge = {
    light: { Hot: 'bg-rose-100 text-rose-700', Warm: 'bg-amber-100 text-amber-700', Cold: 'bg-sky-100 text-sky-700' },
    dark:  { Hot: 'bg-rose-500/20 text-rose-300', Warm: 'bg-amber-500/20 text-amber-300', Cold: 'bg-sky-500/20 text-sky-300' },
  };

  return (
    <div
      className={cn(
        'relative p-3 rounded-xl border border-l-4 transition-all duration-200 select-none group',
        bgTint,
        theme === 'light' ? 'border-slate-150' : 'border-white/10',
        leftBorder,
        isOverlay
          ? 'shadow-2xl scale-105 rotate-2 cursor-grabbing ring-1 ring-blue-500/50'
          : cn(
              'shadow-sm cursor-grab',
              theme === 'light'
                ? 'hover:border-indigo-200 hover:border-l-indigo-500 hover:shadow-md hover:-translate-y-0.5'
                : 'hover:bg-white/10 hover:border-white/20 hover:shadow-md hover:-translate-y-0.5'
            ),
        isDragging && 'opacity-30 grayscale'
      )}
      title={urgencyTooltip}
    >
      {/* Row 1: Name + urgency + time */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={cn('font-bold text-[13px] truncate', theme === 'light' ? 'text-slate-900' : 'text-white')}>
            {lead.name}
          </span>
          {ServiceIcon && <ServiceIcon size={11} className="shrink-0 opacity-40 text-slate-400" />}
          {hasUrgency && (
            <AlertOctagon size={11} className={cn('shrink-0', isRed ? 'text-red-500' : 'text-orange-500')} />
          )}
        </div>
        <span className={cn('text-[10px] whitespace-nowrap shrink-0 opacity-40', theme === 'light' ? 'text-slate-500' : 'text-white/60')}>
          {timeAgo(lead.createdAt)}
        </span>
      </div>

      {/* Row 2: Destination + pax */}
      <div className={cn('text-[11px] mb-2.5 truncate', theme === 'light' ? 'text-slate-500' : 'text-white/50')}>
        {destPax || <span className="italic opacity-50">No details</span>}
      </div>

      {/* Row 3: Agent + source + temp */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          {lead.assignedTo && (
            <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap', theme === 'light' ? 'bg-violet-50 text-violet-600' : 'bg-violet-500/20 text-violet-300')}>
              {lead.assignedTo}
            </span>
          )}
          {lead.source && (
            <span className={cn('text-[9px] font-bold uppercase px-1.5 py-0.5 rounded whitespace-nowrap', theme === 'light' ? 'bg-slate-100 text-slate-400' : 'bg-white/10 text-white/40')}>
              {lead.source}
            </span>
          )}
        </div>
        <span className={cn(
          'text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0',
          theme === 'light' ? tempBadge.light[lead.temperature] : tempBadge.dark[lead.temperature]
        )}>
          {lead.temperature}
        </span>
      </div>

      {/* Row 4: Hover actions */}
      <div className={cn(
        'overflow-hidden transition-all duration-200 max-h-0 opacity-0 mt-0',
        'group-hover:max-h-12 group-hover:opacity-100 group-hover:mt-2.5 group-hover:pt-2.5',
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
          {budget && (
            <span className={cn(
              'flex items-center justify-center px-2 py-1.5 rounded-lg text-[10px] font-bold border font-mono',
              theme === 'light' ? 'bg-slate-50 text-slate-600 border-slate-200' : 'bg-white/5 text-white/60 border-white/10'
            )}>
              ₹{budget}
            </span>
          )}
        </div>
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

const DraggableCard: React.FC<{ lead: Lead }> = ({ lead }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className="touch-none outline-none">
      {isDragging
        ? <LeadCard lead={lead} isDragging />
        : <Link to={`/leads/${lead.id}`} className="block"><LeadCard lead={lead} /></Link>
      }
    </div>
  );
};

const DroppableColumn: React.FC<{ status: string; children: React.ReactNode }> = ({ status, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const { theme } = useTheme();
  const cs = COLUMN_STYLES[status] || COLUMN_STYLES['New'];
  const count = React.Children.count(children);

  return (
    <div ref={setNodeRef} className={cn(
      'flex-1 min-w-[260px] rounded-2xl flex flex-col h-[calc(100vh-280px)] transition-all duration-200 border',
      theme === 'light'
        ? cn('border-slate-200', isOver ? cs.isOver : 'bg-slate-50/80')
        : cn('border-white/10', isOver ? 'bg-white/10 ring-2 ring-white/20' : 'bg-black/20')
    )}>
      <div className={cn(
        'px-3 py-2.5 rounded-t-2xl flex items-center justify-between border-b',
        theme === 'light'
          ? cn(isOver ? cs.isOver : cs.headerBg, 'border-slate-200/60')
          : cn(isOver ? 'bg-white/15 border-white/15' : 'bg-white/5 border-white/10')
      )}>
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full shrink-0', theme === 'light' ? cs.dot : 'bg-white/50')} />
          <h3 className={cn('font-black text-[11px] uppercase tracking-wider', theme === 'light' ? cs.title : 'text-white/70')}>
            {status}
          </h3>
        </div>
        <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-full', theme === 'light' ? (isOver ? 'bg-blue-500 text-white' : cs.badge) : 'bg-white/20 text-white/70')}>
          {count}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2.5 pb-20 space-y-2">
        {children}
      </div>
    </div>
  );
};

// ─── Pipeline Stats Bar (Kanban) ──────────────────────────────────────────────

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
      <span className={cn('text-[11px] font-bold uppercase tracking-wider', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>
        Pipeline
      </span>
      {STATUS_COLUMNS.map(status => {
        const count = leads.filter(l => l.status === status).length;
        return (
          <div key={status} className={cn(
            'flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border',
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
  const waLink = `https://wa.me/${lead.contact.phone.replace(/[^0-9]/g, '')}`;

  return (
    <div
      onClick={onSelect}
      title={urgencyTooltip}
      className={cn(
        'rounded-2xl border overflow-hidden cursor-pointer transition-all duration-200',
        theme === 'light'
          ? isSelected
            ? 'bg-white border-indigo-300 shadow-[0_0_0_3px_rgba(99,102,241,0.1),0_8px_24px_rgba(99,102,241,0.1)] -translate-y-0.5'
            : 'bg-white border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-indigo-100'
          : isSelected
            ? 'bg-white/10 border-indigo-400/50 shadow-lg -translate-y-0.5'
            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:shadow-lg hover:-translate-y-0.5',
        isRed && 'border-l-[3px] border-l-red-400'
      )}
    >
      {/* Color band */}
      <div className="h-1.5 w-full" style={{ background: bandStyle }} />

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
            <div className={cn('text-[14px] font-extrabold truncate leading-tight', theme === 'light' ? 'text-slate-900' : 'text-white')}>
              {lead.name}
            </div>
            <div className={cn('text-[10px] mt-0.5', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>
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
          {lead.source && (
            <span className={cn('text-[9px] font-bold uppercase px-2 py-1 rounded-md border', theme === 'light' ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-white/10 text-white/40 border-white/10')}>
              {lead.source}
            </span>
          )}
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
        <Link to={`/leads/${lead.id}`} onClick={e => e.stopPropagation()} className={cn('flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold border transition-colors', theme === 'light' ? 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20')}>
          Open →
        </Link>
      </div>
    </div>
  );
};

// ─── Overview: Detail Panel ───────────────────────────────────────────────────

const OverviewDetailPanel: React.FC<{
  lead: Lead;
  updateLeadStatus: (id: string, status: LeadStatus) => void;
  onClose: () => void;
}> = ({ lead, updateLeadStatus, onClose }) => {
  const { theme } = useTheme();
  const initials = getInitials(lead.name);
  const avatarGradient = getAvatarGradient(lead.name);
  const waLink = `https://wa.me/${lead.contact.phone.replace(/[^0-9]/g, '')}`;
  const { adults, children } = lead.tripDetails.paxConfig;
  const paxStr = [adults > 0 ? `${adults} Adults` : '', children > 0 ? `${children} Children` : ''].filter(Boolean).join(' · ') || '—';

  const detailRows = [
    { k: 'Destination', v: lead.tripDetails.destination || '—' },
    { k: 'Budget', v: lead.tripDetails.budget ? formatCurrency(lead.tripDetails.budget) : '—', money: true },
    { k: 'Travel Date', v: lead.tripDetails.startDate ? formatDate(lead.tripDetails.startDate) : '—' },
    { k: 'Pax', v: paxStr },
    { k: 'Source', v: lead.source },
    { k: 'Temperature', v: lead.temperature },
  ];

  return (
    <div className={cn(
      'w-[278px] min-w-[278px] flex flex-col border-l overflow-hidden',
      theme === 'light' ? 'bg-white border-slate-100' : 'bg-white/5 border-white/10'
    )}>
      {/* Header */}
      <div className={cn('flex items-center justify-between px-4 py-3 border-b shrink-0', theme === 'light' ? 'border-slate-100' : 'border-white/10')}>
        <span className={cn('text-[10px] font-black uppercase tracking-wider', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>Lead Details</span>
        <button onClick={onClose} className={cn('w-6 h-6 rounded-md flex items-center justify-center transition-colors', theme === 'light' ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-white/10 text-white/60 hover:bg-white/20')}>
          <X size={12} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
        {/* Avatar + name */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-black text-white shrink-0" style={{ background: avatarGradient }}>
            {initials}
          </div>
          <div>
            <div className={cn('text-[15px] font-extrabold', theme === 'light' ? 'text-slate-900' : 'text-white')}>{lead.name}</div>
            <div className={cn('text-[11px] mt-0.5', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>{lead.contact.phone}</div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-1.5">
          <a href={`tel:${lead.contact.phone}`} className={cn('flex items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-bold border transition-colors', theme === 'light' ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-green-500/10 text-green-400 border-green-500/20')}>📞 Call</a>
          <a href={waLink} target="_blank" rel="noreferrer" className={cn('flex items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-bold border transition-colors', theme === 'light' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20')}>💬 WA</a>
          {lead.contact.email
            ? <a href={`mailto:${lead.contact.email}`} className={cn('flex items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-bold border transition-colors', theme === 'light' ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' : 'bg-blue-500/10 text-blue-400 border-blue-500/20')}>✉ Mail</a>
            : <Link to={`/leads/${lead.id}`} className={cn('flex items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-bold border transition-colors', theme === 'light' ? 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20')}>Open</Link>
          }
        </div>

        {/* Stage dropdown */}
        <div>
          <div className={cn('text-[9px] font-black uppercase tracking-wider mb-1.5', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>Stage</div>
          <select
            value={lead.status}
            onChange={e => updateLeadStatus(lead.id, e.target.value as LeadStatus)}
            className={cn(
              'w-full px-3 py-2.5 rounded-xl border text-sm font-bold cursor-pointer transition-colors focus:outline-none',
              theme === 'light' ? 'bg-amber-50 text-amber-700 border-amber-200 focus:border-amber-300' : 'bg-white/10 text-white/80 border-white/20',
              '[&>option]:text-black [&>option]:bg-white'
            )}
          >
            {STATUS_COLUMNS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Trip details */}
        <div>
          <div className={cn('text-[9px] font-black uppercase tracking-wider mb-2', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>Trip Details</div>
          <div className="space-y-1.5">
            {detailRows.map(row => (
              <div key={row.k} className={cn('flex items-center justify-between px-3 py-2 rounded-lg', theme === 'light' ? 'bg-slate-50' : 'bg-white/5')}>
                <span className={cn('text-[10px] font-semibold', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>{row.k}</span>
                <span className={cn('text-[11px] font-bold', theme === 'light' ? (row.money ? 'text-emerald-600 font-mono' : 'text-slate-800') : 'text-white/80')}>
                  {row.v}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity */}
        <div>
          <div className={cn('text-[9px] font-black uppercase tracking-wider mb-2', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>Activity</div>
          <div className="space-y-2.5">
            {lead.lastStatusUpdate && lead.lastStatusUpdate !== lead.createdAt && (
              <div className="flex gap-2.5">
                <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1 shrink-0" />
                <div>
                  <div className={cn('text-[11px] font-medium', theme === 'light' ? 'text-slate-700' : 'text-white/70')}>Moved to {lead.status}</div>
                  <div className={cn('text-[9px] mt-0.5', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>
                    {formatDate(lead.lastStatusUpdate)}{lead.assignedTo ? ` · ${lead.assignedTo}` : ''}
                  </div>
                </div>
              </div>
            )}
            <div className="flex gap-2.5">
              <div className={cn('w-2 h-2 rounded-full mt-1 shrink-0', theme === 'light' ? 'bg-slate-300' : 'bg-white/30')} />
              <div>
                <div className={cn('text-[11px] font-medium', theme === 'light' ? 'text-slate-700' : 'text-white/70')}>
                  Lead created{lead.source ? ` via ${lead.source}` : ''}
                </div>
                <div className={cn('text-[9px] mt-0.5', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>{formatDate(lead.createdAt)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={cn('px-4 py-3 border-t shrink-0', theme === 'light' ? 'border-slate-100' : 'border-white/10')}>
        <Link to={`/leads/${lead.id}`} className={cn('w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-bold transition-colors', theme === 'light' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-indigo-500 text-white hover:bg-indigo-600')}>
          Open Full View →
        </Link>
      </div>
    </div>
  );
};

// ─── Overview Grid ─────────────────────────────────────────────────────────────

const OverviewGrid: React.FC<{
  allLeads: Lead[];
  leads: Lead[];
  updateLeadStatus: (id: string, status: LeadStatus) => void;
}> = ({ allLeads, leads, updateLeadStatus }) => {
  const { theme } = useTheme();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState('');
  const [groupBy, setGroupBy] = useState<'none' | 'agent' | 'temperature'>('none');
  const [sortBy, setSortBy] = useState<'newest' | 'budget' | 'name'>('newest');

  const selectedLead = selectedLeadId
    ? (leads.find(l => l.id === selectedLeadId) ?? allLeads.find(l => l.id === selectedLeadId) ?? null)
    : null;

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
    <div className={cn('flex-1 flex flex-col overflow-hidden min-h-0', containerBg)}>

      {/* Stats Strip */}
      <div className={cn('flex items-stretch border-b shrink-0', theme === 'light' ? 'bg-white border-slate-100' : 'bg-white/5 border-white/10')}>
        {([
          { icon: '👥', num: stats.active,        label: 'Active leads',    color: theme === 'light' ? 'text-slate-900' : 'text-white', iconBg: 'bg-indigo-50' },
          { icon: '₹',  num: stats.pipelineValue > 0 ? `₹${formatCompactCurrency(stats.pipelineValue)}` : '₹0', label: 'Pipeline value', color: 'text-emerald-600', iconBg: 'bg-emerald-50' },
          { icon: '🔥', num: stats.needAction,    label: 'Need action',     color: 'text-rose-600',    iconBg: 'bg-rose-50'    },
          { icon: '🏆', num: stats.wonThisMonth,  label: 'Won this month',  color: 'text-amber-600',   iconBg: 'bg-amber-50'   },
        ] as { icon: string; num: string | number; label: string; color: string; iconBg: string }[]).map((s, i) => (
          <div key={i} className={cn('flex-1 flex items-center gap-3 px-5 py-3', i > 0 && (theme === 'light' ? 'border-l border-slate-100' : 'border-l border-white/10'))}>
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0', s.iconBg)}>{s.icon}</div>
            <div>
              <div className={cn('text-xl font-black leading-none tracking-tight', s.color)}>{s.num}</div>
              <div className="text-[10px] text-slate-400 font-semibold mt-0.5">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className={cn('flex items-center gap-1.5 px-5 py-2.5 shrink-0 overflow-x-auto', theme === 'light' ? 'bg-[#f4f6f9]' : 'bg-white/5')}>
        <button
          onClick={() => setStageFilter('')}
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
            onClick={() => setStageFilter(stageFilter === stage ? '' : stage)}
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
        <div className="flex-1 overflow-y-auto p-5 min-w-0 custom-scrollbar">
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

              <div className={cn('grid gap-3', selectedLeadId ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3')}>
                {group.leads.map(lead => (
                  <OverviewLeadCard
                    key={lead.id}
                    lead={lead}
                    isSelected={selectedLeadId === lead.id}
                    onSelect={() => setSelectedLeadId(selectedLeadId === lead.id ? null : lead.id)}
                  />
                ))}
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

        {/* Detail panel */}
        {selectedLead && (
          <OverviewDetailPanel
            lead={selectedLead}
            updateLeadStatus={updateLeadStatus}
            onClose={() => setSelectedLeadId(null)}
          />
        )}
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export const Leads = () => {
  const { leads, addLead, addLeads, updateLeadStatus } = useLeads();
  const { theme, getTextColor, getInputClass, getBorderClass, getSecondaryTextColor } = useTheme();

  const [view, setView] = useState<'kanban' | 'overview'>('kanban');
  const [activeMobileStatus, setActiveMobileStatus] = useState<LeadStatus>('New');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newLeadServices, setNewLeadServices] = useState<string[]>([]);
  const [newLeadPax, setNewLeadPax] = useState<PaxConfig>({ adults: 2, children: 0, childAges: [] });
  const [newLeadPrefs, setNewLeadPrefs] = useState<TravelPreferencesType>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showToast, setShowToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [filters, setFilters] = useState({ source: '', temp: '' });

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
    if (filters.source && l.source !== filters.source) return false;
    if (filters.temp && l.temperature !== filters.temp) return false;
    return true;
  });

  const hasActiveFilters = filters.source || filters.temp;
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
      tripDetails: { destination: formData.get('destination') as string, budget: Number(formData.get('budget') || 0), paxConfig: newLeadPax, startDate: formData.get('startDate') as string },
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
    <div className={cn('h-full flex flex-col animate-in fade-in duration-500 relative', view === 'kanban' ? 'gap-5' : 'gap-0')}>

      {/* Toast */}
      {showToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 md:top-6 md:right-6 md:translate-x-0 md:left-auto z-50 animate-in slide-in-from-top-2 fade-in duration-300 w-full max-w-sm px-4">
          <div className={cn('flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md', theme === 'light' ? 'bg-white/90 border-slate-200' : 'bg-slate-800/90 border-white/10', showToast.type === 'success' ? 'text-green-500' : 'text-red-500')}>
            <CheckCircle2 size={18} className="shrink-0" />
            <span className={cn('font-medium text-sm', theme === 'light' ? 'text-slate-800' : 'text-white')}>{showToast.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={cn('flex flex-col md:flex-row justify-between items-start md:items-center gap-4', view === 'overview' && 'shrink-0 px-0 pt-0')}>
        <div>
          <h1 className={cn('text-4xl font-bold font-serif', getTextColor())}>Leads</h1>
          <p className={cn('text-sm mt-1 opacity-70', getTextColor())}>Manage and track your opportunities</p>
        </div>

        <div className="flex gap-3 flex-wrap">
          {/* View toggle */}
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

          {/* Filter dropdown */}
          <div className="relative group z-30">
            <Button variant="secondary" className="gap-2 h-11">
              <Filter size={18} /> Filter{hasActiveFilters && <span className="w-2 h-2 rounded-full bg-indigo-500 ml-0.5" />}
            </Button>
            <div className={cn('absolute top-full right-0 mt-2 w-56 rounded-xl shadow-2xl p-3 hidden group-hover:block backdrop-blur-xl border', theme === 'light' ? 'bg-white/90 border-slate-200' : 'bg-gray-900/90 border-white/10')}>
              <div className={cn('text-xs font-bold uppercase tracking-wider mb-2 opacity-50', getTextColor())}>Temperature</div>
              {['Hot', 'Warm', 'Cold'].map(t => (
                <div key={t} onClick={() => setFilters(p => ({ ...p, temp: p.temp === t ? '' : t }))} className={cn('px-3 py-2 rounded-lg cursor-pointer text-sm mb-1 transition-colors flex items-center justify-between min-h-[44px]', filters.temp === t ? 'bg-blue-500/20 text-blue-500 font-bold' : cn('hover:bg-white/10', getTextColor()))}>
                  {t}{filters.temp === t && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                </div>
              ))}
              <div className="h-px bg-gray-500/20 my-2" />
              <div className={cn('text-xs font-bold uppercase tracking-wider mb-2 opacity-50', getTextColor())}>Source</div>
              {['Instagram', 'Referral', 'Website'].map(s => (
                <div key={s} onClick={() => setFilters(p => ({ ...p, source: p.source === s ? '' : s }))} className={cn('px-3 py-2 rounded-lg cursor-pointer text-sm mb-1 transition-colors flex items-center justify-between min-h-[44px]', filters.source === s ? 'bg-blue-500/20 text-blue-500 font-bold' : cn('hover:bg-white/10', getTextColor()))}>
                  {s}{filters.source === s && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleOpenModal} className="hidden md:flex shadow-lg shadow-blue-500/20 h-11">
            <Plus size={18} /> Add Lead
          </Button>
        </div>
      </div>

      {/* Content */}
      {filteredLeads.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] animate-in fade-in zoom-in-95 duration-500">
          <div className={cn('w-24 h-24 rounded-full flex items-center justify-center mb-6', theme === 'light' ? 'bg-blue-50 text-blue-400' : 'bg-white/5 text-white/30')}>
            {hasActiveFilters ? <SearchX size={48} /> : <Users size={48} />}
          </div>
          <h2 className={cn('text-2xl font-bold font-serif mb-2', getTextColor())}>{hasActiveFilters ? 'No matches found' : 'No leads yet'}</h2>
          <p className={cn('max-w-xs mx-auto mb-8 text-center', getSecondaryTextColor())}>
            {hasActiveFilters ? "We couldn't find any leads matching your filters." : 'Your pipeline is looking empty. Add your first potential client.'}
          </p>
          {hasActiveFilters
            ? <Button onClick={() => setFilters({ source: '', temp: '' })} variant="secondary">Clear Filters</Button>
            : <Button onClick={handleOpenModal} className="hidden md:flex shadow-xl shadow-blue-500/20"><Plus size={18} /> Create First Lead</Button>
          }
        </div>
      ) : view === 'overview' ? (
        <OverviewGrid allLeads={leads} leads={filteredLeads} updateLeadStatus={updateLeadStatus} />
      ) : (
        <>
          {/* Desktop Kanban */}
          <div className="hidden md:flex flex-col flex-1 overflow-hidden min-h-0 gap-4">
            <PipelineStatsBar leads={filteredLeads} />
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="flex gap-5 overflow-x-auto pb-4 flex-1 items-start snap-x">
                {STATUS_COLUMNS.map(status => (
                  <DroppableColumn key={status} status={status}>
                    {filteredLeads.filter(l => l.status === status).map(lead => (
                      <DraggableCard key={lead.id} lead={lead} />
                    ))}
                  </DroppableColumn>
                ))}
              </div>
              <DragOverlay dropAnimation={dropAnimation}>
                {activeLead ? <LeadCard lead={activeLead} isOverlay /> : null}
              </DragOverlay>
            </DndContext>
          </div>

          {/* Mobile Kanban */}
          <div className="md:hidden flex flex-col h-full">
            <div className="flex gap-2 overflow-x-auto pb-4 px-1 no-scrollbar">
              {STATUS_COLUMNS.map(status => (
                <button
                  key={status}
                  onClick={() => setActiveMobileStatus(status as LeadStatus)}
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
            <div className="flex-1 space-y-4 pb-20">
              {filteredLeads.filter(l => l.status === activeMobileStatus).map(lead => (
                <MobileLeadCard key={lead.id} lead={lead} onStatusChange={updateLeadStatus} />
              ))}
              {filteredLeads.filter(l => l.status === activeMobileStatus).length === 0 && (
                <div className="text-center opacity-50 py-10 flex flex-col items-center gap-2">
                  <div className={cn('w-12 h-12 rounded-full flex items-center justify-center', theme === 'light' ? 'bg-slate-100' : 'bg-white/5')}>
                    <Users size={24} />
                  </div>
                  <p className="text-sm">No leads in {activeMobileStatus}</p>
                </div>
              )}
            </div>
          </div>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={cn('text-[10px] font-bold uppercase opacity-60', getTextColor())}>Destination</label>
                  <input name="destination" required placeholder="Where to?" className={cn('w-full bg-transparent border-b p-2 outline-none text-base transition-colors', getBorderClass(), 'focus:border-blue-500', getTextColor())} />
                </div>
                <div className="space-y-1">
                  <label className={cn('text-[10px] font-bold uppercase opacity-60', getTextColor())}>Start Date</label>
                  <input name="startDate" type="date" required className={cn('w-full bg-transparent border-b p-2 outline-none text-base transition-colors', getBorderClass(), 'focus:border-blue-500', getTextColor())} />
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
    </div>
  );
};
