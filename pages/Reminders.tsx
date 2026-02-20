
import React, { useState, useRef, useEffect } from 'react';
import { useLeads } from '../contexts/LeadContext';
import { useTheme } from '../contexts/ThemeContext';
import { cn, formatDate, formatCompactCurrency } from '../utils/helpers';
import { DialButton } from '../components/ui/DialButton';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  Circle, 
  Clock,
  Phone,
  Mail,
  AlertTriangle,
  Sunrise,
  Sun,
  Moon,
  Calendar,
  MessageSquare,
  FileText,
  Wallet,
  MapPin,
  Check,
  MoreHorizontal,
  RotateCcw
} from 'lucide-react';
import { Link } from 'react-router-dom';

// --- Types & Helpers ---

type TimeBucket = 'overdue' | 'morning' | 'afternoon' | 'evening' | 'tomorrow' | 'upcoming';

const isToday = (date: Date) => {
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
};

const isTomorrow = (date: Date) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return date.getDate() === tomorrow.getDate() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getFullYear() === tomorrow.getFullYear();
};

// --- Task Type Logic ---
const getTaskType = (task: string) => {
    const t = task.toLowerCase();
    if (t.includes('call') || t.includes('phone')) return { type: 'Call', icon: Phone, color: 'bg-green-100 text-green-600' };
    if (t.includes('email') || t.includes('mail') || t.includes('send')) return { type: 'Email', icon: Mail, color: 'bg-blue-100 text-blue-600' };
    if (t.includes('pay') || t.includes('invoice') || t.includes('budget') || t.includes('cost')) return { type: 'Payment', icon: Wallet, color: 'bg-purple-100 text-purple-600' };
    if (t.includes('visa') || t.includes('doc') || t.includes('passport')) return { type: 'Docs', icon: FileText, color: 'bg-amber-100 text-amber-600' };
    return { type: 'General', icon: CheckCircle2, color: 'bg-slate-100 text-slate-500' };
};

// --- Components ---

