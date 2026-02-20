
import React, { useState, useRef } from 'react';
import { useLeads } from '../contexts/LeadContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { ServiceSelector } from './ServiceSelector';
import { PaxSelector } from './PaxSelector';
import { TravelPreferences } from './TravelPreferences';
import { Lead, LeadTemperature, LeadSource, PaxConfig, TravelPreferences as TravelPreferencesType } from '../types';
import { generateId, cn } from '../utils/helpers';
import { UploadCloud, Download, CheckCircle2 } from 'lucide-react';
import Papa from 'papaparse';

export const AddLeadModal = () => {
  const { addLead, addLeads, isAddLeadModalOpen, setAddLeadModalOpen } = useLeads();
  const { theme, getTextColor, getInputClass, getBorderClass, getSecondaryTextColor } = useTheme();
  const { user, users } = useAuth();

  const [newLeadServices, setNewLeadServices] = useState<string[]>([]);
  const [newLeadPax, setNewLeadPax] = useState<PaxConfig>({ adults: 2, children: 0, childAges: [] });
  const [newLeadPrefs, setNewLeadPrefs] = useState<TravelPreferencesType>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showToast, setShowToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // --- CSV Logic ---
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
                  paxConfig: { adults: 2, children: 0, childAges: [] },
                  startDate: findField(row, mappings.startDate) || new Date().toISOString(),
              },
              status: (findField(row, mappings.status) as any) || 'New',
              temperature: 'Hot',
              source: (findField(row, mappings.source) as any) || 'Other',
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
          setAddLeadModalOpen(false);
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
              phone: (formData.get('phone') as string) || '', 
              email: (formData.get('email') as string) || '',
          },
          tripDetails: {
              destination: formData.get('destination') as string,
              budget: Number(formData.get('budget') || 0), 
              paxConfig: newLeadPax,
              startDate: formData.get('startDate') as string,
          },
          preferences: newLeadPrefs,
          status: 'New',
          temperature: formData.get('temperature') as LeadTemperature,
          source: formData.get('source') as LeadSource,
          interestedServices: newLeadServices,
          referenceName: formData.get('reference') as string,
          assignedTo: formData.get('assignedTo') as string,
          tags: [],
          createdAt: new Date().toISOString(),
          lastStatusUpdate: new Date().toISOString(),
          vendors: []
      };
      addLead(newLead);
      
      // Reset form state for next time
      setNewLeadServices([]);
      setNewLeadPax({ adults: 2, children: 0, childAges: [] });
      setNewLeadPrefs({});
      setAddLeadModalOpen(false);
  };

  const inputClasses = cn(
      "w-full rounded-lg px-3 py-2 text-sm md:p-3 md:text-base outline-none transition-all border",
      getInputClass()
  );

  return (
    <>
      {showToast && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 md:top-6 md:right-6 md:translate-x-0 md:left-auto z-[60] animate-in slide-in-from-top-2 fade-in duration-300 w-full max-w-sm px-4">
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

      <Modal isOpen={isAddLeadModalOpen} onClose={() => setAddLeadModalOpen(false)} title="Create New Lead">
        <form onSubmit={handleAddLead} className="space-y-5">
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

            <div className={cn("p-4 rounded-xl border border-dashed space-y-3", getBorderClass(), theme === 'light' ? 'bg-slate-50/50' : 'bg-white/5')}>
                <p className={cn("text-xs font-bold uppercase tracking-wide opacity-50", getTextColor())}>Trip Details</p>
                
                <div className="space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-1">
                            <label className={cn("text-[10px] font-bold uppercase opacity-60", getTextColor())}>Destination</label>
                            <input name="destination" required placeholder="Where to?" className={cn("w-full bg-transparent border-b p-2 outline-none text-base transition-colors", getBorderClass(), "focus:border-slate-900", getTextColor())} />
                         </div>
                         <div className="space-y-1">
                            <label className={cn("text-[10px] font-bold uppercase opacity-60", getTextColor())}>Start Date</label>
                            <input name="startDate" type="date" required className={cn("w-full bg-transparent border-b p-2 outline-none text-base transition-colors", getBorderClass(), "focus:border-slate-900", getTextColor())} />
                         </div>
                     </div>
                     
                     <PaxSelector value={newLeadPax} onChange={setNewLeadPax} />
                     
                     <div className="pt-2">
                        <TravelPreferences value={newLeadPrefs} onChange={setNewLeadPrefs} />
                     </div>

                     <div className="space-y-1">
                        <label className={cn("text-[10px] font-bold uppercase opacity-60", getTextColor())}>Total Budget</label>
                        <input name="budget" type="number" placeholder="Budget (₹) - Optional" className={cn("w-full bg-transparent border-b p-2 outline-none text-lg font-mono transition-colors", getBorderClass(), "focus:border-slate-900", getTextColor())} />
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
                    <label className={cn("text-xs font-bold uppercase tracking-wider opacity-60", getTextColor())}>
                        {user?.role === 'admin' ? 'Assign To' : 'Reference Name'}
                    </label>
                    {user?.role === 'admin' ? (
                        <select name="assignedTo" className={cn(inputClasses, "[&>option]:text-black")}>
                            <option value="Unassigned">Unassigned</option>
                            {users.filter(u => u.role === 'agent').map(u => (
                                <option key={u.id} value={u.name}>{u.name}</option>
                            ))}
                        </select>
                    ) : (
                        <input name="reference" className={inputClasses} placeholder="Optional" />
                    )}
                </div>
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
                        className={cn("text-xs font-medium flex items-center gap-2 cursor-pointer transition-colors px-3 py-2 rounded-lg border border-dashed hover:bg-slate-100", getTextColor(), getBorderClass())}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                    >
                        <UploadCloud size={16} className="text-slate-500" /> 
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
    </>
  );
};
