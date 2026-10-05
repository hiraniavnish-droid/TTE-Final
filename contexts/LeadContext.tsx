  
import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect } from 'react';
import { Lead, Interaction, Reminder, LeadStatus, Supplier, ActivityLog } from '../types';
import { generateId } from '../utils/helpers';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { normalizeLeadTripDetails } from '../lib/leadTripDetails';
import { useRealtime } from '../hooks/useRealtime';

interface LeadContextType {
  leads: Lead[];
  allLeads: Lead[];
  interactions: Interaction[];
  reminders: Reminder[];
  suppliers: Supplier[];
  activityLogs: ActivityLog[];
  isLoading: boolean;
  loadError: string | null;
  retryLoad: () => void;
  addLead: (lead: Lead) => Promise<void>;
  addLeads: (leads: Lead[]) => Promise<void>;
  updateLead: (id: string, updates: Partial<Lead>) => Promise<void>;
  updateLeadStatus: (id: string, status: LeadStatus, customLog?: string) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  addInteraction: (interaction: Interaction) => void;
  addReminder: (reminder: Reminder) => void;
  updateReminder: (id: string, updates: Partial<Reminder>) => void;
  toggleReminder: (id: string) => void;
  getLeadsByStatus: (status: LeadStatus) => Lead[];
  getLeadInteractions: (leadId: string) => Interaction[];
  getLeadReminders: (leadId: string) => Reminder[];
  deleteReminder: (id: string) => void;
  addSupplier: (supplier: Supplier) => void;
  updateSupplier: (supplier: Supplier) => void;
  isAddLeadModalOpen: boolean;
  setAddLeadModalOpen: (isOpen: boolean) => void;
}

const LeadContext = createContext<LeadContextType | undefined>(undefined);

