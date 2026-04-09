
import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../utils/helpers';
import { Camera, Plus, Trash2, Edit3, Check, X, MapPin } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Sightseeing } from '../../types';
import { GUJARAT_CITIES } from './gujaratConstants';
import toast from 'react-hot-toast';

interface SightseeingManagerProps {
  sightseeingData: Record<string, Sightseeing[]>;
  setSightseeingData: React.Dispatch<React.SetStateAction<Record<string, Sightseeing[]>>>;
}

export const SightseeingManager: React.FC<SightseeingManagerProps> = ({ sightseeingData, setSightseeingData }) => {
  const { theme, getTextColor, getInputClass } = useTheme();
  const [selectedCity, setSelectedCity] = useState(GUJARAT_CITIES[0]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSpot, setEditingSpot] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', desc: '' });

  const [newSpot, setNewSpot] = useState({ name: '', desc: '', img: '' });

  const citySpots = sightseeingData[selectedCity] || [];

  const handleAddSpot = () => {
    if (!newSpot.name.trim()) { toast.error('Name is required'); return; }
    const spot: Sightseeing = {
      name: newSpot.name.trim(),
      desc: newSpot.desc.trim() || 'Popular attraction',
      img: newSpot.img.trim() || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=400&q=80',
    };
    setSightseeingData(prev => {
      const updated = { ...prev };
      updated[selectedCity] = [...(updated[selectedCity] || []), spot];
      return updated;
    });
    toast.success(`${spot.name} added to ${selectedCity}`);
    setNewSpot({ name: '', desc: '', img: '' });
    setIsAddModalOpen(false);
  };

  const handleDeleteSpot = (spotName: string) => {
    if (!confirm(`Delete "${spotName}" from ${selectedCity}?`)) return;
    setSightseeingData(prev => {
      const updated = { ...prev };
      updated[selectedCity] = (updated[selectedCity] || []).filter(s => s.name !== spotName);
      return updated;
    });
    toast.success(`${spotName} removed`);
  };

  const handleStartEdit = (spot: Sightseeing) => {
    setEditingSpot(spot.name);
    setEditForm({ name: spot.name, desc: spot.desc });
  };

  const handleSaveEdit = (originalName: string) => {
    if (!editForm.name.trim()) { setEditingSpot(null); return; }
    setSightseeingData(prev => {
      const updated = { ...prev };
      updated[selectedCity] = (updated[selectedCity] || []).map(s =>
        s.name === originalName ? { ...s, name: editForm.name.trim(), desc: editForm.desc.trim() } : s
      );
      return updated;
    });
    toast.success('Updated');
    setEditingSpot(null);
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
                onClick={() => { setSelectedCity(city); setEditingSpot(null); }}
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
            <Plus size={14} /> Add Spot
          </Button>
        </div>

        {/* Spots Grid */}
        {citySpots.length === 0 ? (
          <div className={cn("text-center py-20 rounded-2xl border-2 border-dashed", theme === 'light' ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/10")}>
            <Camera size={40} className="mx-auto mb-3 opacity-30" />
            <p className={cn("text-sm font-bold", getTextColor())}>No sightseeing spots in {selectedCity}</p>
            <p className="text-xs opacity-50 mt-1">Add attractions to include in packages</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {citySpots.map((spot) => (
              <div
                key={spot.name}
                className={cn(
                  "rounded-2xl border overflow-hidden group transition-all hover:shadow-lg",
                  theme === 'light' ? "bg-white border-slate-200" : "bg-white/5 border-white/10"
                )}
              >
                <div className="h-36 relative overflow-hidden bg-slate-200">
                  <img src={spot.img || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={spot.name} />
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleStartEdit(spot)} className="p-1.5 bg-white/90 backdrop-blur-sm rounded-lg text-slate-600 hover:text-blue-600 shadow-sm">
                      <Edit3 size={12} />
                    </button>
                    <button onClick={() => handleDeleteSpot(spot.name)} className="p-1.5 bg-white/90 backdrop-blur-sm rounded-lg text-slate-600 hover:text-red-600 shadow-sm">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  {editingSpot === spot.name ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        className={cn("w-full px-3 py-1.5 rounded-lg border text-sm font-bold", getInputClass())}
                        autoFocus
                      />
                      <textarea
                        value={editForm.desc}
                        onChange={(e) => setEditForm(prev => ({ ...prev, desc: e.target.value }))}
                        className={cn("w-full px-3 py-1.5 rounded-lg border text-xs resize-none h-16", getInputClass())}
                      />
                      <div className="flex gap-2">
                        <button onClick={() => handleSaveEdit(spot.name)} className="flex items-center gap-1 text-xs font-bold text-green-600 hover:text-green-700">
                          <Check size={12} /> Save
                        </button>
                        <button onClick={() => setEditingSpot(null)} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-600">
                          <X size={12} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className={cn("text-sm font-bold mb-1", getTextColor())}>{spot.name}</h3>
                      <p className="text-xs opacity-60 line-clamp-2 leading-relaxed">{spot.desc}</p>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Spot Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title={`Add Sightseeing to ${selectedCity}`}>
        <div className="space-y-4 p-1">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider opacity-60 mb-1 block">Name</label>
            <input
              type="text"
              value={newSpot.name}
              onChange={(e) => setNewSpot(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Sabarmati Ashram"
              className={cn("w-full px-4 py-2.5 rounded-xl border text-sm font-medium", getInputClass())}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider opacity-60 mb-1 block">Description</label>
            <textarea
              value={newSpot.desc}
              onChange={(e) => setNewSpot(prev => ({ ...prev, desc: e.target.value }))}
              placeholder="Brief description..."
              className={cn("w-full px-4 py-2.5 rounded-xl border text-sm resize-none h-20", getInputClass())}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider opacity-60 mb-1 block">Image URL (optional)</label>
            <input
              type="text"
              value={newSpot.img}
              onChange={(e) => setNewSpot(prev => ({ ...prev, img: e.target.value }))}
              placeholder="https://..."
              className={cn("w-full px-4 py-2.5 rounded-xl border text-sm", getInputClass())}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setIsAddModalOpen(false)} className="flex-1">Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleAddSpot} className="flex-1">Add Spot</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
