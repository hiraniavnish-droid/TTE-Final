
import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useLeads } from '../contexts/LeadContext';
import { VendorDetail, Lead } from '../types';
import { cn, formatCurrency, generateId } from '../utils/helpers';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Trash2, Plus, AlertCircle } from 'lucide-react';

interface VendorManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string | null;
  onSave: (leadId: string, vendors: VendorDetail[]) => void;
}

export const VendorManagementModal: React.FC<VendorManagementModalProps> = ({ 
  isOpen, 
  onClose, 
  leadId, 
  onSave 
}) => {
  const { leads, suppliers } = useLeads();
  const { theme, getTextColor, getInputClass } = useTheme();
  
  const [vendors, setVendors] = useState<VendorDetail[]>([]);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen && leadId) {
      const lead = leads.find(l => l.id === leadId);
      if (lead) {
        // Initialize with existing vendors or a blank row if empty
        if (lead.vendors && lead.vendors.length > 0) {
            setVendors(lead.vendors);
        } else {
            setVendors([{ id: generateId(), name: '', cost: 0, price: 0 }]);
        }
      }
    }
    setErrors({});
  }, [isOpen, leadId, leads]);

  const handleUpdate = (id: string, field: keyof VendorDetail, value: string | number) => {
    setVendors(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));
    if (field === 'name' && value) {
        setErrors(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleAddRow = () => {
    setVendors(prev => [...prev, { id: generateId(), name: '', cost: 0, price: 0 }]);
  };

  const handleRemoveRow = (id: string) => {
    setVendors(prev => prev.filter(v => v.id !== id));
  };

  const handleSubmit = () => {
    // Validation
    const newErrors: Record<string, boolean> = {};
    let hasError = false;

    if (vendors.length === 0) {
        alert("Please add at least one vendor.");
        return;
    }

    vendors.forEach(v => {
        if (!v.name.trim()) {
            newErrors[v.id] = true;
            hasError = true;
        }
    });

    if (hasError) {
        setErrors(newErrors);
        return;
    }

    if (leadId) {
        onSave(leadId, vendors);
        onClose();
    }
  };

  const totalCost = vendors.reduce((acc, v) => acc + (Number(v.cost) || 0), 0);
  const totalPrice = vendors.reduce((acc, v) => acc + (Number(v.price) || 0), 0);

  // Suggestions for autocomplete
  const supplierNames = suppliers.map(s => s.name);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enter Vendor & Pricing Details">
      <div className="space-y-6">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-amber-800 text-xs">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>You must add at least one vendor and quote details before moving this lead to <strong>Proposal Sent</strong>.</p>
        </div>

        <div className="space-y-3">
            {/* Headers */}
            <div className="grid grid-cols-12 gap-2 text-[10px] uppercase font-bold tracking-wider opacity-60 px-1">
                <div className="col-span-5">Vendor Name <span className="text-red-500">*</span></div>
                <div className="col-span-3 text-right">Buying (Net)</div>
                <div className="col-span-3 text-right">Selling (Quote)</div>
                <div className="col-span-1"></div>
            </div>

            {/* Rows */}
            {vendors.map((vendor) => (
                <div key={vendor.id} className="grid grid-cols-12 gap-2 items-center animate-in fade-in slide-in-from-left-2 duration-300">
                    <div className="col-span-5 relative group">
                        <input 
                            list={`suppliers-${vendor.id}`}
                            value={vendor.name}
                            onChange={(e) => handleUpdate(vendor.id, 'name', e.target.value)}
                            placeholder="e.g. Falcon DMC"
                            className={cn(
                                "w-full p-2 rounded-lg border outline-none text-sm transition-all",
                                getInputClass(),
                                errors[vendor.id] ? "border-red-500 bg-red-50 focus:border-red-500" : ""
                            )}
                            autoFocus={!vendor.name}
                        />
                        <datalist id={`suppliers-${vendor.id}`}>
                            {supplierNames.map(name => <option key={name} value={name} />)}
                        </datalist>
                    </div>
                    <div className="col-span-3">
                        <input 
                            type="number"
                            value={vendor.cost || ''}
                            onChange={(e) => handleUpdate(vendor.id, 'cost', parseFloat(e.target.value))}
                            placeholder="0"
                            className={cn(
                                "w-full p-2 rounded-lg border outline-none text-sm font-mono text-right",
                                getInputClass()
                            )}
                        />
                    </div>
                    <div className="col-span-3">
                        <input 
                            type="number"
                            value={vendor.price || ''}
                            onChange={(e) => handleUpdate(vendor.id, 'price', parseFloat(e.target.value))}
                            placeholder="0"
                            className={cn(
                                "w-full p-2 rounded-lg border outline-none text-sm font-mono text-right font-bold",
                                getInputClass()
                            )}
                        />
                    </div>
                    <div className="col-span-1 flex justify-center">
                        <button 
                            onClick={() => handleRemoveRow(vendor.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            ))}
        </div>

        <Button variant="secondary" onClick={handleAddRow} className="w-full border-dashed border-2">
            <Plus size={16} /> Add Another Vendor
        </Button>

        <div className={cn("pt-4 mt-4 border-t border-dashed", theme === 'light' ? 'border-slate-200' : 'border-white/10')}>
            <div className="flex justify-between items-center text-sm mb-1">
                <span className="opacity-60 font-medium">Total Purchase Cost:</span>
                <span className="font-mono">{formatCurrency(totalCost)}</span>
            </div>
            <div className="flex justify-between items-center text-lg font-bold">
                <span className={getTextColor()}>Total Quoted Price:</span>
                <span className="font-mono text-emerald-600">{formatCurrency(totalPrice)}</span>
            </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit} className="shadow-lg shadow-blue-500/20">Save & Continue</Button>
        </div>
      </div>
    </Modal>
  );
};