const SnoozeMenu = ({ onSelect, onClose }: { onSelect: (mins: number | string) => void, onClose: () => void }) => {
    const { theme } = useTheme();
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div ref={menuRef} className={cn(
            "absolute right-0 top-8 z-50 w-32 rounded-xl shadow-xl border overflow-hidden animate-in fade-in zoom-in-95 duration-100",
            theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/20'
        )}>
            {[
                { label: '+1 Hour', val: 60 },
                { label: '+3 Hours', val: 180 },
                { label: 'Tomorrow', val: 'tomorrow' },
                { label: 'Next Week', val: 'week' }
            ].map((opt) => (
                <button
                    key={opt.label}
                    onClick={(e) => { e.stopPropagation(); onSelect(opt.val); }}
                    className={cn(
                        "w-full text-left px-3 py-2 text-xs font-bold transition-colors hover:bg-blue-50 hover:text-blue-600",
                        theme === 'light' ? 'text-slate-600' : 'text-slate-300'
                    )}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
};

const ActionableTaskRow = ({ reminder, lead, onToggle, onSnooze, isOverdue }: any) => {
    const { theme, getTextColor } = useTheme();
    const [showSnooze, setShowSnooze] = useState(false);
    const [isCompleting, setIsCompleting] = useState(false);
    
    // Cast motion.div to any to avoid TypeScript errors
    const MotionDiv = motion.div as any;

    // 1. Context Extraction
    const { icon: TaskIcon, color: iconColor } = getTaskType(reminder.task);
    const waLink = lead ? `https://wa.me/${lead.contact.phone.replace(/[^0-9]/g, '')}` : '#';
    const emailLink = lead ? `mailto:${lead.contact.email}` : '#';
    
    // 2. Data Formatting
    const timeDisplay = new Date(reminder.dueDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const budgetDisplay = lead ? formatCompactCurrency(lead.tripDetails.budget) : '';
    const destDisplay = lead?.tripDetails.destination || 'General';

    const handleSnooze = (val: number | string) => {
        onSnooze(reminder.id, val);
        setShowSnooze(false);
    };

    const handleComplete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isCompleting) return;
        
        setIsCompleting(true);
        // Confetti removed per request
        
        // Delay actual removal to allow animation to play
        setTimeout(() => {
            onToggle(reminder.id);
        }, 600);
    };

    if (reminder.isCompleted && !isCompleting) return null; // Or render differently if showing history

    return (
        <MotionDiv 
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className={cn(
                "group relative flex items-center gap-4 py-3 px-4 transition-all duration-300 border-b min-h-[72px]",
                theme === 'light' ? 'bg-white border-slate-100 hover:bg-slate-50' : 'bg-white/5 border-white/5 hover:bg-white/10',
                isOverdue && "bg-rose-50/50 border-l-4 border-l-rose-500", // Red Zone urgency
                isCompleting && "opacity-50 grayscale"
            )}
        >
            {/* LEFT: Task-Specific Iconography */}
            <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-110", 
                iconColor,
                isCompleting && "bg-emerald-100 text-emerald-600 scale-125 rotate-12"
            )}>
                {isCompleting ? <Check size={20} strokeWidth={3} /> : <TaskIcon size={18} />}
            </div>

            {/* CENTER: The Context Upgrade */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className={cn(
                    "text-sm flex items-center gap-2 mb-0.5 transition-all", 
                    getTextColor(),
                    isCompleting && "line-through opacity-50"
                )}>
                    <span className="font-bold truncate">{reminder.task}</span>
                    {lead && (
                        <span className="text-slate-400 font-normal truncate hidden sm:inline">
                            for <span className={cn("font-medium", theme === 'light' ? 'text-slate-600' : 'text-slate-300')}>{lead.name}</span>
                        </span>
                    )}
                </div>
                
                <div className={cn("flex items-center gap-2 text-[11px] font-medium opacity-70", theme === 'light' ? 'text-slate-500' : 'text-slate-400')}>
                    {lead && (
                        <>
                            <span className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 border border-slate-200">
                                <MapPin size={10} /> {destDisplay}
                            </span>
                            <span className="hidden sm:inline text-slate-300">•</span>
                            {budgetDisplay && (
                                <span className="hidden sm:inline font-mono text-emerald-600 dark:text-emerald-400 font-bold">{budgetDisplay}</span>
                            )}
                            <span className="text-slate-300">•</span>
                        </>
                    )}
                    <span className={cn("flex items-center gap-1", isOverdue ? "text-rose-500 font-bold animate-pulse" : "")}>
                        <Clock size={10} /> {isOverdue ? 'Overdue' : 'Due'}: {timeDisplay}
                    </span>
                </div>
            </div>

            {/* RIGHT: Hover-to-Act Interface */}
            <div className="relative shrink-0 h-10 flex items-center justify-end min-w-[140px]">
                
                {/* Default State: Assigned User / Lead Context */}
                <div className="absolute right-0 flex items-center gap-3 transition-all duration-300 group-hover:opacity-0 group-hover:translate-x-4 pointer-events-none group-hover:pointer-events-none">
                    {lead && (
                        <div className={cn("text-right hidden sm:block", theme === 'light' ? 'text-slate-400' : 'text-slate-500')}>
                            <div className="text-[10px] uppercase font-bold tracking-wider">Client</div>
                            <div className="text-xs font-medium truncate max-w-[100px]">{lead.name}</div>
                        </div>
                    )}
                    <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border",
                        theme === 'light' ? "bg-slate-50 border-slate-200 text-slate-500" : "bg-white/10 border-white/10 text-white"
                    )}>
                        {lead ? lead.name.charAt(0) : <AlertTriangle size={14} />}
                    </div>
                </div>

                {/* Hover State: Quick Action Buttons */}
                <div className="absolute right-0 flex items-center gap-2 opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                    
                    {/* Call Button */}
                    {lead?.contact?.phone && (
                        <DialButton phoneNumber={lead.contact.phone} className="w-9 h-9 shadow-sm border border-green-200 bg-green-50 text-green-600 hover:bg-green-100" />
                    )}

                    {/* WhatsApp Button */}
                    {lead?.contact?.phone && (
                        <a 
                            href={waLink} 
                            target="_blank" 
                            rel="noreferrer"
                            className="w-9 h-9 flex items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 hover:scale-105 transition-all shadow-sm"
                            title="WhatsApp"
                        >
                            <MessageSquare size={16} />
                        </a>
                    )}

                    {/* Snooze Button */}
                    <div className="relative">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowSnooze(!showSnooze); }}
                            className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100 hover:text-blue-600 transition-all shadow-sm"
                            title="Snooze"
                        >
                            <Clock size={16} />
                        </button>
                        {showSnooze && <SnoozeMenu onSelect={handleSnooze} onClose={() => setShowSnooze(false)} />}
                    </div>

                    {/* Done Button (Gamified Checkbox) */}
                    <button 
                        onClick={handleComplete}
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-500 hover:scale-110 active:scale-95 transition-all shadow-lg shadow-blue-200"
                        title="Complete"
                    >
                        <Check size={18} strokeWidth={3} />
                    </button>
                </div>
            </div>
        </MotionDiv>
    );
};

