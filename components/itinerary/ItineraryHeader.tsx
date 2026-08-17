
import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../utils/helpers';
import { Calendar, Users, Car, Settings, ChevronLeft, RotateCcw, UserCheck, Search, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { FleetItem } from './types';
import { getVehicleString } from './utils';
import { supabase } from '../../lib/supabase';

interface ItineraryHeaderProps {
  startDate: string;
  setStartDate: (date: string) => void;
  pax: number;
  setPax: (pax: number) => void;
  fleet: FleetItem[];
  onOpenFleetModal: () => void;
  guestName: string;
  setGuestName: (name: string) => void;
  onBack: () => void;
  onUpdateRates?: () => void;
}

interface LeadOption {
  id: string;
  name: string;
  pax: number;
  startDate: string;
  status: string;
}

export const ItineraryHeader: React.FC<ItineraryHeaderProps> = ({
  startDate, setStartDate, pax, setPax, fleet, onOpenFleetModal,
  guestName, setGuestName, onBack, onUpdateRates
}) => {
  const { theme, getTextColor, getInputClass } = useTheme();
  const [showLeadPicker, setShowLeadPicker] = useState(false);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [leadSearch, setLeadSearch] = useState('');
  const [leadsLoading, setLeadsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowLeadPicker(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const openLeadPicker = async () => {
    setShowLeadPicker(true);
    setLeadSearch('');
    if (leads.length > 0) return;
    setLeadsLoading(true);
    try {
      const { data } = await supabase
        .from('leads')
        .select('id, name, status, trip_details')
        .in('status', ['New', 'Contacted', 'Proposal Sent', 'Discussion'])
        .order('created_at', { ascending: false })
        .limit(60);

      const mapped: LeadOption[] = (data || []).map((l: any) => {
        const td = l.trip_details || {};
        const pc = td.paxConfig || td.pax_config || {};
        return {
          id: l.id,
          name: l.name || 'Unknown',
          pax: (pc.adults || pc.Adults || 2),
          startDate: td.startDate || td.start_date || '',
          status: l.status || '',
        };
      });
      setLeads(mapped);
    } catch (_) {}
    setLeadsLoading(false);
  };

  const selectLead = (lead: LeadOption) => {
    setGuestName(lead.name);
    if (lead.pax >= 2) setPax(lead.pax);
    if (lead.startDate) setStartDate(lead.startDate);
    setShowLeadPicker(false);
  };

  const filtered = leads.filter(l =>
    l.name.toLowerCase().includes(leadSearch.toLowerCase())
  );

  const statusColor: Record<string, string> = {
    'New': 'bg-blue-100 text-blue-700',
    'Contacted': 'bg-purple-100 text-purple-700',
    'Proposal Sent': 'bg-amber-100 text-amber-700',
    'Discussion': 'bg-orange-100 text-orange-700',
  };

  return (
    <div className={cn(
      // relative + z-10 ensures dropdown escapes the overflow-auto scroll container's stacking context
      // Double-bezel: outer shell + inner white card with inset highlight
      "relative z-10 p-[1.5px] rounded-[1.375rem] transition-colors",
      theme === 'light'
        ? "bg-gradient-to-br from-slate-200/80 to-slate-100/30 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.05),0_12px_32px_-6px_rgba(15,23,42,0.08)]"
        : "bg-white/10 shadow-lg"
    )}>
      {/* Inner core */}
      <div className={cn(
        'flex flex-col gap-4 p-4 md:p-5 rounded-[calc(1.375rem-1.5px)] transition-colors',
        theme === 'light' ? 'bg-white shadow-[inset_0_1px_0_rgba(255,255,255,1)]' : 'bg-slate-900'
      )}>
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className={cn("flex items-center gap-1.5 text-sm font-bold transition-all duration-300 hover:-translate-x-0.5", theme === 'light' ? "text-slate-400 hover:text-slate-700" : "text-white/50 hover:text-white")}
        >
          <ChevronLeft size={15} /> Change Destination
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 md:items-end">
        <div className="space-y-1.5">
          <label className="text-[10px] md:text-xs font-bold uppercase tracking-wider opacity-60">Start Date</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={cn("pl-10 pr-4 py-2.5 rounded-xl border w-full font-medium text-sm", getInputClass())}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] md:text-xs font-bold uppercase tracking-wider opacity-60">Travelers (Pax)</label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <select
              value={pax}
              onChange={(e) => setPax(Number(e.target.value))}
              className={cn("pl-10 pr-8 py-2.5 rounded-xl border w-full font-medium text-sm appearance-none", getInputClass())}
            >
              {[2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20].map(n => <option key={n} value={n}>{n} Pax</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] md:text-xs font-bold uppercase tracking-wider opacity-60">Transport</label>
          <button
            onClick={onOpenFleetModal}
            className={cn(
              "flex items-center justify-between w-full px-4 py-2.5 rounded-xl border text-left transition-all",
              theme === 'light' ? 'bg-white border-slate-200 hover:border-blue-400' : 'bg-white/5 border-white/10 hover:border-white/30'
            )}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <Car size={16} className="opacity-50 shrink-0" />
              <span className={cn("text-sm font-bold truncate", getTextColor())}>{getVehicleString(fleet)}</span>
            </div>
            <Settings size={14} className="opacity-40 shrink-0" />
          </button>
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <label className="text-[10px] md:text-xs font-bold uppercase tracking-wider opacity-60">Guest Name</label>
          <div className="flex gap-2 relative" ref={dropdownRef}>
            {/* Lead picker button */}
            <button
              onClick={openLeadPicker}
              title="Pick from existing leads"
              className={cn(
                "px-3 py-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold shrink-0 transition-all",
                showLeadPicker
                  ? "bg-blue-600 text-white border-blue-600"
                  : theme === 'light'
                    ? "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
                    : "bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30"
              )}
            >
              <UserCheck size={14} />
              <span className="hidden lg:inline">Lead</span>
            </button>

            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Guest name..."
              className={cn("px-4 py-2.5 rounded-xl border w-full font-medium text-sm", getInputClass())}
            />
            <Button onClick={onUpdateRates} className="bg-slate-900 text-white shrink-0 px-4">
              <RotateCcw size={16} className="mr-2" />
              <span className="hidden md:inline">Update Rates</span>
              <span className="md:hidden">Update</span>
            </Button>

            {/* Lead Picker Dropdown */}
            {showLeadPicker && (
              <div className={cn(
                "absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-2xl z-[200] overflow-hidden",
                theme === 'light' ? "bg-white border-slate-200" : "bg-slate-800 border-white/10"
              )}>
                <div className={cn("flex items-center gap-2 p-2 border-b", theme === 'light' ? "border-slate-100" : "border-white/10")}>
                  <Search size={13} className="opacity-40 shrink-0" />
                  <input
                    autoFocus
                    value={leadSearch}
                    onChange={(e) => setLeadSearch(e.target.value)}
                    placeholder="Search leads..."
                    className="text-sm flex-1 bg-transparent outline-none font-medium"
                  />
                  <button onClick={() => setShowLeadPicker(false)}><X size={13} className="opacity-40 hover:opacity-70" /></button>
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {leadsLoading && (
                    <div className="p-3 text-xs text-center opacity-50">Loading leads...</div>
                  )}
                  {!leadsLoading && filtered.length === 0 && (
                    <div className="p-3 text-xs text-center opacity-50">No active leads found</div>
                  )}
                  {filtered.map(lead => (
                    <button
                      key={lead.id}
                      onClick={() => selectLead(lead)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-blue-50 transition-colors",
                        theme === 'dark' && "hover:bg-white/5"
                      )}
                    >
                      <div>
                        <div className={cn("text-sm font-bold", getTextColor())}>{lead.name}</div>
                        <div className="text-[10px] opacity-50 mt-0.5">
                          {lead.pax} pax{lead.startDate ? ` · ${lead.startDate}` : ''}
                        </div>
                      </div>
                      <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded uppercase", statusColor[lead.status] || 'bg-slate-100 text-slate-600')}>
                        {lead.status}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </div> {/* end inner core */}
    </div>
  );
};
