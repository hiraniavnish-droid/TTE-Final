
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useLeads } from '../contexts/LeadContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { DialButton } from '../components/ui/DialButton';
import { ServiceSelector } from '../components/ServiceSelector';
import { PaxSelector } from '../components/PaxSelector'; 
import { TravelPreferences } from '../components/TravelPreferences';
import { Lead, LeadStatus, LeadTemperature, LeadSource, PaxConfig, TravelPreferences as TravelPreferencesType, VendorDetail } from '../types';
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
  LayoutList,
  LayoutGrid,
  Plus,
  Filter,
  UploadCloud,
  MapPin,
  DollarSign,
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
  User,
  Tag,
  Search,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Save,
  Trash2,
  Settings2,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Flame,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { VendorManagementModal } from '../components/VendorManagementModal';
import { motion } from 'framer-motion';

// --- Helper for Urgency Logic ---

const getLeadUrgency = (lead: Lead): { colorClass: string, tooltip: string } => {
    const defaultRes = { colorClass: '', tooltip: '' };
    
    const lastUpdate = lead.lastStatusUpdate ? new Date(lead.lastStatusUpdate) : new Date(lead.createdAt);
    const diffMs = Date.now() - lastUpdate.getTime();
    const diffMins = diffMs / (1000 * 60);
    const diffHours = diffMs / (1000 * 60 * 60);

    if (lead.status === 'Won' || lead.status === 'Lost') return defaultRes;

    if (lead.status === 'New') {
        if (diffMins > 20) return { colorClass: 'border-l-4 border-l-red-500 bg-red-50/50', tooltip: `New Lead ignored for ${Math.round(diffMins)} mins!` };
        if (diffMins > 10) return { colorClass: 'border-l-4 border-l-orange-500 bg-orange-50/50', tooltip: `New Lead ignored for ${Math.round(diffMins)} mins!` };
    }
    else if (lead.status === 'Contacted') {
        if (diffHours > 2) return { colorClass: 'border-l-4 border-l-red-500 bg-red-50/50', tooltip: `No movement for ${Math.round(diffHours)} hours!` };
        if (diffHours > 1) return { colorClass: 'border-l-4 border-l-orange-500 bg-orange-50/50', tooltip: `No movement for ${Math.round(diffHours)} hours!` };
    }
    else if (lead.status === 'Proposal Sent') {
        if (diffHours > 24) return { colorClass: 'border-l-4 border-l-red-500 bg-red-50/50', tooltip: `Proposal stale for ${Math.round(diffHours/24)} days!` };
        if (diffHours > 4) return { colorClass: 'border-l-4 border-l-orange-500 bg-orange-50/50', tooltip: `Proposal stale for ${Math.round(diffHours)} hours!` };
    }
    else if (lead.status === 'Discussion') {
        if (diffHours > 96) return { colorClass: 'border-l-4 border-l-red-500 bg-red-50/50', tooltip: `Discussion stale for ${Math.round(diffHours/24)} days!` };
        if (diffHours > 24) return { colorClass: 'border-l-4 border-l-orange-500 bg-orange-50/50', tooltip: `Discussion stale for ${Math.round(diffHours/24)} days!` };
    }

    return defaultRes;
};

export const getAgentColor = (name: string | undefined) => {
    if (!name || name === 'Unassigned' || name === 'System' || name === 'Admin') return 'bg-gray-100 text-gray-600 border-gray-200';
    const colors = [
        'bg-blue-100 text-blue-700 border-blue-200',
        'bg-emerald-100 text-emerald-700 border-emerald-200',
        'bg-amber-100 text-amber-700 border-amber-200',
        'bg-purple-100 text-purple-700 border-purple-200',
        'bg-rose-100 text-rose-700 border-rose-200',
        'bg-indigo-100 text-indigo-700 border-indigo-200',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

// --- Visual Component (Shared between Draggable and Overlay) ---

const tempColors = {
  Hot: 'bg-rose-500/20 text-rose-200 border-rose-500/30',
  Warm: 'bg-amber-500/20 text-amber-200 border-amber-500/30',
  Cold: 'bg-sky-500/20 text-sky-200 border-sky-500/30'
};

const tempColorsLight = {
  Hot: 'bg-rose-100 text-rose-700 border-rose-200',
  Warm: 'bg-amber-100 text-amber-700 border-amber-200',
  Cold: 'bg-sky-100 text-sky-700 border-sky-200'
};

const statusAccentMap: Record<string, string> = {
  'New':           'border-l-4 border-l-sky-300',
  'Contacted':     'border-l-4 border-l-amber-300',
  'Proposal Sent': 'border-l-4 border-l-violet-300',
  'Discussion':    'border-l-4 border-l-indigo-300',
  'Won':           'border-l-4 border-l-emerald-400',
  'Lost':          'border-l-4 border-l-slate-300',
};

const LeadCard: React.FC<{ lead: Lead, isOverlay?: boolean, isDragging?: boolean }> = React.memo(({ lead, isOverlay, isDragging }) => {
  const { theme, getTextColor, getSecondaryTextColor } = useTheme();

  const { colorClass: urgencyClass, tooltip: urgencyTooltip } = getLeadUrgency(lead);

  const ServiceIcon = useMemo(() => {
    if (lead.interestedServices.includes('Holiday Package')) return Palmtree;
    if (lead.interestedServices.includes('Flight Booking')) return Plane;
    if (lead.interestedServices.includes('Hotel Booking')) return BedDouble;
    if (lead.interestedServices.includes('Visa Service')) return FileCheck;
    return null;
  }, [lead.interestedServices]);

  const metadata = useMemo(() => {
    const parts: string[] = [];
    if (lead.tripDetails.destination) parts.push(lead.tripDetails.destination);
    const { adults, children } = lead.tripDetails.paxConfig;
    const totalPax = adults + children;
    if (totalPax > 0) {
      const pax: string[] = [];
      if (adults > 0) pax.push(`${adults}A`);
      if (children > 0) pax.push(`${children}C`);
      parts.push(pax.join(', '));
    }
    const budgetStr = formatCompactCurrency(lead.tripDetails.budget);
    if (budgetStr) parts.push(budgetStr);
    return parts;
  }, [lead.tripDetails.destination, lead.tripDetails.paxConfig, lead.tripDetails.budget]);

  const hotGlow = lead.temperature === 'Hot' && !isOverlay
    ? { boxShadow: theme === 'light' ? '0 0 0 1px rgba(239,68,68,0.15), 0 4px 16px rgba(239,68,68,0.10)' : '0 0 0 1px rgba(239,68,68,0.20), 0 4px 20px rgba(239,68,68,0.15)' }
    : {};

  return (
    <div
        className={cn(
            "relative px-3 py-2 rounded-xl border transition-all duration-200 select-none group cursor-pointer",
            theme === 'light'
              ? (lead.status === 'Won' ? 'bg-emerald-50/60 border-emerald-100 hover:border-emerald-200' : lead.status === 'Lost' ? 'bg-slate-50 border-slate-100 opacity-70 hover:opacity-100' : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5')
              : theme === 'ocean' ? 'bg-blue-900/60 border-blue-700/50 hover:bg-blue-800/60 hover:border-blue-600/60 hover:shadow-md' : 'bg-slate-800 border-slate-600/60 hover:bg-slate-700 hover:border-slate-500/60 hover:shadow-md',
            isOverlay ? "shadow-[0_20px_60px_rgba(0,0,0,0.25)] scale-105 rotate-[3deg] cursor-grabbing ring-2 ring-indigo-500/40 ring-offset-2" : "shadow-sm",
            isDragging ? "opacity-20 grayscale scale-95" : "opacity-100",
            urgencyClass || statusAccentMap[lead.status] || ''
        )}
        style={hotGlow}
        title={urgencyTooltip}
    >
        <div className="flex items-start justify-between gap-2">
            {/* Left: name row + metadata+agent row */}
            <div className="flex-1 min-w-0">
                {/* Row 1: Name + service icon + urgency */}
                <div className="flex items-center gap-1 mb-0.5">
                    <h4 className={cn("font-bold truncate text-sm capitalize leading-tight", getTextColor())}>{lead.name}</h4>
                    {ServiceIcon && <ServiceIcon size={11} className={cn("opacity-40 shrink-0", getSecondaryTextColor())} />}
                    {urgencyClass && <AlertOctagon size={11} className={cn("shrink-0 ml-0.5", urgencyClass.includes('red') ? 'text-red-500' : 'text-orange-500')} />}
                </div>
                {/* Row 2: metadata + agent badge inline */}
                <div className="flex items-center gap-1.5">
                    <span className={cn("text-[11px] truncate min-w-0 flex-1", theme === 'light' ? 'opacity-60' : 'opacity-80', getSecondaryTextColor())}>
                        {metadata.length > 0 ? metadata.join(' · ') : <span className="italic opacity-50">No details</span>}
                    </span>
                    {(() => {
                        const isUnassigned = !lead.assignedTo || lead.assignedTo === 'Unassigned' || lead.assignedTo === 'System';
                        const displayAgent = isUnassigned ? 'Admin' : lead.assignedTo!;
                        return (
                            <span className={cn("inline-flex items-center gap-0.5 shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded border", getAgentColor(displayAgent))}>
                                <User size={8} />
                                {displayAgent}
                            </span>
                        );
                    })()}
                </div>
            </div>

            {/* Right: temp badge + (time + dial) */}
            <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={cn(
                    "text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded border leading-none",
                    theme === 'light' ? tempColorsLight[lead.temperature] : tempColors[lead.temperature]
                )}>
                    {lead.temperature}
                </span>
                <div className="flex items-center gap-1">
                    <span className={cn("text-[9px] whitespace-nowrap", theme === 'light' ? 'opacity-30' : 'opacity-50', getSecondaryTextColor())}>
                        {timeAgo(lead.createdAt)}
                    </span>
                    <div onClick={(e) => e.stopPropagation()}>
                        <DialButton phoneNumber={lead.contact.phone} className="w-6 h-6" />
                    </div>
                </div>
            </div>
        </div>
      {lead.tags && lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-gray-200/30">
          {lead.tags.map(tag => (
            <span key={tag} className={cn(
              "text-[9px] font-semibold px-1.5 py-0.5 rounded-full border leading-none",
              theme === 'light' ? 'bg-indigo-50 text-indigo-500 border-indigo-100' : theme === 'ocean' ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
            )}>
              {tag}
            </span>
          ))}
        </div>
      )}
      </div>
  );
});

// --- Mobile Lead Card Component ---

interface MobileLeadCardProps {
    lead: Lead;
    onStatusChange?: (id: string, status: LeadStatus) => void;
}

const MobileLeadCard: React.FC<MobileLeadCardProps> = React.memo(({ lead, onStatusChange }) => {
  const { theme, getTextColor, getSecondaryTextColor } = useTheme();

  const statusColors: Record<string, string> = {
      'New': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      'Contacted': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      'Proposal Sent': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      'Discussion': 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
      'Won': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      'Lost': 'bg-rose-500/10 text-rose-500 border-rose-500/20'
  };

  const waLink = `https://wa.me/${lead.contact.phone.replace(/[^0-9]/g, '')}`;
  const { colorClass: urgencyClass } = getLeadUrgency(lead);

  return (
    <div className={cn(
        "p-4 rounded-xl border transition-all shadow-sm",
        theme === 'light' ? 'bg-white border-slate-100' : theme === 'ocean' ? 'bg-blue-950/60 border-blue-800/40' : 'bg-slate-800/80 border-slate-700/50',
        urgencyClass
    )}>
       <div className="flex justify-between items-start mb-3">
          <Link to={`/leads/${lead.id}`} className={cn("font-bold text-lg truncate flex-1 mr-2 capitalize", getTextColor())}>
            {lead.name}
          </Link>
          
          <div className="relative shrink-0">
              <span className={cn(
                 "px-2 py-0.5 rounded text-[10px] font-bold uppercase border flex items-center gap-1",
                 statusColors[lead.status] || 'bg-slate-500/10 text-slate-500 border-slate-500/20'
              )}>
                {lead.status}
                {onStatusChange && <ChevronDown size={12} strokeWidth={3} />}
              </span>
              
              {onStatusChange && (
                  <select
                    value={lead.status}
                    onChange={(e) => onStatusChange(lead.id, e.target.value as LeadStatus)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  >
                      {STATUS_COLUMNS.map(status => (
                          <option key={status} value={status}>{status}</option>
                      ))}
                  </select>
              )}
          </div>
       </div>

       <Link to={`/leads/${lead.id}`} className="block space-y-2 mb-4">
           <div className={cn("flex items-center gap-2 text-sm font-medium", theme === 'light' ? 'text-slate-600' : 'text-slate-300')}>
               <MapPin size={16} className={cn("shrink-0", theme === 'light' ? 'text-slate-500' : 'text-slate-400')} />
               <span>{lead.tripDetails.destination}</span>
           </div>
           <div className={cn("flex items-center gap-2 text-sm font-medium", theme === 'light' ? 'text-slate-600' : 'text-slate-300')}>
               <Calendar size={16} className={cn("shrink-0", theme === 'light' ? 'text-slate-500' : 'text-slate-400')} />
               <span>{formatDate(lead.tripDetails.startDate)}</span>
           </div>
       </Link>

       <div className="grid grid-cols-2 gap-3 mt-2">
           <a href={`tel:${lead.contact.phone}`} className={cn(
               "flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors border w-full",
               theme === 'light'
                ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                : 'bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30'
           )}>
               <Phone size={16} /> Call
           </a>
           <a href={waLink} target="_blank" rel="noreferrer" className={cn(
               "flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors border w-full",
               theme === 'light'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
           )}>
               <MessageCircle size={16} /> WhatsApp
           </a>
       </div>
    </div>
  );
});


// --- DND Components ---

const DraggableCard: React.FC<{ lead: Lead; index?: number }> = React.memo(({ lead, index = 0 }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  const MotionDiv = motion.div as any;

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.3), ease: 'easeOut' }}
      className="mb-1.5"
    >
      <div ref={setNodeRef} {...listeners} {...attributes} className="touch-none outline-none">
        {isDragging ? (
          <LeadCard lead={lead} isDragging={true} />
        ) : (
          <Link to={`/leads/${lead.id}`} className="block">
            <LeadCard lead={lead} />
          </Link>
        )}
      </div>
    </MotionDiv>
  );
});

