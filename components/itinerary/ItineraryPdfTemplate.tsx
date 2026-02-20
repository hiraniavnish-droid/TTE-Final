
import React from 'react';
import { formatCurrency, cn } from '../../utils/helpers';
import { Check, Calendar, MapPin, Star, Phone, Globe, Mail, Utensils, BedDouble, Car } from 'lucide-react';
import { POLICY_DATA } from '../../constants';
import { Hotel, ItineraryPackage, RoomType, Sightseeing } from '../../types';
import { FleetItem, ItineraryPricing } from './types';
import { FALLBACK_IMG, getMealPlanLabel, getSmartDate, getVehicleString } from './utils';

interface ItineraryPdfTemplateProps {
  guestName: string;
  pax: number;
  activePackage: ItineraryPackage;
  pricing: ItineraryPricing;
  startDate: string;
  hotelOverrides: Record<number, { hotel: Hotel, roomType: RoomType }>;
  hotelData: Record<string, Hotel[]>;
  baseTier: 'Budget' | 'Premium';
  fleet: FleetItem[];
  sightseeingData: Record<string, Sightseeing[]>;
  sightseeingOverrides: Record<number, string[]>;
}

// Fixed width for A4 compatibility.
const PDF_WIDTH_CLASS = "w-[800px]";