const BucketSection = ({ title, icon: Icon, colorClass, tasks, leads, onToggle, onSnooze, isOverdueBucket }: any) => {
    const { theme } = useTheme();
    
    if (tasks.length === 0) return null;

    return (
        <div className="mb-6">
            {/* Sticky Header */}
            <div className={cn(
                "sticky top-0 z-20 flex items-center gap-2 py-3 px-4 text-xs font-extrabold uppercase tracking-widest backdrop-blur-md shadow-sm transition-colors border-b rounded-t-2xl",
                theme === 'light' 
                    ? 'bg-slate-50/95 text-slate-500 border-slate-200' 
                    : 'bg-slate-900/95 text-slate-300 border-white/10',
                isOverdueBucket && "bg-rose-50/95 text-rose-600 border-rose-200"
            )}>
                <Icon size={14} className={colorClass} />
                <span>{title}</span>
                <span className={cn(
                    "ml-auto text-[10px] px-2 py-0.5 rounded-full min-w-[24px] text-center",
                    isOverdueBucket ? "bg-rose-100 text-rose-600" : "bg-slate-200 text-slate-600"
                )}>
                    {tasks.length}
                </span>
            </div>

            {/* List Body */}
            <div className={cn(
                "bg-white rounded-b-2xl border-x border-b overflow-hidden shadow-sm",
                theme === 'light' ? 'border-slate-200' : 'bg-transparent border-white/10'
            )}>
                <AnimatePresence>
                    {tasks.map((task: any) => (
                        <ActionableTaskRow 
                            key={task.id} 
                            reminder={task} 
                            lead={leads.find((l: any) => l.id === task.leadId)}
                            onToggle={onToggle}
                            onSnooze={onSnooze}
                            isOverdue={isOverdueBucket}
                        />
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};

// --- Main Page ---

export const Reminders = () => {
  const { reminders, leads, toggleReminder, updateReminder } = useLeads();
  const { theme, getTextColor } = useTheme();
  
  // Collapsible State
  const [showCompleted, setShowCompleted] = useState(false);

  // Bucket Logic
  const categorizeTask = (dueDateStr: string): TimeBucket => {
      const date = new Date(dueDateStr);
      const now = new Date();

      // Only mark overdue if it's strictly before today, or if it's today but hour is passed (simplified)
      // Actually strict overdue: date < now
      if (date < now && !isToday(date)) return 'overdue';
      if (date < now && isToday(date)) return 'overdue'; // Intraday overdue
      
      if (isToday(date)) {
          const hour = date.getHours();
          if (hour < 12) return 'morning';
          if (hour < 17) return 'afternoon';
          return 'evening';
      }

      if (isTomorrow(date)) return 'tomorrow';
      return 'upcoming';
  };

  // Process Tasks
  const pendingTasks = reminders.filter(r => !r.isCompleted);
  const completedTasks = reminders.filter(r => r.isCompleted).sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()); // Newest completed first

  const buckets: Record<TimeBucket, any[]> = {
      overdue: [],
      morning: [],
      afternoon: [],
      evening: [],
      tomorrow: [],
      upcoming: []
  };

  pendingTasks.forEach(task => {
      const bucket = categorizeTask(task.dueDate);
      buckets[bucket].push(task);
  });

  // Sorting within buckets (Date Ascending)
  Object.keys(buckets).forEach(key => {
      buckets[key as TimeBucket].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  });

  const handleSnooze = (id: string, option: number | string) => {
      const task = reminders.find(r => r.id === id);
      if (!task) return;

      let newDate = new Date();
      
      if (typeof option === 'number') {
          // Add minutes to current time (snooze from NOW)
          newDate = new Date(Date.now() + option * 60000);
      } else if (option === 'tomorrow') {
          newDate.setDate(newDate.getDate() + 1);
          newDate.setHours(9, 0, 0, 0);
      } else if (option === 'week') {
          newDate.setDate(newDate.getDate() + 7);
          newDate.setHours(9, 0, 0, 0);
      }

      updateReminder(id, { dueDate: newDate.toISOString() });
  };

  return (
    <div className="pb-20 max-w-4xl mx-auto px-4 md:px-0">
      
      {/* Header */}
      <div className="mb-8 pt-4 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
            <h1 className={cn("text-3xl font-bold font-serif", getTextColor())}>Action Center</h1>
            <p className={cn("text-sm opacity-60 mt-1 max-w-md", getTextColor())}>
                Focus on high-priority actions. Clear the red zone first.
            </p>
        </div>
        <div className={cn(
            "flex items-center gap-3 px-4 py-2 rounded-xl border shadow-sm", 
            theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'
        )}>
            <div className="text-right">
                <p className={cn("text-[10px] font-bold uppercase tracking-wider opacity-50", getTextColor())}>Tasks Pending</p>
                <p className={cn("text-xl font-bold leading-none text-blue-600")}>{pendingTasks.length}</p>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
            <div className="text-right">
                <p className={cn("text-[10px] font-bold uppercase tracking-wider opacity-50", getTextColor())}>Urgent</p>
                <p className={cn("text-xl font-bold leading-none text-rose-500")}>{buckets.overdue.length}</p>
            </div>
        </div>
      </div>

      {/* Task Buckets */}
      <div className="space-y-2">
          
          <BucketSection 
            title="Overdue & Urgent" 
            icon={AlertTriangle} 
            colorClass="text-rose-600" 
            tasks={buckets.overdue} 
            leads={leads}
            onToggle={toggleReminder}
            onSnooze={handleSnooze}
            isOverdueBucket={true}
          />

          <BucketSection 
            title="Morning Focus" 
            icon={Sunrise} 
            colorClass="text-blue-500" 
            tasks={buckets.morning} 
            leads={leads}
            onToggle={toggleReminder}
            onSnooze={handleSnooze}
          />

          <BucketSection 
            title="Afternoon Tasks" 
            icon={Sun} 
            colorClass="text-amber-500" 
            tasks={buckets.afternoon} 
            leads={leads}
            onToggle={toggleReminder}
            onSnooze={handleSnooze}
          />

          <BucketSection 
            title="Evening Wrap-up" 
            icon={Moon} 
            colorClass="text-indigo-500" 
            tasks={buckets.evening} 
            leads={leads}
            onToggle={toggleReminder}
            onSnooze={handleSnooze}
          />

          <BucketSection 
            title="Tomorrow" 
            icon={Calendar} 
            colorClass={theme === 'light' ? 'text-slate-600' : 'text-slate-300'}
            tasks={buckets.tomorrow} 
            leads={leads}
            onToggle={toggleReminder}
            onSnooze={handleSnooze}
        />

        <BucketSection 
            title="Upcoming" 
            icon={Calendar} 
            colorClass={theme === 'light' ? 'text-slate-400' : 'text-slate-500'}
            tasks={buckets.upcoming} 
            leads={leads}
            onToggle={toggleReminder}
            onSnooze={handleSnooze}
        />

         {/* Empty State */}
        {pendingTasks.length === 0 && (
            <div className="py-24 text-center animate-in zoom-in-95 duration-500">
                <div className={cn("w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-100", theme === 'light' ? 'bg-emerald-50 text-emerald-500' : 'bg-white/5 text-white/50')}>
                    <CheckCircle2 size={40} />
                </div>
                <h2 className={cn("text-2xl font-bold font-serif", getTextColor())}>All Clear!</h2>
                <p className={cn("text-sm opacity-60 mt-2", getTextColor())}>You've crushed your agenda for today.</p>
                <div className="mt-8">
                    <Link to="/leads" className="px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-slate-800 transition-all">
                        Find More Work
                    </Link>
                </div>
            </div>
        )}
      </div>

      {/* Completed Section (Bottom) */}
      {completedTasks.length > 0 && (
          <div className="mt-12 border-t border-dashed border-slate-200 pt-8">
              <button 
                  onClick={() => setShowCompleted(!showCompleted)}
                  className={cn("text-xs font-bold uppercase tracking-wider mb-6 opacity-40 flex items-center justify-center gap-2 hover:opacity-100 transition-opacity w-full", getTextColor())}
              >
                  {showCompleted ? "Hide" : "Show"} Completed History ({completedTasks.length})
              </button>
              
              {showCompleted && (
                  <div className={cn(
                      "rounded-2xl overflow-hidden animate-in slide-in-from-top-2 fade-in opacity-50 grayscale hover:grayscale-0 transition-all duration-500",
                      theme === 'light' ? 'bg-slate-50 border border-slate-100' : 'bg-white/5 border border-white/5'
                  )}>
                      {completedTasks.map(task => (
                           <div key={task.id} className="flex items-center justify-between p-4 border-b border-slate-200/50 last:border-0 hover:bg-slate-100/50 transition-colors group">
                               <div className="flex items-center gap-3">
                                   <button 
                                      onClick={() => toggleReminder(task.id)}
                                      className="text-emerald-500 hover:text-slate-400 p-1 rounded hover:bg-slate-200/50 transition-all"
                                      title="Mark as incomplete (Undo)"
                                   >
                                       <CheckCircle2 size={18} className="fill-emerald-100" />
                                   </button>
                                   <span className="text-sm line-through decoration-slate-400 text-slate-500 font-medium">{task.task}</span>
                               </div>
                               <span className="text-xs font-mono text-slate-400">{new Date(task.dueDate).toLocaleDateString()}</span>
                           </div>
                      ))}
                  </div>
              )}
          </div>
      )}

    </div>
  );
};
