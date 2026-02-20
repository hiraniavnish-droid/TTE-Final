
import React, { useState, useMemo, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn, formatCurrency, generateId, useRoomCalculator } from '../../utils/helpers';
import { 
  Calendar, Users, Car, User, ArrowRight, ChevronLeft, LayoutGrid, List, MapPin, BedDouble, Check, Camera, Copy, Trash2
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Hotel, RoomType, Sightseeing, Vehicle } from '../../types';
import { CustomDay, FleetItem } from './types';
import { FALLBACK_IMG, getShortMealPlan, getVehicleString } from './utils';

interface CustomBuilderProps {
    onComplete: (days: CustomDay[]) => void;
    onCancel: () => void;
    guestName: string; setGuestName: (n: string) => void;
    pax: number; setPax: (n: number) => void;
    startDate: string; setStartDate: (d: string) => void;
    fleet: FleetItem[];
    onOpenFleetModal: () => void;
    hotelData: Record<string, Hotel[]>;
    sightseeingData: Record<string, Sightseeing[]>;
    vehicleData: Vehicle[];
}

export const CustomBuilder: React.FC<CustomBuilderProps> = ({ 
    onComplete, onCancel, 
    guestName, setGuestName, 
    pax, setPax, 
    startDate, setStartDate, 
    fleet, onOpenFleetModal,
    hotelData, sightseeingData, vehicleData
}) => {
    const { theme, getTextColor, getInputClass } = useTheme();
    
    // --- Trip State ---
    const [days, setDays] = useState<CustomDay[]>([]);
    
    // --- Current Day Builder State ---
    const [city, setCity] = useState<string>('Bhuj');
    const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
    const [selectedRoomType, setSelectedRoomType] = useState<RoomType | undefined>(undefined);
    const [selectedSpots, setSelectedSpots] = useState<string[]>([]);
    const [isAllHotelsModalOpen, setIsAllHotelsModalOpen] = useState(false);
    
    // Mobile Tab State
    const [mobileTab, setMobileTab] = useState<'editor' | 'timeline'>('editor');
    
    useEffect(() => {
        setSelectedHotel(null);
        setSelectedRoomType(undefined);
        setSelectedSpots([]);
    }, [city]);

    const handleAddDay = () => {
        const newDay: CustomDay = {
            id: generateId(),
            city,
            hotel: selectedHotel,
            selectedRoomType: selectedRoomType, 
            sightseeing: selectedSpots
        };
        setDays([...days, newDay]);
        
        setSelectedHotel(null);
        setSelectedRoomType(undefined);
        setSelectedSpots([]);
    };

    const handleRemoveDay = (index: number) => {
        setDays(days.filter((_, i) => i !== index));
    };

    const handleDuplicateDay = (index: number) => {
        const dayToClone = days[index];
        const newDay = { ...dayToClone, id: generateId() };
        const newDays = [...days];
        newDays.splice(index + 1, 0, newDay);
        setDays(newDays);
    };

    const totalCost = useMemo(() => {
        let cost = 0;
        // Transport
        fleet.forEach(v => {
            const vData = vehicleData.find(vd => vd.name === v.name);
            if (vData) cost += vData.rate * v.count * (days.length || 1);
        });
        // Hotels
        days.forEach(d => {
            if (d.hotel && d.selectedRoomType) {
                const roomCount = useRoomCalculator(pax, d.selectedRoomType.capacity);
                cost += d.selectedRoomType.rate * roomCount;
            }
        });
        return cost;
    }, [days, fleet, pax, vehicleData]);

    const selectHotel = (hotel: Hotel) => {
        setSelectedHotel(hotel);
        if (hotel.roomTypes.length > 0) {
            setSelectedRoomType(hotel.roomTypes[0]); 
        }
    };

    return (
        // Changed from fixed to absolute to respect parent layout context, added z-50 to overlap everything
        <div className="absolute inset-0 z-50 bg-white flex flex-col font-sans animate-in fade-in duration-300">
            
            {/* 1. RESPONSIVE HEADER */}
            <div className="shrink-0 bg-white border-b border-slate-200 z-50">
                <div className="md:hidden flex items-center justify-between p-4 pb-2">
                    <button onClick={onCancel} className="p-2 -ml-2 text-slate-500">
                        <ChevronLeft size={24} />
                    </button>
                    <div className="text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Est.</p>
                        <p className="text-lg font-mono font-bold text-emerald-600 leading-none">{formatCurrency(totalCost)}</p>
                    </div>
                    <Button size="sm" onClick={() => onComplete(days)} disabled={days.length === 0} className="bg-slate-900 text-white">
                        Finish
                    </Button>
                </div>

                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar px-4 pb-3 md:p-4 md:h-16">
                    <button onClick={onCancel} className="hidden md:flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors mr-2">
                        <ChevronLeft size={20} />
                        <span className="font-bold text-sm">Back</span>
                    </button>
                    
                    <div className="hidden md:block h-6 w-px bg-slate-200 mx-2"></div>

                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 shrink-0">
                        <User size={14} className="text-slate-400" />
                        <input 
                            value={guestName} 
                            onChange={(e) => setGuestName(e.target.value)} 
                            className="bg-transparent text-sm font-bold w-24 outline-none text-slate-700 placeholder:text-slate-400"
                            placeholder="Guest Name"
                        />
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 shrink-0">
                        <Users size={14} className="text-slate-400" />
                        <select 
                            value={pax} 
                            onChange={(e) => setPax(Number(e.target.value))}
                            className="bg-transparent text-sm font-bold outline-none text-slate-700 cursor-pointer"
                        >
                            {[2,4,6,8,10,12,14,16].map(n => <option key={n} value={n}>{n} Pax</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 shrink-0">
                        <Calendar size={14} className="text-slate-400" />
                        <input 
                            type="date" 
                            value={startDate} 
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent text-sm font-bold outline-none text-slate-700 cursor-pointer w-28"
                        />
                    </div>

                    <button 
                        onClick={onOpenFleetModal}
                        className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-all text-left group shrink-0"
                    >
                        <Car size={14} className="text-slate-400 group-hover:text-blue-500" />
                        <span className="text-sm font-bold text-slate-700 truncate max-w-[150px]">{getVehicleString(fleet)}</span>
                    </button>

                    <div className="hidden md:flex items-center gap-4 ml-auto">
                        <div className="text-right">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Est. Cost</p>
                            <p className="text-lg font-mono font-bold text-emerald-600 leading-none">{formatCurrency(totalCost)}</p>
                        </div>
                        <Button onClick={() => onComplete(days)} disabled={days.length === 0} className="bg-slate-900 text-white px-6">
                            Finalize Trip <ArrowRight size={16} />
                        </Button>
                    </div>
                </div>
            </div>

            {/* 2. SPLIT WORKSPACE */}
            <div className="flex-1 flex overflow-hidden relative">
                
                {/* LEFT PANEL: SPEED EDITOR */}
                <div className={cn(
                    "flex flex-col border-r border-slate-200 bg-white transition-all",
                    "md:w-[70%]", 
                    mobileTab === 'editor' ? "absolute inset-0 z-10 w-full md:static" : "hidden md:flex" 
                )}>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-8 md:space-y-10 pb-32 md:pb-6">
                    
                        {/* 1. City Selection */}
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold font-serif text-slate-800 flex items-center gap-2">
                                <MapPin size={20} className="text-blue-500" /> Select Base Location
                            </h2>
                            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                                {Object.keys(hotelData).map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setCity(c)}
                                        className={cn(
                                            "px-6 py-4 rounded-2xl border-2 text-lg font-bold transition-all min-w-[140px] flex flex-col items-start gap-1 hover:scale-105",
                                            city === c 
                                                ? "border-blue-500 bg-blue-50 text-blue-700 shadow-lg shadow-blue-100" 
                                                : "border-slate-100 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
                                        )}
                                    >
                                        <span>{c}</span>
                                        <span className="text-[10px] uppercase font-normal tracking-wider opacity-60">Gujarat</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 2. Instant Hotel Cards */}
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold font-serif text-slate-800 flex items-center gap-2">
                                <BedDouble size={20} className="text-purple-500" /> Recommended Stays
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {(hotelData[city] || []).slice(0, 3).map((hotel, idx) => {
                                    const isSelected = selectedHotel?.name === hotel.name;
                                    const displayRoom = hotel.roomTypes[0];
                                    
                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => selectHotel(hotel)}
                                            className={cn(
                                                "group relative rounded-2xl overflow-hidden border-2 transition-all text-left flex flex-col cursor-pointer",
                                                isSelected 
                                                    ? "border-blue-500 ring-4 ring-blue-500/20 shadow-xl" 
                                                    : "border-transparent hover:border-slate-300 shadow-sm"
                                            )}
                                        >
                                            <div className="h-28 w-full relative bg-slate-200">
                                                <img 
                                                    src={hotel.img || FALLBACK_IMG} 
                                                    onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }}
                                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                                {isSelected && (
                                                    <div className="absolute top-2 right-2 bg-blue-500 text-white p-1 rounded-full shadow-lg">
                                                        <Check size={14} strokeWidth={3} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-3 bg-slate-50 flex-1 flex flex-col justify-between">
                                                <div>
                                                    <h4 className="font-bold text-sm text-slate-800 leading-tight line-clamp-1">{hotel.name}</h4>
                                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-1">{hotel.tier}</p>
                                                </div>
                                                
                                                {isSelected && selectedRoomType ? (
                                                    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                                                        <select 
                                                            value={selectedRoomType.name}
                                                            onChange={(e) => {
                                                                const room = hotel.roomTypes.find(r => r.name === e.target.value);
                                                                if(room) setSelectedRoomType(room);
                                                            }}
                                                            className="w-full text-xs font-bold bg-white border border-blue-300 rounded px-1 py-1 outline-none text-slate-700"
                                                        >
                                                            {hotel.roomTypes.map(r => (
                                                                <option key={r.name} value={r.name}>{r.name} (Max {r.capacity})</option>
                                                            ))}
                                                        </select>
                                                        <div className="flex justify-between items-end mt-2">
                                                            <div className="text-[10px] font-bold text-slate-500">
                                                                {useRoomCalculator(pax, selectedRoomType.capacity)} Room(s)
                                                            </div>
                                                            <span className="font-mono font-bold text-emerald-600">{formatCurrency(selectedRoomType.rate)}</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-between items-end mt-2">
                                                        <span className="text-xs font-medium text-slate-400">{getShortMealPlan(hotel.type)}</span>
                                                        <span className="font-mono font-bold text-slate-500 text-xs">From {formatCurrency(displayRoom?.rate || 0)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="text-center">
                                <button 
                                    onClick={() => setIsAllHotelsModalOpen(true)}
                                    className="text-xs font-bold text-slate-400 hover:text-blue-500 transition-colors uppercase tracking-wider"
                                >
                                    View All {hotelData[city]?.length} Hotels
                                </button>
                            </div>
                        </div>

                        {/* 3. Sightseeing Grid */}
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold font-serif text-slate-800 flex items-center gap-2">
                                <Camera size={20} className="text-pink-500" /> Sightseeing
                            </h2>
                            <div className="flex flex-wrap gap-3">
                                {(sightseeingData[city] || []).map((spot, i) => {
                                    const isSelected = selectedSpots.includes(spot.name);
                                    return (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                if (isSelected) setSelectedSpots(selectedSpots.filter(s => s !== spot.name));
                                                else setSelectedSpots([...selectedSpots, spot.name]);
                                            }}
                                            className={cn(
                                                "px-4 py-2 rounded-xl border-2 text-sm font-bold transition-all flex items-center gap-2",
                                                isSelected 
                                                    ? "bg-emerald-50 border-emerald-500 text-emerald-700" 
                                                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                                            )}
                                        >
                                            {isSelected && <Check size={14} />}
                                            {spot.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                    </div>

                    {/* Footer Action */}
                    <div className="p-4 md:p-6 border-t border-slate-200 bg-white/95 backdrop-blur shrink-0 flex justify-center absolute bottom-0 md:relative w-full z-20 md:z-0">
                        <Button onClick={handleAddDay} className="w-full max-w-2xl py-4 h-auto text-lg shadow-xl shadow-blue-500/20">
                            Add Day to Itinerary <ArrowRight size={20} />
                        </Button>
                    </div>
                </div>

                {/* RIGHT PANEL: LIVE TIMELINE */}
                <div className={cn(
                    "h-full overflow-y-auto bg-slate-50 p-4 transition-all",
                    "md:w-[30%]",
                    mobileTab === 'timeline' ? "absolute inset-0 z-10 w-full md:static" : "hidden md:block"
                )}>
                    <div className="mb-4">
                        <h3 className="font-bold text-lg font-serif text-slate-800">Your Trip Timeline</h3>
                        <p className="text-xs text-slate-500">{days.length} Days Planned</p>
                    </div>

                    <div className="space-y-4 pb-24 md:pb-20">
                        {days.length === 0 && (
                            <div className="h-64 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                                <List size={32} className="mb-2 opacity-50" />
                                <p className="text-sm font-medium">No days added yet.</p>
                            </div>
                        )}

                        {days.map((day, idx) => (
                            <div key={day.id} className="group relative bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => handleDuplicateDay(idx)}
                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Duplicate Day"
                                    >
                                        <Copy size={14} />
                                    </button>
                                    <button 
                                        onClick={() => handleRemoveDay(idx)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Remove Day"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>

                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                                        {idx + 1}
                                    </div>
                                    <h4 className="font-bold text-slate-800">{day.city}</h4>
                                </div>

                                <div className="space-y-2 ml-11">
                                    {day.hotel && day.selectedRoomType ? (
                                        <div className="text-sm">
                                            <div className="font-bold text-slate-700">{day.hotel.name}</div>
                                            <div className="text-[10px] text-slate-500 uppercase tracking-wider flex flex-col">
                                                <span>{day.selectedRoomType.name} ({useRoomCalculator(pax, day.selectedRoomType.capacity)} Rooms)</span>
                                                <span className="text-emerald-600 font-bold">{(day.hotel.type)}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-slate-400 italic">No hotel selected</div>
                                    )}

                                    {day.sightseeing.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {day.sightseeing.map(s => (
                                                <span key={s} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded font-medium border border-slate-200">
                                                    {s}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* MOBILE BOTTOM TABS */}
                <div className="md:hidden absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-2 z-30 flex gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                    <button 
                        onClick={() => setMobileTab('editor')}
                        className={cn(
                            "flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors", 
                            mobileTab === 'editor' ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-500"
                        )}
                    >
                        <LayoutGrid size={18} /> Builder
                    </button>
                    <button 
                        onClick={() => setMobileTab('timeline')}
                        className={cn(
                            "flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors relative", 
                            mobileTab === 'timeline' ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-500"
                        )}
                    >
                        <List size={18} /> Timeline
                        {days.length > 0 && <span className="bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full absolute top-2 right-12">{days.length}</span>}
                    </button>
                </div>

            </div>

            <Modal 
                isOpen={isAllHotelsModalOpen} 
                onClose={() => setIsAllHotelsModalOpen(false)} 
                title={`All Hotels in ${city}`}
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(hotelData[city] || []).map((hotel, idx) => {
                        const isSelected = selectedHotel?.name === hotel.name;
                        return (
                            <button
                                key={idx}
                                onClick={() => {
                                    selectHotel(hotel); 
                                    setIsAllHotelsModalOpen(false);
                                }}
                                className={cn(
                                    "group relative rounded-xl overflow-hidden border-2 transition-all text-left flex flex-col h-64",
                                    isSelected 
                                        ? "border-blue-500 ring-4 ring-blue-500/20 shadow-xl" 
                                        : "border-transparent bg-slate-50 hover:border-slate-300"
                                )}
                            >
                                <div className="h-40 w-full relative shrink-0 bg-slate-200">
                                    <img 
                                        src={hotel.img || FALLBACK_IMG} 
                                        onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }}
                                        className="w-full h-full object-cover" 
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                    {isSelected && (
                                        <div className="absolute top-2 right-2 bg-blue-500 text-white p-1 rounded-full shadow-lg">
                                            <Check size={14} strokeWidth={3} />
                                        </div>
                                    )}
                                </div>
                                <div className="p-3 flex-1 flex flex-col justify-between w-full bg-white">
                                    <div>
                                        <h4 className={cn("font-bold text-sm text-slate-800 leading-tight line-clamp-1", getTextColor())}>{hotel.name}</h4>
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-1">{hotel.tier}</p>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <span className="text-xs font-medium text-slate-400">{getShortMealPlan(hotel.type)}</span>
                                        <span className="font-mono font-bold text-emerald-600">From {formatCurrency(hotel.roomTypes[0]?.rate || 0)}</span>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </Modal>
        </div>
    );
};