export const ItineraryPdfTemplate: React.FC<ItineraryPdfTemplateProps> = ({
  guestName, pax, activePackage, pricing, startDate, hotelOverrides, hotelData, baseTier, fleet,
  sightseeingData, sightseeingOverrides
}) => {
  
  const getDayData = (index: number, city: string) => {
      const override = hotelOverrides[index];
      let currentHotel: Hotel | undefined;
      let currentRoom: RoomType | undefined;

      if (override) {
          currentHotel = override.hotel;
          currentRoom = override.roomType;
      } else {
          const cityHotels = hotelData[city] || [];
          currentHotel = cityHotels.find(h => h.tier === baseTier) || cityHotels[0];
          if(currentHotel) currentRoom = currentHotel.roomTypes[0];
      }
      return { currentHotel, currentRoom };
  };

  const getDaySightseeing = (index: number, city: string) => {
      const overrides = sightseeingOverrides[index];
      const available = sightseeingData[city] || [];
      
      if (overrides && overrides.length > 0) {
          return available.filter(s => overrides.includes(s.name));
      }
      return available.slice(0, 4);
  };

  return (
    // CHANGED: Fixed positioning at top-left with negative Z-index. 
    // This keeps it in the viewport for correct image painting but hides it from the user.
    <div id="pdf-template-container" className="fixed top-0 left-0 -z-50 bg-white text-slate-900 font-sans pointer-events-none">
        
        {/* --- SECTION 1: COVER --- */}
        <div className={cn("pdf-section relative h-[1123px] flex flex-col justify-between overflow-hidden", PDF_WIDTH_CLASS)}>
            <div className="absolute inset-0 z-0">
                <img 
                    src="https://rannutsav.net/wp-content/uploads/2025/08/white-desert-600x500.webp" 
                    className="w-full h-full object-cover"
                    alt="Cover"
                    crossOrigin="anonymous"
                    loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/10" />
            </div>

            <div className="relative z-10 p-12 pt-20 flex justify-between items-start">
                <div className="text-white">
                    <p className="text-xs font-bold tracking-[0.4em] uppercase mb-4 border-b border-white/30 pb-2 inline-block">The Tourism Experts</p>
                    <h1 className="text-7xl font-serif font-bold leading-[0.9]">
                        Kutch<br/><span className="text-blue-400">Odyssey</span>
                    </h1>
                </div>
                <div className="text-white text-right">
                    <p className="text-xl font-serif italic text-white/80">A Tailored Journey to</p>
                    <p className="text-3xl font-bold tracking-wide">The White Desert</p>
                </div>
            </div>

            <div className="relative z-10 p-12 pb-24 text-white">
                <div className="backdrop-blur-xl bg-white/10 border border-white/20 p-8 rounded-3xl shadow-2xl">
                    <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-2">Prepared Exclusively For</p>
                    <h2 className="text-5xl font-serif font-bold mb-8">{guestName}</h2>
                    
                    <div className="grid grid-cols-2 gap-12 text-sm border-t border-white/20 pt-8">
                        <div>
                            <p className="opacity-60 mb-1 uppercase text-xs tracking-wider">Travel Dates</p>
                            <p className="font-bold text-xl flex items-center gap-2">
                                <Calendar size={20} className="text-blue-400" /> {getSmartDate(startDate, 0, true)} — {getSmartDate(startDate, activePackage.days - 1, true)}
                            </p>
                        </div>
                        <div>
                            <p className="opacity-60 mb-1 uppercase text-xs tracking-wider">Travelers</p>
                            <p className="font-bold text-xl flex items-center gap-2">
                                <MapPin size={20} className="text-emerald-400" /> {pax} Guests
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* --- SECTION 2: INTRO --- */}
        <div className={cn("pdf-section p-10 bg-white", PDF_WIDTH_CLASS)}>
            <div className="flex gap-10 h-72">
                <div className="w-1/2 flex flex-col justify-between">
                    <div>
                        <h2 className="text-3xl font-serif font-bold text-slate-900 mb-1">Trip Overview</h2>
                        <span className="text-slate-400 font-medium italic text-sm">Your personalized itinerary at a glance</span>
                        <div className="w-12 h-1 bg-blue-600 mt-4 rounded-full"></div>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600"><Car size={14}/></div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400">Transport</p>
                                <p className="font-bold text-slate-900 text-sm">{getVehicleString(fleet)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600"><Star size={14}/></div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400">Experience Tier</p>
                                <p className="font-bold text-slate-900 text-sm">{baseTier} Stays</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="w-1/2 bg-slate-50 rounded-2xl border border-slate-100 p-6 relative overflow-hidden">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-6 absolute top-6 left-6">Route Map</h3>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex items-center relative z-10">
                            {activePackage.route.map((city, idx) => (
                                <React.Fragment key={idx}>
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-slate-900 ring-4 ring-white shadow-md"></div>
                                        <span className="font-bold text-[10px] uppercase tracking-wide absolute -bottom-6 w-20 text-center">{city}</span>
                                    </div>
                                    {idx < activePackage.route.length - 1 && (
                                        <div className="w-12 h-0.5 bg-slate-300"></div>
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                        <MapPin size={120} className="absolute text-slate-100 -right-4 -bottom-4 rotate-12" />
                    </div>
                </div>
            </div>
        </div>

        {/* --- SECTIONS: DAYS --- */}
        {activePackage.route.map((city, index) => {
            const { currentHotel, currentRoom } = getDayData(index, city);
            const sights = getDaySightseeing(index, city);
            
            return (
                <div key={index} className={cn("pdf-section p-8 pt-4 pb-4 bg-white border-b border-slate-50 break-inside-avoid", PDF_WIDTH_CLASS)}>
                    <div className="flex gap-6 h-full">
                        {/* Timeline Spine */}
                        <div className="flex flex-col items-center w-12 shrink-0">
                            <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-serif font-bold text-lg shadow-lg z-10">
                                {index + 1}
                            </div>
                            <div className="w-0.5 bg-dashed border-l-2 border-slate-200 h-full -mt-2 opacity-50"></div>
                        </div>

                        <div className="flex-1 pb-8">
                            {/* Header */}
                            <div className="flex justify-between items-baseline mb-4">
                                <div>
                                    <h3 className="text-2xl font-serif font-bold text-slate-900">{city}</h3>
                                    <p className="text-slate-500 text-sm font-medium">{getSmartDate(startDate, index)}</p>
                                </div>
                                {index === 0 && <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-1 rounded uppercase">Arrival</span>}
                                {index === activePackage.route.length - 1 && <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-1 rounded uppercase">Departure</span>}
                            </div>

                            {/* Hotel */}
                            {currentHotel ? (
                                <div className="bg-slate-50 rounded-xl border border-slate-200 p-1 flex items-center gap-4 mb-6 shadow-sm break-inside-avoid">
                                    <div className="w-24 h-16 rounded-lg overflow-hidden shrink-0 relative bg-slate-200">
                                        <img 
                                            src={currentHotel.img || FALLBACK_IMG} 
                                            className="w-full h-full object-cover" 
                                            alt={currentHotel.name}
                                            crossOrigin="anonymous"
                                            loading="eager"
                                        />
                                    </div>
                                    <div className="flex-1 py-1">
                                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Accommodation</p>
                                        <h4 className="text-sm font-bold text-slate-800">{currentHotel.name}</h4>
                                        <div className="flex gap-3 mt-1">
                                            <span className="text-[10px] text-slate-500 flex items-center gap-1"><BedDouble size={10}/> {currentRoom?.name}</span>
                                            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1"><Utensils size={10}/> {getMealPlanLabel(currentHotel.type)}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-400 text-xs italic text-center mb-6">
                                    Departing / No Accommodation
                                </div>
                            )}

                            {/* Sightseeing - UPDATED: No line-clamp, more flexible spacing */}
                            {sights.length > 0 && (
                                <div className="space-y-3">
                                    <h5 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-2">
                                        <div className="w-1 h-1 rounded-full bg-slate-400"></div> Highlights
                                    </h5>
                                    <div className="grid grid-cols-4 gap-3">
                                        {sights.map((sight, idx) => (
                                            <div key={idx} className="flex flex-col gap-2">
                                                <div className="aspect-[4/3] rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shadow-sm relative">
                                                    <img 
                                                        src={sight.img || FALLBACK_IMG} 
                                                        className="w-full h-full object-cover"
                                                        alt={sight.name}
                                                        crossOrigin="anonymous"
                                                        loading="eager"
                                                    />
                                                </div>
                                                <div>
                                                    {/* Changed text styling to prevent clipping */}
                                                    <p className="font-bold text-[10px] text-slate-800 leading-normal mb-1">{sight.name}</p>
                                                    <p className="text-[9px] text-slate-500 leading-relaxed">{sight.desc}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        })}

        {/* --- SECTION: COSTING --- */}
        <div className={cn("pdf-section p-12 bg-slate-50 min-h-[400px]", PDF_WIDTH_CLASS)}>
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-slate-200">
                <div className="flex justify-between items-end border-b border-dashed border-slate-200 pb-6 mb-6">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Total Package Cost</p>
                        <h2 className="text-5xl font-mono font-bold text-slate-900 tracking-tight">{formatCurrency(pricing.finalTotal)}</h2>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-slate-500 mb-1">Per Person (Approx)</p>
                        <p className="text-xl font-bold text-blue-600">{formatCurrency(pricing.perPerson)}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-12">
                    <div>
                        <h3 className="font-bold font-serif text-lg mb-4 text-slate-900 flex items-center gap-2">
                            <Check size={18} className="text-green-500" /> Inclusions
                        </h3>
                        <ul className="space-y-2">
                            {POLICY_DATA.inclusions.map((inc, i) => (
                                <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 shrink-0" />
                                    {inc}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <h3 className="font-bold font-serif text-lg mb-4 text-slate-900 flex items-center gap-2 opacity-50">
                            Exclusions
                        </h3>
                        <ul className="space-y-2 opacity-60">
                            {POLICY_DATA.exclusions.map((exc, i) => (
                                <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                                    {exc}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            <div className="mt-12 flex justify-between items-center text-slate-400 text-xs border-t border-slate-200 pt-6">
                <div className="flex gap-6">
                    <span className="flex items-center gap-1 font-medium"><Phone size={12}/> +91 98765 43210</span>
                    <span className="flex items-center gap-1 font-medium"><Mail size={12}/> bookings@tourismexperts.com</span>
                    <span className="flex items-center gap-1 font-medium"><Globe size={12}/> www.tourismexperts.com</span>
                </div>
                <div className="font-serif italic">Crafted with care by The Tourism Experts.</div>
            </div>
        </div>

    </div>
  );
};
