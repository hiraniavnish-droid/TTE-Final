
import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect } from 'react';
import { Lead, Interaction, Reminder, LeadStatus, Supplier, ActivityLog } from '../types';
import { MOCK_INTERACTIONS, MOCK_REMINDERS, MOCK_SUPPLIERS, MOCK_ACTIVITY_LOGS } from '../constants';
import { generateId } from '../utils/helpers';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { useRealtime } from '../hooks/useRealtime';

// Nudge Type Definition
export interface NudgeData {
  isOpen: boolean;
  leadId: string | null;
  leadName: string;
  status: LeadStatus | null;
}

interface LeadContextType {
  leads: Lead[];
  allLeads: Lead[]; 
  interactions: Interaction[];
  reminders: Reminder[];
  suppliers: Supplier[];
  activityLogs: ActivityLog[]; 
  isLoading: boolean;
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
  nudge: NudgeData;
  closeNudge: () => void;
}

const LeadContext = createContext<LeadContextType | undefined>(undefined);

export const LeadProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  // -- Real Data State --
  const [internalLeads, setInternalLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // -- Mock Data States (Keeping local for now) --
  const [interactions, setInteractions] = useState<Interaction[]>(MOCK_INTERACTIONS);
  const [reminders, setReminders] = useState<Reminder[]>(MOCK_REMINDERS);
  const [suppliers, setSuppliers] = useState<Supplier[]>(MOCK_SUPPLIERS);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(MOCK_ACTIVITY_LOGS);
  
  // -- UI States --
  const [isAddLeadModalOpen, setAddLeadModalOpen] = useState(false);
  const [nudge, setNudge] = useState<NudgeData>({ isOpen: false, leadId: null, leadName: '', status: null });

  // --- Helpers: Data Mapping (App <-> DB) ---
  const mapLeadFromDB = (data: any): Lead => ({
    id: data.id,
    name: data.name,
    contact: data.contact || { phone: data.phone || '', email: '' }, 
    tripDetails: data.trip_details || {
        destination: data.destination || '',
        budget: data.budget || 0,
        startDate: data.travel_date || new Date().toISOString(),
        paxConfig: { adults: data.pax || 2, children: 0, childAges: [] }
    },
    preferences: data.preferences || {},
    commercials: data.commercials,
    vendors: data.vendors || [],
    status: data.status,
    temperature: data.temperature,
    source: data.source,
    interestedServices: data.interested_services || [],
    referenceName: data.reference_name,
    assignedTo: data.assigned_to,
    tags: data.tags || [],
    createdAt: data.created_at,
    lastStatusUpdate: data.last_status_update
  });

  const mapLeadToDB = (lead: Partial<Lead>) => {
    const dbObj: any = { ...lead };
    if (lead.tripDetails) dbObj.trip_details = lead.tripDetails;
    if (lead.interestedServices) dbObj.interested_services = lead.interestedServices;
    if (lead.referenceName) dbObj.reference_name = lead.referenceName;
    if (lead.assignedTo) dbObj.assigned_to = lead.assignedTo;
    if (lead.lastStatusUpdate) dbObj.last_status_update = lead.lastStatusUpdate;
    if (lead.createdAt) dbObj.created_at = lead.createdAt;

    delete dbObj.tripDetails;
    delete dbObj.interestedServices;
    delete dbObj.referenceName;
    delete dbObj.assignedTo;
    delete dbObj.lastStatusUpdate;
    delete dbObj.createdAt;

    return dbObj;
  };

  // --- Fetch Logic ---
  const fetchLeads = async () => {
    if(internalLeads.length === 0) setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setInternalLeads(data.map(mapLeadFromDB));
      }
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  // --- REALTIME SUBSCRIPTION ---
  // Serves as a backup and for syncing changes from OTHER users.
  useRealtime('leads', (payload) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    if (eventType === 'INSERT') {
      const newLead = mapLeadFromDB(newRecord);
      setInternalLeads(prev => {
        // Prevent duplicate inserts if we already added it optimistically
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
  });

  const visibleLeads = useMemo(() => {
      if (!user) return [];
      if (user.role === 'admin') return internalLeads;
      return internalLeads.filter(l => l.assignedTo === user.name);
  }, [user, internalLeads]);

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
      setActivityLogs(prev => [newLog, ...prev]);
  };

  // --- Actions ---

  const addLead = async (lead: Lead) => {
    try {
        const l = lead as any;
        const calculatedPax = (l.tripDetails?.paxConfig?.adults || 0) + (l.tripDetails?.paxConfig?.children || 0);

        const sanitizedLead: any = {
            name: l.name,
            phone: l.phone || l.contact?.phone || '',
            status: l.status || 'new',
            destination: l.destination || l.tripDetails?.destination || '',
            pax: parseInt(l.pax) || calculatedPax || 0,
            travel_date: l.travel_date || l.tripDetails?.startDate || null,
            budget: parseFloat(l.budget) || parseFloat(l.tripDetails?.budget) || 0,
            notes: l.notes || '',
        };

        const assignee = l.assigned_to || (user?.role === 'agent' ? user.name : l.assignedTo);
        if (assignee && assignee !== 'Unassigned') {
            sanitizedLead.assigned_to = assignee;
        }

        // Standardize Add Pattern: Insert -> Select -> Update State
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
        }
    } catch (err) {
        console.error('Supabase Add Error:', err);
    }
  };

  const addLeads = async (newLeads: Lead[]) => {
      try {
          const dbPayloads = newLeads.map((lead: any) => {
             const calculatedPax = (lead.tripDetails?.paxConfig?.adults || 0) + (lead.tripDetails?.paxConfig?.children || 0);
             return {
                name: lead.name,
                phone: lead.contact?.phone || '',
                status: lead.status || 'new',
                destination: lead.tripDetails?.destination || '',
                pax: parseInt(lead.pax) || calculatedPax || 0,
                travel_date: lead.tripDetails?.startDate || null,
                budget: parseFloat(lead.tripDetails?.budget) || 0,
                notes: lead.notes || '',
                assigned_to: lead.assignedTo !== 'Unassigned' ? lead.assignedTo : undefined
             };
          });

          // Standardize Bulk Add Pattern: Insert -> Select -> Update State
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
        const dbUpdates = mapLeadToDB(updates);
        
        // Standardize Update Pattern: Update -> Select -> Update State
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
        }
    } catch (err) {
        console.error('Supabase Update Error:', err);
    }
  };

  const updateLeadStatus = async (id: string, status: LeadStatus, customLog?: string) => {
    const currentLead = internalLeads.find(l => l.id === id);
    const oldStatus = currentLead?.status;
    const newTimestamp = new Date().toISOString();

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
        // Standardize Update Pattern: Update -> Select -> Update State
        const { data, error } = await supabase.from('leads').update({
            status: status,
            last_status_update: newTimestamp
        })
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

                if (status !== 'Lost' && status !== 'New') {
                    setNudge({
                        isOpen: true,
                        leadId: updatedLead.id,
                        leadName: updatedLead.name,
                        status: status
                    });
                }
            }
        }
    } catch (err) {
        console.error('Supabase Status Update Error:', err);
        throw err;
    }
  };

  const deleteLead = async (id: string) => {
    try {
        const { error } = await supabase.from('leads').delete().eq('id', id);
        if (error) throw error;

        // Standardize Delete Pattern: Immediate Filter
        setInternalLeads(prev => prev.filter(l => l.id !== id));
        
        // Cleanup local state
        setInteractions(prev => prev.filter(i => i.leadId !== id));
        setReminders(prev => prev.filter(r => r.leadId !== id));
    } catch (err) {
        console.error('Supabase Delete Error:', err);
    }
  };

  // --- Local State Helpers ---

  const closeNudge = () => setNudge(prev => ({ ...prev, isOpen: false }));
  const addInteraction = (interaction: Interaction) => setInteractions(prev => [interaction, ...prev]);
  const addReminder = (reminder: Reminder) => setReminders(prev => [reminder, ...prev]);
  const updateReminder = (id: string, updates: Partial<Reminder>) => setReminders(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  const toggleReminder = (id: string) => {
    const reminder = reminders.find(r => r.id === id);
    if (!reminder) return;
    const newStatus = !reminder.isCompleted;
    setReminders(prev => prev.map(r => r.id === id ? { ...r, isCompleted: newStatus } : r));
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
  const deleteReminder = (id: string) => setReminders(prev => prev.filter(r => r.id !== id));
  const addSupplier = (supplier: Supplier) => setSuppliers(prev => [supplier, ...prev]);
  const updateSupplier = (updatedSupplier: Supplier) => setSuppliers(prev => prev.map(s => s.id === updatedSupplier.id ? updatedSupplier : s));
  const getLeadsByStatus = (status: LeadStatus) => visibleLeads.filter(l => l.status === status);
  const getLeadInteractions = (leadId: string) => interactions.filter(i => i.leadId === leadId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const getLeadReminders = (leadId: string) => reminders.filter(r => r.leadId === leadId);

  return (
    <LeadContext.Provider value={{
      leads: visibleLeads,
      allLeads: internalLeads,
      interactions,
      reminders,
      suppliers,
      activityLogs,
      isLoading,
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
      nudge,
      closeNudge
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
