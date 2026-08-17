
import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useTasks, TeamTask, TaskPriority, TaskStatus } from '../contexts/TaskContext';
import { cn, formatDate, timeAgo, generateId } from '../utils/helpers';
import {
  Plus, Send, CheckCircle2, Clock, AlertTriangle, Flame,
  ArrowRight, User, Calendar, Tag, Link, MessageSquare,
  Trash2, X, ChevronRight, Check, ExternalLink
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; dot: string }> = {
  low:    { label: 'Low',    color: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
  normal: { label: 'Normal', color: 'bg-blue-100 text-blue-600',  dot: 'bg-blue-400' },
  high:   { label: 'High',   color: 'bg-amber-100 text-amber-700',dot: 'bg-amber-400' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-600',    dot: 'bg-red-500' },
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string }> = {
  pending:     { label: 'Pending',     color: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  completed:   { label: 'Completed',   color: 'bg-emerald-100 text-emerald-700' },
};

const isLink = (text: string) => /https?:\/\//.test(text);

// ─── Task Thread Panel ────────────────────────────────────────────────────────

const TaskThread: React.FC<{
  task: TeamTask;
  onClose: () => void;
  onComplete: () => void;
}> = ({ task, onClose, onComplete }) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { getTaskMessages, addMessage, updateTask } = useTasks();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const msgs = getTaskMessages(task.id);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs.length]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || !user) return;
    const type = isLink(text) ? 'link' : 'text';
    addMessage(task.id, user.name, text, type);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const pc = PRIORITY_CONFIG[task.priority];
  const sc = STATUS_CONFIG[task.status];

  return (
    <div className={cn(
      'flex flex-col h-full border-l',
      theme === 'light' ? 'bg-white border-slate-100' : 'bg-slate-900 border-white/10'
    )}>
      {/* Header */}
      <div className={cn('p-4 border-b shrink-0 space-y-3', theme === 'light' ? 'border-slate-100' : 'border-white/10')}>
        <div className="flex items-start justify-between gap-2">
          <h3 className={cn('font-bold text-base leading-tight flex-1', theme === 'light' ? 'text-slate-900' : 'text-white')}>
            {task.title}
          </h3>
          <button onClick={onClose} className="shrink-0 opacity-40 hover:opacity-70 transition-opacity">
            <X size={16} />
          </button>
        </div>
        {task.description && (
          <p className={cn('text-xs leading-relaxed', theme === 'light' ? 'text-slate-500' : 'text-white/50')}>
            {task.description}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', pc.color)}>{pc.label}</span>
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', sc.color)}>{sc.label}</span>
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1', theme === 'light' ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-white/60')}>
            <ArrowRight size={9} strokeWidth={2.5} /> {task.assignedTo}
          </span>
          {task.dueDate && (
            <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1', theme === 'light' ? 'bg-slate-100 text-slate-500' : 'bg-white/10 text-white/50')}>
              <Calendar size={9} /> {formatDate(task.dueDate)}
            </span>
          )}
        </div>

        {/* Status toggle (for assignee) + complete button */}
        <div className="flex gap-2">
          {user?.name === task.assignedTo && task.status !== 'completed' && (
            <button
              onClick={() => updateTask(task.id, { status: task.status === 'pending' ? 'in_progress' : 'pending' })}
              className={cn('flex-1 text-[11px] font-bold py-1.5 rounded-lg border transition-all active:scale-[0.97] flex items-center justify-center gap-1.5',
                task.status === 'in_progress'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : (theme === 'light' ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-white/10 text-white/60 hover:bg-white/5')
              )}
            >
              {task.status === 'in_progress'
                ? <><span className="w-1.5 h-1.5 rounded-full bg-white" /> In Progress</>
                : 'Mark In Progress'}
            </button>
          )}
          {task.status !== 'completed' && (
            <button
              onClick={onComplete}
              className="flex-1 text-[11px] font-bold py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1"
            >
              <Check size={12} /> Mark Complete
            </button>
          )}
          {task.status === 'completed' && (
            <div className="flex-1 text-[11px] font-bold py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center gap-1">
              <CheckCircle2 size={12} /> Completed {task.completedAt ? timeAgo(task.completedAt) : ''}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {msgs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full opacity-40 text-center">
            <MessageSquare size={28} className="mb-2" />
            <p className="text-xs font-medium">No messages yet</p>
            <p className="text-[10px] mt-1">Send a message, submit a link, or update on progress</p>
          </div>
        )}
        {msgs.map((msg) => {
          const isMe = msg.author === user?.name;
          const isAdmin = msg.author === task.assignedBy;
          return (
            <div key={msg.id} className={cn('flex gap-2', isMe ? 'flex-row-reverse' : 'flex-row')}>
              <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5', theme === 'light' ? 'bg-slate-900 text-white' : 'bg-white/10 text-white border border-white/10')}>
                {msg.author[0].toUpperCase()}
              </div>
              <div className={cn('max-w-[75%] space-y-0.5', isMe ? 'items-end' : 'items-start', 'flex flex-col')}>
                <div className={cn('text-[9px] font-bold flex items-center gap-1', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>
                  {msg.author} {isAdmin && !isMe && <span className={cn('px-1 py-0 rounded text-[8px]', theme === 'light' ? 'bg-slate-200 text-slate-600' : 'bg-white/15 text-white/70')}>ADMIN</span>}
                  · {timeAgo(msg.createdAt)}
                </div>
                {msg.type === 'link' ? (
                  <a
                    href={msg.content}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors',
                      isMe
                        ? (theme === 'light' ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800' : 'bg-white text-slate-900 border-white hover:bg-white/90')
                        : (theme === 'light' ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200' : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10')
                    )}
                  >
                    <ExternalLink size={11} />
                    <span className="truncate max-w-[180px]">{msg.content.replace(/^https?:\/\//, '')}</span>
                  </a>
                ) : (
                  <div className={cn(
                    'px-3 py-2 rounded-2xl text-xs leading-relaxed',
                    isMe
                      ? (theme === 'light' ? 'bg-slate-900 text-white rounded-tr-sm' : 'bg-white text-slate-900 rounded-tr-sm')
                      : (theme === 'light' ? 'bg-slate-100 text-slate-800 rounded-tl-sm' : 'bg-white/10 text-white rounded-tl-sm')
                  )}>
                    {msg.content}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {task.status !== 'completed' && (
        <div className={cn('p-3 border-t shrink-0', theme === 'light' ? 'border-slate-100 bg-slate-50/50' : 'border-white/10')}>
          <div className={cn('flex items-end gap-2 rounded-xl border p-2', theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10')}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message, or paste a link..."
              rows={2}
              className="flex-1 bg-transparent text-xs outline-none resize-none leading-relaxed"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className={cn(
                'shrink-0 w-8 h-8 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-95',
                theme === 'light' ? 'bg-slate-900 hover:bg-slate-800 text-white' : 'bg-white hover:bg-white/90 text-slate-900'
              )}
            >
              <Send size={13} />
            </button>
          </div>
          <p className={cn('text-[9px] mt-1.5 text-center', theme === 'light' ? 'text-slate-400' : 'text-white/30')}>
            Enter to send · Links auto-detected · Shift+Enter for newline
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Task Card ────────────────────────────────────────────────────────────────

const TaskCard: React.FC<{
  task: TeamTask;
  msgCount: number;
  isSelected: boolean;
  onSelect: () => void;
  onComplete: () => void;
  onDelete?: () => void;
  isAdmin: boolean;
}> = ({ task, msgCount, isSelected, onSelect, onComplete, onDelete, isAdmin }) => {
  const { theme } = useTheme();
  const pc = PRIORITY_CONFIG[task.priority];
  const sc = STATUS_CONFIG[task.status];
  const isOverdue = task.dueDate && task.status !== 'completed' && new Date(task.dueDate) < new Date();

  return (
    <div
      onClick={onSelect}
      className={cn(
        'group relative p-3.5 rounded-2xl border cursor-pointer transition-all',
        isSelected
          ? (theme === 'light' ? 'bg-slate-50 border-slate-300 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.1)]' : 'bg-white/10 border-white/25 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)]')
          : (theme === 'light' ? 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-[0_4px_20px_-4px_rgba(15,23,42,0.08)]' : 'bg-white/5 border-white/10 hover:border-white/20'),
        task.priority === 'urgent' && task.status !== 'completed' && 'border-l-4 border-l-red-400',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-start gap-2 min-w-0">
          <div className="mt-0.5">
            {task.status === 'completed'
              ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
              : task.priority === 'urgent'
                ? <Flame size={16} className="text-red-500 shrink-0" />
                : <Clock size={16} className={cn('shrink-0', theme === 'light' ? 'text-slate-400' : 'text-white/30')} />
            }
          </div>
          <div className="min-w-0">
            <h4 className={cn('font-bold text-sm leading-tight truncate', task.status === 'completed' ? 'line-through opacity-50' : (theme === 'light' ? 'text-slate-900' : 'text-white'))}>
              {task.title}
            </h4>
            {task.description && (
              <p className={cn('text-[11px] mt-0.5 line-clamp-1', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>
                {task.description}
              </p>
            )}
          </div>
        </div>
        <ChevronRight size={14} className={cn('shrink-0 mt-0.5 transition-transform', isSelected ? cn('rotate-90', theme === 'light' ? 'text-slate-900' : 'text-white') : 'opacity-30')} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full', pc.color)}>{pc.label}</span>
        <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full', sc.color)}>{sc.label}</span>
        <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-1 font-semibold', theme === 'light' ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-white/60')}>
          <User size={8} /> {task.assignedTo}
        </span>
        {task.dueDate && (
          <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-1 font-semibold', isOverdue ? 'bg-red-100 text-red-600' : (theme === 'light' ? 'bg-slate-100 text-slate-500' : 'bg-white/10 text-white/40'))}>
            <Calendar size={8} /> {isOverdue ? 'Overdue · ' : ''}{formatDate(task.dueDate)}
          </span>
        )}
        {msgCount > 0 && (
          <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-1 font-semibold ml-auto', theme === 'light' ? 'bg-slate-100 text-slate-400' : 'bg-white/10 text-white/30')}>
            <MessageSquare size={8} /> {msgCount}
          </span>
        )}
      </div>

      {/* Hover actions */}
      <div className={cn('overflow-hidden transition-all max-h-0 opacity-0 group-hover:max-h-10 group-hover:opacity-100 group-hover:mt-2.5 group-hover:pt-2.5 flex gap-1.5',
        theme === 'light' ? 'group-hover:border-t group-hover:border-slate-100' : 'group-hover:border-t group-hover:border-white/10'
      )}>
        {task.status !== 'completed' && (
          <button
            onClick={e => { e.stopPropagation(); onComplete(); }}
            className={cn('flex-1 text-[10px] font-bold py-1 rounded-lg flex items-center justify-center gap-1 border transition-colors', theme === 'light' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20')}
          >
            <Check size={10} /> Complete
          </button>
        )}
        {isAdmin && onDelete && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className={cn('px-2.5 py-1 rounded-lg border transition-colors text-[10px] font-bold', theme === 'light' ? 'bg-red-50 text-red-500 border-red-200 hover:bg-red-100' : 'bg-red-500/10 text-red-400 border-red-500/20')}
          >
            <Trash2 size={10} />
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Create Task Modal ────────────────────────────────────────────────────────

const CreateTaskModal: React.FC<{
  onClose: () => void;
  onSave: (task: Parameters<ReturnType<typeof useTasks>['createTask']>[0]) => void;
  teamMembers: string[];
  createdBy: string;
}> = ({ onClose, onSave, teamMembers, createdBy }) => {
  const { theme, getInputClass } = useTheme();
  const [form, setForm] = useState({
    title: '', description: '', assignedTo: teamMembers[0] || '',
    dueDate: '', priority: 'normal' as TaskPriority,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave({ ...form, assignedBy: createdBy });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={cn('w-full max-w-md rounded-3xl shadow-2xl border overflow-hidden', theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10')}>
        <div className={cn('px-6 py-4 border-b flex items-center justify-between', theme === 'light' ? 'border-slate-100' : 'border-white/10')}>
          <h2 className="font-bold text-base">Assign New Task</h2>
          <button onClick={onClose} className="opacity-40 hover:opacity-70 transition-opacity"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 block mb-1.5">Task Title *</label>
            <input
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="What needs to be done?"
              required
              className={cn('w-full rounded-xl border px-4 py-2.5 text-sm font-medium outline-none', getInputClass())}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 block mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Optional details, context, or instructions..."
              rows={3}
              className={cn('w-full rounded-xl border px-4 py-2.5 text-sm outline-none resize-none leading-relaxed', getInputClass())}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 block mb-1.5">Assign To *</label>
              <select
                value={form.assignedTo}
                onChange={e => setForm(p => ({ ...p, assignedTo: e.target.value }))}
                required
                className={cn('w-full rounded-xl border px-4 py-2.5 text-sm font-medium outline-none', getInputClass(), '[&>option]:text-black')}
              >
                {teamMembers.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 block mb-1.5">Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm(p => ({ ...p, priority: e.target.value as TaskPriority }))}
                className={cn('w-full rounded-xl border px-4 py-2.5 text-sm font-medium outline-none', getInputClass(), '[&>option]:text-black')}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 block mb-1.5">Due Date</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
              className={cn('w-full rounded-xl border px-4 py-2.5 text-sm font-medium outline-none', getInputClass())}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className={cn('flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors', theme === 'light' ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-white/10 text-white/60 hover:bg-white/5')}>
              Cancel
            </button>
            <button type="submit" className={cn(
              'flex-1 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.97]',
              theme === 'light' ? 'bg-slate-900 hover:bg-slate-800 text-white' : 'bg-white hover:bg-white/90 text-slate-900'
            )}>
              Assign Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export const Reminders = () => {
  const { theme, getTextColor } = useTheme();
  const { user, users } = useAuth();
  const { tasks, messages, createTask, completeTask, deleteTask, getTaskMessages } = useTasks();

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | TaskStatus>('all');
  const [filterAssignee, setFilterAssignee] = useState('all');

  const isAdmin = user?.role === 'admin';
  const teamMembers = users.filter(u => u.name !== user?.name).map(u => u.name);
  const allAssignees = ['all', ...users.map(u => u.name)];

  const selectedTask = selectedTaskId ? tasks.find(t => t.id === selectedTaskId) : null;

  const filteredTasks = tasks.filter(t => {
    if (!isAdmin && t.assignedTo !== user?.name && t.assignedBy !== user?.name) return false;
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterAssignee !== 'all' && t.assignedTo !== filterAssignee) return false;
    return true;
  });

  const grouped = {
    urgent: filteredTasks.filter(t => t.priority === 'urgent' && t.status !== 'completed'),
    pending: filteredTasks.filter(t => t.status === 'pending' && t.priority !== 'urgent'),
    in_progress: filteredTasks.filter(t => t.status === 'in_progress' && t.priority !== 'urgent'),
    completed: filteredTasks.filter(t => t.status === 'completed'),
  };

  const pendingCount = tasks.filter(t => t.assignedTo === user?.name && t.status !== 'completed').length;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-2.5 mb-1">
            <h1 className={cn('text-2xl font-bold tracking-tight', getTextColor())}>Action Center</h1>
            {pendingCount > 0 && !isAdmin && (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-600">
                {pendingCount} pending
              </span>
            )}
          </div>
          <p className={cn('text-sm', theme === 'light' ? 'text-slate-400' : 'text-white/40')}>
            {isAdmin ? 'Assign and track tasks across your team' : 'Your assigned tasks and conversations'}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.97] shadow-[0_4px_20px_-4px_rgba(15,23,42,0.12)]',
              theme === 'light' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-slate-900 hover:bg-white/90'
            )}
          >
            <Plus size={16} strokeWidth={2.5} /> Assign Task
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="shrink-0 flex items-center gap-2 mb-4 flex-wrap">
        {(['all', 'pending', 'in_progress', 'completed'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={cn(
              'px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all',
              filterStatus === s
                ? (theme === 'light' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-900 border-white')
                : (theme === 'light' ? 'bg-white border-slate-200 text-slate-500 hover:border-slate-300' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10')
            )}
          >
            {s === 'all' ? 'All' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
            <span className="ml-1.5 opacity-60">
              {s === 'all' ? filteredTasks.length : filteredTasks.filter(t => t.status === s).length}
            </span>
          </button>
        ))}
        {isAdmin && (
          <select
            value={filterAssignee}
            onChange={e => setFilterAssignee(e.target.value)}
            className={cn('ml-auto text-[11px] font-bold px-3 py-1.5 rounded-full border outline-none cursor-pointer', theme === 'light' ? 'bg-white border-slate-200 text-slate-600' : 'bg-white/5 border-white/10 text-white/70', '[&>option]:text-black')}
          >
            {allAssignees.map(a => <option key={a} value={a}>{a === 'all' ? 'All Members' : a}</option>)}
          </select>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex gap-4 min-h-0">

        {/* Task List */}
        <div className={cn('flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-2', selectedTask && 'max-w-[520px]')}>
          {filteredTasks.length === 0 && (
            <div className={cn('flex flex-col items-center justify-center h-40 opacity-40')}>
              <CheckCircle2 size={32} className="mb-2" />
              <p className="text-sm font-medium">No tasks here</p>
            </div>
          )}

          {grouped.urgent.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <Flame size={13} className="text-red-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-500">Urgent</span>
              </div>
              <div className="space-y-2">
                {grouped.urgent.map(t => (
                  <TaskCard key={t.id} task={t} msgCount={getTaskMessages(t.id).length}
                    isSelected={selectedTaskId === t.id} onSelect={() => setSelectedTaskId(t.id === selectedTaskId ? null : t.id)}
                    onComplete={() => completeTask(t.id)} onDelete={() => deleteTask(t.id)} isAdmin={isAdmin} />
                ))}
              </div>
            </div>
          )}

          {grouped.in_progress.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-50">In Progress</span>
              </div>
              <div className="space-y-2">
                {grouped.in_progress.map(t => (
                  <TaskCard key={t.id} task={t} msgCount={getTaskMessages(t.id).length}
                    isSelected={selectedTaskId === t.id} onSelect={() => setSelectedTaskId(t.id === selectedTaskId ? null : t.id)}
                    onComplete={() => completeTask(t.id)} onDelete={() => deleteTask(t.id)} isAdmin={isAdmin} />
                ))}
              </div>
            </div>
          )}

          {grouped.pending.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-2 h-2 rounded-full bg-slate-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-50">Pending</span>
              </div>
              <div className="space-y-2">
                {grouped.pending.map(t => (
                  <TaskCard key={t.id} task={t} msgCount={getTaskMessages(t.id).length}
                    isSelected={selectedTaskId === t.id} onSelect={() => setSelectedTaskId(t.id === selectedTaskId ? null : t.id)}
                    onComplete={() => completeTask(t.id)} onDelete={() => deleteTask(t.id)} isAdmin={isAdmin} />
                ))}
              </div>
            </div>
          )}

          {grouped.completed.length > 0 && filterStatus !== 'pending' && filterStatus !== 'in_progress' && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-50">Completed</span>
              </div>
              <div className="space-y-2">
                {grouped.completed.map(t => (
                  <TaskCard key={t.id} task={t} msgCount={getTaskMessages(t.id).length}
                    isSelected={selectedTaskId === t.id} onSelect={() => setSelectedTaskId(t.id === selectedTaskId ? null : t.id)}
                    onComplete={() => {}} onDelete={() => deleteTask(t.id)} isAdmin={isAdmin} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Thread Panel */}
        {selectedTask && (
          <div className={cn('w-[380px] shrink-0 rounded-2xl border overflow-hidden animate-in slide-in-from-right-4 duration-300', theme === 'light' ? 'border-slate-200' : 'border-white/10')}>
            <TaskThread
              task={selectedTask}
              onClose={() => setSelectedTaskId(null)}
              onComplete={() => { completeTask(selectedTask.id); }}
            />
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <CreateTaskModal
          onClose={() => setShowCreate(false)}
          onSave={createTask}
          teamMembers={users.map(u => u.name)}
          createdBy={user?.name || 'Admin'}
        />
      )}
    </div>
  );
};