// Color accent per kanban column
const COLUMN_COLORS: Record<string, { accent: string, headerText: string, badge: string, glow: string }> = {
  'New':           { accent: 'border-t-sky-400',     headerText: 'text-sky-600',     badge: 'bg-sky-500 text-white',     glow: 'ring-sky-200' },
  'Contacted':     { accent: 'border-t-amber-400',   headerText: 'text-amber-600',   badge: 'bg-amber-500 text-white',   glow: 'ring-amber-200' },
  'Proposal Sent': { accent: 'border-t-violet-400',  headerText: 'text-violet-600',  badge: 'bg-violet-500 text-white',  glow: 'ring-violet-200' },
  'Discussion':    { accent: 'border-t-indigo-400',  headerText: 'text-indigo-600',  badge: 'bg-indigo-500 text-white',  glow: 'ring-indigo-200' },
  'Won':           { accent: 'border-t-emerald-400', headerText: 'text-emerald-600', badge: 'bg-emerald-500 text-white', glow: 'ring-emerald-200' },
  'Lost':          { accent: 'border-t-slate-400',   headerText: 'text-slate-500',   badge: 'bg-slate-400 text-white',   glow: 'ring-slate-200' },
};

const DroppableColumn: React.FC<{ status: string, children: React.ReactNode }> = ({ status, children }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });
  const { theme } = useTheme();
  const colColors = COLUMN_COLORS[status] || COLUMN_COLORS['New'];
  const count = React.Children.count(children);

  return (
    <div ref={setNodeRef} className={cn(
        "flex-1 min-w-[260px] rounded-2xl p-2.5 flex flex-col h-[calc(100vh-240px)] transition-all duration-300 border-t-4",
        colColors.accent,
        theme === 'light'
          ? (isOver ? `bg-white ring-2 ${colColors.glow} shadow-lg` : 'bg-slate-50 border border-slate-200/80 border-t-[4px] shadow-sm')
          : (isOver ? `ring-2 ${colColors.glow} shadow-inner ${theme === 'ocean' ? 'bg-blue-800/30' : 'bg-slate-700/40'}` : theme === 'ocean' ? 'bg-blue-950/70 border border-blue-800/50' : 'bg-slate-800/80 border border-slate-700/60')
    )}>
      <div className="flex justify-between items-center mb-2 px-1">
        <h3 className={cn("font-bold text-sm uppercase tracking-wide", isOver ? colColors.headerText : (theme === 'light' ? 'text-slate-600' : 'text-white/90'))}>
            {status}
        </h3>
        <span className={cn(
          "text-[11px] font-bold px-2 py-0.5 rounded-full transition-all",
          isOver
            ? colColors.badge
            : theme === 'light'
              ? "bg-white text-slate-500 border border-slate-200 shadow-sm"
              : theme === 'ocean' ? "bg-blue-800/80 text-blue-100 border border-blue-600/50" : "bg-slate-700 text-slate-200 border border-slate-500/60"
        )}>
            {count}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-20">
        {count === 0 ? (
          <div className={cn("mt-4 border-2 border-dashed rounded-xl p-4 text-center", theme === 'light' ? 'border-slate-200 text-slate-300' : theme === 'ocean' ? 'border-blue-700/30 text-blue-300/30' : 'border-slate-600/40 text-slate-500/40')}>
            <span className="text-xs font-medium">Drop here</span>
          </div>
        ) : children}
      </div>
    </div>
  );
};

// --- Main Page ---

type SortKey = 'name' | 'agent' | 'status' | 'temp' | 'destination' | 'budget' | 'createdAt';
type SortDir = 'asc' | 'desc';

const SortableTh: React.FC<{ label: string; k: SortKey; sortKey: SortKey; sortDir: SortDir; onClick: (k: SortKey) => void }> = ({ label, k, sortKey, sortDir, onClick }) => {
    const active = sortKey === k;
    const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
    return (
        <th className="p-5 font-bold font-serif text-sm">
            <button onClick={() => onClick(k)} className={cn("inline-flex items-center gap-1 hover:text-blue-500 transition-colors", active && "text-blue-500")}>
                {label}
                <Icon size={12} className={cn(!active && "opacity-40")} />
            </button>
        </th>
    );
};

