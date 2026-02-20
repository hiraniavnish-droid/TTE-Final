
import React from 'react';
import { cn, formatCurrency } from '../../utils/helpers';
import { Modal } from '../ui/Modal';
import { Hotel, RoomType } from '../../types';
import { FALLBACK_IMG, getShortMealPlan } from './utils';

interface HotelSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  city: string;
  dayIndex: number;
  hotels: Hotel[];
  onSelect: (dayIndex: number, hotel: Hotel, roomType: RoomType) => void;
}

export const HotelSwapModal: React.FC<HotelSwapModalProps> = ({ isOpen, onClose, city, dayIndex, hotels, onSelect }) => {
  return (
    <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title={`Change Hotel in ${city}`}
    >
        <div className="space-y-4">
            {hotels.map((hotel) => (
                <button
                    key={hotel.name}
                    onClick={() => {
                        if (hotel.roomTypes.length > 0) onSelect(dayIndex, hotel, hotel.roomTypes[0]);
                        onClose();
                    }}
                    className="w-full flex items-center gap-4 p-3 rounded-xl border hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
                >
                    <div className="w-20 h-16 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                        <img src={hotel.img || FALLBACK_IMG} onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }} className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800">{hotel.name}</h4>
                        <div className="flex items-center gap-2 text-xs mt-1">
                            <span className={cn("px-1.5 py-0.5 rounded font-bold uppercase tracking-wider", hotel.tier === 'Premium' ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600")}>{hotel.tier}</span>
                            <span className="text-slate-500">{getShortMealPlan(hotel.type)}</span>
                        </div>
                    </div>
                    <div className="ml-auto text-right">
                        <span className="block font-mono font-bold text-emerald-600">{formatCurrency(hotel.roomTypes[0]?.rate || 0)}</span>
                        <span className="text-[10px] text-slate-400">base rate</span>
                    </div>
                </button>
            ))}
        </div>
    </Modal>
  );
};
