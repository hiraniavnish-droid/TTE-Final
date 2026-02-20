
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLeads } from '../contexts/LeadContext';
import { useTheme } from '../contexts/ThemeContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { DialButton } from '../components/ui/DialButton';
import { ServiceSelector } from '../components/ServiceSelector';
import { PaxSelector } from '../components/PaxSelector'; 
import { TravelPreferences } from '../components/TravelPreferences';
import { WorkflowStepper } from '../components/WorkflowStepper'; 
import { VendorManagementModal } from '../components/VendorManagementModal'; // NEW
import { InteractionType, Interaction, Reminder, LeadStatus, Supplier, Commercials, Lead, VendorDetail } from '../types';
import { formatCurrency, formatCompactCurrency, formatDate, generateId, cn } from '../utils/helpers';
import { triggerConfetti } from '../utils/celebration';
import { 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Users, 
  Tag, 
  ArrowLeft,
  Clock,
  MessageCircle,
  PhoneCall,
  AlertCircle,
  Pencil,
  Save,
  X,
  ClipboardList,
  CheckCircle2,
  User,
  History,
  CheckSquare,
  Trash2,
  AlertTriangle,
  Briefcase,
  Copy,
  ChevronDown,
  ChevronUp,
  Handshake,
  Calculator,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Trophy,
  ExternalLink,
  Send
} from 'lucide-react';

const WORKFLOW_ORDER: LeadStatus[] = ['New', 'Contacted', 'Proposal Sent', 'Discussion', 'Won'];

const generateVendorBrief = (lead: Lead): string => {
    const startDate = new Date(lead.tripDetails.startDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 5);
    const nights = 5;

    const services = lead.interestedServices && lead.interestedServices.length > 0 
      ? lead.interestedServices.join(', ') 
      : 'Not Specified';
      
    const paxString = `${lead.tripDetails.paxConfig.adults} Adults, ${lead.tripDetails.paxConfig.children} Children ${lead.tripDetails.paxConfig.children > 0 ? `(${lead.tripDetails.paxConfig.childAges.join(', ')} yrs)` : ''}`;
    
    const prefs = lead.preferences || {};
    const prefString = [
        prefs.hotel ? `🏨 ${prefs.hotel}` : '',
        prefs.mealPlan ? `🍽 ${prefs.mealPlan}` : ''
    ].filter(Boolean).join(' | ');

    return `📢 *New Quotation Request*
📍 *Dest:* ${lead.tripDetails.destination}
📅 *Dates:* ${formatDate(lead.tripDetails.startDate)} to ${formatDate(endDate.toISOString())}
🌙 *Duration:* ${nights} Nights
👥 *Pax:* ${paxString}
💰 *Budget:* ${formatCurrency(lead.tripDetails.budget)}
🛠 *Services:* ${services}
✨ *Prefs:* ${prefString || 'Standard'}
🏷 *Tags:* ${lead.tags.length > 0 ? lead.tags.join(', ') : 'None'}`;
};

// --- Sub-Component: Commercials View (NOW READ-ONLY OVERVIEW) ---

interface CommercialsViewProps {
    lead: Lead;
    commercials: Commercials;
    onEdit: () => void;
}

