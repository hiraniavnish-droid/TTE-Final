
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { cn, generateId, formatCurrency } from '../../utils/helpers';
import { Package, Hotel as HotelIcon, Camera, Zap, ChevronLeft, MapPin } from 'lucide-react';
import { GUJARAT_HOTELS, GUJARAT_SIGHTSEEING, GUJARAT_VEHICLES, GUJARAT_PACKAGES, GUJARAT_CITIES } from './gujaratConstants';
import { GujaratPackageFlow } from './GujaratPackageFlow';
import { HotelRateManager } from './HotelRateManager';
import { SightseeingManager } from './SightseeingManager';
import { QuickQuote } from './QuickQuote';
import { Hotel, Sightseeing } from '../../types';

type Tab = 'packages' | 'hotels' | 'sightseeing' | 'quick-quote';

const TABS: { id: Tab; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'packages', label: 'Packages', icon: <Package size={16} />, desc: 'Browse & build packages' },
  { id: 'hotels', label: 'Hotel Rates', icon: <HotelIcon size={16} />, desc: 'Manage hotel inventory' },
  { id: 'sightseeing', label: 'Sightseeing', icon: <Camera size={16} />, desc: 'Manage attractions' },
  { id: 'quick-quote', label: 'Quick Quote', icon: <Zap size={16} />, desc: 'Fast estimates' },
];

export const GujaratDmcConsole: React.FC = () => {
  const navigate = useNavigate();
  const { theme, getTextColor } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>('packages');

  // Shared mutable data (starts from constants, can be edited in Hotel/Sightseeing managers)
  const [hotelData, setHotelData] = useState<Record<string, Hotel[]>>(
    () => JSON.parse(JSON.stringify(GUJARAT_HOTELS))
  );
  const [sightseeingData, setSightseeingData] = useState<Record<string, Sightseeing[]>>(
    () => JSON.parse(JSON.stringify(GUJARAT_SIGHTSEEING))
  );

  return (
    <div className="fixed top-0 bottom-0 right-0 left-0 md:left-64 z-30 flex flex-col overflow-hidden transition-all duration-300 animate-in fade-in bg-slate-50">

      {/* --- TOP BAR --- */}
      <div className={cn(
        "shrink-0 border-b backdrop-blur-xl px-4 md:px-6 py-3",
        theme === 'light' ? "bg-white/95 border-slate-200" : "bg-slate-900/95 border-white/10"
      )}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/builder')}
              className={cn("flex items-center gap-1.5 text-xs font-bold transition-all hover:-translate-x-1", theme === 'light' ? "text-slate-400 hover:text-slate-700" : "text-white/50 hover:text-white")}
            >
              <ChevronLeft size={14} /> Hub
            </button>
            <div className="w-px h-5 bg-slate-200" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                <MapPin size={16} />
              </div>
              <div>
                <h1 className={cn("text-lg font-bold font-serif leading-tight", getTextColor())}>Gujarat DMC Console</h1>
                <p className="text-[10px] text-slate-400 font-medium">9 Destinations &bull; Full Package Management</p>
              </div>
            </div>
          </div>
        </div>

        {/* --- TAB BAR --- */}
        <div className="flex gap-1 overflow-x-auto hide-scrollbar">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200 shadow-sm"
                  : theme === 'light'
                    ? "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    : "text-white/50 hover:bg-white/10 hover:text-white"
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span className={cn("hidden md:inline text-[10px] font-medium", activeTab === tab.id ? "text-amber-500" : "opacity-50")}>{tab.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* --- TAB CONTENT --- */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'packages' && (
          <GujaratPackageFlow
            hotelData={hotelData}
            sightseeingData={sightseeingData}
            vehicleData={GUJARAT_VEHICLES}
            packages={GUJARAT_PACKAGES}
            onBack={() => navigate('/builder')}
          />
        )}
        {activeTab === 'hotels' && (
          <HotelRateManager
            hotelData={hotelData}
            setHotelData={setHotelData}
          />
        )}
        {activeTab === 'sightseeing' && (
          <SightseeingManager
            sightseeingData={sightseeingData}
            setSightseeingData={setSightseeingData}
          />
        )}
        {activeTab === 'quick-quote' && (
          <QuickQuote hotelData={hotelData} />
        )}
      </div>
    </div>
  );
};