interface FilterState {
    search: string;
    source: string;
    temp: string;
    tags: string[];
    agents: string[];
    statuses: string[];
    destination: string;
    budgetMin: string;
    budgetMax: string;
    createdFrom: string;
    createdTo: string;
    tripFrom: string;
    tripTo: string;
    needsAttention: boolean;
}

const EMPTY_FILTERS: FilterState = {
    search: '', source: '', temp: '', tags: [], agents: [], statuses: [],
    destination: '', budgetMin: '', budgetMax: '', createdFrom: '', createdTo: '',
    tripFrom: '', tripTo: '', needsAttention: false,
};

const PRESETS_KEY = 'tte_leads_presets_v1';
const COLS_KEY = 'tte_leads_cols_v1';
type ColumnKey = 'name' | 'agent' | 'status' | 'temp' | 'destination' | 'budget' | 'createdAt' | 'tags';
const DEFAULT_COLS: Record<ColumnKey, boolean> = {
    name: true, agent: true, status: true, temp: true, destination: true, budget: true, createdAt: false, tags: false,
};

export const Leads = () => {
  const { leads, addLead, addLeads, updateLead, updateLeadStatus, deleteLead } = useLeads();
  const { theme, getTextColor, getInputClass, getBorderClass, getSecondaryTextColor } = useTheme();
  const { user, users } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [view, setView] = useState<'kanban' | 'list'>(() => (searchParams.get('view') === 'list' ? 'list' : 'kanban'));
  const [activeMobileStatus, setActiveMobileStatus] = useState<LeadStatus>('New');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newLeadServices, setNewLeadServices] = useState<string[]>([]);
  const [newLeadPax, setNewLeadPax] = useState<PaxConfig>({ adults: 2, children: 0, childAges: [] });
  const [newLeadPrefs, setNewLeadPrefs] = useState<TravelPreferencesType>({});
  
  // -- Gatekeeper Logic State --
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [pendingLeadId, setPendingLeadId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<LeadStatus | null>(null);

  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showToast, setShowToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // ---- Filter / sort / pagination / bulk / columns state ----
  const initFiltersFromUrl = (): FilterState => {
      const f = { ...EMPTY_FILTERS };
      const get = (k: string) => searchParams.get(k) || '';
      const getList = (k: string) => (searchParams.get(k) || '').split(',').filter(Boolean);
      f.search = get('q');
      f.source = get('source');
      f.temp = get('temp');
      f.tags = getList('tags');
      f.agents = getList('agents');
      f.statuses = getList('status');
      f.destination = get('dest');
      f.budgetMin = get('bmin');
      f.budgetMax = get('bmax');
      f.createdFrom = get('cfrom');
      f.createdTo = get('cto');
      f.tripFrom = get('tfrom');
      f.tripTo = get('tto');
      f.needsAttention = searchParams.get('attn') === '1';
      return f;
  };

  const [filters, setFilters] = useState<FilterState>(initFiltersFromUrl);
  const [sortKey, setSortKey] = useState<SortKey>(() => (searchParams.get('sort') as SortKey) || 'createdAt');
  const [sortDir, setSortDir] = useState<SortDir>(() => (searchParams.get('dir') as SortDir) || 'desc');
  const [page, setPage] = useState<number>(() => parseInt(searchParams.get('page') || '1', 10) || 1);
  const [pageSize, setPageSize] = useState<number>(() => parseInt(searchParams.get('ps') || '25', 10) || 25);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showColMenu, setShowColMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [bulkAgent, setBulkAgent] = useState('');
  const [bulkTag, setBulkTag] = useState('');
  const [columns, setColumns] = useState<Record<ColumnKey, boolean>>(() => {
      try {
          const stored = localStorage.getItem(COLS_KEY);
          if (stored) return { ...DEFAULT_COLS, ...JSON.parse(stored) };
      } catch {}
      return DEFAULT_COLS;
  });
  const [presets, setPresets] = useState<{ name: string; filters: FilterState }[]>(() => {
      try {
          const stored = localStorage.getItem(PRESETS_KEY);
          if (stored) return JSON.parse(stored);
      } catch {}
      return [];
  });

  // Persist columns
  useEffect(() => {
      try { localStorage.setItem(COLS_KEY, JSON.stringify(columns)); } catch {}
  }, [columns]);

  // Persist presets
  useEffect(() => {
      try { localStorage.setItem(PRESETS_KEY, JSON.stringify(presets)); } catch {}
  }, [presets]);

  // Sync state -> URL
  useEffect(() => {
      const next = new URLSearchParams();
      if (view === 'list') next.set('view', 'list');
      if (filters.search) next.set('q', filters.search);
      if (filters.source) next.set('source', filters.source);
      if (filters.temp) next.set('temp', filters.temp);
      if (filters.tags.length) next.set('tags', filters.tags.join(','));
      if (filters.agents.length) next.set('agents', filters.agents.join(','));
      if (filters.statuses.length) next.set('status', filters.statuses.join(','));
      if (filters.destination) next.set('dest', filters.destination);
      if (filters.budgetMin) next.set('bmin', filters.budgetMin);
      if (filters.budgetMax) next.set('bmax', filters.budgetMax);
      if (filters.createdFrom) next.set('cfrom', filters.createdFrom);
      if (filters.createdTo) next.set('cto', filters.createdTo);
      if (filters.tripFrom) next.set('tfrom', filters.tripFrom);
      if (filters.tripTo) next.set('tto', filters.tripTo);
      if (filters.needsAttention) next.set('attn', '1');
      if (sortKey !== 'createdAt') next.set('sort', sortKey);
      if (sortDir !== 'desc') next.set('dir', sortDir);
      if (page !== 1) next.set('page', String(page));
      if (pageSize !== 25) next.set('ps', String(pageSize));
      setSearchParams(next, { replace: true });
  }, [view, filters, sortKey, sortDir, page, pageSize, setSearchParams]);

  // Reset page when filters/sort change
  useEffect(() => { setPage(1); }, [filters, sortKey, sortDir, pageSize]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
        const leadId = active.id as string;
        const newStatus = over.id as LeadStatus;
        if (STATUS_COLUMNS.includes(newStatus)) {
            // --- Gatekeeper Check ---
            if (newStatus === 'Proposal Sent') {
                const lead = leads.find(l => l.id === leadId);
                if (lead && (!lead.vendors || lead.vendors.length === 0)) {
                    setPendingLeadId(leadId);
                    setPendingStatus(newStatus);
                    setIsVendorModalOpen(true);
                    return; // Halt status change
                }
            }
            
            try {
                // Persistent Drag-and-Drop: Optimistic UI + Backend Sync via Context
                await updateLeadStatus(leadId, newStatus);
            } catch (error) {
                // Error Handling: Show Toast (Revert is handled by context fetchLeads)
                setShowToast({ 
                    message: "Failed to update status. Changes reverted.", 
                    type: 'error' 
                });
                setTimeout(() => setShowToast(null), 3000);
            }
        }
    }
  };

  const allTags = useMemo(() => {
      const tagSet = new Set<string>();
      leads.forEach(l => l.tags?.forEach(t => tagSet.add(t)));
      return Array.from(tagSet).sort();
  }, [leads]);

  const allDestinations = useMemo(() => {
      const set = new Set<string>();
      leads.forEach(l => { if (l.tripDetails.destination) set.add(l.tripDetails.destination); });
      return Array.from(set).sort();
  }, [leads]);

  const allAgents = useMemo(() => {
      const set = new Set<string>();
      users.forEach(u => set.add(u.name));
      leads.forEach(l => { if (l.assignedTo) set.add(l.assignedTo); });
      set.add('Unassigned');
      return Array.from(set).sort();
  }, [users, leads]);

  const filteredLeads = useMemo(() => {
      const q = filters.search.trim().toLowerCase();
      const min = filters.budgetMin ? parseFloat(filters.budgetMin) : null;
      const max = filters.budgetMax ? parseFloat(filters.budgetMax) : null;
      const cFrom = filters.createdFrom ? new Date(filters.createdFrom).getTime() : null;
      const cTo = filters.createdTo ? new Date(filters.createdTo).getTime() + 86_400_000 : null;
      const tFrom = filters.tripFrom ? new Date(filters.tripFrom).getTime() : null;
      const tTo = filters.tripTo ? new Date(filters.tripTo).getTime() + 86_400_000 : null;

      return leads.filter(l => {
          if (filters.source && l.source !== filters.source) return false;
          if (filters.temp && l.temperature !== filters.temp) return false;
          if (filters.tags.length > 0 && !filters.tags.every(t => l.tags?.includes(t))) return false;
          if (filters.statuses.length > 0 && !filters.statuses.includes(l.status)) return false;
          if (filters.agents.length > 0) {
              const a = l.assignedTo || 'Unassigned';
              if (!filters.agents.includes(a)) return false;
          }
          if (filters.destination && l.tripDetails.destination !== filters.destination) return false;
          if (min !== null && (l.tripDetails.budget || 0) < min) return false;
          if (max !== null && (l.tripDetails.budget || 0) > max) return false;
          if (cFrom !== null || cTo !== null) {
              const t = new Date(l.createdAt).getTime();
              if (cFrom !== null && t < cFrom) return false;
              if (cTo !== null && t > cTo) return false;
          }
          if (tFrom !== null || tTo !== null) {
              if (!l.tripDetails.startDate) return false;
              const t = new Date(l.tripDetails.startDate).getTime();
              if (tFrom !== null && t < tFrom) return false;
              if (tTo !== null && t > tTo) return false;
          }
          if (filters.needsAttention) {
              const u = getLeadUrgency(l);
              if (!u.colorClass) return false;
          }
          if (q) {
              const hay = `${l.name} ${l.contact?.phone || ''} ${l.tripDetails.destination || ''} ${l.tags?.join(' ') || ''}`.toLowerCase();
              if (!hay.includes(q)) return false;
          }
          return true;
      });
  }, [leads, filters]);

  const sortedLeads = useMemo(() => {
      const arr = [...filteredLeads];
      const dir = sortDir === 'asc' ? 1 : -1;
      const cmp = (a: Lead, b: Lead): number => {
          switch (sortKey) {
              case 'name': return a.name.localeCompare(b.name) * dir;
              case 'agent': return (a.assignedTo || 'Unassigned').localeCompare(b.assignedTo || 'Unassigned') * dir;
              case 'status': return a.status.localeCompare(b.status) * dir;
              case 'temp': return (a.temperature || '').localeCompare(b.temperature || '') * dir;
              case 'destination': return (a.tripDetails.destination || '').localeCompare(b.tripDetails.destination || '') * dir;
              case 'budget': return ((a.tripDetails.budget || 0) - (b.tripDetails.budget || 0)) * dir;
              case 'createdAt':
              default: return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
          }
      };
      arr.sort(cmp);
      return arr;
  }, [filteredLeads, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedLeads.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedLeads = useMemo(() =>
      view === 'list' ? sortedLeads.slice((safePage - 1) * pageSize, safePage * pageSize) : sortedLeads,
  [sortedLeads, safePage, pageSize, view]);

  const hasActiveFilters = !!(
      filters.search || filters.source || filters.temp || filters.tags.length ||
      filters.agents.length || filters.statuses.length || filters.destination ||
      filters.budgetMin || filters.budgetMax || filters.createdFrom || filters.createdTo ||
      filters.tripFrom || filters.tripTo || filters.needsAttention
  );

  const activeFilterCount =
      (filters.search ? 1 : 0) + (filters.source ? 1 : 0) + (filters.temp ? 1 : 0) +
      filters.tags.length + filters.agents.length + filters.statuses.length +
      (filters.destination ? 1 : 0) + (filters.budgetMin || filters.budgetMax ? 1 : 0) +
      (filters.createdFrom || filters.createdTo ? 1 : 0) +
      (filters.tripFrom || filters.tripTo ? 1 : 0) + (filters.needsAttention ? 1 : 0);

  const toggleSort = (k: SortKey) => {
      if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
      else { setSortKey(k); setSortDir('asc'); }
  };

  const toggleListItem = (key: 'agents' | 'statuses' | 'tags', value: string) => {
      setFilters(p => {
          const arr = p[key];
          return { ...p, [key]: arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value] };
      });
  };

  const clearFilters = () => setFilters(EMPTY_FILTERS);

  const exportCsv = () => {
      const rows = sortedLeads.map(l => ({
          Name: l.name,
          Phone: l.contact?.phone || '',
          Email: l.contact?.email || '',
          Agent: l.assignedTo || 'Unassigned',
          Status: l.status,
          Temperature: l.temperature,
          Source: l.source,
          Destination: l.tripDetails.destination,
          Budget: l.tripDetails.budget,
          'Trip Start': l.tripDetails.startDate,
          Tags: (l.tags || []).join('; '),
          Created: l.createdAt,
      }));
      const csv = Papa.unparse(rows);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
  };

  // ---- Bulk actions ----
  const visibleIds = useMemo(() => pagedLeads.map(l => l.id), [pagedLeads]);
  const allOnPageSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
  const togglePageSelect = () => {
      setSelectedIds(prev => {
          const next = new Set(prev);
          if (allOnPageSelected) visibleIds.forEach(id => next.delete(id));
          else visibleIds.forEach(id => next.add(id));
          return next;
      });
  };
  const toggleOne = (id: string) => {
      setSelectedIds(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id); else next.add(id);
          return next;
      });
  };
  const clearSelection = () => setSelectedIds(new Set());

  const bulkAssign = async (agent: string) => {
      if (!agent) return;
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map(id => updateLead(id, { assignedTo: agent === 'Unassigned' ? undefined : agent })));
      setShowToast({ message: `Assigned ${ids.length} lead(s) to ${agent}`, type: 'success' });
      setTimeout(() => setShowToast(null), 2500);
      clearSelection();
  };
  const bulkAddTag = async (tag: string) => {
      if (!tag.trim()) return;
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map(id => {
          const l = leads.find(x => x.id === id); if (!l) return Promise.resolve();
          const nextTags = Array.from(new Set([...(l.tags || []), tag.trim()]));
          return updateLead(id, { tags: nextTags });
      }));
      setShowToast({ message: `Tagged ${ids.length} lead(s)`, type: 'success' });
      setTimeout(() => setShowToast(null), 2500);
      setBulkTag('');
      clearSelection();
  };
  const bulkDelete = async () => {
      const ids = Array.from(selectedIds);
      if (!ids.length) return;
      if (!confirm(`Delete ${ids.length} lead(s)? This cannot be undone.`)) return;
      await Promise.all(ids.map(id => deleteLead(id)));
      setShowToast({ message: `Deleted ${ids.length} lead(s)`, type: 'success' });
      setTimeout(() => setShowToast(null), 2500);
      clearSelection();
  };

  // ---- Presets ----
  const savePreset = () => {
      const name = prompt('Save current filters as preset. Name?');
      if (!name) return;
      setPresets(p => [...p.filter(x => x.name !== name), { name, filters }]);
  };
  const applyPreset = (name: string) => {
      const p = presets.find(x => x.name === name);
      if (p) setFilters(p.filters);
      setShowPresetMenu(false);
  };
  const deletePreset = (name: string) => setPresets(p => p.filter(x => x.name !== name));
  const activeLead = activeId ? leads.find(l => l.id === activeId) : null;

  const handleOpenModal = () => {
      setNewLeadServices([]);
      setNewLeadPax({ adults: 2, children: 0, childAges: [] });
      setNewLeadPrefs({});
      setIsModalOpen(true);
  };

  // --- CSV Import Logic ---

  const downloadSampleCsv = () => {
      const headers = ['Name', 'Phone', 'Email', 'Destination', 'Budget', 'Travel Date', 'Status', 'Source'];
      const row = ['John Doe', '+919876543210', 'john@example.com', 'Bali', '50000', '2025-10-01', 'New', 'Instagram'];
      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), row.join(',')].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "voyageos_lead_template.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const processImportedData = (data: any[]) => {
      const validLeads: Lead[] = [];
      let skippedCount = 0;

      // Smart Mapping Configuration
      const mappings = {
          name: ['name', 'client', 'customer', 'passenger'],
          phone: ['phone', 'mobile', 'contact', 'number'],
          email: ['email', 'mail'],
          destination: ['destination', 'loc', 'place', 'dest'],
          budget: ['budget', 'price', 'cost'],
          startDate: ['date', 'travel date', 'start', 'start date'],
          status: ['status', 'stage'],
          source: ['source', 'channel']
      };

      const findField = (row: any, keys: string[]) => {
          for (const key of keys) {
              const foundKey = Object.keys(row).find(k => k.toLowerCase().trim() === key);
              if (foundKey && row[foundKey]) return row[foundKey];
          }
          return null;
      };

      data.forEach(row => {
          const name = findField(row, mappings.name);
          const phone = findField(row, mappings.phone);

          // Mandatory Check
          if (!name || !phone) {
              skippedCount++;
              return;
          }

          const newLead: Lead = {
              id: generateId(),
              name: name,
              contact: {
                  phone: phone,
                  email: findField(row, mappings.email) || '',
              },
              tripDetails: {
                  destination: findField(row, mappings.destination) || 'TBD',
                  budget: Number(findField(row, mappings.budget)) || 0,
                  paxConfig: { adults: 2, children: 0, childAges: [] }, // Default
                  startDate: findField(row, mappings.startDate) || new Date().toISOString(),
              },
              status: (findField(row, mappings.status) as LeadStatus) || 'New',
              temperature: 'Hot', // Default
              source: (findField(row, mappings.source) as LeadSource) || 'Other',
              interestedServices: [],
              tags: ['Imported'],
              createdAt: new Date().toISOString(),
              lastStatusUpdate: new Date().toISOString(),
              vendors: []
          };
          validLeads.push(newLead);
      });

      if (validLeads.length > 0) {
          addLeads(validLeads);
          setShowToast({
              message: `Imported ${validLeads.length} leads.${skippedCount > 0 ? ` Skipped ${skippedCount} rows.` : ''}`,
              type: 'success'
          });
          setIsModalOpen(false);
      } else {
          setShowToast({
              message: `No valid leads found. Skipped ${skippedCount} rows.`,
              type: 'error'
          });
      }

      setTimeout(() => setShowToast(null), 5000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => processImportedData(results.data),
          error: (error) => {
              console.error(error);
              setShowToast({ message: "Failed to parse CSV.", type: 'error' });
              setTimeout(() => setShowToast(null), 3000);
          }
      });
      // Reset input
      e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type === "text/csv") {
           Papa.parse(file, {
              header: true,
              skipEmptyLines: true,
              complete: (results) => processImportedData(results.data),
              error: (error) => {
                  console.error(error);
                  setShowToast({ message: "Failed to parse CSV.", type: 'error' });
                  setTimeout(() => setShowToast(null), 3000);
              }
          });
      } else if (file) {
          setShowToast({ message: "Please upload a valid .csv file", type: 'error' });
          setTimeout(() => setShowToast(null), 3000);
      }
  };

  const handleAddLead = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const newLead: Lead = {
          id: generateId(),
          name: formData.get('name') as string,
          contact: {
              phone: (formData.get('phone') as string) || '', // Optional
              email: (formData.get('email') as string) || '', // Optional
          },
          tripDetails: {
              destination: formData.get('destination') as string,
              budget: Number(formData.get('budget') || 0), // Default to 0 if empty
              paxConfig: newLeadPax, // Use the state object
              startDate: formData.get('startDate') as string,
          },
          preferences: newLeadPrefs, // Use the state object
          status: 'New',
          temperature: formData.get('temperature') as LeadTemperature,
          source: formData.get('source') as LeadSource,
          interestedServices: newLeadServices, // Include services
          referenceName: formData.get('reference') as string,
          assignedTo: formData.get('assignedTo') as string,
          tags: [],
          createdAt: new Date().toISOString(),
          lastStatusUpdate: new Date().toISOString(),
          vendors: []
      };
      addLead(newLead);
      setIsModalOpen(false);
  };

  // --- Gatekeeper: Handle Vendor Save ---
  const handleVendorSave = (leadId: string, vendors: VendorDetail[]) => {
      const lead = leads.find(l => l.id === leadId);
      if(!lead) return;

      const totalCost = vendors.reduce((acc, v) => acc + (v.cost || 0), 0);
      const totalPrice = vendors.reduce((acc, v) => acc + (v.price || 0), 0);
      
      const newCommercials = {
          sellingPrice: totalPrice,
          netCost: totalCost,
          vendorId: vendors[0].id,
          manualVendorName: vendors[0].name,
          taxAmount: 0
      };

      updateLead(leadId, { vendors, commercials: newCommercials });
      
      // If there was a pending status change
      if (pendingStatus) {
          updateLeadStatus(leadId, pendingStatus);
          setPendingStatus(null);
          setPendingLeadId(null);
      }
      setIsVendorModalOpen(false);
  };

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  };

  const inputClasses = cn(
      "w-full rounded-lg px-3 py-2 text-sm md:p-3 md:text-base outline-none transition-all border",
      getInputClass()
  );

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500 relative pt-2 md:pt-0">
      
       {/* Toast Notification */}
       {showToast && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 md:top-6 md:right-6 md:translate-x-0 md:left-auto z-50 animate-in slide-in-from-top-2 fade-in duration-300 w-full max-w-sm px-4">
              <div className={cn(
                  "flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md",
                  theme === 'light' ? 'bg-white/90 border-slate-200' : theme === 'ocean' ? 'bg-blue-950/90 border-blue-700/40' : 'bg-slate-800/90 border-slate-700/50',
                  showToast.type === 'success' ? 'text-green-500' : 'text-red-500'
              )}>
                  <CheckCircle2 size={18} className="shrink-0" />
                  <span className={cn("font-medium text-sm", theme === 'light' ? 'text-slate-800' : 'text-white')}>{showToast.message}</span>
              </div>
          </div>
      )}

      {/* --- Gatekeeper Modal --- */}
      <VendorManagementModal 
          isOpen={isVendorModalOpen}
          onClose={() => setIsVendorModalOpen(false)}
          leadId={pendingLeadId}
          onSave={handleVendorSave}
      />

      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className={cn("text-2xl md:text-3xl font-extrabold mb-0.5 bg-gradient-to-r bg-clip-text text-transparent",
              theme === 'light' ? 'from-indigo-600 to-blue-500' : theme === 'ocean' ? 'from-blue-300 to-indigo-300' : 'from-indigo-300 to-slate-100'
            )}>Leads</h1>
            <p className={cn("text-sm", getSecondaryTextColor())}>Manage and track your opportunities</p>
        </div>
        
        <div className="flex items-center gap-2 md:gap-3 flex-wrap w-full md:w-auto">
            {/* Search */}
            <div className={cn("relative h-10 md:h-11 flex-1 md:flex-none md:w-64", )}>
                <Search size={16} className={cn("absolute left-3 top-1/2 -translate-y-1/2", getSecondaryTextColor())} />
                <input
                    type="text"
                    value={filters.search}
                    onChange={e => setFilters(p => ({...p, search: e.target.value}))}
                    placeholder="Search name, phone, destination..."
                    className={cn(
                        "w-full h-full rounded-xl pl-9 pr-8 text-sm outline-none transition-all border",
                        theme === 'light' ? 'bg-white border-slate-200 focus:border-blue-400' : theme === 'ocean' ? 'bg-blue-950/60 border-blue-800/40 text-white focus:border-blue-500' : 'bg-slate-800 border-slate-700/50 text-white focus:border-indigo-500'
                    )}
                />
                {filters.search && (
                    <button onClick={() => setFilters(p => ({...p, search: ''}))} className={cn("absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-500/10", getSecondaryTextColor())}>
                        <X size={14} />
                    </button>
                )}
            </div>

            {/* View Toggles */}
            <div className={cn("flex items-center rounded-xl p-1 border h-10 md:h-11 flex-shrink-0", theme === 'light' ? 'bg-white border-slate-200' : theme === 'ocean' ? 'bg-blue-950/60 border-blue-800/40' : 'bg-slate-800 border-slate-700/50')}>
                <button
                    onClick={() => setView('kanban')}
                    className={cn("p-2 rounded-lg transition-all h-full w-10 flex items-center justify-center", view === 'kanban' ? (theme === 'light' ? 'bg-slate-100 text-blue-600' : theme === 'ocean' ? 'bg-blue-800/60 text-indigo-300' : 'bg-slate-700 text-indigo-300') : 'opacity-50 hover:opacity-100 text-gray-400')}
                >
                    <LayoutGrid size={20} />
                </button>
                <button
                    onClick={() => setView('list')}
                    className={cn("p-2 rounded-lg transition-all h-full w-10 flex items-center justify-center", view === 'list' ? (theme === 'light' ? 'bg-slate-100 text-blue-600' : theme === 'ocean' ? 'bg-blue-800/60 text-indigo-300' : 'bg-slate-700 text-indigo-300') : 'opacity-50 hover:opacity-100 text-gray-400')}
                >
                    <LayoutList size={20} />
                </button>
            </div>

            {/* Filter */}
            <div className="relative z-30 h-10 md:h-11">
                <Button variant="secondary" onClick={() => { setShowFilterMenu(v => !v); setShowColMenu(false); setShowPresetMenu(false); }} className={cn("gap-2 h-full shadow-none relative",
                  theme === 'light' ? 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                    : theme === 'ocean' ? 'border border-blue-700/50 bg-blue-950/80 hover:bg-blue-900/60 text-slate-200'
                    : 'border border-slate-600/50 bg-slate-800 hover:bg-slate-700 text-slate-200'
                )}>
                    <Filter size={18} /> Filter
                    {activeFilterCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {activeFilterCount}
                      </span>
                    )}
                </Button>
                {showFilterMenu && (
                <div className={cn(
                    "absolute top-full right-0 mt-2 w-[360px] max-h-[70vh] overflow-y-auto custom-scrollbar rounded-xl shadow-2xl p-4 backdrop-blur-xl border z-40",
                     theme === 'light' ? 'bg-white/95 border-slate-200' : theme === 'ocean' ? 'bg-blue-950/95 border-blue-800/40' : 'bg-slate-900/95 border-slate-700/50'
                )}>
                    {/* Quick: Needs attention */}
                    <button
                        onClick={() => setFilters(p => ({...p, needsAttention: !p.needsAttention}))}
                        className={cn(
                            "w-full mb-3 px-3 py-2 rounded-lg text-sm font-semibold border flex items-center gap-2 justify-center transition-colors",
                            filters.needsAttention
                                ? 'bg-rose-500/15 text-rose-500 border-rose-500/30'
                                : (theme === 'light' ? 'border-slate-200 hover:bg-slate-50' : 'border-slate-600/50 hover:bg-white/5')
                        )}
                    >
                        <Flame size={14} /> Needs attention {filters.needsAttention && <span className="text-[10px] opacity-70">(stale)</span>}
                    </button>

                    {/* Stages */}
                    <div className={cn("text-[11px] font-bold uppercase tracking-wider mb-1.5 opacity-60", getTextColor())}>Stage</div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        {STATUS_COLUMNS.map(s => {
                            const active = filters.statuses.includes(s);
                            return (
                                <button key={s} onClick={() => toggleListItem('statuses', s)} className={cn(
                                    "px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all",
                                    active ? 'bg-blue-500/15 text-blue-500 border-blue-500/40' : (theme === 'light' ? 'bg-white border-slate-200 hover:border-slate-300' : 'border-slate-600/50 hover:border-slate-400')
                                )}>{s}</button>
                            );
                        })}
                    </div>

                    {/* Agents */}
                    <div className={cn("text-[11px] font-bold uppercase tracking-wider mb-1.5 opacity-60", getTextColor())}>Assigned to</div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        {allAgents.map(a => {
                            const active = filters.agents.includes(a);
                            return (
                                <button key={a} onClick={() => toggleListItem('agents', a)} className={cn(
                                    "px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all",
                                    active ? 'bg-blue-500/15 text-blue-500 border-blue-500/40' : (theme === 'light' ? 'bg-white border-slate-200 hover:border-slate-300' : 'border-slate-600/50 hover:border-slate-400')
                                )}>{a}</button>
                            );
                        })}
                    </div>

                    {/* Temperature */}
                    <div className={cn("text-[11px] font-bold uppercase tracking-wider mb-1.5 opacity-60", getTextColor())}>Temperature</div>
                    <div className="flex gap-1.5 mb-3">
                        {['Hot', 'Warm', 'Cold'].map(t => (
                            <button key={t} onClick={() => setFilters(p => ({...p, temp: p.temp === t ? '' : t}))} className={cn(
                                "flex-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold border transition-all",
                                filters.temp === t ? 'bg-blue-500/15 text-blue-500 border-blue-500/40' : (theme === 'light' ? 'bg-white border-slate-200 hover:border-slate-300' : 'border-slate-600/50 hover:border-slate-400')
                            )}>{t}</button>
                        ))}
                    </div>

                    {/* Source */}
                    <div className={cn("text-[11px] font-bold uppercase tracking-wider mb-1.5 opacity-60", getTextColor())}>Source</div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        {['Instagram', 'Referral', 'Website', 'Walk-in', 'Other'].map(s => (
                            <button key={s} onClick={() => setFilters(p => ({...p, source: p.source === s ? '' : s}))} className={cn(
                                "px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all",
                                filters.source === s ? 'bg-blue-500/15 text-blue-500 border-blue-500/40' : (theme === 'light' ? 'bg-white border-slate-200 hover:border-slate-300' : 'border-slate-600/50 hover:border-slate-400')
                            )}>{s}</button>
                        ))}
                    </div>

                    {/* Destination */}
                    {allDestinations.length > 0 && (
                        <>
                            <div className={cn("text-[11px] font-bold uppercase tracking-wider mb-1.5 opacity-60", getTextColor())}>Destination</div>
                            <select
                                value={filters.destination}
                                onChange={e => setFilters(p => ({...p, destination: e.target.value}))}
                                className={cn("w-full mb-3 rounded-md px-2.5 py-1.5 text-[11px] border", theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-600/50 text-white')}
                            >
                                <option value="">All destinations</option>
                                {allDestinations.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </>
                    )}

                    {/* Budget range */}
                    <div className={cn("text-[11px] font-bold uppercase tracking-wider mb-1.5 opacity-60", getTextColor())}>Budget (₹)</div>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        <input type="number" placeholder="Min" value={filters.budgetMin} onChange={e => setFilters(p => ({...p, budgetMin: e.target.value}))}
                            className={cn("rounded-md px-2 py-1.5 text-[11px] border", theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-600/50 text-white')} />
                        <input type="number" placeholder="Max" value={filters.budgetMax} onChange={e => setFilters(p => ({...p, budgetMax: e.target.value}))}
                            className={cn("rounded-md px-2 py-1.5 text-[11px] border", theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-600/50 text-white')} />
                    </div>

                    {/* Created date range */}
                    <div className={cn("text-[11px] font-bold uppercase tracking-wider mb-1.5 opacity-60", getTextColor())}>Created date</div>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        <input type="date" value={filters.createdFrom} onChange={e => setFilters(p => ({...p, createdFrom: e.target.value}))}
                            className={cn("rounded-md px-2 py-1.5 text-[11px] border", theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-600/50 text-white')} />
                        <input type="date" value={filters.createdTo} onChange={e => setFilters(p => ({...p, createdTo: e.target.value}))}
                            className={cn("rounded-md px-2 py-1.5 text-[11px] border", theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-600/50 text-white')} />
                    </div>

                    {/* Trip date range */}
                    <div className={cn("text-[11px] font-bold uppercase tracking-wider mb-1.5 opacity-60", getTextColor())}>Trip start</div>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        <input type="date" value={filters.tripFrom} onChange={e => setFilters(p => ({...p, tripFrom: e.target.value}))}
                            className={cn("rounded-md px-2 py-1.5 text-[11px] border", theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-600/50 text-white')} />
                        <input type="date" value={filters.tripTo} onChange={e => setFilters(p => ({...p, tripTo: e.target.value}))}
                            className={cn("rounded-md px-2 py-1.5 text-[11px] border", theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-600/50 text-white')} />
                    </div>

                    {/* Tags */}
                    {allTags.length > 0 && (
                        <>
                            <div className={cn("text-[11px] font-bold uppercase tracking-wider mb-1.5 opacity-60 flex items-center gap-1", getTextColor())}>
                                <Tag size={10} /> Tags
                            </div>
                            <div className="flex flex-wrap gap-1 mb-3">
                                {allTags.map(tag => {
                                    const active = filters.tags.includes(tag);
                                    return (
                                        <button key={tag} onClick={() => toggleListItem('tags', tag)} className={cn(
                                            "px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all",
                                            active ? 'bg-blue-500/20 text-blue-500 border-blue-500/40' : cn('border-transparent hover:border-gray-400/30', getTextColor(), 'opacity-60 hover:opacity-100')
                                        )}>{tag}</button>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    <div className="flex gap-2 mt-2 pt-3 border-t border-gray-500/15">
                        <Button variant="secondary" onClick={clearFilters} className="flex-1 text-xs h-8">Clear all</Button>
                        <Button onClick={savePreset} className="flex-1 text-xs h-8 gap-1"><Save size={12} /> Save preset</Button>
                    </div>
                </div>
                )}
            </div>

            {/* Presets */}
            {presets.length > 0 && (
                <div className="relative h-10 md:h-11">
                    <Button variant="secondary" onClick={() => { setShowPresetMenu(v => !v); setShowFilterMenu(false); setShowColMenu(false); }} className={cn("gap-2 h-full shadow-none",
                      theme === 'light' ? 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-600' : 'border border-slate-600/50 bg-slate-800 hover:bg-slate-700 text-slate-200'
                    )}>
                        <Bookmark size={16} /> Presets
                    </Button>
                    {showPresetMenu && (
                        <div className={cn("absolute top-full right-0 mt-2 w-56 rounded-xl shadow-2xl border z-40 overflow-hidden",
                            theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700/50'
                        )}>
                            {presets.map(p => (
                                <div key={p.name} className={cn("flex items-center justify-between px-3 py-2 hover:bg-blue-500/10", getTextColor())}>
                                    <button onClick={() => applyPreset(p.name)} className="flex-1 text-left text-sm">{p.name}</button>
                                    <button onClick={() => deletePreset(p.name)} className="opacity-50 hover:opacity-100 hover:text-rose-500"><Trash2 size={14} /></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Columns (list view only) */}
            {view === 'list' && (
                <div className="relative h-10 md:h-11">
                    <Button variant="secondary" onClick={() => { setShowColMenu(v => !v); setShowFilterMenu(false); setShowPresetMenu(false); }} className={cn("gap-2 h-full shadow-none",
                      theme === 'light' ? 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-600' : 'border border-slate-600/50 bg-slate-800 hover:bg-slate-700 text-slate-200'
                    )}>
                        <Settings2 size={16} /> Columns
                    </Button>
                    {showColMenu && (
                        <div className={cn("absolute top-full right-0 mt-2 w-48 rounded-xl shadow-2xl border z-40 p-2",
                            theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700/50'
                        )}>
                            {(Object.keys(DEFAULT_COLS) as ColumnKey[]).map(k => (
                                <label key={k} className={cn("flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-blue-500/10", getTextColor())}>
                                    <input type="checkbox" checked={!!columns[k]} onChange={e => setColumns(c => ({...c, [k]: e.target.checked}))} />
                                    <span className="capitalize">{k === 'createdAt' ? 'Created' : k}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <Button variant="secondary" onClick={exportCsv} className={cn("gap-2 h-10 md:h-11 shadow-none hidden md:flex",
                theme === 'light' ? 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-600' : 'border border-slate-600/50 bg-slate-800 hover:bg-slate-700 text-slate-200'
            )}>
                <Download size={16} /> Export
            </Button>

            <Button onClick={handleOpenModal} className="hidden md:flex shadow-lg shadow-blue-500/20 h-10 md:h-11">
                <Plus size={18} /> Add Lead
            </Button>
        </div>
      </div>

      {filteredLeads.length === 0 ? (
         <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] animate-in fade-in zoom-in-95 duration-500">
            {/* Empty State ... (Unchanged) */}
            <div className={cn("w-24 h-24 rounded-full flex items-center justify-center mb-6", theme === 'light' ? 'bg-blue-50 text-blue-400' : theme === 'ocean' ? 'bg-blue-900/30 text-blue-400/50' : 'bg-slate-800/60 text-slate-500')}>
                {hasActiveFilters ? <SearchX size={48} /> : <Users size={48} />}
            </div>
            <h2 className={cn("text-2xl font-bold font-serif mb-2", getTextColor())}>
                {hasActiveFilters ? "No matches found" : "No leads yet"}
            </h2>
            <p className={cn("max-w-xs mx-auto mb-8 text-center", getSecondaryTextColor())}>
                {hasActiveFilters 
                    ? "We couldn't find any leads matching your filters. Try clearing them to see all results." 
                    : "Your pipeline is looking empty. Add your first potential client to start tracking their journey."}
            </p>
            {hasActiveFilters ? (
                <Button onClick={clearFilters} variant="secondary">
                    Clear Filters
                </Button>
            ) : (
                <Button onClick={handleOpenModal} className="hidden md:flex shadow-xl shadow-blue-500/20">
                    <Plus size={18} /> Create First Lead
                </Button>
            )}
         </div>
      ) : view === 'kanban' ? (
        <>
            {/* Kanban View ... (Unchanged) */}
            <div className="hidden md:block h-full">
                <DndContext 
                    sensors={sensors} 
                    collisionDetection={closestCenter} 
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <div className="flex gap-6 overflow-x-auto pb-6 h-full items-start snap-x">
                        {STATUS_COLUMNS.map(status => (
                            <DroppableColumn key={status} status={status}>
                                {filteredLeads.filter(l => l.status === status).map((lead, idx) => (
                                    <DraggableCard key={lead.id} lead={lead} index={idx} />
                                ))}
                            </DroppableColumn>
                        ))}
                    </div>

                    <DragOverlay dropAnimation={dropAnimation}>
                        {activeLead ? (
                           <LeadCard lead={activeLead} isOverlay />
                        ) : null}
                    </DragOverlay>

                </DndContext>
            </div>

            <div className="md:hidden flex flex-col h-full">
                 {/* Mobile Kanban Tabs */}
                 <div className="relative">
                     <div className="flex gap-2 overflow-x-auto pb-4 px-1 no-scrollbar items-center">
                         {STATUS_COLUMNS.map(status => (
                             <button
                                key={status}
                                onClick={() => setActiveMobileStatus(status as LeadStatus)}
                                className={cn(
                                    "whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold border transition-all min-h-[44px]",
                                    activeMobileStatus === status
                                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                        : (theme === 'light' ? "bg-white text-slate-500 border-slate-200" : theme === 'ocean' ? "bg-blue-900/40 text-blue-200/70 border-blue-700/40" : "bg-slate-800 text-slate-400 border-slate-700/50")
                                )}
                             >
                                {status}
                             </button>
                         ))}
                     </div>
                     {/* Scroll Hint Overlay */}
                     <div className={cn("absolute right-0 top-0 bottom-4 w-12 pointer-events-none bg-gradient-to-l", theme === 'light' ? "from-slate-50 to-transparent" : theme === 'ocean' ? "from-blue-950 to-transparent" : "from-slate-900 to-transparent")} />
                 </div>
                 
                 <div className="flex-1 space-y-4 pb-32">
                     {filteredLeads
                        .filter(l => l.status === activeMobileStatus)
                        .map(lead => (
                            <MobileLeadCard 
                                key={lead.id} 
                                lead={lead} 
                                onStatusChange={updateLeadStatus} 
                            />
                     ))}
                     {filteredLeads.filter(l => l.status === activeMobileStatus).length === 0 && (
                         <div className="text-center opacity-50 py-10 flex flex-col items-center gap-2">
                             <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", theme === 'light' ? 'bg-slate-100' : theme === 'ocean' ? 'bg-blue-900/30' : 'bg-slate-800/60')}>
                                 <LayoutList size={24} />
                             </div>
                             <p className="text-sm">No leads in {activeMobileStatus}</p>
                         </div>
                     )}
                 </div>
            </div>
        </>
      ) : (
        <>
            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
                <div className={cn("hidden md:flex items-center gap-3 px-4 py-2.5 rounded-xl border shadow-sm",
                    theme === 'light' ? 'bg-blue-50 border-blue-200' : 'bg-blue-900/30 border-blue-700/40'
                )}>
                    <span className={cn("text-sm font-semibold", getTextColor())}>{selectedIds.size} selected</span>
                    <div className="h-5 w-px bg-gray-400/30" />
                    <select
                        value={bulkAgent}
                        onChange={e => { setBulkAgent(e.target.value); bulkAssign(e.target.value); setBulkAgent(''); }}
                        className={cn("rounded-md px-2 py-1 text-xs border", theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-600/50 text-white')}
                    >
                        <option value="">Assign to…</option>
                        {allAgents.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <div className="flex items-center gap-1">
                        <input
                            type="text"
                            placeholder="Add tag"
                            value={bulkTag}
                            onChange={e => setBulkTag(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') bulkAddTag(bulkTag); }}
                            className={cn("rounded-md px-2 py-1 text-xs border w-24", theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-600/50 text-white')}
                        />
                        <button onClick={() => bulkAddTag(bulkTag)} className="p-1 rounded hover:bg-blue-500/10"><Tag size={14} /></button>
                    </div>
                    <button onClick={bulkDelete} className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-rose-500 hover:bg-rose-500/10">
                        <Trash2 size={14} /> Delete
                    </button>
                    <button onClick={clearSelection} className="text-xs opacity-60 hover:opacity-100">Clear</button>
                </div>
            )}

            {/* List View with sortable columns + checkboxes */}
            <Card noPadding className="hidden md:block overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className={cn("w-full text-left border-collapse", getTextColor())}>
                        <thead>
                            <tr className={cn(theme === 'light' ? 'bg-slate-50 border-b border-slate-200' : theme === 'ocean' ? 'bg-blue-950/40 border-b border-blue-800/40' : 'bg-slate-800/60 border-b border-slate-700/60')}>
                                <th className="p-3 w-8">
                                    <input type="checkbox" checked={allOnPageSelected} onChange={togglePageSelect} aria-label="Select all" />
                                </th>
                                {columns.name && <SortableTh label="Name" k="name" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />}
                                {columns.agent && user?.role === 'admin' && <SortableTh label="Agent" k="agent" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />}
                                {columns.status && <SortableTh label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />}
                                {columns.temp && <SortableTh label="Temp" k="temp" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />}
                                {columns.destination && <SortableTh label="Destination" k="destination" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />}
                                {columns.budget && <SortableTh label="Budget" k="budget" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />}
                                {columns.createdAt && <SortableTh label="Created" k="createdAt" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />}
                                {columns.tags && <th className="p-5 font-bold font-serif text-sm">Tags</th>}
                                <th className="p-5 font-bold font-serif text-sm">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pagedLeads.map(lead => {
                                const checked = selectedIds.has(lead.id);
                                return (
                                <tr key={lead.id} className={cn(
                                    "group relative transition-all duration-500 ease-in-out border-b",
                                    checked && (theme === 'light' ? 'bg-blue-50/60' : 'bg-blue-900/20'),
                                    theme === 'light'
                                        ? "border-slate-100 hover:bg-gradient-to-r hover:from-transparent hover:via-slate-50 hover:to-transparent"
                                        : theme === 'ocean' ? "border-blue-800/20 hover:bg-gradient-to-r hover:from-transparent hover:via-blue-800/20 hover:to-transparent" : "border-slate-700/30 hover:bg-gradient-to-r hover:from-transparent hover:via-slate-700/30 hover:to-transparent",
                                    "hover:shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] hover:z-10"
                                )}>
                                    <td className="p-3 w-8">
                                        <input type="checkbox" checked={checked} onChange={() => toggleOne(lead.id)} aria-label={`Select ${lead.name}`} />
                                    </td>
                                    {columns.name && (
                                        <td className="p-5 font-semibold relative">
                                            <div className={cn(
                                                "absolute left-0 top-0 bottom-0 w-[3px] scale-y-0 transition-transform duration-300 origin-center group-hover:scale-y-100",
                                                theme === 'light' ? "bg-slate-900" : "bg-blue-400"
                                            )} />
                                            <div className="flex items-center gap-2">
                                                {lead.name}
                                                <DialButton phoneNumber={lead.contact.phone} className="w-11 h-11 opacity-50 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        </td>
                                    )}
                                    {columns.agent && user?.role === 'admin' && (
                                        <td className="p-5">
                                            {(() => {
                                                const isUnassigned = !lead.assignedTo || lead.assignedTo === 'Unassigned' || lead.assignedTo === 'System';
                                                const displayAgent = isUnassigned ? 'Admin' : lead.assignedTo!;
                                                return (
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded-full text-[10px] font-bold border opacity-70 group-hover:opacity-100 transition-opacity",
                                                        getAgentColor(displayAgent)
                                                    )}>
                                                        {displayAgent}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                    )}
                                    {columns.status && (
                                        <td className="p-5">
                                            <span className={cn("px-2.5 py-1 rounded-md text-xs font-medium border", theme === 'light' ? 'bg-white border-slate-200' : theme === 'ocean' ? 'bg-blue-900/50 border-blue-700/40' : 'bg-slate-700/60 border-slate-600/50')}>{lead.status}</span>
                                        </td>
                                    )}
                                    {columns.temp && (
                                        <td className="p-5">
                                            <span className={cn(
                                                "px-2.5 py-1 rounded-full text-xs font-bold border",
                                                lead.temperature === 'Hot' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                                                lead.temperature === 'Warm' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                'bg-sky-500/10 text-sky-500 border-sky-500/20'
                                            )}>{lead.temperature}</span>
                                        </td>
                                    )}
                                    {columns.destination && (
                                        <td className={cn("p-5 text-sm transition-colors", theme === 'light' ? "text-slate-500 group-hover:text-slate-900" : "text-slate-400 group-hover:text-slate-100")}>
                                            {lead.tripDetails.destination}
                                        </td>
                                    )}
                                    {columns.budget && (
                                        <td className={cn("p-5 text-sm font-mono tracking-wide transition-colors", theme === 'light' ? "text-slate-500 group-hover:text-slate-900" : "text-slate-400 group-hover:text-slate-100")}>
                                            {formatCurrency(lead.tripDetails.budget)}
                                        </td>
                                    )}
                                    {columns.createdAt && (
                                        <td className={cn("p-5 text-sm transition-colors", theme === 'light' ? "text-slate-500" : "text-slate-400")}>
                                            {timeAgo(lead.createdAt)}
                                        </td>
                                    )}
                                    {columns.tags && (
                                        <td className="p-5">
                                            <div className="flex flex-wrap gap-1">
                                                {(lead.tags || []).slice(0, 3).map(t => (
                                                    <span key={t} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">{t}</span>
                                                ))}
                                            </div>
                                        </td>
                                    )}
                                    <td className="p-5">
                                        <Link to={`/leads/${lead.id}`} className={cn(
                                            "font-medium text-sm transition-all transform inline-block",
                                            theme === 'light' ? "text-blue-500 hover:text-blue-600" : "text-blue-400 hover:text-blue-300",
                                            "opacity-60 group-hover:opacity-100 group-hover:translate-x-1"
                                        )}>
                                            View
                                        </Link>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className={cn("flex items-center justify-between px-4 py-3 border-t text-xs",
                    theme === 'light' ? 'border-slate-200 bg-slate-50/40' : 'border-slate-700/40 bg-slate-800/30'
                )}>
                    <div className={cn("opacity-70", getTextColor())}>
                        Showing <span className="font-bold">{(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, sortedLeads.length)}</span> of <span className="font-bold">{sortedLeads.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <select value={pageSize} onChange={e => setPageSize(parseInt(e.target.value, 10))}
                            className={cn("rounded px-2 py-1 border text-xs", theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-600/50 text-white')}>
                            {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}/page</option>)}
                        </select>
                        <button disabled={safePage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className={cn("p-1.5 rounded border", safePage <= 1 ? 'opacity-30' : 'hover:bg-blue-500/10', theme === 'light' ? 'border-slate-200' : 'border-slate-600/50')}>
                            <ChevronLeft size={14} />
                        </button>
                        <span className={cn("font-mono", getTextColor())}>{safePage} / {totalPages}</span>
                        <button disabled={safePage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className={cn("p-1.5 rounded border", safePage >= totalPages ? 'opacity-30' : 'hover:bg-blue-500/10', theme === 'light' ? 'border-slate-200' : 'border-slate-600/50')}>
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            </Card>

            <div className="md:hidden space-y-4 pb-32">
                {pagedLeads.map(lead => (
                    <MobileLeadCard
                        key={lead.id}
                        lead={lead}
                        onStatusChange={updateLeadStatus}
                    />
                ))}
            </div>
        </>
      )}

      <button
        onClick={handleOpenModal}
        className="md:hidden fixed bottom-24 right-6 h-14 w-14 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center z-50 hover:scale-105 active:scale-95 transition-all"
        aria-label="Add Lead"
      >
        <Plus size={28} />
      </button>

      {/* Modal is kept separate below to avoid nesting issues */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Lead">
        <form onSubmit={handleAddLead} className="space-y-5">
            {/* ... Modal content matches exactly previous version ... */}
            <div className="space-y-2">
                 <label className={cn("text-xs font-bold uppercase tracking-wider opacity-60", getTextColor())}>Service Requirements</label>
                 <ServiceSelector 
                    selectedServices={newLeadServices}
                    onChange={setNewLeadServices}
                 />
            </div>

            <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                    <label className={cn("text-xs font-bold uppercase tracking-wider opacity-60", getTextColor())}>Client Name</label>
                    <input name="name" required className={inputClasses} placeholder="John Doe" />
                </div>
                <div className="space-y-1.5">
                    <label className={cn("text-xs font-bold uppercase tracking-wider opacity-60", getTextColor())}>Source</label>
                    <select name="source" className={cn(inputClasses, "[&>option]:text-black")}>
                        <option value="Instagram">Instagram</option>
                        <option value="Walk-in">Walk-in</option>
                        <option value="Referral">Referral</option>
                        <option value="Website">Website</option>
                    </select>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                    <label className={cn("text-xs font-bold uppercase tracking-wider opacity-60", getTextColor())}>Phone</label>
                    <input name="phone" defaultValue="+91 " className={inputClasses} placeholder="+91 ..." />
                </div>
                <div className="space-y-1.5">
                    <label className={cn("text-xs font-bold uppercase tracking-wider opacity-60", getTextColor())}>Email <span className="text-[10px] opacity-50 font-normal normal-case ml-1">(Optional)</span></label>
                    <input name="email" type="email" className={inputClasses} placeholder="email@example.com" />
                </div>
            </div>

            <div className={cn("p-4 rounded-xl border border-dashed space-y-3", getBorderClass(), theme === 'light' ? 'bg-slate-50' : theme === 'ocean' ? 'bg-blue-950/40' : 'bg-slate-800/40')}>
                <p className={cn("text-xs font-bold uppercase tracking-wide opacity-50", getTextColor())}>Trip Details</p>
                
                <div className="space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-1">
                            <label className={cn("text-[10px] font-bold uppercase opacity-60", getTextColor())}>Destination</label>
                            <input name="destination" required placeholder="Where to?" className={cn("w-full bg-transparent border-b p-2 outline-none text-base transition-colors", getBorderClass(), "focus:border-blue-500", getTextColor())} />
                         </div>
                         <div className="space-y-1">
                            <label className={cn("text-[10px] font-bold uppercase opacity-60", getTextColor())}>Start Date</label>
                            <input name="startDate" type="date" required className={cn("w-full bg-transparent border-b p-2 outline-none text-base transition-colors", getBorderClass(), "focus:border-blue-500", getTextColor())} />
                         </div>
                     </div>
                     
                     <PaxSelector value={newLeadPax} onChange={setNewLeadPax} />
                     
                     <div className="pt-2">
                        <TravelPreferences value={newLeadPrefs} onChange={setNewLeadPrefs} />
                     </div>

                     <div className="space-y-1">
                        <label className={cn("text-[10px] font-bold uppercase opacity-60", getTextColor())}>Total Budget</label>
                        <input name="budget" type="number" placeholder="Budget (₹) - Optional" className={cn("w-full bg-transparent border-b p-2 outline-none text-lg font-mono transition-colors", getBorderClass(), "focus:border-blue-500", getTextColor())} />
                     </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
                 <div className="space-y-1.5">
                    <label className={cn("text-xs font-bold uppercase tracking-wider opacity-60", getTextColor())}>Temperature</label>
                    <select name="temperature" className={cn(inputClasses, "[&>option]:text-black")}>
                        <option value="Hot">Hot (Ready to buy)</option>
                        <option value="Warm">Warm (Interested)</option>
                        <option value="Cold">Cold (Future)</option>
                    </select>
                </div>
                 <div className="space-y-1.5">
                    <label className={cn("text-xs font-bold uppercase tracking-wider opacity-60", getTextColor())}>Reference Name</label>
                    <input name="reference" className={inputClasses} placeholder="Optional" />
                </div>
                {user?.role === 'admin' && (
                    <div className="space-y-1.5 col-span-2">
                        <label className={cn("text-xs font-bold uppercase tracking-wider opacity-60", getTextColor())}>Assign To</label>
                        <select name="assignedTo" className={cn(inputClasses, "[&>option]:text-black")}>
                            <option value="Unassigned">Unassigned</option>
                            {/* Assuming users are available here via context, but we need to pass them or access context */}
                            <option value={user.name}>Me ({user.name})</option>
                        </select>
                    </div>
                )}
            </div>

            <div className="pt-4 flex justify-between items-center border-t border-gray-500/10 relative">
                 <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".csv" 
                    onChange={handleFileUpload}
                 />
                 
                 <div className="flex flex-col gap-1">
                    <div 
                        className={cn("text-xs font-medium flex items-center gap-2 cursor-pointer transition-colors px-3 py-2 rounded-lg border border-dashed hover:bg-blue-500/10", getTextColor(), getBorderClass())}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                    >
                        <UploadCloud size={16} className="text-blue-500" /> 
                        <span>Import CSV</span>
                    </div>
                    <button 
                        type="button" 
                        onClick={downloadSampleCsv} 
                        className={cn("text-[10px] opacity-50 hover:opacity-100 flex items-center gap-1 ml-1", getSecondaryTextColor())}
                    >
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
