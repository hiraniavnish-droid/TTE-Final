
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLeads } from '../contexts/LeadContext';
import { addDays, format, addMinutes } from 'date-fns';
import { Calendar as CalendarIcon, Clock, ChevronDown, ChevronUp, Check, X, CalendarDays } from 'lucide-react';
import { generateId, cn } from '../utils/helpers';
import { Reminder } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { DayPicker } from 'react-day-picker';

// Local helper functions
const setHoursFn = (date: Date | number, hours: number): Date => {
  const d = new Date(date);
  d.setHours(hours);
  return d;
};

const setMinutesFn = (date: Date | number, minutes: number): Date => {
  const d = new Date(date);
  d.setMinutes(minutes);
  return d;
};

export const SmartNudge = () => {
  const { nudge, closeNudge, addReminder } = useLeads();
  
  // Cast motion.div to any to avoid TypeScript errors
  const MotionDiv = motion.div as any;
  
  // State
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedHour, setSelectedHour] = useState(10);
  const [selectedMinute, setSelectedMinute] = useState(0);
  
  // Modes: 'none' | 'date' | 'time'
  const [activeMode, setActiveMode] = useState<'none' | 'date' | 'time'>('none');
  const [isCustomExpanded, setIsCustomExpanded] = useState(false);
  const [shake, setShake] = useState(0);

  // Computed Date
  const fullSelectedDate = useMemo(() => {
      return setMinutesFn(setHoursFn(selectedDate, selectedHour), selectedMinute);
  }, [selectedDate, selectedHour, selectedMinute]);

  // Smart Defaults
  const smartOptions = useMemo(() => {
      const now = new Date();
      switch (nudge.status) {
          case 'New':
              return [
                  { label: '+15 Mins', date: addMinutes(now, 15) },
                  { label: '+1 Hour', date: addMinutes(now, 60) },
                  { label: 'Tomorrow', date: setHoursFn(setMinutesFn(addDays(now, 1), 0), 10) }
              ];
          case 'Contacted':
              return [
                  { label: 'Tomorrow', date: setHoursFn(setMinutesFn(addDays(now, 1), 0), 10) },
                  { label: 'Evening', date: setHoursFn(setMinutesFn(now, 0), 19) },
                  { label: '2 Days', date: setHoursFn(setMinutesFn(addDays(now, 2), 0), 11) }
              ];
          case 'Proposal Sent':
              return [
                  { label: 'Tomorrow', date: setHoursFn(setMinutesFn(addDays(now, 1), 0), 11) },
                  { label: '2 Days', date: setHoursFn(setMinutesFn(addDays(now, 2), 0), 11) },
                  { label: 'Next Week', date: setHoursFn(setMinutesFn(addDays(now, 7), 0), 10) }
              ];
          default:
              return [
                  { label: 'Tomorrow', date: setHoursFn(setMinutesFn(addDays(now, 1), 0), 10) },
                  { label: '2 Days', date: setHoursFn(setMinutesFn(addDays(now, 2), 0), 10) },
                  { label: 'Next Week', date: setHoursFn(setMinutesFn(addDays(now, 7), 0), 10) }
              ];
      }
  }, [nudge.status, nudge.isOpen]);

  useEffect(() => {
    if (nudge.isOpen) {
      setIsCustomExpanded(false);
      setActiveMode('none');
      if (smartOptions.length > 0) {
          updateSelection(smartOptions[0].date);
      } else {
          updateSelection(addDays(new Date(), 1));
      }
    }
  }, [nudge.isOpen, nudge.status]);

  if (!nudge.isOpen || !nudge.leadId) return null;

  const updateSelection = (date: Date) => {
      setSelectedDate(date);
      setSelectedHour(date.getHours());
      setSelectedMinute(date.getMinutes());
  };

  const handleChipSelect = (date: Date) => {
      updateSelection(date);
      setActiveMode('none'); // Close custom inputs if quick select is used
  };

  const getTaskName = (status: any) => {
      switch(status) {
          case 'New': return 'First Contact';
          case 'Contacted': return 'Send Requirements / Call Back';
          case 'Proposal Sent': return 'Follow up on Quote';
          case 'Discussion': return 'Check Booking Decision';
          case 'Won': return 'Ask for Referral / Feedback';
          default: return 'Follow up';
      }
  };

  const handleConfirm = () => {
      const reminder: Reminder = {
          id: generateId(),
          leadId: nudge.leadId!,
          task: getTaskName(nudge.status),
          dueDate: fullSelectedDate.toISOString(),
          isCompleted: false
      };
      addReminder(reminder);
      closeNudge();
  };

  const handleOverlayClick = () => setShake(prev => prev + 1);

  // Time Logic
  const timeOptions = Array.from({ length: 24 }).map((_, i) => i); // 0-23
  const minuteOptions = [0, 15, 30, 45];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        
        {/* Backdrop */}
        <MotionDiv 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
            onClick={handleOverlayClick}
        />

        {/* Compact Card - Changed overflow-hidden to overflow-visible to prevent clipping */}
        <AnimatePresence mode="wait">
            <MotionDiv
                key="unified-scheduler"
                layout
                initial={{ y: 20, opacity: 0, scale: 0.95 }}
                animate={{ 
                    y: 0, 
                    opacity: 1, 
                    scale: 1,
                    x: shake % 2 === 0 ? 0 : [0, -5, 5, -5, 5, 0],
                    maxWidth: '26rem' // Compact width
                }}
                exit={{ y: 20, opacity: 0, scale: 0.95 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className="relative bg-white w-full rounded-2xl shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-visible flex flex-col pointer-events-auto"
            >
                {/* Header */}
                <div className="px-5 pt-5 pb-1 flex justify-between items-start">
                    <div>
                        <h2 className="text-lg font-bold font-serif text-slate-900">Schedule Follow-up</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Status: <span className="font-semibold text-blue-600">{nudge.status}</span></p>
                    </div>
                    <button onClick={closeNudge} className="p-1.5 -mr-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    
                    {/* 1. Smart Suggestions */}
                    <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quick Suggestion</p>
                        <div className="flex gap-2">
                            {smartOptions.map((opt, idx) => {
                                const isSelected = Math.abs(fullSelectedDate.getTime() - opt.date.getTime()) < 60000;
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => handleChipSelect(opt.date)}
                                        className={cn(
                                            "flex-1 py-2 px-1 rounded-lg text-xs font-semibold transition-all duration-200 border relative overflow-hidden",
                                            isSelected 
                                                ? "bg-blue-600 text-white border-blue-600 shadow-md" 
                                                : "bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-white"
                                        )}
                                    >
                                        <span className="relative z-10">{opt.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 2. Compact Custom Input Module */}
                    <div className="space-y-2">
                        <button 
                            onClick={() => setIsCustomExpanded(!isCustomExpanded)}
                            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors uppercase tracking-wider"
                        >
                            <CalendarIcon size={12} /> Custom Date & Time
                            {isCustomExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>

                        <AnimatePresence>
                            {isCustomExpanded && (
                                <MotionDiv 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-visible" // Ensure parent allows overflow
                                >
                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 relative">
                                        
                                        {/* Click Outside Listener Backdrop for Calendar */}
                                        {activeMode === 'date' && (
                                            <div 
                                                className="fixed inset-0 z-40 bg-transparent" 
                                                onClick={() => setActiveMode('none')} 
                                            />
                                        )}

                                        {/* Input Row (Buttons) */}
                                        <div className="flex gap-3 relative z-10">
                                            {/* Date Button */}
                                            <button
                                                onClick={() => setActiveMode(activeMode === 'date' ? 'none' : 'date')}
                                                className={cn(
                                                    "flex-1 flex items-center gap-2 bg-white border shadow-sm rounded-lg py-2.5 px-3 text-left transition-all",
                                                    activeMode === 'date' 
                                                        ? "border-blue-500 ring-2 ring-blue-100 text-blue-700" 
                                                        : "border-slate-200 text-slate-700 hover:border-blue-300"
                                                )}
                                            >
                                                <CalendarDays size={16} className={activeMode === 'date' ? "text-blue-500" : "text-slate-400"} />
                                                <span className="text-sm font-medium truncate">
                                                    {format(selectedDate, 'EEE, MMM d')}
                                                </span>
                                            </button>

                                            {/* Time Button */}
                                            <button
                                                onClick={() => setActiveMode(activeMode === 'time' ? 'none' : 'time')}
                                                className={cn(
                                                    "flex-1 flex items-center gap-2 bg-white border shadow-sm rounded-lg py-2.5 px-3 text-left transition-all",
                                                    activeMode === 'time' 
                                                        ? "border-blue-500 ring-2 ring-blue-100 text-blue-700" 
                                                        : "border-slate-200 text-slate-700 hover:border-blue-300"
                                                )}
                                            >
                                                <Clock size={16} className={activeMode === 'time' ? "text-blue-500" : "text-slate-400"} />
                                                <span className="text-sm font-medium truncate">
                                                    {format(fullSelectedDate, 'h:mm a')}
                                                </span>
                                            </button>
                                        </div>

                                        {/* Floating Date Picker (Absolute) */}
                                        <AnimatePresence>
                                            {activeMode === 'date' && (
                                                <MotionDiv
                                                    initial={{ opacity: 0, y: 10, scale: 0.95 }} // Start slightly below
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}     // Slide UP
                                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}    // Slide DOWN
                                                    // Positioning flipped: bottom-full mb-2
                                                    className="absolute bottom-full mb-2 left-0 z-50 bg-white border border-slate-200 shadow-2xl shadow-slate-400/50 rounded-xl p-2 w-full max-w-[280px]"
                                                    onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside calendar
                                                >
                                                    <style>{`
                                                        .rdp { --rdp-cell-size: 32px; --rdp-accent-color: #2563eb; margin: 0; }
                                                        .rdp-day_selected:not([disabled]) { background-color: var(--rdp-accent-color); color: white; font-weight: bold; border-radius: 6px; }
                                                        .rdp-day:hover:not([disabled]):not(.rdp-day_selected) { background-color: #f1f5f9; border-radius: 6px; }
                                                        .rdp-caption_label { color: #334155; font-weight: 700; font-size: 0.9rem; }
                                                        .rdp-nav_button { width: 24px; height: 24px; }
                                                        .rdp-head_cell { font-size: 0.65rem; color: #94a3b8; }
                                                        .rdp-day { font-size: 0.85rem; }
                                                    `}</style>
                                                    <DayPicker
                                                        mode="single"
                                                        selected={selectedDate}
                                                        onSelect={(d) => { if (d) { setSelectedDate(d); setActiveMode('none'); } }}
                                                        showOutsideDays
                                                    />
                                                </MotionDiv>
                                            )}
                                        </AnimatePresence>

                                        {/* Horizontal Time Scroller (Inline Expand) */}
                                        <AnimatePresence>
                                            {activeMode === 'time' && (
                                                <MotionDiv
                                                    initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                                    animate={{ height: "auto", opacity: 1, marginTop: 12 }}
                                                    exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="flex flex-col gap-3">
                                                        {/* Hour Chips */}
                                                        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar snap-x">
                                                            {timeOptions.map((h) => (
                                                                <button
                                                                    key={h}
                                                                    onClick={() => setSelectedHour(h)}
                                                                    className={cn(
                                                                        "flex-shrink-0 w-10 h-8 rounded-lg text-xs font-bold snap-center border transition-all",
                                                                        selectedHour === h 
                                                                            ? "bg-blue-600 text-white border-blue-600 shadow-md scale-105" 
                                                                            : "bg-white text-slate-500 border-slate-200 hover:border-blue-300"
                                                                    )}
                                                                >
                                                                    {h % 12 === 0 ? 12 : h % 12}{h < 12 ? 'a' : 'p'}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        {/* Minute Chips */}
                                                        <div className="flex justify-center gap-2 border-t border-slate-200 pt-2">
                                                            {minuteOptions.map(m => (
                                                                <button
                                                                    key={m}
                                                                    onClick={() => setSelectedMinute(m)}
                                                                    className={cn(
                                                                        "px-3 py-1 rounded-full text-[10px] font-bold border transition-all",
                                                                        selectedMinute === m 
                                                                            ? "bg-blue-100 text-blue-700 border-blue-300" 
                                                                            : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                                                                    )}
                                                                >
                                                                    :{m.toString().padStart(2, '0')}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </MotionDiv>
                                            )}
                                        </AnimatePresence>

                                    </div>
                                </MotionDiv>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* 3. Live Anchor (Footer) */}
                    <div className="flex justify-between items-center bg-slate-50 rounded-lg px-4 py-3 border border-slate-100">
                        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Target Date</span>
                        <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            {format(fullSelectedDate, 'MMM d, h:mm a')}
                        </div>
                    </div>

                    {/* 4. Confirm Button */}
                    <button 
                        onClick={handleConfirm}
                        className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
                    >
                        <Check size={18} strokeWidth={3} />
                        Set Reminder
                    </button>

                </div>
            </MotionDiv>
        </AnimatePresence>
    </div>
  );
};
