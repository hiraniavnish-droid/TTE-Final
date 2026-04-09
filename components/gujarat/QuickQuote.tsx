
import React, { useState, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn, formatCurrency } from '../../utils/helpers';
import { Zap, Copy, Check, MapPin, Moon, Users, Calculator } from 'lucide-react';
import { Button } from '../ui/Button';
import { Hotel } from '../../types';
import { GUJARAT_CITIES, GUJARAT_VEHICLES } from './gujaratConstants';
import toast from 'react-hot-toast';

interface QuickQuoteProps {
  hotelData: Record<string, Hotel[]>;
}

interface CityNight {
  city: string;
  nights: number;
}

export const QuickQuote: React.FC<QuickQuoteProps> = ({ hotelData }) => {
  const { theme, getTextColor, getInputClass } = useTheme();
  const [selectedCities, setSelectedCities] = useState<CityNight[]>([]);
  const [pax, setPax] = useState(2);
  const [tier, setTier] = useState<'Budget' | 'Premium'>('Budget');
  const [copyFeedback, setCopyFeedback] = useState(false);

  const toggleCity = (city: string) => {
    setSelectedCities(prev => {
      const exists = prev.find(c => c.city === city);
      if (exists) return prev.filter(c => c.city !== city);
      return [...prev, { city, nights: 1 }];
    });
  };

  const updateNights = (city: string, nights: number) => {
    setSelectedCities(prev => prev.map(c => c.city === city ? { ...c, nights: Math.max(1, nights) } : c));
  };

  const totalNights = useMemo(() => selectedCities.reduce((sum, c) => sum + c.nights, 0), [selectedCities]);
  const totalDays = totalNights + 1;

  const estimate = useMemo(() => {
    if (selectedCities.length === 0) return null;

    let hotelCost = 0;
    selectedCities.forEach(({ city, nights }) => {
      const cityHotels = hotelData[city] || [];
      const hotel = cityHotels.find(h => h.tier === tier) || cityHotels[0];
      if (hotel) {
        const room = hotel.roomTypes[0];
        if (room) {
          const roomsNeeded = Math.ceil(pax / room.capacity);
          hotelCost += room.rate * roomsNeeded * nights;
        }
      }
    });

    // Vehicle estimate
    let vehicleRate = 3600; // Sedan default
    if (pax > 4 && pax <= 7) vehicleRate = 5100; // Innova
    else if (pax > 7) vehicleRate = 8700; // Tempo
    const vehicleCost = vehicleRate * Math.ceil(pax / (pax <= 4 ? 4 : pax <= 7 ? 7 : 12)) * totalDays;

    const total = hotelCost + vehicleCost;
    return { hotelCost, vehicleCost, total, perPerson: Math.round(total / pax) };
  }, [selectedCities, pax, tier, hotelData, totalDays]);

  const handleCopy = async () => {
    if (!estimate || selectedCities.length === 0) return;

    const route = selectedCities.map(c => `${c.city} (${c.nights}N)`).join(' → ');
    let text = `⚡ *Quick Estimate - Gujarat Package*\n\n`;
    text += `📍 *Route:* ${route}\n`;
    text += `⏳ *Duration:* ${totalNights}N / ${totalDays}D\n`;
    text += `👥 *Pax:* ${pax} Adults\n`;
    text += `🏨 *Category:* ${tier}\n\n`;
    text += `💰 *Estimated Total:* ${formatCurrency(estimate.total)}\n`;
    text += `👤 *Per Person:* ${formatCurrency(estimate.perPerson)}\n\n`;
    text += `_Note: This is an approximate estimate. Final pricing may vary based on hotel availability and specific dates._\n\n`;
    text += `— THE TOURISM EXPERTS`;

    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Heading */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-amber-50 text-amber-600 mb-3 ring-1 ring-amber-100">
            <Zap size={24} />
          </div>
          <h2 className={cn("text-2xl font-bold font-serif", getTextColor())}>Quick Quote</h2>
          <p className="text-xs opacity-50 mt-1">Select cities, set nights & pax — get an instant estimate</p>
        </div>

        {/* City Selection */}
        <div className={cn("p-5 rounded-2xl border", theme === 'light' ? "bg-white border-slate-200" : "bg-white/5 border-white/10")}>
          <h3 className="text-xs font-bold uppercase tracking-wider opacity-50 mb-3 flex items-center gap-2"><MapPin size={12} /> Select Cities</h3>
          <div className="flex flex-wrap gap-2">
            {GUJARAT_CITIES.map(city => {
              const selected = selectedCities.find(c => c.city === city);
              return (
                <button
                  key={city}
                  onClick={() => toggleCity(city)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                    selected
                      ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20 ring-2 ring-amber-300"
                      : theme === 'light'
                        ? "bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700"
                        : "bg-white/10 text-white/60 hover:bg-white/20"
                  )}
                >
                  {city}
                </button>
              );
            })}
          </div>
        </div>

        {/* Nights per city */}
        {selectedCities.length > 0 && (
          <div className={cn("p-5 rounded-2xl border", theme === 'light' ? "bg-white border-slate-200" : "bg-white/5 border-white/10")}>
            <h3 className="text-xs font-bold uppercase tracking-wider opacity-50 mb-3 flex items-center gap-2"><Moon size={12} /> Nights Per City</h3>
            <div className="space-y-3">
              {selectedCities.map(({ city, nights }) => (
                <div key={city} className="flex items-center justify-between">
                  <span className={cn("text-sm font-bold", getTextColor())}>{city}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateNights(city, nights - 1)} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm flex items-center justify-center">-</button>
                    <span className="w-8 text-center font-mono font-bold text-sm">{nights}</span>
                    <button onClick={() => updateNights(city, nights + 1)} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm flex items-center justify-center">+</button>
                    <span className="text-xs opacity-40 ml-1">night{nights !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              ))}
              <div className="border-t border-dashed border-slate-200 pt-3 flex items-center justify-between">
                <span className="text-xs font-bold opacity-50">Total</span>
                <span className={cn("text-sm font-bold", getTextColor())}>{totalNights}N / {totalDays}D</span>
              </div>
            </div>
          </div>
        )}

        {/* Pax & Tier */}
        <div className={cn("p-5 rounded-2xl border grid grid-cols-2 gap-4", theme === 'light' ? "bg-white border-slate-200" : "bg-white/5 border-white/10")}>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider opacity-50 mb-2 block flex items-center gap-1"><Users size={12} /> Travelers</label>
            <input
              type="number"
              value={pax}
              min={1}
              onChange={(e) => setPax(Math.max(1, parseInt(e.target.value) || 1))}
              className={cn("w-full px-4 py-2.5 rounded-xl border text-sm font-bold", getInputClass())}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider opacity-50 mb-2 block">Category</label>
            <div className="flex gap-2">
              {(['Budget', 'Premium'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  className={cn(
                    "flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all",
                    tier === t
                      ? t === 'Premium' ? "bg-amber-500 text-white" : "bg-slate-700 text-white"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Result */}
        {estimate && (
          <div className={cn("p-6 rounded-2xl border-2 border-amber-200 bg-amber-50/50")}>
            <div className="flex items-center gap-2 mb-4">
              <Calculator size={18} className="text-amber-600" />
              <h3 className="text-sm font-bold text-amber-800">Estimated Cost</h3>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-[10px] uppercase font-bold text-amber-600/60">Hotels</p>
                <p className="text-lg font-mono font-bold text-amber-900">{formatCurrency(estimate.hotelCost)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-amber-600/60">Transport</p>
                <p className="text-lg font-mono font-bold text-amber-900">{formatCurrency(estimate.vehicleCost)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-amber-600/60">Per Person</p>
                <p className="text-lg font-mono font-bold text-amber-900">{formatCurrency(estimate.perPerson)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-amber-200">
              <div>
                <p className="text-xs font-bold text-amber-600/60 uppercase">Total Estimate</p>
                <p className="text-3xl font-mono font-bold text-amber-900">{formatCurrency(estimate.total)}</p>
              </div>
              <Button variant="primary" size="sm" onClick={handleCopy}>
                {copyFeedback ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Quote</>}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
