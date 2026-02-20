
import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../utils/helpers';
import { Trash2, Plus } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Vehicle } from '../../types';
import { FleetItem } from './types';
import { FALLBACK_IMG } from './utils';

interface FleetManagerProps {
  isOpen: boolean;
  onClose: () => void;
  fleet: FleetItem[];
  onAddVehicle: () => void;
  onRemoveVehicle: (id: string) => void;
  onUpdateVehicle: (id: string, field: 'name' | 'count', value: any) => void;
  vehicleData: Vehicle[];
}

export const FleetManager: React.FC<FleetManagerProps> = ({ 
  isOpen, onClose, fleet, onAddVehicle, onRemoveVehicle, onUpdateVehicle, vehicleData 
}) => {
  const { getTextColor } = useTheme();

  const getVehicleImg = (name: string) => {
      const v = vehicleData.find(v => v.name === name);
      // The hook now handles the fallback chain, so `v.img` is the best available URL
      return v?.img || "";
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Transport Fleet">
        <div className="space-y-4">
            <p className={cn("text-sm opacity-60", getTextColor())}>
                Configure the exact mix of vehicles for this trip. 
            </p>
            
            <div className="space-y-3">
                {fleet.map((vehicle) => {
                    const vehicleImg = getVehicleImg(vehicle.name);
                    return (
                        <div key={vehicle.id} className="flex items-center gap-3 p-3 rounded-xl border bg-slate-50/50">
                            <div className="w-16 h-12 bg-slate-200 rounded-lg border overflow-hidden shrink-0 relative">
                                <img 
                                    src={vehicleImg || FALLBACK_IMG} 
                                    onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }}
                                    alt={vehicle.name || "Vehicle Image"} 
                                    className="w-full h-full object-cover" 
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <label className="text-[10px] font-bold uppercase opacity-50 block mb-1">Vehicle Type</label>
                                <select 
                                    value={vehicle.name}
                                    onChange={(e) => onUpdateVehicle(vehicle.id, 'name', e.target.value)}
                                    className={cn("w-full bg-transparent font-bold text-sm outline-none truncate", getTextColor())}
                                >
                                    {vehicleData.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                                </select>
                            </div>
                            
                            <div className="w-20 shrink-0">
                                <label className="text-[10px] font-bold uppercase opacity-50 block mb-1 text-center">Qty</label>
                                <input 
                                    type="number"
                                    min="1"
                                    value={vehicle.count}
                                    onChange={(e) => onUpdateVehicle(vehicle.id, 'count', parseInt(e.target.value) || 1)}
                                    className={cn("w-full p-1 bg-white border rounded text-center font-bold", getTextColor())}
                                />
                            </div>

                            <button 
                                onClick={() => onRemoveVehicle(vehicle.id)}
                                className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors mt-4"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    );
                })}
            </div>

            <Button variant="secondary" onClick={onAddVehicle} className="w-full border-dashed border-2">
                <Plus size={16} /> Add Another Vehicle
            </Button>

            <div className="pt-4 border-t flex justify-end">
                <Button onClick={onClose}>Done</Button>
            </div>
        </div>
    </Modal>
  );
};
