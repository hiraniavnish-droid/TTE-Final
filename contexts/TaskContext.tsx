
import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { generateId } from '../utils/helpers';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TaskStatus   = 'pending' | 'in_progress' | 'completed';

export interface TeamTask {
  id: string;
  title: string;
  description: string;
  assignedTo: string;   // user name
  assignedBy: string;   // admin name
  dueDate: string;      // ISO date string or ''
  priority: TaskPriority;
  status: TaskStatus;
  leadId?: string;
  leadName?: string;
  createdAt: string;
  completedAt?: string;
}

export interface TaskMessage {
  id: string;
  taskId: string;
  author: string;
  content: string;
  type: 'text' | 'link';
  createdAt: string;
}

// ─── Storage Helpers ──────────────────────────────────────────────────────────

const TASKS_KEY    = 'tte_team_tasks';
const MESSAGES_KEY = 'tte_task_messages';

const loadTasks = (): TeamTask[] => {
  try { return JSON.parse(localStorage.getItem(TASKS_KEY) || '[]'); } catch { return []; }
};
const saveTasks = (tasks: TeamTask[]) => {
  try { localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); } catch {}
};
const loadMessages = (): TaskMessage[] => {
  try { return JSON.parse(localStorage.getItem(MESSAGES_KEY) || '[]'); } catch { return []; }
};
const saveMessages = (msgs: TaskMessage[]) => {
  try { localStorage.setItem(MESSAGES_KEY, JSON.stringify(msgs)); } catch {}
};

// ─── Context ──────────────────────────────────────────────────────────────────

interface TaskContextType {
  tasks: TeamTask[];
  messages: TaskMessage[];
  createTask: (task: Omit<TeamTask, 'id' | 'createdAt' | 'status'>) => TeamTask;
  updateTask: (id: string, updates: Partial<TeamTask>) => void;
  deleteTask: (id: string) => void;
  completeTask: (id: string) => void;
  addMessage: (taskId: string, author: string, content: string, type?: TaskMessage['type']) => void;
  getTaskMessages: (taskId: string) => TaskMessage[];
  getMyTasks: (userName: string) => TeamTask[];
  getPendingCount: (userName: string) => number;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tasks, setTasks]       = useState<TeamTask[]>(() => loadTasks());
  const [messages, setMessages] = useState<TaskMessage[]>(() => loadMessages());

  const createTask = useCallback((task: Omit<TeamTask, 'id' | 'createdAt' | 'status'>): TeamTask => {
    const newTask: TeamTask = {
      ...task,
      id: generateId(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    setTasks(prev => { const next = [newTask, ...prev]; saveTasks(next); return next; });
    return newTask;
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<TeamTask>) => {
    setTasks(prev => {
      const next = prev.map(t => t.id === id ? { ...t, ...updates } : t);
      saveTasks(next);
      return next;
    });
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => { const next = prev.filter(t => t.id !== id); saveTasks(next); return next; });
    setMessages(prev => { const next = prev.filter(m => m.taskId !== id); saveMessages(next); return next; });
  }, []);

  const completeTask = useCallback((id: string) => {
    setTasks(prev => {
      const next = prev.map(t => t.id === id
        ? { ...t, status: 'completed' as TaskStatus, completedAt: new Date().toISOString() }
        : t
      );
      saveTasks(next);
      return next;
    });
  }, []);

  const addMessage = useCallback((taskId: string, author: string, content: string, type: TaskMessage['type'] = 'text') => {
    const msg: TaskMessage = {
      id: generateId(),
      taskId,
      author,
      content,
      type,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => { const next = [...prev, msg]; saveMessages(next); return next; });
    // Also bump the task's updatedAt equivalent by touching it
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t } : t));
  }, []);

  const getTaskMessages = useCallback((taskId: string) =>
    messages.filter(m => m.taskId === taskId), [messages]);

  const getMyTasks = useCallback((userName: string) =>
    tasks.filter(t => t.assignedTo === userName && t.status !== 'completed'), [tasks]);

  const getPendingCount = useCallback((userName: string) =>
    tasks.filter(t => t.assignedTo === userName && t.status !== 'completed').length, [tasks]);

  return (
    <TaskContext.Provider value={{
      tasks, messages,
      createTask, updateTask, deleteTask, completeTask,
      addMessage, getTaskMessages, getMyTasks, getPendingCount,
    }}>
      {children}
    </TaskContext.Provider>
  );
};

export const useTasks = () => {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error('useTasks must be used inside TaskProvider');
  return ctx;
};