const CommercialsView: React.FC<CommercialsViewProps> = ({ lead, commercials, onEdit }) => {
    const { theme, getTextColor } = useTheme();

    const sellingPrice = commercials.sellingPrice || 0;
    const netCost = commercials.netCost || 0;
    
    const grossProfit = sellingPrice - netCost;
    const marginPercent = sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0;

    let marginColor = "text-gray-500";
    let marginBg = "";
    if (sellingPrice > 0) {
        if (grossProfit < 0) {
            marginColor = "text-red-500";
            marginBg = "bg-red-500/10 border-red-500/20";
        } else if (marginPercent < 5) {
            marginColor = "text-orange-500";
            marginBg = "bg-orange-500/10 border-orange-500/20";
        } else if (marginPercent >= 15) {
            marginColor = "text-emerald-500";
            marginBg = "bg-emerald-500/10 border-emerald-500/20";
        } else {
            marginColor = "text-blue-500";
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Card>
                <div className="flex items-center justify-between mb-6 border-b border-gray-500/10 pb-4">
                    <div className="flex items-center gap-2">
                        <div className={cn("p-2 rounded-lg", theme === 'light' ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/20 text-blue-300')}>
                            <Calculator size={20} />
                        </div>
                        <h3 className={cn("text-lg font-bold font-serif", getTextColor())}>Costing Sheet</h3>
                    </div>
                    <Button size="sm" variant="secondary" onClick={onEdit}>
                        <Pencil size={14} /> Edit Vendors
                    </Button>
                </div>

                <div className="space-y-6">
                    {/* Vendors List Summary */}
                    {lead.vendors && lead.vendors.length > 0 ? (
                        <div className="space-y-2">
                            {lead.vendors.map((v) => (
                                <div key={v.id} className="flex justify-between items-center text-sm p-2 rounded bg-slate-50 border border-slate-100">
                                    <span className="font-bold text-slate-700">{v.name}</span>
                                    <div className="flex gap-4 font-mono text-xs">
                                        <span className="text-slate-500">Buy: {formatCompactCurrency(v.cost)}</span>
                                        <span className="font-bold text-slate-900">Sell: {formatCompactCurrency(v.price)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-4 text-sm opacity-50 italic border-dashed border-2 rounded-lg">
                            No vendors added yet.
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                        <div className="space-y-1">
                            <label className={cn("text-xs font-bold uppercase tracking-wider opacity-60", getTextColor())}>
                                Total Selling Price
                            </label>
                            <div className={cn("text-2xl font-mono font-bold", getTextColor())}>
                                {formatCurrency(sellingPrice)}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className={cn("text-xs font-bold uppercase tracking-wider opacity-60", getTextColor())}>
                                Total Net Cost
                            </label>
                            <div className={cn("text-2xl font-mono font-medium opacity-70", getTextColor())}>
                                {formatCurrency(netCost)}
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            <Card className={cn("transition-all duration-500 border", marginBg || "border-transparent")}>
                <div className="flex items-center gap-2 mb-6 border-b border-gray-500/10 pb-4">
                    <div className={cn("p-2 rounded-lg", theme === 'light' ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/20 text-emerald-300')}>
                        <TrendingUp size={20} />
                    </div>
                    <h3 className={cn("text-lg font-bold font-serif", getTextColor())}>Profit Analysis</h3>
                </div>

                <div className="grid grid-cols-2 gap-8 items-center">
                    <div>
                        <p className={cn("text-xs font-bold uppercase tracking-wider opacity-60 mb-1", getTextColor())}>Gross Profit</p>
                        <div className={cn("text-4xl font-bold font-mono tracking-tight", marginColor)}>
                            {formatCurrency(grossProfit)}
                        </div>
                        {grossProfit < 0 && (
                            <div className="flex items-center gap-1 text-red-500 text-xs font-bold mt-2">
                                <TrendingDown size={14} /> Loss detected
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col items-end">
                        <p className={cn("text-xs font-bold uppercase tracking-wider opacity-60 mb-1", getTextColor())}>Margin</p>
                        <div className={cn("text-3xl font-bold font-mono flex items-center gap-1", marginColor)}>
                            {marginPercent.toFixed(1)}%
                        </div>
                        <div className="mt-2 text-xs opacity-50 italic">Target: &gt;15%</div>
                    </div>
                </div>
            </Card>
        </div>
    );
};

// ... (SuggestedSuppliers component remains unchanged) ...
interface SuggestedSuppliersProps {
    lead: Lead;
    allLeads: Lead[];
    suppliers: Supplier[];
}

const SuggestedSuppliers: React.FC<SuggestedSuppliersProps> = ({ lead, allLeads, suppliers }) => {
    // ... (Keep existing implementation logic) ...
    const { theme, getTextColor, getSecondaryTextColor } = useTheme();
    const [isExpanded, setIsExpanded] = useState(true);
    const [selectedVendor, setSelectedVendor] = useState<Supplier | null>(null);

    const relevantSuppliers = useMemo(() => {
        if (!lead.tripDetails.destination) return [];
        const leadDest = lead.tripDetails.destination.toLowerCase().trim();

        return suppliers.filter(supplier => {
            if (!supplier.destinations) return false;
            
            if (Array.isArray(supplier.destinations)) {
                return supplier.destinations.some(d => {
                    const supplierDest = d.toLowerCase().trim();
                    return supplierDest.includes(leadDest) || leadDest.includes(supplierDest);
                });
            }
            if (typeof supplier.destinations === 'string') {
                // @ts-ignore
                return supplier.destinations.toLowerCase().includes(leadDest);
            }
            return false;
        });
    }, [lead.tripDetails.destination, suppliers]);

    const vendorStats = useMemo(() => {
        if (!selectedVendor) return null;
        let quotesRequested = 0;
        let bookings = 0;
        let totalVolume = 0;
        allLeads.forEach(l => {
            if (l.commercials?.vendorId === selectedVendor.id) {
                quotesRequested++;
                if (l.status === 'Won') {
                    bookings++;
                    totalVolume += (l.commercials.netCost || 0);
                }
            }
        });
        const conversionRate = quotesRequested > 0 ? (bookings / quotesRequested) * 100 : 0;
        return { quotesRequested, bookings, totalVolume, conversionRate };
    }, [selectedVendor, allLeads]);

    const handleWhatsApp = (e: React.MouseEvent, supplier: Supplier) => {
        e.stopPropagation();
        const brief = generateVendorBrief(lead);
        const phoneClean = supplier.phone.replace(/[^0-9]/g, '');
        const url = `https://wa.me/${phoneClean}?text=${encodeURIComponent(brief)}`;
        window.open(url, '_blank');
    };

    if (!lead.tripDetails.destination) return null;

    return (
        <>
            <Card noPadding className="mb-6 overflow-hidden border-l-4 border-l-purple-500">
                <button 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={cn(
                        "w-full flex items-center justify-between p-4 transition-colors", 
                        theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-white/5'
                    )}
                >
                    <div className="flex items-center gap-2">
                        <div className={cn("p-1.5 rounded-md", theme === 'light' ? 'bg-purple-50 text-purple-600' : 'bg-purple-500/20 text-purple-300')}>
                            <Handshake size={16} />
                        </div>
                        <span className={cn("font-bold text-sm", getTextColor())}>
                            Suggested Partners
                        </span>
                        <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-mono", theme === 'light' ? "bg-gray-100" : "bg-white/10", getTextColor())}>
                            {relevantSuppliers.length}
                        </span>
                    </div>
                    {isExpanded ? <ChevronUp size={16} className="opacity-50" /> : <ChevronDown size={16} className="opacity-50" />}
                </button>

                {isExpanded && (
                    <div className={cn("px-4 pb-4 animate-in slide-in-from-top-2 duration-300")}>
                        <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            {relevantSuppliers.length === 0 ? (
                                <div className="text-center py-6 opacity-50 text-xs italic">
                                    No partners found for "{lead.tripDetails.destination}". <br/>
                                    Check the Suppliers directory.
                                </div>
                            ) : (
                                relevantSuppliers.map(supplier => (
                                    <div 
                                        key={supplier.id} 
                                        onClick={() => setSelectedVendor(supplier)}
                                        className={cn(
                                            "flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer group",
                                            theme === 'light' ? 'bg-slate-50 border-slate-100 hover:bg-white hover:shadow-md' : 'bg-white/5 border-white/5 hover:bg-white/10'
                                        )}
                                    >
                                        <div className="min-w-0 flex-1 mr-3">
                                            <div className="flex items-center gap-2">
                                                <h4 className={cn("font-bold text-xs truncate group-hover:text-blue-500 transition-colors", getTextColor())}>{supplier.name}</h4>
                                                <span className="text-[9px] px-1 rounded border opacity-70 uppercase">{supplier.category}</span>
                                            </div>
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <User size={10} className="opacity-50" />
                                                <span className={cn("text-[10px] truncate", getSecondaryTextColor())}>{supplier.contactPerson}</span>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 shrink-0">
                                            <button 
                                                onClick={(e) => handleWhatsApp(e, supplier)}
                                                className={cn(
                                                    "p-2 rounded-lg transition-colors border shadow-sm",
                                                    theme === 'light' 
                                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' 
                                                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                                )}
                                                title="WhatsApp Rate Request"
                                            >
                                                <MessageCircle size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </Card>
            <Modal isOpen={!!selectedVendor} onClose={() => setSelectedVendor(null)} title="Vendor Insights">
                {selectedVendor && vendorStats && (
                    <div className="space-y-6">
                        <div className={cn("p-4 rounded-xl flex items-start gap-4 border", theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/10')}>
                            <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0", theme === 'light' ? 'bg-white shadow text-purple-600' : 'bg-white/10 text-white')}>
                                {selectedVendor.name.charAt(0)}
                            </div>
                            <div className="flex-1">
                                <h3 className={cn("text-xl font-bold font-serif", getTextColor())}>{selectedVendor.name}</h3>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm opacity-70">
                                    <span className="flex items-center gap-1"><User size={12}/> {selectedVendor.contactPerson}</span>
                                    <span className="flex items-center gap-1"><Phone size={12}/> {selectedVendor.phone}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                             <Button variant="secondary" onClick={() => setSelectedVendor(null)}>Close</Button>
                             <Button onClick={(e) => handleWhatsApp(e, selectedVendor!)} className="bg-emerald-600 hover:bg-emerald-700 text-white border-none">
                                 <MessageCircle size={16} /> WhatsApp Request
                             </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
};

export const LeadDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { leads, allLeads, updateLead, updateLeadStatus, deleteLead, getLeadInteractions, getLeadReminders, addInteraction, addReminder, suppliers } = useLeads();
  const { theme, getTextColor, getSecondaryTextColor, getInputClass } = useTheme();

  const [interactionText, setInteractionText] = useState('');
  const [interactionType, setInteractionType] = useState<InteractionType>('Note');
  const [isReminderModalOpen, setReminderModalOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // Gatekeeper States
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<LeadStatus | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const lead = leads.find(l => l.id === id);
  const [formData, setFormData] = useState<Lead | undefined>(lead);

  useEffect(() => {
    if (lead) setFormData(lead);
  }, [lead]);

  if (!lead || !formData) return <div className={cn("p-8 text-center opacity-50 font-mono", getTextColor())}>Lead not found</div>;

  const interactions = getLeadInteractions(lead.id);
  const reminders = getLeadReminders(lead.id);

  const handleStepClick = (status: LeadStatus, stepName: string, isRevert: boolean) => {
      if (isRevert) {
          const clickedIndex = WORKFLOW_ORDER.indexOf(status);
          const previousStatus = clickedIndex > 0 ? WORKFLOW_ORDER[clickedIndex - 1] : 'New';
          if (lead.status === previousStatus) return; 
          const logMessage = `System: Status reverted to ${previousStatus} (undid ${stepName}).`;
          updateLeadStatus(lead.id, previousStatus, logMessage);
      } else {
          if (lead.status === status) return;

          // --- Gatekeeper Check for Workflow ---
          if (status === 'Proposal Sent') {
              if (!lead.vendors || lead.vendors.length === 0) {
                  setPendingStatus(status);
                  setIsVendorModalOpen(true);
                  return; // HALT
              }
          }

          let logMessage = `System: Status moved to ${status} via Workflow.`;
          
          // Removed manual auto-reminder creation here.
          // The Context will trigger the SmartNudge.
          
          if (status === 'Proposal Sent') {
              setToastMessage("✅ Quote Shared. Status Updated!");
              setShowToast(true);
              setTimeout(() => setShowToast(false), 4000);
          } else if (status === 'Won') {
              triggerConfetti();
          }
          updateLeadStatus(lead.id, status, logMessage);
      }
  };

  const handleVendorSave = (leadId: string, vendors: VendorDetail[]) => {
      // 1. Update vendors & commercials
      const totalCost = vendors.reduce((acc, v) => acc + (v.cost || 0), 0);
      const totalPrice = vendors.reduce((acc, v) => acc + (v.price || 0), 0);
      
      const newCommercials = {
          sellingPrice: totalPrice,
          netCost: totalCost,
          vendorId: vendors[0].id,
          taxAmount: 0 
      };

      const updatedLead = { ...formData!, vendors, commercials: newCommercials };
      setFormData(updatedLead); // Update local state
      updateLead(leadId, { vendors, commercials: newCommercials }); // Update context
      
      // 2. Resume Status Change
      if (pendingStatus) {
          updateLeadStatus(leadId, pendingStatus);
          
          if (pendingStatus === 'Proposal Sent') {
              setToastMessage("✅ Proposal Prepared & Status Updated!");
              setShowToast(true);
              setTimeout(() => setShowToast(false), 4000);
          }
      } else {
          setToastMessage("Commercials saved successfully.");
          setShowToast(true);
          setTimeout(() => setShowToast(false), 3000);
      }

      setPendingStatus(null);
  };

  const handleLogInteraction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!interactionText.trim()) return;
    const newInteraction: Interaction = {
      id: generateId(),
      leadId: lead.id,
      type: interactionType,
      content: interactionText,
      timestamp: new Date().toISOString(),
      sentiment: 'Neutral'
    };
    addInteraction(newInteraction);
    setInteractionText('');
  };

  const handleAddReminder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newReminder: Reminder = {
      id: generateId(),
      leadId: lead.id,
      task: fd.get('task') as string,
      dueDate: fd.get('dueDate') as string,
      isCompleted: false
    };
    addReminder(newReminder);
    setReminderModalOpen(false);
  };

  const handleSaveProfile = () => {
      if (!formData) return;
      updateLead(lead.id, formData);
      setIsEditing(false);
  };

  const handleDeleteLead = () => {
      if (window.confirm("Are you sure? This cannot be undone.")) {
          deleteLead(lead.id);
          navigate('/leads');
      }
  };

  const handleCopyBrief = async () => {
      const brief = generateVendorBrief(lead);
      try {
          await navigator.clipboard.writeText(brief);
          setToastMessage('Vendor Brief copied!');
          setShowToast(true);
          setTimeout(() => setShowToast(false), 3000);
      } catch (err) {
          console.error("Failed to copy brief", err);
      }
  };

  const editInputClass = cn(
      "bg-transparent border-b border-gray-500/30 focus:border-slate-900 outline-none w-full transition-colors pb-1 text-sm font-medium", 
      getTextColor()
  );

  return (
    <div className="animate-in fade-in slide-in-from-right-8 duration-500 max-w-7xl mx-auto relative pb-20">
      
      {showToast && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 md:top-6 md:right-6 md:translate-x-0 md:left-auto z-50 animate-in slide-in-from-top-2 fade-in duration-300 w-full max-w-sm px-4">
              <div className={cn(
                  "flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md",
                  theme === 'light' ? 'bg-white/90 border-green-100 text-green-700' : 'bg-slate-800/90 border-green-500/30 text-green-400'
              )}>
                  <CheckCircle2 size={18} className="shrink-0" />
                  <span className="font-medium text-sm">{toastMessage}</span>
              </div>
          </div>
      )}

      {/* --- Gatekeeper Modal --- */}
      <VendorManagementModal 
          isOpen={isVendorModalOpen}
          onClose={() => setIsVendorModalOpen(false)}
          leadId={lead.id}
          onSave={handleVendorSave}
      />

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start gap-6 mb-8">
          <div>
              <div className="flex items-center gap-3 mb-2">
                  <Button variant="ghost" onClick={() => navigate('/leads')} className="p-0 h-auto hover:bg-transparent opacity-50 hover:opacity-100">
                      <ArrowLeft size={20} />
                  </Button>
                  <h1 className={cn("text-xl md:text-3xl font-bold font-serif tracking-tight", getTextColor())}>{lead.name}</h1>
                  <span className={cn(
                      "text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded border",
                      lead.temperature === 'Hot' ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                  )}>
                      {lead.temperature}
                  </span>
              </div>
              
              <div className={cn("flex flex-wrap items-center gap-4 text-sm opacity-80", getSecondaryTextColor())}>
                  <div className="flex items-center gap-1.5">
                      <MapPin size={16} className="text-blue-500" />
                      <span className="font-medium">{lead.tripDetails.destination}</span>
                  </div>
                  <div className="h-4 w-px bg-current opacity-20"></div>
                  <div className="flex items-center gap-1.5">
                      <Calendar size={16} className="text-purple-500" />
                      <span className="font-mono">{formatDate(lead.tripDetails.startDate)}</span>
                  </div>
                  <div className="h-4 w-px bg-current opacity-20"></div>
                  <div className="flex items-center gap-1.5">
                      <DollarSign size={16} className="text-emerald-500" />
                      <span className="font-mono font-bold tracking-tight">{formatCurrency(lead.tripDetails.budget)}</span>
                  </div>
                  <div className="h-4 w-px bg-current opacity-20"></div>
                  <div className="flex items-center gap-1.5">
                      <Users size={16} className="text-amber-500" />
                      <span>{lead.tripDetails.paxConfig.adults}A {lead.tripDetails.paxConfig.children > 0 && `${lead.tripDetails.paxConfig.children}C`}</span>
                  </div>
              </div>
          </div>

          <div className="flex flex-wrap gap-2 w-full lg:w-auto justify-start lg:justify-end">
              <Button variant="secondary" onClick={() => setIsEditing(!isEditing)}>
                  {isEditing ? <X size={16} /> : <Pencil size={16} />} 
                  {isEditing ? 'Cancel Edit' : 'Edit Lead'}
              </Button>
              <Button variant="secondary" onClick={handleCopyBrief} className="hidden sm:flex">
                  <ClipboardList size={16} /> Copy Brief
              </Button>
              <Button variant="danger" onClick={handleDeleteLead} className="hidden sm:flex">
                  <Trash2 size={16} />
              </Button>
          </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* LEFT COLUMN (2/3): Workflow, Profile, Commercials */}
          <div className="xl:col-span-2 space-y-8">
              
              {/* Workflow Stepper */}
              <Card>
                  <WorkflowStepper currentStatus={lead.status} onStepClick={handleStepClick} />
              </Card>

              {/* Editable Profile */}
              <Card>
                  <div className="flex items-center gap-2 mb-6 border-b border-gray-500/10 pb-4">
                      <div className={cn("p-2 rounded-lg", theme === 'light' ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-white')}>
                          <User size={20} />
                      </div>
                      <h3 className={cn("text-lg font-bold font-serif", getTextColor())}>Trip Profile</h3>
                      {isEditing && (
                          <Button size="sm" onClick={handleSaveProfile} className="ml-auto bg-green-600 hover:bg-green-700 text-white border-none">
                              <Save size={16} /> Save Changes
                          </Button>
                      )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                      {/* Contact */}
                      <div className="space-y-4">
                          <h4 className={cn("text-xs font-bold uppercase tracking-wider opacity-50", getTextColor())}>Contact Info</h4>
                          <div className="space-y-3">
                              <div>
                                  <label className="text-[10px] opacity-50 block mb-1">Phone</label>
                                  {isEditing ? (
                                      <input 
                                          value={formData.contact.phone} 
                                          onChange={e => setFormData({...formData, contact: {...formData.contact, phone: e.target.value}})}
                                          className={editInputClass}
                                      />
                                  ) : (
                                      <div className="flex items-center justify-between">
                                          <span className="font-mono text-sm">{lead.contact.phone}</span>
                                          <div className="flex gap-2">
                                              <DialButton phoneNumber={lead.contact.phone} className="w-8 h-8" />
                                              <a href={`https://wa.me/${lead.contact.phone.replace(/[^0-9]/g, '')}`} target="_blank" className={cn("w-8 h-8 flex items-center justify-center rounded-full bg-green-50 text-green-600 hover:bg-green-100 transition-colors")}>
                                                  <MessageCircle size={14} />
                                              </a>
                                          </div>
                                      </div>
                                  )}
                              </div>
                              <div>
                                  <label className="text-[10px] opacity-50 block mb-1">Email</label>
                                  {isEditing ? (
                                      <input 
                                          value={formData.contact.email} 
                                          onChange={e => setFormData({...formData, contact: {...formData.contact, email: e.target.value}})}
                                          className={editInputClass}
                                      />
                                  ) : (
                                      <span className="text-sm">{lead.contact.email || '-'}</span>
                                  )}
                              </div>
                          </div>
                      </div>

                      {/* Key Details */}
                      <div className="space-y-4">
                          <h4 className={cn("text-xs font-bold uppercase tracking-wider opacity-50", getTextColor())}>Trip Basics</h4>
                          <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="text-[10px] opacity-50 block mb-1">Destination</label>
                                      {isEditing ? (
                                          <input 
                                              value={formData.tripDetails.destination} 
                                              onChange={e => setFormData({...formData, tripDetails: {...formData.tripDetails, destination: e.target.value}})}
                                              className={editInputClass}
                                          />
                                      ) : (
                                          <span className="text-sm font-medium">{lead.tripDetails.destination}</span>
                                      )}
                                  </div>
                                  <div>
                                      <label className="text-[10px] opacity-50 block mb-1">Start Date</label>
                                      {isEditing ? (
                                          <input 
                                              type="date"
                                              value={formData.tripDetails.startDate} 
                                              onChange={e => setFormData({...formData, tripDetails: {...formData.tripDetails, startDate: e.target.value}})}
                                              className={editInputClass}
                                          />
                                      ) : (
                                          <span className="text-sm font-mono">{formatDate(lead.tripDetails.startDate)}</span>
                                      )}
                                  </div>
                              </div>
                              <div>
                                  <label className="text-[10px] opacity-50 block mb-1">Budget</label>
                                  {isEditing ? (
                                      <input 
                                          type="number"
                                          value={formData.tripDetails.budget} 
                                          onChange={e => setFormData({...formData, tripDetails: {...formData.tripDetails, budget: Number(e.target.value)}})}
                                          className={editInputClass}
                                      />
                                  ) : (
                                      <span className="text-sm font-mono font-bold text-emerald-600">{formatCurrency(lead.tripDetails.budget)}</span>
                                  )}
                              </div>
                          </div>
                      </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-gray-500/10">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-2">
                              <PaxSelector 
                                  value={formData.tripDetails.paxConfig} 
                                  onChange={(p) => setFormData({...formData, tripDetails: {...formData.tripDetails, paxConfig: p}})}
                                  readOnly={!isEditing}
                              />
                          </div>
                          <div className="space-y-2">
                              <TravelPreferences 
                                  value={formData.preferences} 
                                  onChange={(p) => setFormData({...formData, preferences: p})}
                                  readOnly={!isEditing}
                              />
                          </div>
                      </div>
                  </div>
              </Card>

              {/* Commercials Section (Modified to open Vendor Modal) */}
              <CommercialsView 
                  lead={lead} 
                  commercials={formData.commercials || { sellingPrice: 0, netCost: 0, vendorId: '' }} 
                  onEdit={() => setIsVendorModalOpen(true)}
              />
          </div>

          {/* RIGHT COLUMN (1/3): Timeline & Tasks */}
          <div className="space-y-6">
              
              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-3">
                  <Button className="w-full justify-center" onClick={() => setReminderModalOpen(true)}>
                      <Clock size={16} /> Set Reminder
                  </Button>
                  <Button variant="secondary" className="w-full justify-center" onClick={() => {
                      const subject = `Trip Proposal: ${lead.tripDetails.destination}`;
                      const body = `Hi ${lead.name},\n\nPlease find the attached proposal...`;
                      window.open(`mailto:${lead.contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
                  }}>
                      <Mail size={16} /> Email
                  </Button>
              </div>

              {/* Suggested Suppliers Widget */}
              <SuggestedSuppliers lead={lead} allLeads={allLeads} suppliers={suppliers} />

              {/* Tasks List */}
              <Card noPadding className="max-h-[300px] flex flex-col">
                  <div className="p-4 border-b border-gray-500/10 flex justify-between items-center bg-gray-50/50">
                      <span className={cn("text-xs font-bold uppercase tracking-wider opacity-60 text-slate-900")}>Pending Tasks</span>
                      <span className="text-xs bg-slate-200 px-2 py-0.5 rounded-full font-bold text-slate-600">{reminders.filter(r => !r.isCompleted).length}</span>
                  </div>
                  <div className="overflow-y-auto p-2 space-y-1">
                      {reminders.filter(r => !r.isCompleted).length === 0 && (
                          <div className="p-4 text-center opacity-40 text-xs italic">No pending tasks. Good job!</div>
                      )}
                      {reminders.filter(r => !r.isCompleted).map(r => (
                          <div key={r.id} className={cn("p-3 rounded-lg border flex gap-3 group transition-colors", theme === 'light' ? 'bg-white border-slate-100 hover:border-slate-300' : 'bg-white/5 border-white/10')}>
                              <div className="mt-0.5">
                                  <Clock size={14} className="text-orange-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                  <p className={cn("text-sm font-medium leading-tight", getTextColor())}>{r.task}</p>
                                  <p className="text-[10px] opacity-50 mt-1 font-mono">{formatDate(r.dueDate)}</p>
                              </div>
                          </div>
                      ))}
                  </div>
              </Card>

              {/* Timeline Feed */}
              <div className="space-y-4">
                  <div className={cn("flex items-center gap-2 opacity-50 px-1", getTextColor())}>
                      <History size={14} />
                      <span className="text-xs font-bold uppercase tracking-wider">Interaction History</span>
                  </div>

                  {/* Add Note Input */}
                  <Card noPadding className="p-3">
                      <form onSubmit={handleLogInteraction} className="relative">
                          <input 
                              placeholder="Log a call, note, or update..." 
                              className={cn("w-full bg-transparent text-sm outline-none pr-10", getInputClass(), "border-none shadow-none focus:ring-0")}
                              value={interactionText}
                              onChange={(e) => setInteractionText(e.target.value)}
                          />
                          <button 
                              type="submit" 
                              disabled={!interactionText.trim()}
                              className="absolute right-0 top-1/2 -translate-y-1/2 p-1.5 text-blue-500 hover:bg-blue-50 rounded-full disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                          >
                              <Send size={14} />
                          </button>
                      </form>
                  </Card>

                  {/* Timeline Items */}
                  <div className="space-y-4 pl-4 border-l-2 border-gray-200/50 ml-2 relative">
                      {interactions.map((interaction) => (
                          <div key={interaction.id} className="relative group">
                              <div className={cn(
                                  "absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm transition-colors",
                                  interaction.type === 'StatusChange' ? 'bg-purple-400' : 
                                  interaction.type === 'Call' ? 'bg-blue-400' : 'bg-gray-400'
                              )} />
                              
                              <div className={cn("p-3 rounded-xl border transition-all hover:shadow-sm", theme === 'light' ? 'bg-white border-slate-100' : 'bg-white/5 border-white/10')}>
                                  <div className="flex justify-between items-start mb-1">
                                      <span className={cn("text-[10px] font-bold uppercase tracking-wider opacity-60", getTextColor())}>
                                          {interaction.type}
                                      </span>
                                      <span className="text-[10px] font-mono opacity-40">
                                          {formatDate(interaction.timestamp)}
                                      </span>
                                  </div>
                                  <p className={cn("text-sm", getTextColor())}>{interaction.content}</p>
                              </div>
                          </div>
                      ))}
                      {interactions.length === 0 && (
                          <p className="text-xs opacity-40 italic pl-2">No history yet.</p>
                      )}
                  </div>
              </div>

          </div>
      </div>

      {/* Reminder Modal */}
      <Modal isOpen={isReminderModalOpen} onClose={() => setReminderModalOpen(false)} title="Set Follow-up">
          <form onSubmit={handleAddReminder} className="space-y-4">
              <div className="space-y-1.5">
                  <label className={cn("text-xs font-bold uppercase tracking-wider opacity-60", getTextColor())}>Task</label>
                  <input name="task" required placeholder="e.g. Call to discuss budget" className={cn("w-full p-3 rounded-lg border outline-none", getInputClass())} autoFocus />
              </div>
              <div className="space-y-1.5">
                  <label className={cn("text-xs font-bold uppercase tracking-wider opacity-60", getTextColor())}>Due Date</label>
                  <input name="dueDate" type="datetime-local" required className={cn("w-full p-3 rounded-lg border outline-none font-mono", getInputClass())} />
              </div>
              <div className="flex justify-end pt-2">
                  <Button type="submit">Save Task</Button>
              </div>
          </form>
      </Modal>

    </div>
  );
};
