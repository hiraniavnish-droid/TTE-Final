
import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils/helpers';
import { TravelPreferences as TravelPreferencesType } from '../types';
import { BedDouble, Utensils } from 'lucide-react';

interface TravelPreferencesProps {
  value?: TravelPreferencesType;
  onChange: (prefs: TravelPreferencesType) => void;
  readOnly?: boolean;
}

const CATEGORIES = [
  {
    key: 'hotel' as keyof TravelPreferencesType,
    label: 'Hotel Category',
    icon: BedDouble,
    options: ['3 Star', '4 Star', '5 Star', 'Luxury']
  },
  {
    key: 'mealPlan' as keyof TravelPreferencesType,
    label: 'Meal Plan',
    icon: Utensils,
    options: ['CP (Bfast)', 'MAP (Bfast+Din)', 'AP (All Meals)']
  }
];

export const TravelPreferences: React.FC<TravelPreferencesProps> = ({ 
  value = {}, 
  onChange, 
  readOnly = false 
}) => {
  const { theme, getTextColor, getBorderClass } = useTheme();

  const handleToggle = (key: keyof TravelPreferencesType, option: string) => {
    if (readOnly) return;
    
    // Toggle logic: If selected, remove it. If not, set it.
    const currentValue = value[key];
    const newValue = currentValue === option ? undefined : option;
    
    onChange({
      ...value,
      [key]: newValue
    });
  };

  return (
    <div className={cn("space-y-4", readOnly && "opacity-90")}>
      <h3 className={cn("text-xs font-bold uppercase tracking-wider opacity-60 mb-2", getTextColor())}>Trip Preferences</h3>
      
      <div className="grid grid-cols-1 gap-4">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const selectedValue = value[cat.key];

          // In ReadOnly mode, only show categories that have a selection
          if (readOnly && !selectedValue) return null;

          return (
            <div key={cat.key} className={cn("rounded-xl border p-3", getBorderClass(), theme === 'light' ? 'bg-slate-50/50' : 'bg-white/5')}>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} className={cn("opacity-60", getTextColor())} />
                <span className={cn("text-xs font-bold opacity-70 uppercase", getTextColor())}>{cat.label}</span>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {cat.options.map((option) => {
                   const isSelected = selectedValue === option;
                   
                   // In ReadOnly mode, only show the selected option
                   if (readOnly && !isSelected) return null;

                   return (
                     <button
                       key={option}
                       type="button"
                       onClick={() => handleToggle(cat.key, option)}
                       disabled={readOnly}
                       className={cn(
                         "text-xs px-3 py-1.5 rounded-lg border transition-all duration-200 font-medium",
                         isSelected 
                           ? (theme === 'light' 
                               ? "bg-teal-100 border-teal-500 text-teal-700 shadow-sm" 
                               : "bg-teal-500/20 border-teal-500/50 text-teal-300 shadow-sm")
                           : (theme === 'light'
                               ? "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                               : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10")
                       )}
                     >
                       {option}
                     </button>
                   );
                })}
              </div>
            </div>
          );
        })}
        {readOnly && Object.keys(value).length === 0 && (
            <p className={cn("text-xs italic opacity-50", getTextColor())}>No specific preferences logged.</p>
        )}
      </div>
    </div>
  );
};
