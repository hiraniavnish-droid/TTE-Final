
import React, { useState, useRef, useEffect } from 'react';
import { useLeads } from '../contexts/LeadContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { DialButton } from '../components/ui/DialButton';
import { ServiceSelector } from '../components/ServiceSelector';
import { PaxSelector } from '../components/PaxSelector'; 
import { TravelPreferences } from '../components/TravelPreferences';
import { Lead, LeadStatus, LeadTemperature, LeadSource, PaxConfig, TravelPreferences as TravelPreferencesType, VendorDetail } from '../types';
import { STATUS_COLUMNS } from '../constants';
import { formatCurrency, formatCompactCurrency, generateId, cn, formatDate, timeAgo } from '../utils/helpers';
import Papa from 'papaparse';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  useDraggable,
  useDroppable,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DropAnimation
} from '@dnd-kit/core';
import { 
  LayoutList, 
  LayoutGrid, 
  Plus, 
  Filter, 
  UploadCloud,
  MapPin,
  DollarSign,
  SearchX,
  Users,
  Calendar,
  Phone,
  MessageCircle,
  ChevronDown,
  Palmtree,
  Plane,
  BedDouble,
  FileCheck,
  AlertOctagon,
  Download,
  CheckCircle2,
  User
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { VendorManagementModal } from '../components/VendorManagementModal';

// --- Helper for Urgency Logic ---

const getLeadUrgency = (lead: Lead): { colorClass: string, tooltip: string } => {
    const defaultRes = { colorClass: '', tooltip: '' };
    
    const lastUpdate = lead.lastStatusUpdate ? new Date(lead.lastStatusUpdate) : new Date(lead.createdAt);
    const diffMs = Date.now() - lastUpdate.getTime();
    const diffMins = diffMs / (1000 * 60);
    const diffHours = diffMs / (1000 * 60 * 60);

    if (lead.status === 'Won' || lead.status === 'Lost') return defaultRes;

    if (lead.status === 'New') {
        if (diffMins > 20) return { colorClass: 'border-l-4 border-l-red-500 bg-red-50/50', tooltip: `New Lead ignored for ${Math.round(diffMins)} mins!` };
        if (diffMins > 10) return { colorClass: 'border-l-4 border-l-orange-500 bg-orange-50/50', tooltip: `New Lead ignored for ${Math.round(diffMins)} mins!` };
    }
    else if (lead.status === 'Contacted') {
        if (diffHours > 2) return { colorClass: 'border-l-4 border-l-red-500 bg-red-50/50', tooltip: `No movement for ${Math.round(diffHours)} hours!` };
        if (diffHours > 1) return { colorClass: 'border-l-4 border-l-orange-500 bg-orange-50/50', tooltip: `No movement for ${Math.round(diffHours)} hours!` };
    }
    else if (lead.status === 'Proposal Sent') {
        if (diffHours > 24) return { colorClass: 'border-l-4 border-l-red-500 bg-red-50/50', tooltip: `Proposal stale for ${Math.round(diffHours/24)} days!` };
        if (diffHours > 4) return { colorClass: 'border-l-4 border-l-orange-500 bg-orange-50/50', tooltip: `Proposal stale for ${Math.round(diffHours)} hours!` };
    }
    else if (lead.status === 'Discussion') {
        if (diffHours > 96) return { colorClass: 'border-l-4 border-l-red-500 bg-red-50/50', tooltip: `Discussion stale for ${Math.round(diffHours/24)} days!` };
        if (diffHours > 24) return { colorClass: 'border-l-4 border-l-orange-500 bg-orange-50/50', tooltip: `Discussion stale for ${Math.round(diffHours/24)} days!` };
    }

    return defaultRes;
};

export const getAgentColor = (name: string | undefined) => {
    if (!name || name === 'Unassigned') return 'bg-gray-100 text-gray-600 border-gray-200';
    const colors = [
        'bg-blue-100 text-blue-700 border-blue-200',
        'bg-emerald-100 text-emerald-700 border-emerald-200',
        'bg-amber-100 text-amber-700 border-amber-200',
        'bg-purple-100 text-purple-700 border-purple-200',
        'bg-rose-100 text-rose-700 border-rose-200',
        'bg-indigo-100 text-indigo-700 border-indigo-200',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

// --- Visual Component (Shared between Draggable and Overlay) ---

const LeadCard: React.FC<{ lead: Lead, isOverlay?: boolean, isDragging?: boolean }> = ({ lead, isOverlay, isDragging }) => {
  const { theme, getTextColor, getSecondaryTextColor } = useTheme();

  const tempColors = {
    Hot: 'bg-rose-500/20 text-rose-200 border-rose-500/30',
    Warm: 'bg-amber-500/20 text-amber-200 border-amber-500/30',
    Cold: 'bg-sky-500/20 text-sky-200 border-sky-500/30'
  };

  const tempColorsLight = {
      Hot: 'bg-rose-100 text-rose-700 border-rose-200',
      Warm: 'bg-amber-100 text-amber-700 border-amber-200',
      Cold: 'bg-sky-100 text-sky-700 border-sky-200'
  };

  const { colorClass: urgencyClass, tooltip: urgencyTooltip } = getLeadUrgency(lead);

  const getServiceIcon = () => {
    if (lead.interestedServices.includes('Holiday Package')) return Palmtree;
    if (lead.interestedServices.includes('Flight Booking')) return Plane;
    if (lead.interestedServices.includes('Hotel Booking')) return BedDouble;
    if (lead.interestedServices.includes('Visa Service')) return FileCheck;
    return null;
  };
  const ServiceIcon = getServiceIcon();

  const metadata = [];
  if (lead.tripDetails.destination) metadata.push(lead.tripDetails.destination);
  const { adults, children } = lead.tripDetails.paxConfig;
  const totalPax = adults + children;
  if (totalPax > 0) {
      const parts = [];
      if (adults > 0) parts.push(`${adults}A`);
      if (children > 0) parts.push(`${children}C`);
      metadata.push(parts.join(', '));
  }
  const budgetStr = formatCompactCurrency(lead.tripDetails.budget);
  if (budgetStr) metadata.push(budgetStr);

  return (
    <div 
        className={cn(
            "relative p-3 rounded-xl border transition-all duration-200 select-none group",
            theme === 'light' ? 'bg-white border-slate-100 hover:border-slate-300' : 'bg-white/5 backdrop-blur-md border-white/10 hover:bg-white/10 hover:border-white/20',
            isOverlay ? "shadow-2xl scale-105 rotate-2 cursor-grabbing ring-1 ring-blue-500/50" : "shadow-sm hover:shadow-md cursor-grab",
            isDragging ? "opacity-30 grayscale" : "opacity-100",
            urgencyClass 
        )}
        title={urgencyTooltip} 
    >
        <div className="flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                    <h4 className={cn("font-bold truncate text-sm capitalize", getTextColor())}>{lead.name}</h4>
                    {ServiceIcon && (
                        <span className={cn("opacity-50 shrink-0", getSecondaryTextColor())}>
                            <ServiceIcon size={12} />
                        </span>
                    )}
                    <span className={cn("text-[10px] ml-auto shrink-0 opacity-40 whitespace-nowrap", getSecondaryTextColor())}>
                        {timeAgo(lead.createdAt)}
                    </span>
                    {urgencyClass && <AlertOctagon size={12} className={cn("shrink-0", urgencyClass.includes('red') ? 'text-red-500' : 'text-orange-500')} />}
                </div>

                <div className={cn("flex items-center gap-2 text-xs truncate opacity-70", getSecondaryTextColor())}>
                    {metadata.map((item, index) => (
                        <React.Fragment key={index}>
                            <span className="truncate">{item}</span>
                            {index < metadata.length - 1 && (
                                <span className="w-0.5 h-0.5 rounded-full bg-current opacity-50 shrink-0" />
                            )}
                        </React.Fragment>
                    ))}
                    {metadata.length === 0 && <span className="italic opacity-50">No details</span>}
                </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
                <span className={cn(
                    "text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded border leading-none",
                    theme === 'light' ? tempColorsLight[lead.temperature] : tempColors[lead.temperature]
                )}>
                    {lead.temperature}
                </span>

                <div onClick={(e) => e.stopPropagation()}>
                   <DialButton phoneNumber={lead.contact.phone} className="w-7 h-7" />
                </div>
            </div>
        </div>
      </div>
  );
};

// --- Mobile Lead Card Component ---

interface MobileLeadCardProps {
    lead: Lead;
    onStatusChange?: (id: string, status: LeadStatus) => void;
}

const MobileLeadCard: React.FC<MobileLeadCardProps> = ({ lead, onStatusChange }) => {
  const { theme, getTextColor, getSecondaryTextColor } = useTheme();

  const statusColors: Record<string, string> = {
      'New': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      'Contacted': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      'Proposal Sent': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      'Discussion': 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
      'Won': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      'Lost': 'bg-rose-500/10 text-rose-500 border-rose-500/20'
  };

  const waLink = `https://wa.me/${lead.contact.phone.replace(/[^0-9]/g, '')}`;
  const { colorClass: urgencyClass } = getLeadUrgency(lead);

  return (
    <div className={cn(
        "p-4 rounded-xl border transition-all shadow-sm",
        theme === 'light' ? 'bg-white border-slate-100' : 'bg-white/5 border-white/10',
        urgencyClass
    )}>
       <div className="flex justify-between items-start mb-3">
          <Link to={`/leads/${lead.id}`} className={cn("font-bold text-lg truncate flex-1 mr-2 capitalize", getTextColor())}>
            {lead.name}
          </Link>
          
          <div className="relative shrink-0">
              <span className={cn(
                 "px-2 py-0.5 rounded text-[10px] font-bold uppercase border flex items-center gap-1",
                 statusColors[lead.status] || 'bg-slate-500/10 text-slate-500 border-slate-500/20'
              )}>
                {lead.status}
                {onStatusChange && <ChevronDown size={12} strokeWidth={3} />}
              </span>
              
              {onStatusChange && (
                  <select
                    value={lead.status}
                    onChange={(e) => onStatusChange(lead.id, e.target.value as LeadStatus)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  >
                      {STATUS_COLUMNS.map(status => (
                          <option key={status} value={status}>{status}</option>
                      ))}
                  </select>
              )}
          </div>
       </div>

       <Link to={`/leads/${lead.id}`} className="block space-y-2 mb-4">
           <div className={cn("flex items-center gap-2 text-sm font-medium", theme === 'light' ? 'text-slate-600' : 'text-slate-300')}>
               <MapPin size={16} className={cn("shrink-0", theme === 'light' ? 'text-slate-500' : 'text-slate-400')} />
               <span>{lead.tripDetails.destination}</span>
           </div>
           <div className={cn("flex items-center gap-2 text-sm font-medium", theme === 'light' ? 'text-slate-600' : 'text-slate-300')}>
               <Calendar size={16} className={cn("shrink-0", theme === 'light' ? 'text-slate-500' : 'text-slate-400')} />
               <span>{formatDate(lead.tripDetails.startDate)}</span>
           </div>
       </Link>

       <div className="grid grid-cols-2 gap-3 mt-2">
           <a href={`tel:${lead.contact.phone}`} className={cn(
               "flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors border w-full",
               theme === 'light' 
                ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' 
                : 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'
           )}>
               <Phone size={16} /> Call
           </a>
           <a href={waLink} target="_blank" rel="noreferrer" className={cn(
               "flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors border w-full",
               theme === 'light' 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
           )}>
               <MessageCircle size={16} /> WhatsApp
           </a>
       </div>
    </div>
  );
};


// --- DND Components ---

const DraggableCard: React.FC<{ lead: Lead }> = ({ lead }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
  });
  
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className="mb-3 touch-none outline-none">
       {isDragging ? (
          <LeadCard lead={lead} isDragging={true} />
       ) : (
          <Link to={`/leads/${lead.id}`} className="block">
              <LeadCard lead={lead} />
          </Link>
       )}
    </div>
  );
};

const DroppableColumn: React.FC<{ status: string, children: React.ReactNode }> = ({ status, children }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });
  const { theme, getTextColor } = useTheme();

  return (
    <div ref={setNodeRef} className={cn(
        "flex-1 min-w-[300px] rounded-2xl p-3 flex flex-col h-[calc(100vh-240px)] transition-all duration-300",
        theme === 'light' 
          ? (isOver ? 'bg-blue-50 ring-2 ring-blue-200 shadow-inner' : 'bg-slate-100/50') 
          : (isOver ? 'bg-white/10 ring-2 ring-white/10 shadow-inner' : 'bg-black/20')
    )}>
      <h3 className={cn("font-bold font-serif text-lg mb-3 px-2 flex justify-between items-center transition-colors", isOver ? "text-blue-500" : getTextColor())}>
          {status}
          <span className={cn(
            "text-sm px-2.5 py-0.5 rounded-full backdrop-blur-sm transition-colors",
            isOver ? "bg-blue-500 text-white" : "bg-white/20"
          )}>
              {React.Children.count(children)}
          </span>
      </h3>
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-20">
        {children}
      </div>
    </div>
  );
};

