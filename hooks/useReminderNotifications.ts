
import { useEffect, useRef } from 'react';
import { useLeads } from '../contexts/LeadContext';
import { useAuth } from '../contexts/AuthContext';

export function useReminderNotifications() {
  const { reminders } = useLeads();
  const { user } = useAuth();
  const notifiedIds = useRef<Set<string>>(new Set());

  // Request permission once on mount
  useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Check reminders whenever they change
  useEffect(() => {
    if (!user || !('Notification' in window) || Notification.permission !== 'granted') return;

    const now = new Date();
    const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000);

    reminders.forEach(r => {
      if (r.isCompleted) return;
      if (notifiedIds.current.has(r.id)) return;

      const due = new Date(r.dueDate);
      if (due <= fiveMinutesLater) {
        notifiedIds.current.add(r.id);
        const isOverdue = due < now;
        new Notification(isOverdue ? '⏰ Overdue Reminder' : '🔔 Upcoming Reminder', {
          body: r.task,
          icon: '/favicon.ico',
          tag: r.id, // Prevents duplicate toasts for the same reminder
        });
      }
    });
  }, [reminders, user]);
}
