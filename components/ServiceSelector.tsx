
import React from 'react';
import { Palmtree, Plane, BedDouble, FileCheck, Car, Shield } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils/helpers';

export const SERVICE_OPTIONS = [
  { id: 'Holiday Package', icon: Palmtree },
  { id: 'Flight Booking', icon: Plane },
  { id: 'Hotel Booking', icon: BedDouble },
  { id: 'Visa Service', icon: FileCheck },
  { id: 'Cab/Transfer', icon: Car },
  { id: 'Travel Insurance', icon: Shield },
];

interface ServiceSelectorProps {
  selectedServices: string[];
  onChange?: (services: string[]) => void;
  readOnly?: boolean;
}

export const ServiceSelector: React.FC<ServiceSelectorProps> = ({ 
  selectedServices, 
  onChange,
  readOnly = false 
}) => {
  const { theme } = useTheme();

  const handleToggle = (id: string) => {
    if (readOnly || !onChange) return;

    // Logic: 'Holiday Package' is exclusive
    if (id === 'Holiday Package') {
        // If selecting Holiday Package, clear everything else and select only it
        // If deselecting it, just clear it
        if (selectedServices.includes(id)) {
            onChange([]);
        } else {
            onChange([id]);
        }
    } else {
        // If selecting any other service
        let newServices = [...selectedServices];
        
        // 1. Remove 'Holiday Package' if it exists (since we are picking individual services)
        if (newServices.includes('Holiday Package')) {
            newServices = newServices.filter(s => s !== 'Holiday Package');
        }

        // 2. Toggle the specific ID
        if (newServices.includes(id)) {
            newServices = newServices.filter(s => s !== id);
        } else {
            newServices.push(id);
        }
        
        onChange(newServices);
    }
  };

  // Check if Holiday Package is active to visually disable others
  const isHolidayPackageActive = selectedServices.includes('Holiday Package');

  // Read Only Mode (Badge Style)
  if (readOnly) {
      if (selectedServices.length === 0) {
          return <p className="text-xs opacity-50 italic">No services selected.</p>;
      }
      return (
          <div className="flex flex-wrap gap-2">
              {selectedServices.map(service => {
                  const opt = SERVICE_OPTIONS.find(o => o.id === service);
                  if (!opt) return null;
                  const Icon = opt.icon;
                  return (
                      <div key={service} className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium",
                          theme === 'light' 
                            ? "bg-blue-50 border-blue-100 text-blue-700" 
                            : "bg-blue-500/10 border-blue-500/20 text-blue-200"
                      )}>
                          <Icon size={14} />
                          {service}
                      </div>
                  );
              })}
          </div>
      );
  }

  // Edit/Select Mode (Grid Style)
  return (
    <div className="grid grid-cols-3 gap-2">
      {SERVICE_OPTIONS.map((option) => {
        const isSelected = selectedServices.includes(option.id);
        const Icon = option.icon;
        
        // Determine disabled state
        const isDisabled = isHolidayPackageActive && option.id !== 'Holiday Package';

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => handleToggle(option.id)}
            disabled={isDisabled}
            className={cn(
              "flex flex-col items-center justify-center p-3 min-h-[56px] rounded-xl border transition-all duration-200 gap-2", 
              isDisabled && "opacity-30 cursor-not-allowed grayscale",
              isSelected 
                ? (theme === 'light' 
                    ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm scale-[1.02]" 
                    : "bg-blue-500/20 border-blue-500 text-blue-100 shadow-lg shadow-blue-500/10 scale-[1.02]")
                : (theme === 'light'
                    ? "bg-slate-50 border-slate-200 text-slate-500 hover:bg-white hover:border-slate-300"
                    : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:text-white/70 hover:border-white/20")
            )}
          >
            <Icon size={20} className={cn(isSelected ? "opacity-100" : "opacity-60")} />
            <span className="text-[10px] font-bold text-center leading-tight">{option.id}</span>
          </button>
        );
      })}
    </div>
  );
};
