
import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn, formatCurrency, generateId } from '../../utils/helpers';
import { Hotel as HotelIcon, Plus, Trash2, Edit3, Check, X, BedDouble, Utensils, Star, ChevronDown, ChevronUp, Link } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Hotel, RoomType } from '../../types';
import { GUJARAT_CITIES } from './gujaratConstants';
import { getMealPlanLabel } from '../itinerary/utils';
import toast from 'react-hot-toast';

interface HotelRateManagerProps {
  hotelData: Record<string, Hotel[]>;
  setHotelData: React.Dispatch<React.SetStateAction<Record<string, Hotel[]>>>;
}

export const HotelRateManager: React.FC<HotelRateManagerProps> = ({ hotelData, setHotelData }) => {
  const { theme, getTextColor, getInputClass } = useTheme();
  const [selectedCity, setSelectedCity] = useState(GUJARAT_CITIES[0]);
  const [expandedHotel, setExpandedHotel] = useState<string | null>(null);
  const [editingRate, setEditingRate] = useState<{ hotelName: string; roomIdx: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [editImageValue, setEditImageValue] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Add Hotel form state
  const [newHotel, setNewHotel] = useState({
    name: '', tier: 'Budget' as 'Budget' | 'Premium', type: 'CPAI',
    roomTypes: [{ name: 'Deluxe Double', capacity: 2, rate: 2500 }]
  });

  const cityHotels = hotelData[selectedCity] || [];

  const handleRateEdit = (hotelName: string, roomIdx: number, currentRate: number) => {
    setEditingRate({ hotelName, roomIdx });
    setEditValue(String(currentRate));
  };

  const handleRateSave = () => {
    if (!editingRate) return;
    const newRate = parseInt(editValue);
    if (isNaN(newRate) || newRate < 0) { setEditingRate(null); return; }

    setHotelData(prev => {
      const updated = { ...prev };
      const hotels = [...(updated[selectedCity] || [])];
      const hIdx = hotels.findIndex(h => h.name === editingRate.hotelName);
      if (hIdx >= 0) {
        const hotel = { ...hotels[hIdx] };
        const rooms = [...hotel.roomTypes];
        rooms[editingRate.roomIdx] = { ...rooms[editingRate.roomIdx], rate: newRate };
        hotel.roomTypes = rooms;
        hotels[hIdx] = hotel;
      }
      updated[selectedCity] = hotels;
      return updated;
    });
    toast.success(`Rate updated to ${formatCurrency(newRate)}`);
    setEditingRate(null);
  };

  const handleImageEdit = (hotelName: string, currentImg: string) => {
    setEditingImage(hotelName);
    setEditImageValue(currentImg || '');
  };

  const handleImageSave = (hotelName: string) => {
    setHotelData(prev => {
      const updated = { ...prev };
      const hotels = [...(updated[selectedCity] || [])];
      const hIdx = hotels.findIndex(h => h.name === hotelName);
      if (hIdx >= 0) {
        hotels[hIdx] = { ...hotels[hIdx], img: editImageValue.trim() };
      }
      updated[selectedCity] = hotels;
      return updated;
    });
    toast.success('Image updated');
    setEditingImage(null);
  };

  const handleDeleteHotel = (hotelName: string) => {
    if (!confirm(`Delete "${hotelName}" from ${selectedCity}?`)) return;
    setHotelData(prev => {
      const updated = { ...prev };
      updated[selectedCity] = (updated[selectedCity] || []).filter(h => h.name !== hotelName);
      return updated;
    });
    toast.success(`${hotelName} removed`);
  };

  const handleAddHotel = () => {
    if (!newHotel.name.trim()) { toast.error('Hotel name is required'); return; }
    const hotel: Hotel = {
      name: newHotel.name.trim(),
      rate: 0,
      type: newHotel.type,
      tier: newHotel.tier,
      img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=400&q=80',
      roomTypes: newHotel.roomTypes.map(rt => ({ ...rt })),
    };
    setHotelData(prev => {
      const updated = { ...prev };
      updated[selectedCity] = [...(updated[selectedCity] || []), hotel];
      return updated;
    });
    toast.success(`${hotel.name} added to ${selectedCity}`);
    setNewHotel({ name: '', tier: 'Budget', type: 'CPAI', roomTypes: [{ name: 'Deluxe Double', capacity: 2, rate: 2500 }] });
    setIsAddModalOpen(false);
  };

  const handleAddRoomType = (hotelName: string) => {
    setHotelData(prev => {
      const updated = { ...prev };
      const hotels = [...(updated[selectedCity] || [])];
      const hIdx = hotels.findIndex(h => h.name === hotelName);
      if (hIdx >= 0) {
        const hotel = { ...hotels[hIdx] };
        hotel.roomTypes = [...hotel.roomTypes, { name: 'New Room', capacity: 2, rate: 2000 }];
        hotels[hIdx] = hotel;
      }
      updated[selectedCity] = hotels;
      return updated;
    });
  };

  const handleDeleteRoomType = (hotelName: string, roomIdx: number) => {
    setHotelData(prev => {
      const updated = { ...prev };
      const hotels = [...(updated[selectedCity] || [])];
      const hIdx = hotels.findIndex(h => h.name === hotelName);
      if (hIdx >= 0) {
        const hotel = { ...hotels[hIdx] };
        hotel.roomTypes = hotel.roomTypes.filter((_, i) => i !== roomIdx);
        hotels[hIdx] = hotel;
      }
      updated[selectedCity] = hotels;
      return updated;
    });
  };

  const handleRoomNameEdit = (hotelName: string, roomIdx: number, newName: string) => {
    setHotelData(prev => {
      const updated = { ...prev };
      const hotels = [...(updated[selectedCity] || [])];
      const hIdx = hotels.findIndex(h => h.name === hotelName);
      if (hIdx >= 0) {
        const hotel = { ...hotels[hIdx] };
        const rooms = [...hotel.roomTypes];
        rooms[roomIdx] = { ...rooms[roomIdx], name: newName };
        hotel.roomTypes = rooms;
        hotels[hIdx] = hotel;
      }
      updated[selectedCity] = hotels;
      return updated;
    });
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* City Selector */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            {GUJARAT_CITIES.map(city => (
              <button
                key={city}
                onClick={() => { setSelectedCity(city); setExpandedHotel(null); }}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
                  selectedCity === city
                    ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20"
                    : theme === 'light'
                      ? "bg-white text-slate-600 hover:bg-amber-50 border border-slate-200"
                      : "bg-white/10 text-white/70 hover:bg-white/20"
                )}
              >
                {city}
              </button>
            ))}
          </div>
          <Button variant="primary" size="sm" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={14} /> Add Hotel
          </Button>
        </div>

        {/* Hotel Cards */}
        {cityHotels.length === 0 ? (
          <div className={cn("text-center py-20 rounded-2xl border-2 border-dashed", theme === 'light' ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/10")}>
            <HotelIcon size={40} className="mx-auto mb-3 opacity-30" />
            <p className={cn("text-sm font-bold", getTextColor())}>No hotels in {selectedCity}</p>
            <p className="text-xs opacity-50 mt-1">Add a hotel to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {cityHotels.map((hotel) => {
              const isExpanded = expandedHotel === hotel.name;
              return (
                <div
                  key={hotel.name}
                  className={cn(
                    "rounded-2xl border transition-all overflow-hidden",
                    theme === 'light' ? "bg-white border-slate-200 shadow-sm" : "bg-white/5 border-white/10"
                  )}
                >
                  {/* Hotel Header */}
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                    onClick={() => setExpandedHotel(isExpanded ? null : hotel.name)}
                  >
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-200 shrink-0 group/img">
                      <img src={hotel.img || ''} className="w-full h-full object-cover" alt={hotel.name} />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleImageEdit(hotel.name, hotel.img || ''); }}
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                        title="Edit image URL"
                      >
                        <Link size={14} className="text-white" />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={cn("text-sm font-bold truncate", getTextColor())}>{hotel.name}</h3>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold",
                          hotel.tier === 'Premium' ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                        )}>
                          {hotel.tier}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs opacity-60">
                        <span className="flex items-center gap-1"><Utensils size={10} /> {getMealPlanLabel(hotel.type)}</span>
                        <span className="flex items-center gap-1"><BedDouble size={10} /> {hotel.roomTypes.length} room type{hotel.roomTypes.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteHotel(hotel.name); }} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={14} />
                      </button>
                      {isExpanded ? <ChevronUp size={16} className="opacity-40" /> : <ChevronDown size={16} className="opacity-40" />}
                    </div>
                  </div>

                  {/* Room Types (Expanded) */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 p-4 bg-slate-50/50 space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider opacity-50">Room Types & Rates</h4>
                        <button onClick={() => handleAddRoomType(hotel.name)} className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1">
                          <Plus size={12} /> Add Room
                        </button>
                      </div>
                      {hotel.roomTypes.map((room, roomIdx) => (
                        <div key={roomIdx} className={cn("flex items-center gap-4 p-3 rounded-xl border", theme === 'light' ? "bg-white border-slate-200" : "bg-white/5 border-white/10")}>
                          <div className="flex-1 min-w-0">
                            <input
                              type="text"
                              value={room.name}
                              onChange={(e) => handleRoomNameEdit(hotel.name, roomIdx, e.target.value)}
                              className={cn("text-sm font-bold bg-transparent border-none outline-none w-full", getTextColor())}
                            />
                            <p className="text-[10px] opacity-50 mt-0.5">Capacity: {room.capacity} pax</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {editingRate?.hotelName === hotel.name && editingRate?.roomIdx === roomIdx ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleRateSave(); if (e.key === 'Escape') setEditingRate(null); }}
                                  className="w-24 px-2 py-1 text-sm font-mono font-bold border rounded-lg text-right outline-none focus:ring-2 focus:ring-amber-500 border-amber-300"
                                  autoFocus
                                />
                                <button onClick={handleRateSave} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={14} /></button>
                                <button onClick={() => setEditingRate(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><X size={14} /></button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleRateEdit(hotel.name, roomIdx, room.rate)}
                                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-mono font-bold text-sm rounded-lg transition-colors flex items-center gap-1.5"
                              >
                                {formatCurrency(room.rate)}
                                <Edit3 size={10} className="opacity-50" />
                              </button>
                            )}
                            {hotel.roomTypes.length > 1 && (
                              <button onClick={() => handleDeleteRoomType(hotel.name, roomIdx)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Image Edit Modal */}
      <Modal isOpen={!!editingImage} onClose={() => setEditingImage(null)} title={`Update Image — ${editingImage}`}>
        <div className="space-y-4 p-1">
          {editImageValue && (
            <div className="h-40 rounded-xl overflow-hidden bg-slate-100">
              <img src={editImageValue} className="w-full h-full object-cover" alt="Preview" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          )}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider opacity-60 mb-1 block">Image URL</label>
            <input
              type="text"
              value={editImageValue}
              onChange={(e) => setEditImageValue(e.target.value)}
              placeholder="https://..."
              className={cn("w-full px-4 py-2.5 rounded-xl border text-sm", getInputClass())}
              autoFocus
            />
            <p className="text-[10px] opacity-50 mt-1">Paste any image URL — Unsplash, Google, your CDN, etc.</p>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setEditingImage(null)} className="flex-1">Cancel</Button>
            <Button variant="primary" size="sm" onClick={() => editingImage && handleImageSave(editingImage)} className="flex-1">Save Image</Button>
          </div>
        </div>
      </Modal>

      {/* Add Hotel Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title={`Add Hotel to ${selectedCity}`}>
        <div className="space-y-4 p-1">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider opacity-60 mb-1 block">Hotel Name</label>
            <input
              type="text"
              value={newHotel.name}
              onChange={(e) => setNewHotel(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Taj Hotel"
              className={cn("w-full px-4 py-2.5 rounded-xl border text-sm font-medium", getInputClass())}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider opacity-60 mb-1 block">Tier</label>
              <select
                value={newHotel.tier}
                onChange={(e) => setNewHotel(prev => ({ ...prev, tier: e.target.value as 'Budget' | 'Premium' }))}
                className={cn("w-full px-4 py-2.5 rounded-xl border text-sm font-medium", getInputClass())}
              >
                <option value="Budget">Budget</option>
                <option value="Premium">Premium</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider opacity-60 mb-1 block">Meal Plan</label>
              <select
                value={newHotel.type}
                onChange={(e) => setNewHotel(prev => ({ ...prev, type: e.target.value }))}
                className={cn("w-full px-4 py-2.5 rounded-xl border text-sm font-medium", getInputClass())}
              >
                <option value="CPAI">CP (Breakfast)</option>
                <option value="MAPAI">MAP (Bfast + Dinner)</option>
                <option value="APAI">AP (All Meals)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider opacity-60 mb-1 block">Initial Room Type</label>
            <div className="grid grid-cols-3 gap-3">
              <input
                type="text"
                value={newHotel.roomTypes[0].name}
                onChange={(e) => setNewHotel(prev => ({ ...prev, roomTypes: [{ ...prev.roomTypes[0], name: e.target.value }] }))}
                placeholder="Room name"
                className={cn("px-3 py-2 rounded-xl border text-sm", getInputClass())}
              />
              <input
                type="number"
                value={newHotel.roomTypes[0].capacity}
                onChange={(e) => setNewHotel(prev => ({ ...prev, roomTypes: [{ ...prev.roomTypes[0], capacity: parseInt(e.target.value) || 2 }] }))}
                placeholder="Capacity"
                className={cn("px-3 py-2 rounded-xl border text-sm", getInputClass())}
              />
              <input
                type="number"
                value={newHotel.roomTypes[0].rate}
                onChange={(e) => setNewHotel(prev => ({ ...prev, roomTypes: [{ ...prev.roomTypes[0], rate: parseInt(e.target.value) || 0 }] }))}
                placeholder="Rate"
                className={cn("px-3 py-2 rounded-xl border text-sm", getInputClass())}
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setIsAddModalOpen(false)} className="flex-1">Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleAddHotel} className="flex-1">Add Hotel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