export const LeadProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  // -- Supabase-backed Data State --
  const [internalLeads, setInternalLeads] = useState<Lead[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const retryLoad = () => setLoadAttempt(v => v + 1);

  // -- UI States --
  const [isAddLeadModalOpen, setAddLeadModalOpen] = useState(false);

  // --- Helpers: Data Mapping (App <-> DB) ---
  const mapLeadFromDB = (data: any): Lead => ({
    id: data.id,
    name: String(data.name || 'Unnamed lead'),
    contact: { ...data.contact, phone: String(data.contact?.phone ?? data.phone ?? ''), email: String(data.contact?.email ?? data.email ?? '') },
    tripDetails: normalizeLeadTripDetails(data),
    preferences: data.preferences || {},
    commercials: data.commercials,
    vendors: data.vendors || [],
    status: data.status,
    temperature: data.temperature || 'Warm',
    source: data.source || 'Other',
    interestedServices: data.interested_services || [],
    referenceName: data.reference_name,
    assignedTo: String(data.assigned_to || '').includes('lead-routing-v1') ? undefined : data.assigned_to,
    tags: data.tags || [],
    createdAt: data.created_at,
    lastStatusUpdate: data.last_status_update,
    wonAt: data.won_at || undefined,
    legacy: !!data.legacy,
    leadCode: data.lead_code || undefined
  });

  const mapLeadToDB = (lead: Partial<Lead>) => {
    const dbObj: any = { ...lead };
    if (lead.tripDetails !== undefined) dbObj.trip_details = lead.tripDetails;
    if (lead.interestedServices !== undefined) dbObj.interested_services = lead.interestedServices;
    if (lead.referenceName !== undefined) dbObj.reference_name = lead.referenceName;
    if (lead.assignedTo !== undefined) dbObj.assigned_to = lead.assignedTo;
    if (lead.lastStatusUpdate !== undefined) dbObj.last_status_update = lead.lastStatusUpdate;
    if (lead.createdAt !== undefined) dbObj.created_at = lead.createdAt;
    if (lead.wonAt !== undefined) dbObj.won_at = lead.wonAt;

    delete dbObj.tripDetails;
    delete dbObj.interestedServices;
    delete dbObj.referenceName;
    delete dbObj.assignedTo;
    delete dbObj.lastStatusUpdate;
    delete dbObj.createdAt;
    delete dbObj.wonAt;
    // lead_code is owned entirely by the DB trigger (migration 006). Never write
    // it back — and the camelCase key isn't a real column, so leaving it on the
    // payload would make every update fail with "column leads.leadCode does not exist".
    delete dbObj.leadCode;

    return dbObj;
  };

  const mapInteractionFromDB = (data: any): Interaction => ({
    id: data.id,
    leadId: data.lead_id,
    type: data.type,
    content: data.content,
    sentiment: data.sentiment,
    timestamp: data.timestamp,
  });

  const mapReminderFromDB = (data: any): Reminder => ({
    id: data.id,
    leadId: data.lead_id,
    task: data.task,
    dueDate: data.due_date,
    isCompleted: data.is_completed,
  });

  const mapSupplierFromDB = (data: any): Supplier => ({
    id: data.id,
    name: String(data.name || 'Unnamed supplier'),
    contactPerson: data.contact_person || '',
    phone: data.phone || '',
    email: data.email || '',
    destinations: data.destinations || [],
    category: data.category,
    rating: data.rating,
  });

  const mapActivityLogFromDB = (data: any): ActivityLog => ({
    id: data.id,
    agentName: data.agent_name,
    actionType: data.action_type,
    details: data.details,
    timestamp: data.timestamp,
    leadId: data.lead_id,
    metadata: data.metadata || {},
  });

  // Each table loads independently. Lead batches paint immediately; the full
  // index continues in the background so filters, exports and reports stay complete.
  useEffect(() => {
    if (!user) { setIsLoading(false); return; }
    const controller = new AbortController();
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    const loadTable = async (table: string, order: string, ascending: boolean, map: (row: any) => any, set: any) => {
      const pageSize = table === 'leads' ? 100 : 500;
      for (let offset = 0; !cancelled; offset += pageSize) {
        const { data, error } = await supabase.from(table).select('*')
          .order(order, { ascending }).order('id', { ascending: true })
          .range(offset, offset + pageSize - 1).abortSignal(controller.signal);
        if (cancelled) return;
        if (error) throw error;
        const batch = (data || []).map(map);
        // Preserve edits and realtime events arriving while later pages load.
        set((current: any[]) => {
          const known = new Set(current.map(row => row.id));
          return [...current, ...batch.filter(row => !known.has(row.id))];
        });
        if (batch.length < pageSize) break;
        // Yield between requests so typing/scrolling has priority over the next batch.
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    };
    loadTable('leads', 'created_at', false, mapLeadFromDB, setInternalLeads)
      .catch(() => { if (!cancelled) setLoadError('Unable to load all leads. Check your connection and retry.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    // Supporting data must never hold up the lead board.
    for (const [table, order, ascending, map, set] of [
      ['interactions', 'timestamp', false, mapInteractionFromDB, setInteractions],
      ['reminders', 'due_date', true, mapReminderFromDB, setReminders],
      ['suppliers', 'name', true, mapSupplierFromDB, setSuppliers],
    ] as const) {
      loadTable(table, order, ascending, map, set).catch(() => {
        if (!cancelled) setLoadError('Some CRM data could not load. Check your connection and retry.');
      });
    }
    loadTable('activity_logs', 'timestamp', false, mapActivityLogFromDB, setActivityLogs)
      .catch(() => { if (!cancelled) console.error('Activity history could not fully load.'); });
    return () => { cancelled = true; controller.abort(); };
  }, [user?.id, loadAttempt]);

  // --- REALTIME SUBSCRIPTION (interactions) — powers live WhatsApp chat updates ---
  useRealtime('interactions', (payload) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    if (eventType === 'INSERT') {
      const newInteraction = mapInteractionFromDB(newRecord);
      setInteractions(prev => {
        if (prev.some(i => i.id === newInteraction.id)) return prev;
        return [newInteraction, ...prev];
      });
    } else if (eventType === 'DELETE') {
      setInteractions(prev => prev.filter(i => i.id !== oldRecord.id));
    }
  }, !!user);

  // --- REALTIME SUBSCRIPTION (leads) ---
  useRealtime('leads', (payload) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    if (eventType === 'INSERT') {
      const newLead = mapLeadFromDB(newRecord);
      setInternalLeads(prev => {
        if (prev.some(l => l.id === newLead.id)) return prev;
        return [newLead, ...prev];
      });
      logActivity('NEW_LEAD', newLead, `New lead received: ${newLead.name}`);
    }
    else if (eventType === 'UPDATE') {
      const updatedLead = mapLeadFromDB(newRecord);
      setInternalLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
    }
    else if (eventType === 'DELETE') {
      setInternalLeads(prev => prev.filter(l => l.id !== oldRecord.id));
    }
  }, !!user);

  const visibleLeads = useMemo(() => {
      if (!user) return [];
      if (user.role === 'admin') return internalLeads;
      return internalLeads.filter(l => l.assignedTo === user.name);
  }, [user, internalLeads]);

  // Only show reminders for leads the current user can see
  const visibleReminders = useMemo(() => {
      if (!user) return [];
      if (user.role === 'admin') return reminders;
      const visibleLeadIds = new Set(visibleLeads.map(l => l.id));
      return reminders.filter(r => visibleLeadIds.has(r.leadId));
  }, [user, reminders, visibleLeads]);

  const logActivity = (
      actionType: 'NEW_LEAD' | 'STATUS_CHANGE' | 'COMMENT',
      lead: Lead,
      details: string,
      extraMetadata?: any
  ) => {
      const newLog: ActivityLog = {
          id: generateId(),
          agentName: user?.name || 'System',
          actionType,
          details,
          timestamp: new Date().toISOString(),
          leadId: lead.id,
          metadata: {
              leadName: lead.name,
              ...extraMetadata
          }
      };
      // Optimistic update
      setActivityLogs(prev => [newLog, ...prev]);
      // Persist to Supabase (fire-and-forget)
      supabase.from('activity_logs').insert([{
          id: newLog.id,
          agent_name: newLog.agentName,
          action_type: newLog.actionType,
          details: newLog.details,
          timestamp: newLog.timestamp,
          lead_id: newLog.leadId,
          metadata: newLog.metadata,
      }]).then(({ error }) => {
          if (error) console.error('Failed to persist activity log:', error);
      });
  };

  // --- Team WhatsApp notification (fire-and-forget — must never block the CRM action) ---
  const API_BASE = (import.meta as any).env?.DEV ? 'https://ttecrm.vercel.app' : '';
  const notifyTeam = (text: string) => {
    fetch(`${API_BASE}/api/notify-team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }).catch(() => { /* notifications are best-effort */ });
  };

  // --- Lead Actions ---

  const addLead = async (lead: Lead) => {
    try {
        const pax = (lead.tripDetails?.paxConfig?.adults || 0) + (lead.tripDetails?.paxConfig?.children || 0);
        const assignee = user?.role === 'agent' ? user.name : (lead.assignedTo || null);

        const sanitizedLead = {
            name: lead.name,
            phone: lead.contact?.phone || '',
            email: lead.contact?.email || '',
            contact: lead.contact || { phone: lead.contact?.phone || '', email: lead.contact?.email || '' },
            status: lead.status || 'New',
            temperature: lead.temperature || 'Warm',
            source: lead.source || 'Other',
            destination: lead.tripDetails?.destination || '',
            pax,
            travel_date: lead.tripDetails?.startDate || null,
            budget: lead.tripDetails?.budget || 0,
            trip_details: lead.tripDetails,
            preferences: lead.preferences || {},
            commercials: lead.commercials || null,
            vendors: lead.vendors || [],
            tags: lead.tags || [],
            interested_services: lead.interestedServices || [],
            reference_name: lead.referenceName || null,
            assigned_to: assignee !== 'Unassigned' ? assignee : null,
            notes: '',
        };

        const { data, error } = await supabase
            .from('leads')
            .insert([sanitizedLead])
            .select()
            .single();

        if (error) throw error;

        if (data) {
            const newLead = mapLeadFromDB(data);
            setInternalLeads(prev => {
                if (prev.some(item => item.id === newLead.id)) return prev;
                return [newLead, ...prev];
            });
            logActivity('NEW_LEAD', newLead, `Created lead: ${newLead.name}`);
            notifyTeam(
                `🆕 *New Lead*\n${newLead.name}` +
                (newLead.tripDetails?.destination ? `\n📍 ${newLead.tripDetails.destination}` : '') +
                `\n📞 ${newLead.contact?.phone || '—'}` +
                `\n👤 ${newLead.assignedTo || 'Unassigned'} · via ${newLead.source}` +
                `\n— by ${user?.name || 'CRM'}`
            );
        }
    } catch (err) {
        console.error('Supabase Add Error:', err);
    }
  };

  const addLeads = async (newLeads: Lead[]) => {
      try {
          const dbPayloads = newLeads.map((lead) => {
             const pax = (lead.tripDetails?.paxConfig?.adults || 0) + (lead.tripDetails?.paxConfig?.children || 0);
             return {
                name: lead.name,
                phone: lead.contact?.phone || '',
                email: lead.contact?.email || '',
                contact: lead.contact,
                status: lead.status || 'New',
                temperature: lead.temperature || 'Warm',
                source: lead.source || 'Other',
                destination: lead.tripDetails?.destination || '',
                pax,
                travel_date: lead.tripDetails?.startDate || null,
                budget: lead.tripDetails?.budget || 0,
                trip_details: lead.tripDetails,
                preferences: lead.preferences || {},
                vendors: lead.vendors || [],
                tags: lead.tags || [],
                interested_services: lead.interestedServices || [],
                reference_name: lead.referenceName || null,
                assigned_to: lead.assignedTo !== 'Unassigned' ? lead.assignedTo : null,
                notes: '',
             };
          });

          const { data, error } = await supabase
            .from('leads')
            .insert(dbPayloads)
            .select();

          if (error) throw error;

          if (data) {
              const mappedLeads = data.map(mapLeadFromDB);
              setInternalLeads(prev => {
                  const existingIds = new Set(prev.map(l => l.id));
                  const uniqueNew = mappedLeads.filter(l => !existingIds.has(l.id));
                  return [...uniqueNew, ...prev];
              });

              if (mappedLeads.length > 0) {
                  logActivity('NEW_LEAD', mappedLeads[0], `Imported ${mappedLeads.length} leads`);
              }
          }
      } catch (err) {
          console.error('Supabase Bulk Add Error:', err);
      }
  };

  const updateLead = async (id: string, updates: Partial<Lead>) => {
    try {
        const before = internalLeads.find(l => l.id === id);
        const dbUpdates = mapLeadToDB(updates);

        const { data, error } = await supabase
            .from('leads')
            .update(dbUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        if (data) {
            const updatedLead = mapLeadFromDB(data);
            setInternalLeads(prev => prev.map(l => l.id === id ? updatedLead : l));

            const assignmentChanged = updates.assignedTo !== undefined && (before?.assignedTo || null) !== (updatedLead.assignedTo || null);
            if (assignmentChanged) {
                notifyTeam(
                    `👤 *Lead Assigned*\n${updatedLead.name}` +
                    (updatedLead.tripDetails?.destination ? `\n📍 ${updatedLead.tripDetails.destination}` : '') +
                    `\n${before?.assignedTo || 'Unassigned'} → *${updatedLead.assignedTo || 'Unassigned'}*` +
                    `\n— by ${user?.name || 'CRM'}`
                );
            }
        }
    } catch (err) {
        console.error('Supabase Update Error:', err);
    }
  };

  const updateLeadStatus = async (id: string, status: LeadStatus, customLog?: string) => {
    const currentLead = internalLeads.find(l => l.id === id);
    const oldStatus = currentLead?.status;
    const newTimestamp = new Date().toISOString();

    // Moving a deal to Won is a sales-attribution event — confirm which month it'll be
    // credited to before committing. wonAt is stamped once (first time ever Won) and never
    // overwritten, so cycling a deal out of Won and back in can't shift its attributed month —
    // make that explicit here rather than silently re-crediting it.
    if (status === 'Won' && oldStatus !== 'Won') {
        const monthLabel = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        const msg = currentLead?.wonAt
            ? `This deal was already recorded as a ${new Date(currentLead.wonAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} sale (on ${new Date(currentLead.wonAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}) and will keep that attribution — moving it to Won again won't shift it to ${monthLabel}. Continue?`
            : `This will count as a ${monthLabel} sale. Confirm?`;
        if (!window.confirm(msg)) return;
    }

    const interaction: Interaction = {
      id: generateId(),
      leadId: id,
      type: 'StatusChange',
      content: customLog || `Status updated to ${status}`,
      timestamp: newTimestamp,
      sentiment: 'Neutral'
    };
    addInteraction(interaction);

    try {
        const updatePayload: any = {
            status: status,
            last_status_update: newTimestamp,
        };
        // Stamp wonAt only the first time this lead ever becomes Won — never overwritten afterwards.
        if (status === 'Won' && !currentLead?.wonAt) {
            updatePayload.won_at = newTimestamp;
        }
        const { data, error } = await supabase.from('leads').update(updatePayload)
        .eq('id', id)
        .select()
        .single();

        if (error) throw error;

        if (data) {
            const updatedLead = mapLeadFromDB(data);
            setInternalLeads(prev => prev.map(l => l.id === id ? updatedLead : l));

            if (currentLead) {
                logActivity(
                    'STATUS_CHANGE',
                    updatedLead,
                    `Moved ${updatedLead.name} from ${oldStatus} -> ${status}`,
                    { oldStatus, newStatus: status }
                );
            }
        }
    } catch (err) {
        console.error('Supabase Status Update Error:', err);
        throw err;
    }
  };

  const deleteLead = async (id: string) => {
    try {
        // Delete child records first (no FK cascade since we removed FK constraints).
        // WhatsApp interactions are kept (not deleted) — they're the durable record of a
        // real conversation on that phone number, and should still surface if the same
        // number becomes a lead again later (matched by phone, not by this lead_id).
        await Promise.all([
            supabase.from('interactions').delete().eq('lead_id', id).neq('type', 'WhatsApp'),
            supabase.from('reminders').delete().eq('lead_id', id),
        ]);

        const { error } = await supabase.from('leads').delete().eq('id', id);
        if (error) throw error;

        setInternalLeads(prev => prev.filter(l => l.id !== id));
        setInteractions(prev => prev.filter(i => i.leadId !== id || i.type === 'WhatsApp'));
        setReminders(prev => prev.filter(r => r.leadId !== id));
    } catch (err: any) {
        console.error('Supabase Delete Error:', err);
        // Migration 007 puts ON DELETE RESTRICT on payments.lead_id and
        // documents.lead_id, so Postgres now refuses to delete a lead that has
        // money or a GST document attached (code 23503). That's intentional —
        // but it must be surfaced, not swallowed, or the user clicks Delete and
        // simply nothing happens.
        if (err?.code === '23503') {
            const what = String(err?.details || err?.message || '').includes('documents')
                ? 'an issued invoice/receipt'
                : 'recorded payments';
            throw new Error(`This lead can't be deleted because it has ${what} attached. Remove or reassign those first — deleting it would break your financial audit trail.`);
        }
        throw err;
    }
  };

  // --- Interaction Actions (Supabase-backed) ---

  const addInteraction = (interaction: Interaction) => {
    // Optimistic update
    setInteractions(prev => {
      if (prev.some(i => i.id === interaction.id)) return prev;
      return [interaction, ...prev];
    });
    // Persist to Supabase (fire-and-forget)
    supabase.from('interactions').insert([{
        id: interaction.id,
        lead_id: interaction.leadId,
        type: interaction.type,
        content: interaction.content,
        sentiment: interaction.sentiment || null,
        timestamp: interaction.timestamp,
    }]).then(({ error }) => {
        if (error) console.error('Failed to persist interaction:', error);
    });
  };

  // --- Reminder Actions (Supabase-backed) ---

  const addReminder = (reminder: Reminder) => {
    // Optimistic update
    setReminders(prev => [reminder, ...prev]);
    // Persist to Supabase
    supabase.from('reminders').insert([{
        id: reminder.id,
        lead_id: reminder.leadId,
        task: reminder.task,
        due_date: reminder.dueDate,
        is_completed: reminder.isCompleted,
    }]).then(({ error }) => {
        if (error) console.error('Failed to persist reminder:', error);
    });
  };

  const updateReminder = (id: string, updates: Partial<Reminder>) => {
    setReminders(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    const dbUpdates: any = {};
    if (updates.task !== undefined) dbUpdates.task = updates.task;
    if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
    if (updates.isCompleted !== undefined) dbUpdates.is_completed = updates.isCompleted;
    supabase.from('reminders').update(dbUpdates).eq('id', id).then(({ error }) => {
        if (error) console.error('Failed to update reminder:', error);
    });
  };

  const toggleReminder = (id: string) => {
    const reminder = reminders.find(r => r.id === id);
    if (!reminder) return;
    const newStatus = !reminder.isCompleted;
    updateReminder(id, { isCompleted: newStatus });
    if (newStatus) {
      addInteraction({
        id: generateId(),
        leadId: reminder.leadId,
        type: 'TaskLog',
        content: `Completed Task: ${reminder.task}`,
        timestamp: new Date().toISOString(),
        sentiment: 'Neutral'
      });
    }
  };

  const deleteReminder = (id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));
    supabase.from('reminders').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('Failed to delete reminder:', error);
    });
  };

  // --- Supplier Actions (Supabase-backed) ---

  const addSupplier = (supplier: Supplier) => {
    setSuppliers(prev => [supplier, ...prev]);
    supabase.from('suppliers').insert([{
        id: supplier.id,
        name: supplier.name,
        contact_person: supplier.contactPerson,
        phone: supplier.phone,
        email: supplier.email,
        destinations: supplier.destinations,
        category: supplier.category,
        rating: supplier.rating,
    }]).then(({ error }) => {
        if (error) console.error('Failed to persist supplier:', error);
    });
  };

  const updateSupplier = (updatedSupplier: Supplier) => {
    setSuppliers(prev => prev.map(s => s.id === updatedSupplier.id ? updatedSupplier : s));
    supabase.from('suppliers').update({
        name: updatedSupplier.name,
        contact_person: updatedSupplier.contactPerson,
        phone: updatedSupplier.phone,
        email: updatedSupplier.email,
        destinations: updatedSupplier.destinations,
        category: updatedSupplier.category,
        rating: updatedSupplier.rating,
    }).eq('id', updatedSupplier.id).then(({ error }) => {
        if (error) console.error('Failed to update supplier:', error);
    });
  };

  // --- Derived Helpers ---

  const getLeadsByStatus = (status: LeadStatus) => visibleLeads.filter(l => l.status === status);
  const getLeadInteractions = (leadId: string) => interactions.filter(i => i.leadId === leadId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const getLeadReminders = (leadId: string) => reminders.filter(r => r.leadId === leadId);

  return (
    <LeadContext.Provider value={{
      leads: visibleLeads,
      allLeads: internalLeads,
      interactions,
      reminders: visibleReminders,
      suppliers,
      activityLogs,
      isLoading,
      loadError,
      retryLoad,
      addLead,
      addLeads,
      updateLead,
      updateLeadStatus,
      deleteLead,
      addInteraction,
      addReminder,
      updateReminder,
      toggleReminder,
      getLeadsByStatus,
      getLeadInteractions,
      getLeadReminders,
      deleteReminder,
      addSupplier,
      updateSupplier,
      isAddLeadModalOpen,
      setAddLeadModalOpen,
    }}>
      {children}
    </LeadContext.Provider>
  );
};

export const useLeads = () => {
  const context = useContext(LeadContext);
  if (!context) throw new Error('useLeads must be used within an LeadProvider');
  return context;
};
