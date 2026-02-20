
import React, { useState, useMemo } from 'react';
import { useLeads } from '../contexts/LeadContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DialButton } from '../components/ui/DialButton';
import { Lead, LeadStatus } from '../types';
import { cn, formatCurrency, formatDate } from '../utils/helpers';
import { getAgentColor } from './Leads'; // Import helper
import { 
  Search, 
  User, 
  Phone, 
  Mail, 
  ArrowRight, 
  X,
  Briefcase,
  Calendar,
  MapPin,
  TrendingUp,
  History,
  Globe,
  UserCheck
} from 'lucide-react';
import { Link } from 'react-router-dom';

// --- Types for Derived Customer ---
interface Customer {
  id: string; // Unique (phone or email)
  name: string;
  contact: { phone: string; email: string };
  totalTrips: number;
  totalValue: number;
  lastInteraction: string;
  leads: Lead[];
  destinations: string[]; // Aggregated unique destinations
  assignedTo?: string; // Latest Agent
}

export const Customers = () => {
  const { leads } = useLeads();
  const { theme, getTextColor, getSecondaryTextColor, getInputClass, getGlassClass } = useTheme();
  const { user } = useAuth(); // Access User Context
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // --- 1. Data Aggregation Logic ---
  const customers = useMemo(() => {
    const customerMap = new Map<string, Omit<Customer, 'destinations'> & { destinations: Set<string> }>();

    leads.forEach(lead => {
      // Use Phone as primary key, fallback to email, or use ID if both missing (unlikely)
      const key = lead.contact.phone || lead.contact.email || lead.id;

      if (!customerMap.has(key)) {
        customerMap.set(key, {
          id: key,
          name: lead.name,
          contact: lead.contact,
          totalTrips: 0,
          totalValue: 0,
          lastInteraction: lead.createdAt, // Default to created
          leads: [],
          destinations: new Set(),
          assignedTo: lead.assignedTo // Initialize with first lead's agent
        });
      }

      const customer = customerMap.get(key)!;
      
      customer.leads.push(lead);
      customer.totalTrips += 1;
      customer.totalValue += lead.tripDetails.budget;
      
      // Aggregate Destinations
      if (lead.tripDetails.destination) {
          customer.destinations.add(lead.tripDetails.destination);
      }

      // Update last interaction if this lead has a more recent update
      const leadTime = lead.lastStatusUpdate || lead.createdAt;
      const currentLast = customer.lastInteraction || '';
      
      if (new Date(leadTime) > new Date(currentLast)) {
          customer.lastInteraction = leadTime;
          // Update assigned agent to the most recent interaction's owner
          if (lead.assignedTo) {
              customer.assignedTo = lead.assignedTo;
          }
      }
    });

    // Convert Set to Array and Sort
    return Array.from(customerMap.values()).map(c => ({
        ...c,
        destinations: Array.from(c.destinations)
    })).sort((a, b) => 
        new Date(b.lastInteraction).getTime() - new Date(a.lastInteraction).getTime()
    );
  }, [leads]);

  // --- 2. Filter Logic ---
  const filteredCustomers = useMemo(() => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return customers;

      return customers.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.contact.phone.includes(q) || 
        (c.contact.email && c.contact.email.toLowerCase().includes(q)) ||
        c.destinations.some(d => d.toLowerCase().includes(q)) // Destination Search
      );
  }, [customers, searchQuery]);

  const getInitials = (name: string) => {
      return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  // Helper to check if a specific destination tag matches current search
  const isDestMatch = (dest: string) => {
      if (!searchQuery) return false;
      return dest.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const statusColors: Record<string, string> = {
      'New': 'bg-blue-500',
      'Contacted': 'bg-amber-500',
      'Proposal Sent': 'bg-purple-500',
      'Discussion': 'bg-indigo-500',
      'Won': 'bg-emerald-500',
      'Lost': 'bg-rose-500'
  };

  return (
    <div className="relative min-h-[calc(100vh-100px)]">
      
      {/* --- Header & Search --- */}
      <div className="flex flex-col items-center justify-center py-8 space-y-6">
          <h1 className={cn("text-4xl font-bold font-serif text-center", getTextColor())}>Customer Directory</h1>
          
          <div className="relative w-full max-w-xl group">
              <div className={cn(
                  "absolute inset-0 rounded-2xl blur-lg transition-opacity duration-300 opacity-20 group-hover:opacity-30",
                   theme === 'light' ? 'bg-blue-300' : 'bg-blue-500'
              )}></div>
              <div className={cn(
                  "relative flex items-center px-4 rounded-2xl transition-all border",
                  theme === 'light' ? 'bg-white border-slate-200 shadow-xl' : 'bg-white/10 border-white/20 backdrop-blur-xl shadow-2xl'
              )}>
                  <Search size={20} className="opacity-50 shrink-0 mr-3" />
                  <input 
                      type="text" 
                      placeholder="Search by Name, Mobile, or Destination (e.g., Bali)..." 
                      className={cn("w-full py-4 bg-transparent outline-none text-lg", getInputClass(), "border-none focus:ring-0")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                  />
                  {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="p-1 hover:bg-gray-500/10 rounded-full">
                          <X size={16} />
                      </button>
                  )}
              </div>
          </div>
      </div>

      {/* --- Customer List (Table) --- */}
      <Card noPadding className="overflow-hidden shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="overflow-x-auto">
            <table className={cn("w-full text-left border-collapse", getTextColor())}>
                <thead>
                    <tr className={cn(theme === 'light' ? 'bg-slate-50 border-b border-slate-200' : 'bg-white/5 border-b border-white/10')}>
                        <th className="p-5 font-bold font-serif text-sm w-1/3">Customer</th>
                        {/* Admin Only: Agent Column */}
                        {user?.role === 'admin' && <th className="p-5 font-bold font-serif text-sm">Agent</th>}
                        <th className="p-5 font-bold font-serif text-sm hidden md:table-cell">Destinations Visited</th>
                        <th className="p-5 font-bold font-serif text-sm hidden lg:table-cell">Stats</th>
                        <th className="p-5 font-bold font-serif text-sm text-right">Action</th>
                    </tr>
                </thead>
                <tbody className={cn("divide-y", theme === 'light' ? 'divide-slate-100' : 'divide-white/5')}>
                    {filteredCustomers.length === 0 ? (
                        <tr>
                            <td colSpan={user?.role === 'admin' ? 5 : 4} className="p-12 text-center opacity-50">
                                <User size={48} className="mx-auto mb-2 opacity-30" />
                                <p>No customers found matching "{searchQuery}".</p>
                            </td>
                        </tr>
                    ) : filteredCustomers.map((customer) => (
                        <tr 
                            key={customer.id} 
                            onClick={() => setSelectedCustomer(customer)}
                            className={cn(
                                "group relative transition-all duration-500 ease-in-out cursor-pointer",
                                theme === 'light' 
                                    ? "hover:bg-gradient-to-r hover:from-transparent hover:via-slate-50 hover:to-transparent" 
                                    : "hover:bg-gradient-to-r hover:from-transparent hover:via-white/5 hover:to-transparent",
                                "hover:shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] hover:z-10"
                            )}
                        >
                            <td className="p-5 relative">
                                {/* Cinematic Glow Marker */}
                                <div className={cn(
                                    "absolute left-0 top-0 bottom-0 w-[3px] scale-y-0 transition-transform duration-300 origin-center group-hover:scale-y-100",
                                    theme === 'light' ? "bg-slate-900" : "bg-blue-400"
                                )} />

                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0 transition-transform duration-300 group-hover:scale-110", 
                                        theme === 'light' ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md' : 'bg-white/10 border border-white/10 text-white'
                                    )}>
                                        {getInitials(customer.name)}
                                    </div>
                                    <div>
                                        <h3 className={cn(
                                            "font-bold text-base leading-tight transition-colors",
                                            theme === 'light' ? "group-hover:text-blue-600" : "group-hover:text-blue-400"
                                        )}>{customer.name}</h3>
                                        <div className={cn("flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1 text-xs opacity-70 transition-colors group-hover:text-slate-800", getSecondaryTextColor())}>
                                            <div className="flex items-center gap-1">
                                                <Phone size={10} /> {customer.contact.phone}
                                            </div>
                                            {customer.contact.email && (
                                                 <div className="flex items-center gap-1">
                                                    <Mail size={10} /> {customer.contact.email}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            
                            {/* Admin Only: Agent Cell */}
                            {user?.role === 'admin' && (
                                <td className="p-5">
                                    <span className={cn(
                                        "px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1 w-fit opacity-70 group-hover:opacity-100 transition-opacity",
                                        getAgentColor(customer.assignedTo)
                                    )}>
                                        <UserCheck size={10} />
                                        {customer.assignedTo || 'Unassigned'}
                                    </span>
                                </td>
                            )}

                            {/* Destinations Column */}
                            <td className="p-5 hidden md:table-cell align-middle">
                                <div className="flex flex-wrap gap-1.5 max-w-xs">
                                    {customer.destinations.length > 0 ? (
                                        customer.destinations.slice(0, 3).map(dest => {
                                            const isMatch = isDestMatch(dest);
                                            return (
                                                <span key={dest} className={cn(
                                                    "text-[10px] px-2 py-0.5 rounded-full border transition-all duration-300",
                                                    isMatch 
                                                        ? "bg-yellow-500/20 text-yellow-600 border-yellow-500/50 font-bold scale-105" 
                                                        : (theme === 'light' ? "bg-slate-100 text-slate-500 border-slate-200 group-hover:border-slate-300 group-hover:bg-white" : "bg-white/5 text-slate-400 border-white/10")
                                                )}>
                                                    {dest}
                                                </span>
                                            );
                                        })
                                    ) : (
                                        <span className="text-xs opacity-30 italic">No trips yet</span>
                                    )}
                                    {customer.destinations.length > 3 && (
                                        <span className="text-[10px] px-1.5 py-0.5 opacity-50">
                                            +{customer.destinations.length - 3} more
                                        </span>
                                    )}
                                </div>
                            </td>

                            <td className="p-5 hidden lg:table-cell">
                                <div className="flex items-center gap-6">
                                    <div>
                                        <p className="text-xs opacity-50 uppercase font-bold tracking-wider">Trips</p>
                                        <p className="font-mono font-bold text-lg group-hover:scale-110 transition-transform origin-left">{customer.totalTrips}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs opacity-50 uppercase font-bold tracking-wider">Value</p>
                                        <p className="font-mono font-bold text-lg text-emerald-500">{formatCurrency(customer.totalValue)}</p>
                                    </div>
                                </div>
                            </td>
                            
                            <td className="p-5 text-right">
                                <div className="flex flex-col items-end gap-1">
                                    <Button size="sm" variant="secondary" className="opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                        View History
                                    </Button>
                                    <span className="text-[10px] opacity-40 group-hover:opacity-60 transition-opacity">{formatDate(customer.lastInteraction)}</span>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </Card>

      {/* --- Customer Details Drawer (Slide-Over) --- */}
      {selectedCustomer && (
          <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={() => setSelectedCustomer(null)}
            />
            
            {/* Drawer Panel */}
            <div className={cn(
                "fixed inset-y-0 right-0 z-50 w-full max-w-md shadow-2xl transform transition-transform duration-300 ease-in-out border-l",
                getGlassClass('95'),
                theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'
            )}>
                <div className="flex flex-col h-full">
                    
                    {/* Drawer Header */}
                    <div className="p-6 border-b border-gray-500/10 flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl shadow-lg",
                                theme === 'light' ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white' : 'bg-white/10 text-white border border-white/20'
                            )}>
                                {getInitials(selectedCustomer.name)}
                            </div>
                            <div>
                                <h2 className={cn("text-2xl font-bold font-serif", getTextColor())}>{selectedCustomer.name}</h2>
                                <p className={cn("text-sm opacity-60", getTextColor())}>Customer since {new Date(selectedCustomer.leads[selectedCustomer.leads.length - 1].createdAt).getFullYear()}</p>
                                {/* Admin Only: Drawer Badge */}
                                {user?.role === 'admin' && selectedCustomer.assignedTo && (
                                    <div className={cn("mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 w-fit", getAgentColor(selectedCustomer.assignedTo))}>
                                        <UserCheck size={10} /> RM: {selectedCustomer.assignedTo}
                                    </div>
                                )}
                            </div>
                        </div>
                        <button onClick={() => setSelectedCustomer(null)} className="p-2 hover:bg-gray-500/10 rounded-full transition-colors">
                            <X size={20} className={getTextColor()} />
                        </button>
                    </div>

                    {/* Drawer Body (Scrollable) */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                        
                        {/* Contact Info */}
                        <div className="space-y-4">
                             <h3 className={cn("text-xs font-bold uppercase tracking-wider opacity-50", getTextColor())}>Contact Details</h3>
                             <div className="flex items-center gap-3">
                                 <DialButton phoneNumber={selectedCustomer.contact.phone} className="w-10 h-10" />
                                 <div className={getTextColor()}>
                                     <p className="text-sm font-bold">Mobile</p>
                                     <p className="text-sm opacity-80">{selectedCustomer.contact.phone}</p>
                                 </div>
                             </div>
                             {selectedCustomer.contact.email && (
                                 <div className="flex items-center gap-3">
                                     <a href={`mailto:${selectedCustomer.contact.email}`} className={cn("w-10 h-10 flex items-center justify-center rounded-full border transition-colors", theme === 'light' ? 'border-slate-200 text-slate-500 hover:bg-slate-50' : 'border-white/10 text-white/50 hover:bg-white/10')}>
                                         <Mail size={18} />
                                     </a>
                                     <div className={getTextColor()}>
                                         <p className="text-sm font-bold">Email</p>
                                         <p className="text-sm opacity-80">{selectedCustomer.contact.email}</p>
                                     </div>
                                 </div>
                             )}
                        </div>
                        
                        {/* Visited Destinations Summary */}
                        <div className="space-y-3">
                             <h3 className={cn("text-xs font-bold uppercase tracking-wider opacity-50 flex items-center gap-2", getTextColor())}>
                                 <Globe size={14} /> Places Visited
                             </h3>
                             <div className="flex flex-wrap gap-2">
                                 {selectedCustomer.destinations.map(dest => (
                                     <span key={dest} className={cn(
                                         "px-3 py-1 rounded-lg text-sm font-medium border",
                                         theme === 'light' ? "bg-slate-100 border-slate-200 text-slate-700" : "bg-white/5 border-white/10 text-slate-300"
                                     )}>
                                         {dest}
                                     </span>
                                 ))}
                                 {selectedCustomer.destinations.length === 0 && (
                                     <span className="text-sm opacity-50 italic">No recorded destinations yet.</span>
                                 )}
                             </div>
                        </div>

                        {/* Trip History */}
                        <div className="space-y-4">
                            <h3 className={cn("text-xs font-bold uppercase tracking-wider opacity-50 flex items-center gap-2", getTextColor())}>
                                <Briefcase size={14} /> Trip History ({selectedCustomer.totalTrips})
                            </h3>
                            
                            <div className="space-y-3">
                                {selectedCustomer.leads.map((lead) => (
                                    <Link 
                                        key={lead.id}
                                        to={`/leads/${lead.id}`} 
                                        className={cn(
                                            "block p-4 rounded-xl border transition-all hover:scale-[1.02]",
                                            theme === 'light' ? 'bg-slate-50 border-slate-200 hover:bg-white hover:shadow-md' : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'
                                        )}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className={cn("font-bold text-lg", getTextColor())}>{lead.tripDetails.destination}</h4>
                                            <span className={cn(
                                                "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white",
                                                statusColors[lead.status] || 'bg-gray-500'
                                            )}>
                                                {lead.status}
                                            </span>
                                        </div>
                                        
                                        <div className={cn("flex items-center gap-4 text-xs opacity-70 mb-3", getSecondaryTextColor())}>
                                            <span className="flex items-center gap-1"><Calendar size={12}/> {formatDate(lead.tripDetails.startDate)}</span>
                                            <span className="flex items-center gap-1"><TrendingUp size={12}/> {formatCurrency(lead.tripDetails.budget)}</span>
                                        </div>
                                        
                                        <div className="flex justify-end">
                                            <span className="text-xs text-blue-500 font-medium flex items-center gap-1">
                                                View Trip <ArrowRight size={12} />
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
          </>
      )}
    </div>
  );
};
