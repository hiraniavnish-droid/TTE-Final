
import { useEffect, useRef } from 'react';
import { useLeads } from '../contexts/LeadContext';
import { useAuth } from '../contexts/AuthContext';

export function useReminderNotifications() {
  const { reminders } = useLeads();
  const { user } = useAuth();
  const notifiedIds = useRef<Set<string>>(new Set());

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
        try { new Notification(isOverdue ? '⏰ Overdue Reminder' : '🔔 Upcoming Reminder', {
          body: r.task,
          icon: '/favicon.ico',
          tag: r.id, // Prevents duplicate toasts for the same reminder
        }); } catch { /* Some mobile browsers expose Notification but disallow its constructor. */ }
      }
    });
  }, [reminders, user]);
}
