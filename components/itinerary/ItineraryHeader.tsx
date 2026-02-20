
import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../utils/helpers';
import { Calendar, Users, Car, Settings, ChevronLeft, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';
import { FleetItem } from './types';
import { getVehicleString } from './utils';

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

export const ItineraryHeader: React.FC<ItineraryHeaderProps> = ({ 
  startDate, setStartDate, pax, setPax, fleet, onOpenFleetModal, 
  guestName, setGuestName, onBack, onUpdateRates 
}) => {
  const { theme, getTextColor, getInputClass } = useTheme();

  return (
    <div className={cn(
        "flex flex-col gap-4 p-4 md:p-6 rounded-2xl shadow-sm border backdrop-blur-md transition-colors",
        theme === 'light' ? "bg-white/90 border-slate-200" : "bg-slate-900/90 border-white/10"
    )}>
        <div className="flex items-center justify-between">
            <button 
                onClick={onBack}
                className={cn("flex items-center gap-2 text-sm font-bold transition-all hover:-translate-x-1", theme === 'light' ? "text-slate-500 hover:text-slate-800" : "text-white/60 hover:text-white")}
            >
                <ChevronLeft size={16} /> Change Destination
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
                        {[2,3,4,5,6,7,8,9,10,12,14,16,18,20].map(n => <option key={n} value={n}>{n} Pax</option>)}
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
                        <span className={cn("text-sm font-bold truncate", getTextColor())}>
                            {getVehicleString(fleet)}
                        </span>
                    </div>
                    <Settings size={14} className="opacity-40 shrink-0" />
                </button>
            </div>

            <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] md:text-xs font-bold uppercase tracking-wider opacity-60">Guest Name</label>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Name"
                        className={cn("px-4 py-2.5 rounded-xl border w-full font-medium text-sm", getInputClass())} 
                    />
                    <Button onClick={onUpdateRates} className="bg-slate-900 text-white shrink-0 px-4">
                        <RotateCcw size={16} className="mr-2" />
                        Update Rates
                    </Button>
                </div>
            </div>
        </div>
    </div>
  );
};
