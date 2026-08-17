
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTasks, TeamTask } from '../contexts/TaskContext';
import { useTheme } from '../contexts/ThemeContext';
import { cn, formatDate } from '../utils/helpers';
import { CheckSquare, ChevronRight, Flame, Clock, Check, X } from 'lucide-react';

export const TaskFloatingButton: React.FC = () => {
  const { user } = useAuth();
  const { getMyTasks, getPendingCount, completeTask } = useTasks();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [justDone, setJustDone] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  if (!user) return null;

  const myTasks = getMyTasks(user.name);
  const count = getPendingCount(user.name);
  const hasUrgent = myTasks.some(t => t.priority === 'urgent');

  const handleComplete = (e: React.MouseEvent, task: TeamTask) => {
    e.stopPropagation();
    completeTask(task.id);
    setJustDone(task.id);
    setTimeout(() => setJustDone(null), 2000);
  };

  const handleOpenTask = (taskId: string) => {
    navigate('/reminders');
    setOpen(false);
    localStorage.setItem('tte_open_task', taskId);
  };

  return (
    <div ref={panelRef} className="fixed bottom-6 right-6 md:right-24 z-40">

      {/* ── Expanded Panel — glass island with double-bezel ────────────────── */}
      {open && (
        <div className={cn(
          'absolute bottom-14 right-0 w-80 max-h-[70vh] flex flex-col',
          'rounded-[1.5rem] overflow-hidden animate-scale-pop',
          // Outer bezel
          'p-[1px]',
          theme === 'light'
            ? 'bg-gradient-to-br from-slate-200/90 to-slate-100/60 shadow-[0_8px_32px_-4px_rgba(15,23,42,0.16),0_24px_56px_-12px_rgba(15,23,42,0.20)]'
            : 'bg-white/20 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.3)]'
        )}>
          {/* Inner core */}
          <div className={cn(
            'flex flex-col h-full rounded-[calc(1.5rem-1px)] overflow-hidden',
            theme === 'light'
              ? 'bg-white shadow-[inset_0_1px_0_rgba(255,255,255,1)]'
              : 'bg-slate-900'
          )}>

            {/* Panel header */}
            <div className={cn(
              'flex items-center justify-between px-4 py-3.5 shrink-0',
              'border-b',
              theme === 'light' ? 'border-slate-100/80 bg-slate-50/60' : 'border-white/10 bg-white/5'
            )}>
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  'w-7 h-7 rounded-xl flex items-center justify-center',
                  theme === 'light' ? 'bg-indigo-50' : 'bg-indigo-500/20'
                )}>
                  <CheckSquare size={13} className="text-indigo-500" />
                </div>
                <div>
                  <span className={cn('text-xs font-bold', theme === 'light' ? 'text-slate-800' : 'text-white')}>My Tasks</span>
                  {count > 0 && (
                    <span className="ml-2 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600">{count}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => { navigate('/reminders'); setOpen(false); }}
                className={cn(
                  'flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full transition-all duration-300',
                  theme === 'light'
                    ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                    : 'text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20'
                )}
              >
                All <ChevronRight size={10} />
              </button>
            </div>

            {/* Task list */}
            <div className="overflow-y-auto custom-scrollbar">
              {myTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-40">
                  <CheckSquare size={28} className="mb-2" />
                  <p className="text-xs font-medium">All clear — no pending tasks</p>
                </div>
              ) : (
                myTasks.map((task, i) => {
                  const isDone = justDone === task.id;
                  const isUrgent = task.priority === 'urgent';
                  return (
                    <div
                      key={task.id}
                      onClick={() => handleOpenTask(task.id)}
                      style={{ animationDelay: `${i * 40}ms` }}
                      className={cn(
                        'flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-all duration-300 border-b last:border-b-0',
                        'animate-blur-in',
                        isDone ? 'opacity-30' : '',
                        theme === 'light'
                          ? 'border-slate-50 hover:bg-slate-50/80'
                          : 'border-white/5 hover:bg-white/5'
                      )}
                    >
                      {/* Priority dot / icon */}
                      <div className={cn(
                        'w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
                        isUrgent
                          ? 'bg-red-50'
                          : (theme === 'light' ? 'bg-slate-100' : 'bg-white/10')
                      )}>
                        {isUrgent
                          ? <Flame size={12} className="text-red-500" />
                          : <Clock size={12} className={theme === 'light' ? 'text-slate-400' : 'text-white/40'} />
                        }
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-[12px] font-bold leading-tight truncate', theme === 'light' ? 'text-slate-800' : 'text-white')}>
                          {task.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={cn('text-[9px] font-semibold', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>
                            from {task.assignedBy}
                          </span>
                          {task.dueDate && (
                            <span className={cn('text-[9px] font-semibold', theme === 'light' ? 'text-slate-300' : 'text-white/30')}>
                              · {formatDate(task.dueDate)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quick complete circle */}
                      <button
                        onClick={e => handleComplete(e, task)}
                        className={cn(
                          'w-6 h-6 rounded-full border-[1.5px] flex items-center justify-center shrink-0 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] mt-0.5',
                          isDone
                            ? 'bg-emerald-500 border-emerald-500 text-white scale-110'
                            : (theme === 'light'
                                ? 'border-slate-300 hover:border-emerald-400 hover:bg-emerald-50 hover:scale-110'
                                : 'border-white/20 hover:border-emerald-400 hover:bg-emerald-500/10')
                        )}
                      >
                        {isDone && <Check size={11} />}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── The Levitating Pill Button ────────────────────────────────────── */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'relative flex items-center gap-2.5 rounded-full font-bold text-sm',
          'transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]',
          'active:scale-[0.96]',
          open
            ? cn(
                'px-4 py-2.5',
                theme === 'light'
                  ? 'bg-slate-900 text-white shadow-[0_8px_32px_-4px_rgba(15,23,42,0.30)]'
                  : 'bg-white text-slate-900 shadow-lg'
              )
            : count > 0
              ? cn(
                  'px-4 py-2.5 animate-bounce-subtle',
                  'bg-indigo-600 text-white',
                  'shadow-[0_4px_20px_-4px_rgba(99,102,241,0.5),0_8px_40px_-8px_rgba(99,102,241,0.3)]',
                  'hover:shadow-[0_8px_32px_-4px_rgba(99,102,241,0.6),0_16px_48px_-8px_rgba(99,102,241,0.4)]',
                  'hover:-translate-y-0.5'
                )
              : cn(
                  'px-4 py-2.5',
                  theme === 'light'
                    ? 'bg-white text-slate-700 border border-slate-200 shadow-ambient-sm hover:shadow-ambient hover:-translate-y-0.5'
                    : 'bg-slate-800 text-white border border-white/10 shadow-lg hover:-translate-y-0.5'
                )
        )}
      >
        {/* Icon */}
        {open
          ? <X size={15} />
          : <CheckSquare size={15} className={count > 0 ? 'text-white' : 'text-indigo-500'} />
        }

        {/* Label */}
        <span className="leading-none">
          {open ? 'Close' : count > 0 ? `${count} Task${count !== 1 ? 's' : ''}` : 'Tasks'}
        </span>

        {/* Urgent pulse ring */}
        {count > 0 && !open && hasUrgent && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-white" />
          </span>
        )}
      </button>
    </div>
  );
};