// --- Main Page ---

export const Leads = () => {
  const { leads, addLead, addLeads, updateLead, updateLeadStatus } = useLeads();
  const { theme, getTextColor, getInputClass, getBorderClass, getSecondaryTextColor } = useTheme();
  const { user } = useAuth(); // Add user auth
  
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [activeMobileStatus, setActiveMobileStatus] = useState<LeadStatus>('New');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newLeadServices, setNewLeadServices] = useState<string[]>([]);
  const [newLeadPax, setNewLeadPax] = useState<PaxConfig>({ adults: 2, children: 0, childAges: [] });
  const [newLeadPrefs, setNewLeadPrefs] = useState<TravelPreferencesType>({});
  
  // -- Gatekeeper Logic State --
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [pendingLeadId, setPendingLeadId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<LeadStatus | null>(null);

  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showToast, setShowToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  const [filters, setFilters] = useState({
      source: '',
      temp: ''
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
        const leadId = active.id as string;
        const newStatus = over.id as LeadStatus;
        if (STATUS_COLUMNS.includes(newStatus)) {
            // --- Gatekeeper Check ---
            if (newStatus === 'Proposal Sent') {
                const lead = leads.find(l => l.id === leadId);
                if (lead && (!lead.vendors || lead.vendors.length === 0)) {
                    setPendingLeadId(leadId);
                    setPendingStatus(newStatus);
                    setIsVendorModalOpen(true);
                    return; // Halt status change
                }
            }
            
            try {
                // Persistent Drag-and-Drop: Optimistic UI + Backend Sync via Context
                await updateLeadStatus(leadId, newStatus);
            } catch (error) {
                // Error Handling: Show Toast (Revert is handled by context fetchLeads)
                setShowToast({ 
                    message: "Failed to update status. Changes reverted.", 
                    type: 'error' 
                });
                setTimeout(() => setShowToast(null), 3000);
            }
        }
    }
  };

  const filteredLeads = leads.filter(l => {
      if (filters.source && l.source !== filters.source) return false;
      if (filters.temp && l.temperature !== filters.temp) return false;
      return true;
  });

  const hasActiveFilters = filters.source || filters.temp;
  const activeLead = activeId ? leads.find(l => l.id === activeId) : null;

  const handleOpenModal = () => {
      setNewLeadServices([]);
      setNewLeadPax({ adults: 2, children: 0, childAges: [] });
      setNewLeadPrefs({});
      setIsModalOpen(true);
  };

  // --- CSV Import Logic ---

  const downloadSampleCsv = () => {
      const headers = ['Name', 'Phone', 'Email', 'Destination', 'Budget', 'Travel Date', 'Status', 'Source'];
      const row = ['John Doe', '+919876543210', 'john@example.com', 'Bali', '50000', '2025-10-01', 'New', 'Instagram'];
      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), row.join(',')].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "voyageos_lead_template.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const processImportedData = (data: any[]) => {
      const validLeads: Lead[] = [];
      let skippedCount = 0;

      // Smart Mapping Configuration
      const mappings = {
          name: ['name', 'client', 'customer', 'passenger'],
          phone: ['phone', 'mobile', 'contact', 'number'],
          email: ['email', 'mail'],
          destination: ['destination', 'loc', 'place', 'dest'],
          budget: ['budget', 'price', 'cost'],
          startDate: ['date', 'travel date', 'start', 'start date'],
          status: ['status', 'stage'],
          source: ['source', 'channel']
      };

      const findField = (row: any, keys: string[]) => {
          for (const key of keys) {
              const foundKey = Object.keys(row).find(k => k.toLowerCase().trim() === key);
              if (foundKey && row[foundKey]) return row[foundKey];
          }
          return null;
      };

      data.forEach(row => {
          const name = findField(row, mappings.name);
          const phone = findField(row, mappings.phone);

          // Mandatory Check
          if (!name || !phone) {
              skippedCount++;
              return;
          }

          const newLead: Lead = {
              id: generateId(),
              name: name,
              contact: {
                  phone: phone,
                  email: findField(row, mappings.email) || '',
              },
              tripDetails: {
                  destination: findField(row, mappings.destination) || 'TBD',
                  budget: Number(findField(row, mappings.budget)) || 0,
                  paxConfig: { adults: 2, children: 0, childAges: [] }, // Default
                  startDate: findField(row, mappings.startDate) || new Date().toISOString(),
              },
              status: (findField(row, mappings.status) as LeadStatus) || 'New',
              temperature: 'Hot', // Default
              source: (findField(row, mappings.source) as LeadSource) || 'Other',
              interestedServices: [],
              tags: ['Imported'],
              createdAt: new Date().toISOString(),
              lastStatusUpdate: new Date().toISOString(),
              vendors: []
          };
          validLeads.push(newLead);
      });

      if (validLeads.length > 0) {
          addLeads(validLeads);
          setShowToast({
              message: `Imported ${validLeads.length} leads.${skippedCount > 0 ? ` Skipped ${skippedCount} rows.` : ''}`,
              type: 'success'
          });
          setIsModalOpen(false);
      } else {
          setShowToast({
              message: `No valid leads found. Skipped ${skippedCount} rows.`,
              type: 'error'
          });
      }

      setTimeout(() => setShowToast(null), 5000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => processImportedData(results.data),
          error: (error) => {
              console.error(error);
              setShowToast({ message: "Failed to parse CSV.", type: 'error' });
              setTimeout(() => setShowToast(null), 3000);
          }
      });
      // Reset input
      e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type === "text/csv") {
           Papa.parse(file, {
              header: true,
              skipEmptyLines: true,
              complete: (results) => processImportedData(results.data),
              error: (error) => {
                  console.error(error);
                  setShowToast({ message: "Failed to parse CSV.", type: 'error' });
                  setTimeout(() => setShowToast(null), 3000);
              }
          });
      } else if (file) {
          setShowToast({ message: "Please upload a valid .csv file", type: 'error' });
          setTimeout(() => setShowToast(null), 3000);
      }
  };

  const handleAddLead = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const newLead: Lead = {
          id: generateId(),
          name: formData.get('name') as string,
          contact: {
              phone: (formData.get('phone') as string) || '', // Optional
              email: (formData.get('email') as string) || '', // Optional
          },
          tripDetails: {
              destination: formData.get('destination') as string,
              budget: Number(formData.get('budget') || 0), // Default to 0 if empty
              paxConfig: newLeadPax, // Use the state object
              startDate: formData.get('startDate') as string,
          },
          preferences: newLeadPrefs, // Use the state object
          status: 'New',
          temperature: formData.get('temperature') as LeadTemperature,
          source: formData.get('source') as LeadSource,
          interestedServices: newLeadServices, // Include services
          referenceName: formData.get('reference') as string,
          assignedTo: formData.get('assignedTo') as string,
          tags: [],
          createdAt: new Date().toISOString(),
          lastStatusUpdate: new Date().toISOString(),
          vendors: []
      };
      addLead(newLead);
      setIsModalOpen(false);
  };

  // --- Gatekeeper: Handle Vendor Save ---
  const handleVendorSave = (leadId: string, vendors: VendorDetail[]) => {
      const lead = leads.find(l => l.id === leadId);
      if(!lead) return;

      const totalCost = vendors.reduce((acc, v) => acc + (v.cost || 0), 0);
      const totalPrice = vendors.reduce((acc, v) => acc + (v.price || 0), 0);
      
      const newCommercials = {
          sellingPrice: totalPrice,
          netCost: totalCost,
          vendorId: vendors[0].id,
          manualVendorName: vendors[0].name,
          taxAmount: 0
      };

      updateLead(leadId, { vendors, commercials: newCommercials });
      
      // If there was a pending status change
      if (pendingStatus) {
          updateLeadStatus(leadId, pendingStatus);
          setPendingStatus(null);
          setPendingLeadId(null);
      }
      setIsVendorModalOpen(false);
  };

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  };

  const inputClasses = cn(
      "w-full rounded-lg px-3 py-2 text-sm md:p-3 md:text-base outline-none transition-all border",
      getInputClass()
  );

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500 relative pt-2 md:pt-0">
      
       {/* Toast Notification */}
       {showToast && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 md:top-6 md:right-6 md:translate-x-0 md:left-auto z-50 animate-in slide-in-from-top-2 fade-in duration-300 w-full max-w-sm px-4">
              <div className={cn(
                  "flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md",
                  theme === 'light' ? 'bg-white/90 border-slate-200' : 'bg-slate-800/90 border-white/10',
                  showToast.type === 'success' ? 'text-green-500' : 'text-red-500'
              )}>
                  <CheckCircle2 size={18} className="shrink-0" />
                  <span className={cn("font-medium text-sm", theme === 'light' ? 'text-slate-800' : 'text-white')}>{showToast.message}</span>
              </div>
          </div>
      )}

      {/* --- Gatekeeper Modal --- */}
      <VendorManagementModal 
          isOpen={isVendorModalOpen}
          onClose={() => setIsVendorModalOpen(false)}
          leadId={pendingLeadId}
          onSave={handleVendorSave}
      />

      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className={cn("text-2xl md:text-4xl font-bold font-serif mb-1", getTextColor())}>Leads</h1>
            <p className={cn("text-sm opacity-70", getTextColor())}>Manage and track your opportunities</p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap w-full md:w-auto h-12 md:h-auto">
            {/* View Toggles */}
            <div className={cn("flex items-center rounded-xl p-1 border h-10 md:h-11 flex-shrink-0", theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10')}>
                <button 
                    onClick={() => setView('kanban')} 
                    className={cn("p-2 rounded-lg transition-all h-full w-10 flex items-center justify-center", view === 'kanban' ? (theme === 'light' ? 'bg-slate-100 text-blue-600' : 'bg-white/20 text-white') : 'opacity-50 hover:opacity-100 text-gray-400')}
                >
                    <LayoutGrid size={20} />
                </button>
                <button 
                    onClick={() => setView('list')} 
                    className={cn("p-2 rounded-lg transition-all h-full w-10 flex items-center justify-center", view === 'list' ? (theme === 'light' ? 'bg-slate-100 text-blue-600' : 'bg-white/20 text-white') : 'opacity-50 hover:opacity-100 text-gray-400')}
                >
                    <LayoutList size={20} />
                </button>
            </div>

            {/* Filter */}
            <div className="relative group z-30 h-10 md:h-11">
                <Button variant="secondary" className="gap-2 h-full border border-slate-200 shadow-none bg-white hover:bg-slate-50 text-slate-600">
                    <Filter size={18} /> Filter
                </Button>
                {/* Filter Dropdown */}
                <div className={cn(
                    "absolute top-full right-0 mt-2 w-56 rounded-xl shadow-2xl p-3 hidden group-hover:block backdrop-blur-xl border",
                     theme === 'light' ? 'bg-white/90 border-slate-200' : 'bg-gray-900/90 border-white/10'
                )}>
                    <div className={cn("text-xs font-bold uppercase tracking-wider mb-2 opacity-50", getTextColor())}>Temperature</div>
                    {['Hot', 'Warm', 'Cold'].map(t => (
                        <div key={t} 
                            onClick={() => setFilters(p => ({...p, temp: p.temp === t ? '' : t}))}
                            className={cn(
                                "px-3 py-2 rounded-lg cursor-pointer text-sm mb-1 transition-colors flex items-center justify-between min-h-[44px]", 
                                filters.temp === t 
                                    ? 'bg-blue-500/20 text-blue-500 font-bold' 
                                    : cn('hover:bg-white/10', getTextColor())
                            )}
                        >
                            {t}
                            {filters.temp === t && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                        </div>
                    ))}
                    <div className="h-px bg-gray-500/20 my-2"></div>
                    <div className={cn("text-xs font-bold uppercase tracking-wider mb-2 opacity-50", getTextColor())}>Source</div>
                     {['Instagram', 'Referral', 'Website'].map(s => (
                        <div key={s} 
                            onClick={() => setFilters(p => ({...p, source: p.source === s ? '' : s}))}
                            className={cn(
                                "px-3 py-2 rounded-lg cursor-pointer text-sm mb-1 transition-colors flex items-center justify-between min-h-[44px]", 
                                filters.source === s 
                                    ? 'bg-blue-500/20 text-blue-500 font-bold' 
                                    : cn('hover:bg-white/10', getTextColor())
                            )}
                        >
                            {s}
                            {filters.source === s && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                        </div>
                    ))}
                </div>
            </div>

            <Button onClick={handleOpenModal} className="hidden md:flex shadow-lg shadow-blue-500/20 h-10 md:h-11">
                <Plus size={18} /> Add Lead
            </Button>
        </div>
      </div>

      {filteredLeads.length === 0 ? (
         <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] animate-in fade-in zoom-in-95 duration-500">
            {/* Empty State ... (Unchanged) */}
            <div className={cn("w-24 h-24 rounded-full flex items-center justify-center mb-6", theme === 'light' ? 'bg-blue-50 text-blue-400' : 'bg-white/5 text-white/30')}>
                {hasActiveFilters ? <SearchX size={48} /> : <Users size={48} />}
            </div>
            <h2 className={cn("text-2xl font-bold font-serif mb-2", getTextColor())}>
                {hasActiveFilters ? "No matches found" : "No leads yet"}
            </h2>
            <p className={cn("max-w-xs mx-auto mb-8 text-center", getSecondaryTextColor())}>
                {hasActiveFilters 
                    ? "We couldn't find any leads matching your filters. Try clearing them to see all results." 
                    : "Your pipeline is looking empty. Add your first potential client to start tracking their journey."}
            </p>
            {hasActiveFilters ? (
                <Button onClick={() => setFilters({source: '', temp: ''})} variant="secondary">
                    Clear Filters
                </Button>
            ) : (
                <Button onClick={handleOpenModal} className="hidden md:flex shadow-xl shadow-blue-500/20">
                    <Plus size={18} /> Create First Lead
                </Button>
            )}
         </div>
      ) : view === 'kanban' ? (
        <>
            {/* Kanban View ... (Unchanged) */}
            <div className="hidden md:block h-full">
                <DndContext 
                    sensors={sensors} 
                    collisionDetection={closestCenter} 
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <div className="flex gap-6 overflow-x-auto pb-6 h-full items-start snap-x">
                        {STATUS_COLUMNS.map(status => (
                            <DroppableColumn key={status} status={status}>
                                {filteredLeads.filter(l => l.status === status).map(lead => (
                                    <DraggableCard key={lead.id} lead={lead} />
                                ))}
                            </DroppableColumn>
                        ))}
                    </div>

                    <DragOverlay dropAnimation={dropAnimation}>
                        {activeLead ? (
                           <LeadCard lead={activeLead} isOverlay />
                        ) : null}
                    </DragOverlay>

                </DndContext>
            </div>

            <div className="md:hidden flex flex-col h-full">
                 {/* Mobile Kanban Tabs */}
                 <div className="relative">
                     <div className="flex gap-2 overflow-x-auto pb-4 px-1 no-scrollbar items-center">
                         {STATUS_COLUMNS.map(status => (
                             <button
                                key={status}
                                onClick={() => setActiveMobileStatus(status as LeadStatus)}
                                className={cn(
                                    "whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold border transition-all min-h-[44px]",
                                    activeMobileStatus === status
                                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                        : (theme === 'light' ? "bg-white text-slate-500 border-slate-200" : "bg-white/5 text-white/60 border-white/10")
                                )}
                             >
                                {status}
                             </button>
                         ))}
                     </div>
                     {/* Scroll Hint Overlay */}
                     <div className={cn("absolute right-0 top-0 bottom-4 w-12 pointer-events-none bg-gradient-to-l", theme === 'light' ? "from-slate-50 to-transparent" : "from-slate-900 to-transparent")} />
                 </div>
                 
                 <div className="flex-1 space-y-4 pb-32">
                     {filteredLeads
                        .filter(l => l.status === activeMobileStatus)
                        .map(lead => (
                            <MobileLeadCard 
                                key={lead.id} 
                                lead={lead} 
                                onStatusChange={updateLeadStatus} 
                            />
                     ))}
                     {filteredLeads.filter(l => l.status === activeMobileStatus).length === 0 && (
                         <div className="text-center opacity-50 py-10 flex flex-col items-center gap-2">
                             <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", theme === 'light' ? 'bg-slate-100' : 'bg-white/5')}>
                                 <LayoutList size={24} />
                             </div>
                             <p className="text-sm">No leads in {activeMobileStatus}</p>
                         </div>
                     )}
                 </div>
            </div>
        </>
      ) : (
        <>
            {/* List View with Cinematic Row Interaction */}
            <Card noPadding className="hidden md:block overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className={cn("w-full text-left border-collapse", getTextColor())}>
                        <thead>
                            <tr className={cn(theme === 'light' ? 'bg-slate-50 border-b border-slate-200' : 'bg-white/5 border-b border-white/10')}>
                                <th className="p-5 font-bold font-serif text-sm">Name</th>
                                {user?.role === 'admin' && <th className="p-5 font-bold font-serif text-sm">Agent</th>}
                                <th className="p-5 font-bold font-serif text-sm">Status</th>
                                <th className="p-5 font-bold font-serif text-sm">Temp</th>
                                <th className="p-5 font-bold font-serif text-sm">Destination</th>
                                <th className="p-5 font-bold font-serif text-sm">Budget</th>
                                <th className="p-5 font-bold font-serif text-sm">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLeads.map(lead => (
                                <tr key={lead.id} className={cn(
                                    "group relative transition-all duration-500 ease-in-out border-b",
                                    theme === 'light' 
                                        ? "border-slate-100 hover:bg-gradient-to-r hover:from-transparent hover:via-slate-50 hover:to-transparent" 
                                        : "border-white/5 hover:bg-gradient-to-r hover:from-transparent hover:via-white/5 hover:to-transparent",
                                    "hover:shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] hover:z-10"
                                )}>
                                    <td className="p-5 font-semibold relative">
                                        {/* Cinematic Glow Marker */}
                                        <div className={cn(
                                            "absolute left-0 top-0 bottom-0 w-[3px] scale-y-0 transition-transform duration-300 origin-center group-hover:scale-y-100",
                                            theme === 'light' ? "bg-slate-900" : "bg-blue-400"
                                        )} />
                                        
                                        <div className="flex items-center gap-2">
                                            {lead.name}
                                            <DialButton phoneNumber={lead.contact.phone} className="w-11 h-11 opacity-50 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </td>
                                    
                                    {/* Admin Agent Column */}
                                    {user?.role === 'admin' && (
                                        <td className="p-5">
                                            {lead.assignedTo ? (
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-full text-[10px] font-bold border opacity-70 group-hover:opacity-100 transition-opacity",
                                                    theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-white/10 border-white/10 text-white'
                                                )}>
                                                    {lead.assignedTo}
                                                </span>
                                            ) : (
                                                <span className="text-xs opacity-30 italic">Unassigned</span>
                                            )}
                                        </td>
                                    )}

                                    <td className="p-5">
                                        <span className={cn("px-2.5 py-1 rounded-md text-xs font-medium border", theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/10 border-white/10')}>{lead.status}</span>
                                    </td>
                                    <td className="p-5">
                                        <span className={cn(
                                            "px-2.5 py-1 rounded-full text-xs font-bold border", 
                                            lead.temperature === 'Hot' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 
                                            lead.temperature === 'Warm' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                                            'bg-sky-500/10 text-sky-500 border-sky-500/20'
                                        )}>{lead.temperature}</span>
                                    </td>
                                    <td className={cn("p-5 text-sm transition-colors", theme === 'light' ? "text-slate-500 group-hover:text-slate-900" : "text-white/60 group-hover:text-white")}>
                                        {lead.tripDetails.destination}
                                    </td>
                                    <td className={cn("p-5 text-sm font-mono tracking-wide transition-colors", theme === 'light' ? "text-slate-500 group-hover:text-slate-900" : "text-white/60 group-hover:text-white")}>
                                        {formatCurrency(lead.tripDetails.budget)}
                                    </td>
                                    <td className="p-5">
                                        <Link to={`/leads/${lead.id}`} className={cn(
                                            "font-medium text-sm transition-all transform inline-block",
                                            theme === 'light' ? "text-blue-500 hover:text-blue-600" : "text-blue-400 hover:text-blue-300",
                                            "opacity-60 group-hover:opacity-100 group-hover:translate-x-1"
                                        )}>
                                            View
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <div className="md:hidden space-y-4 pb-32">
                {filteredLeads.map(lead => (
                    <MobileLeadCard 
                        key={lead.id} 
                        lead={lead} 
                        onStatusChange={updateLeadStatus}
                    />
                ))}
            </div>
        </>
      )}

      <button
        onClick={handleOpenModal}
        className="md:hidden fixed bottom-24 right-6 h-14 w-14 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center z-50 hover:scale-105 active:scale-95 transition-all"
        aria-label="Add Lead"
      >
        <Plus size={28} />
      </button>

      {/* Modal is kept separate below to avoid nesting issues */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Lead">
        <form onSubmit={handleAddLead} className="space-y-5">
            {/* ... Modal content matches exactly previous version ... */}
            <div className="space-y-2">
                 <label className={cn("text-xs font-bold uppercase tracking-wider opacity-60", getTextColor())}>Service Requirements</label>
                 <ServiceSelector 
                    selectedServices={newLeadServices}
                    onChange={setNewLeadServices}
                 />
            </div>

            <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                    <label className={cn("text-xs font-bold uppercase tracking-wider opacity-60", getTextColor())}>Client Name</label>
                    <input name="name" required className={inputClasses} placeholder="John Doe" />
                </div>
                <div className="space-y-1.5">
                    <label className={cn("text-xs font-bold uppercase tracking-wider opacity-60", getTextColor())}>Source</label>
                    <select name="source" className={cn(inputClasses, "[&>option]:text-black")}>
                        <option value="Instagram">Instagram</option>
                        <option value="Walk-in">Walk-in</option>
                        <option value="Referral">Referral</option>
                        <option value="Website">Website</option>
                    </select>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                    <label className={cn("text-xs font-bold uppercase tracking-wider opacity-60", getTextColor())}>Phone</label>
                    <input name="phone" defaultValue="+91 " className={inputClasses} placeholder="+91 ..." />
                </div>
                <div className="space-y-1.5">
                    <label className={cn("text-xs font-bold uppercase tracking-wider opacity-60", getTextColor())}>Email <span className="text-[10px] opacity-50 font-normal normal-case ml-1">(Optional)</span></label>
                    <input name="email" type="email" className={inputClasses} placeholder="email@example.com" />
                </div>
            </div>

            <div className={cn("p-4 rounded-xl border border-dashed space-y-3", getBorderClass(), theme === 'light' ? 'bg-slate-50' : 'bg-white/5')}>
                <p className={cn("text-xs font-bold uppercase tracking-wide opacity-50", getTextColor())}>Trip Details</p>
                
                <div className="space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-1">
                            <label className={cn("text-[10px] font-bold uppercase opacity-60", getTextColor())}>Destination</label>
                            <input name="destination" required placeholder="Where to?" className={cn("w-full bg-transparent border-b p-2 outline-none text-base transition-colors", getBorderClass(), "focus:border-blue-500", getTextColor())} />
                         </div>
                         <div className="space-y-1">
                            <label className={cn("text-[10px] font-bold uppercase opacity-60", getTextColor())}>Start Date</label>
                            <input name="startDate" type="date" required className={cn("w-full bg-transparent border-b p-2 outline-none text-base transition-colors", getBorderClass(), "focus:border-blue-500", getTextColor())} />
                         </div>
                     </div>
                     
                     <PaxSelector value={newLeadPax} onChange={setNewLeadPax} />
                     
                     <div className="pt-2">
                        <TravelPreferences value={newLeadPrefs} onChange={setNewLeadPrefs} />
                     </div>

                     <div className="space-y-1">
                        <label className={cn("text-[10px] font-bold uppercase opacity-60", getTextColor())}>Total Budget</label>
                        <input name="budget" type="number" placeholder="Budget (₹) - Optional" className={cn("w-full bg-transparent border-b p-2 outline-none text-lg font-mono transition-colors", getBorderClass(), "focus:border-blue-500", getTextColor())} />
                     </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
                 <div className="space-y-1.5">
                    <label className={cn("text-xs font-bold uppercase tracking-wider opacity-60", getTextColor())}>Temperature</label>
                    <select name="temperature" className={cn(inputClasses, "[&>option]:text-black")}>
                        <option value="Hot">Hot (Ready to buy)</option>
                        <option value="Warm">Warm (Interested)</option>
                        <option value="Cold">Cold (Future)</option>
                    </select>
                </div>
                 <div className="space-y-1.5">
                    <label className={cn("text-xs font-bold uppercase tracking-wider opacity-60", getTextColor())}>Reference Name</label>
                    <input name="reference" className={inputClasses} placeholder="Optional" />
                </div>
                {user?.role === 'admin' && (
                    <div className="space-y-1.5 col-span-2">
                        <label className={cn("text-xs font-bold uppercase tracking-wider opacity-60", getTextColor())}>Assign To</label>
                        <select name="assignedTo" className={cn(inputClasses, "[&>option]:text-black")}>
                            <option value="Unassigned">Unassigned</option>
                            {/* Assuming users are available here via context, but we need to pass them or access context */}
                            <option value={user.name}>Me ({user.name})</option>
                        </select>
                    </div>
                )}
            </div>

            <div className="pt-4 flex justify-between items-center border-t border-gray-500/10 relative">
                 <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".csv" 
                    onChange={handleFileUpload}
                 />
                 
                 <div className="flex flex-col gap-1">
                    <div 
                        className={cn("text-xs font-medium flex items-center gap-2 cursor-pointer transition-colors px-3 py-2 rounded-lg border border-dashed hover:bg-blue-500/10", getTextColor(), getBorderClass())}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                    >
                        <UploadCloud size={16} className="text-blue-500" /> 
                        <span>Import CSV</span>
                    </div>
                    <button 
                        type="button" 
                        onClick={downloadSampleCsv} 
                        className={cn("text-[10px] opacity-50 hover:opacity-100 flex items-center gap-1 ml-1", getSecondaryTextColor())}
                    >
                        <Download size={10} /> Download Sample
                    </button>
                 </div>

                 <Button type="submit">Create Lead</Button>
            </div>
        </form>
      </Modal>
    </div>
  );
};
