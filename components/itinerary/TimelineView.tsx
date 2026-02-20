
import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn, useRoomCalculator } from '../../utils/helpers';
import { Car, Settings, PlaneLanding, PlaneTakeoff, RefreshCw, Check, Utensils, Hotel as HotelIcon, ChevronDown } from 'lucide-react';
import { Button } from '../ui/Button';
import { Hotel, ItineraryPackage, RoomType, Sightseeing, Vehicle } from '../../types';
import { FleetItem } from './types';
import { FALLBACK_IMG, getMealPlanLabel, getSmartDate } from './utils';

interface TimelineViewProps {
  activePackage: ItineraryPackage;
  startDate: string;
  pax: number;
  fleet: FleetItem[];
  hotelOverrides: Record<number, { hotel: Hotel, roomType: RoomType }>;
  sightseeingOverrides: Record<number, string[]>;
  baseTier: 'Budget' | 'Premium';
  onSwapHotel: (dayIndex: number, city: string) => void;
  onUpdateRoomType: (dayIndex: number, hotel: Hotel, roomType: RoomType) => void; 
  onOpenFleetModal: () => void;
  hotelData: Record<string, Hotel[]>;
  sightseeingData: Record<string, Sightseeing[]>;
  vehicleData: Vehicle[];
}

export const TimelineView: React.FC<TimelineViewProps> = ({ 
    activePackage, startDate, pax, fleet, hotelOverrides, sightseeingOverrides, 
    baseTier, onSwapHotel, onUpdateRoomType, onOpenFleetModal, 
    hotelData, sightseeingData, vehicleData
}) => {
  const { theme, getTextColor } = useTheme();

  // Robust lookup: case-insensitive and whitespace trimmed
  const getVehicleImg = (name: string) => {
      const cleanName = name.toLowerCase().trim();
      const vehicle = vehicleData.find(v => v.name.toLowerCase().trim() === cleanName);
      // Ensure we use the fallback logic from the hook
      if (vehicle?.img) {
          // Append simple cache buster if it's a valid URL to prevent stale images
          return `${vehicle.img}`; 
      }
      return "";
  };

  return (
    <div className="relative border-l-2 border-slate-200 ml-2 md:ml-4 space-y-8 md:space-y-12 pb-10">
        {/* --- TRANSPORT CARD --- */}
        <div className="mb-8 pl-6 md:pl-8 relative animate-in fade-in slide-in-from-left-4 duration-500">
            <div className={cn(
                "absolute -left-[9px] top-6 w-4 h-4 rounded-full border-4 shadow-sm z-10 bg-indigo-500 border-white"
            )} />
            <div className={cn("p-4 md:p-5 rounded-2xl border shadow-sm", theme === 'light' ? "bg-white border-slate-200" : "bg-white/5 border-white/10")}>
                <div className="flex items-center justify-between mb-4 border-b border-dashed border-slate-200 pb-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                            <Car size={20} />
                        </div>
                        <div>
                            <h3 className={cn("text-base md:text-lg font-bold font-serif", getTextColor())}>Transport</h3>
                            <p className="text-[10px] md:text-xs opacity-60">Allocated for entire trip</p>
                        </div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={onOpenFleetModal}>
                        <Settings size={14} /> <span className="hidden md:inline ml-1">Configure</span>
                    </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    {fleet.map((vehicle) => (
                        <div key={vehicle.id} className="flex gap-3 p-2 rounded-xl border bg-slate-50/50 hover:bg-slate-50 transition-colors group">
                            <div className="w-16 h-12 md:w-20 md:h-14 shrink-0 rounded-lg overflow-hidden relative shadow-sm border border-white bg-slate-200">
                                <img 
                                    src={getVehicleImg(vehicle.name) || FALLBACK_IMG} 
                                    onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                                    alt={vehicle.name || "Vehicle Image"} 
                                />
                            </div>
                            <div className="flex flex-col justify-center min-w-0">
                                <span className={cn("font-bold text-sm truncate", getTextColor())}>{vehicle.name}</span>
                                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-0.5">AC Vehicle</span>
                                <span className="text-xs px-1.5 py-0.5 rounded bg-white border shadow-sm w-fit font-mono font-bold mt-1 text-indigo-600">
                                    Qty: {vehicle.count}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* --- DAY LOOPS --- */}
        {activePackage.route.map((city, index) => {
            const override = hotelOverrides[index];
            
            // Resolve Defaults if no override
            let currentHotel: Hotel | undefined;
            let currentRoom: RoomType | undefined;

            if (override) {
                currentHotel = override.hotel;
                currentRoom = override.roomType;
            } else {
                const cityHotels = hotelData[city] || [];
                currentHotel = cityHotels.find(h => h.tier === baseTier) || cityHotels[0];
                if (currentHotel) {
                    currentRoom = currentHotel.roomTypes[0]; // Default to first room type
                }
            }

            const mealPlanLabel = currentHotel ? getMealPlanLabel(currentHotel.type) : 'No Meals';
            const roomCount = currentRoom ? useRoomCalculator(pax, currentRoom.capacity) : 0;
            
            // Sightseeing
            const dayOverrides = sightseeingOverrides[index];
            const allSightseeing = sightseeingData[city] || [];
            const sights = dayOverrides 
                ? allSightseeing.filter(s => dayOverrides.includes(s.name))
                : allSightseeing;

            const isFirstDay = index === 0;
            const isLastDay = index === activePackage.route.length - 1;

            return (
                <div key={index} className="relative pl-6 md:pl-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Timeline Dot */}
                    <div className={cn(
                        "absolute -left-[9px] top-0 w-4 h-4 rounded-full border-4 shadow-sm z-10",
                        isFirstDay ? "bg-blue-500 border-white" : "bg-slate-300 border-white"
                    )} />
                    
                    <div className="flex flex-col gap-4">
                        {/* Day Header with SMART DATE */}
                        <div>
                            <h3 className={cn("text-lg md:text-xl font-bold font-serif flex items-center gap-2", getTextColor())}>
                                <span className="opacity-50">Day {index + 1}</span>
                                <span className="mx-1 opacity-30">•</span>
                                <span>{getSmartDate(startDate, index)}</span>
                            </h3>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className={cn("text-base md:text-lg font-bold text-slate-700", getTextColor())}>{city}</span>
                                {isFirstDay && <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200 uppercase tracking-wider">Arrival</span>}
                                {isLastDay && <span className="text-[9px] font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded border border-orange-200 uppercase tracking-wider">Departure</span>}
                            </div>
                            {isFirstDay && <p className="text-[10px] md:text-xs text-blue-600 flex items-center gap-1 mt-1 font-medium"><PlaneLanding size={12}/> Pickup from Bhuj</p>}
                            {isLastDay && <p className="text-[10px] md:text-xs text-orange-600 flex items-center gap-1 mt-1 font-medium"><PlaneTakeoff size={12}/> Drop at Bhuj</p>}
                        </div>

                        {/* Hotel Card */}
                        {!isLastDay && currentHotel && currentRoom && (
                            <div className={cn("group relative rounded-xl border overflow-hidden transition-all hover:shadow-md", theme === 'light' ? "bg-white border-slate-200" : "bg-white/5 border-white/10")}>
                                <div className="flex flex-col sm:flex-row">
                                    {/* Mobile: Image is a banner on top. Desktop: Side image. */}
                                    <div className="h-32 sm:h-auto sm:w-48 relative shrink-0 bg-slate-200">
                                        <img 
                                            src={currentHotel.img || FALLBACK_IMG} 
                                            onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }}
                                            alt={currentHotel.name || "Hotel Image"} 
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                                        />
                                        <div className="absolute inset-0 bg-black/10" />
                                        <div className="absolute bottom-2 left-2 sm:hidden">
                                            <span className={cn("text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider backdrop-blur-md border border-white/20 text-white bg-black/30")}>
                                                {currentHotel.tier}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="p-4 flex-1 flex flex-col justify-center">
                                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h4 className={cn("font-bold text-base md:text-lg truncate", getTextColor())}>{currentHotel.name}</h4>
                                                    <span className={cn("hidden sm:inline-block text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider", currentHotel.tier === 'Premium' ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600")}>
                                                        {currentHotel.tier}
                                                    </span>
                                                </div>
                                                
                                                <div className="flex flex-col gap-2 mt-2">
                                                    {/* ROOM TYPE SELECTOR (Responsive) */}
                                                    <div className="flex items-center gap-2">
                                                        <HotelIcon size={14} className="opacity-50 shrink-0" />
                                                        <div className="relative flex-1 sm:flex-none">
                                                            <select
                                                                value={currentRoom.name}
                                                                onChange={(e) => {
                                                                    const newRoom = currentHotel?.roomTypes.find(r => r.name === e.target.value);
                                                                    if (newRoom && currentHotel) onUpdateRoomType(index, currentHotel, newRoom);
                                                                }}
                                                                className={cn(
                                                                    "w-full sm:w-auto text-xs font-bold bg-transparent outline-none cursor-pointer border-b border-dashed border-slate-300 hover:border-blue-500 hover:text-blue-600 transition-colors py-1 pr-4 appearance-none", 
                                                                    getTextColor()
                                                                )}
                                                            >
                                                                {currentHotel.roomTypes.map(r => (
                                                                    <option key={r.name} value={r.name}>{r.name} (Max {r.capacity})</option>
                                                                ))}
                                                            </select>
                                                            <ChevronDown size={10} className="absolute right-0 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none" />
                                                        </div>
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 border text-slate-500 whitespace-nowrap">
                                                            {roomCount} Rms
                                                        </span>
                                                    </div>

                                                    <p className="text-xs font-medium text-emerald-600 flex items-center gap-1"><Utensils size={12}/> {mealPlanLabel}</p>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => onSwapHotel(index, city)}
                                                className="text-[10px] text-blue-500 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 border border-blue-100 mt-1 sm:mt-0 w-full sm:w-auto"
                                            >
                                                <RefreshCw size={10} /> Change Hotel
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Included Sightseeing (Horizontal Scroll) */}
                        {sights.length > 0 ? (
                            <div className="mt-1">
                                <div className="flex items-center gap-2 mb-2 opacity-80">
                                    <Check size={12} className="text-green-500" />
                                    <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-slate-500">Included Sightseeing</span>
                                </div>
                                <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar snap-x -mr-4 pr-4 md:mr-0 md:pr-0">
                                    {sights.map((spot, i) => (
                                        <div key={i} className="min-w-[140px] w-[140px] snap-center">
                                            <div className="aspect-video rounded-lg overflow-hidden mb-1.5 relative group shadow-sm border border-slate-100 bg-slate-200">
                                                <img 
                                                    src={spot.img || FALLBACK_IMG} 
                                                    onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }}
                                                    alt={spot.name || "Sightseeing Image"} 
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                            <h5 className={cn("font-bold text-xs truncate leading-tight", getTextColor())}>{spot.name}</h5>
                                            <p className="text-[9px] opacity-60 line-clamp-1 mt-0.5">{spot.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            dayOverrides && dayOverrides.length === 0 && (
                                <div className="mt-2 text-xs opacity-40 italic pl-1">No sightseeing selected for this day.</div>
                            )
                        )}
                    </div>
                </div>
            );
        })}
    </div>
  );
};
