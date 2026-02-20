
import React, { useEffect } from 'react';
import { Minus, Plus, Users, Baby } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils/helpers';
import { PaxConfig } from '../types';

interface PaxSelectorProps {
  value: PaxConfig;
  onChange: (config: PaxConfig) => void;
  readOnly?: boolean;
}

export const PaxSelector: React.FC<PaxSelectorProps> = ({ value, onChange, readOnly = false }) => {
  const { theme, getTextColor, getBorderClass, getInputClass } = useTheme();

  // Ensure childAges array matches children count
  useEffect(() => {
    if (value.childAges.length !== value.children) {
      let newAges = [...value.childAges];
      if (value.children > newAges.length) {
        // Add default age 5 for new children
        const toAdd = value.children - newAges.length;
        newAges = [...newAges, ...Array(toAdd).fill(5)];
      } else {
        // Trim array
        newAges = newAges.slice(0, value.children);
      }
      onChange({ ...value, childAges: newAges });
    }
  }, [value.children]);

  const updateAdults = (delta: number) => {
    const newVal = value.adults + delta;
    if (newVal < 1) return;
    onChange({ ...value, adults: newVal });
  };

  const updateChildren = (delta: number) => {
    const newVal = value.children + delta;
    if (newVal < 0) return;
    onChange({ ...value, children: newVal });
  };

  const updateChildAge = (index: number, newAge: number) => {
    // Clamp age between 0 and 17
    const clampedAge = Math.min(17, Math.max(0, newAge));
    const newAges = [...value.childAges];
    newAges[index] = clampedAge;
    onChange({ ...value, childAges: newAges });
  };

  const CounterRow = ({ label, count, onUpdate, icon: Icon, min }: { label: string, count: number, onUpdate: (d: number) => void, icon: any, min: number }) => (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <div className={cn("p-2 rounded-lg", theme === 'light' ? 'bg-blue-50 text-blue-600' : 'bg-white/10 text-blue-300')}>
            <Icon size={18} />
        </div>
        <span className={cn("font-medium", getTextColor())}>{label}</span>
      </div>
      
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onUpdate(-1)}
          disabled={readOnly || count <= min}
          className={cn(
            "w-9 h-9 flex items-center justify-center rounded-lg border transition-colors",
            theme === 'light' ? 'border-slate-200 hover:bg-slate-50' : 'border-white/10 hover:bg-white/10',
            (readOnly || count <= min) && "opacity-30 cursor-not-allowed"
          )}
        >
          <Minus size={16} />
        </button>
        <span className={cn("w-8 text-center font-bold text-lg", getTextColor())}>{count}</span>
        <button
          type="button"
          onClick={() => onUpdate(1)}
          disabled={readOnly}
          className={cn(
            "w-9 h-9 flex items-center justify-center rounded-lg border transition-colors",
            theme === 'light' ? 'border-slate-200 hover:bg-slate-50' : 'border-white/10 hover:bg-white/10',
            readOnly && "opacity-30 cursor-not-allowed"
          )}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div className={cn("rounded-xl border p-4 space-y-4", getBorderClass(), theme === 'light' ? 'bg-white' : 'bg-white/5')}>
      {/* Header */}
      <div className="flex justify-between items-center border-b pb-3 border-gray-500/10">
        <span className={cn("text-xs font-bold uppercase tracking-wider opacity-60", getTextColor())}>Passenger Composition</span>
        <div className="px-2 py-1 rounded-md bg-blue-500/20 text-blue-500 text-xs font-bold border border-blue-500/30">
          Total Pax: {value.adults + value.children}
        </div>
      </div>

      {/* Counters */}
      <div className="space-y-1">
        <CounterRow label="Adults" count={value.adults} onUpdate={updateAdults} icon={Users} min={1} />
        <CounterRow label="Children" count={value.children} onUpdate={updateChildren} icon={Baby} min={0} />
      </div>

      {/* Child Ages */}
      {value.children > 0 && (
        <div className="animate-in slide-in-from-top-2 fade-in duration-300 pt-2 border-t border-gray-500/10">
          <p className={cn("text-xs font-medium mb-3 opacity-70", getTextColor())}>Child Ages (0-17 yrs)</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {value.childAges.map((age, idx) => (
              <div key={idx} className="relative">
                <label className={cn("absolute -top-2 left-2 px-1 text-[10px] font-bold bg-transparent z-10", getTextColor())}>
                  Child {idx + 1}
                </label>
                <input
                  type="number"
                  min="0"
                  max="17"
                  value={age}
                  readOnly={readOnly}
                  onChange={(e) => updateChildAge(idx, parseInt(e.target.value) || 0)}
                  className={cn(
                    "w-full text-center py-2 rounded-lg border outline-none transition-all pt-3",
                    getInputClass(),
                    readOnly && "opacity-50"
                  )}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
