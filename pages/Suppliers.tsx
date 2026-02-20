
import React, { useState, useMemo, KeyboardEvent } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useLeads } from '../contexts/LeadContext';
import { Supplier, SupplierCategory } from '../types';
import { generateId, cn } from '../utils/helpers';
import { 
  Search, 
  X, 
  User, 
  Phone, 
  Mail, 
  Copy, 
  MapPin, 
  Star,
  CheckCircle2,
  Building2,
  Plane,
  FileText,
  Briefcase,
  Plus,
  Tag,
  Pencil
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';

// --- Sub-Component: Supplier Card ---

interface SupplierCardProps {
  supplier: Supplier;
  onCopy: (text: string, type: string) => void;
  onEdit: (supplier: Supplier) => void;
}

const SupplierCard: React.FC<SupplierCardProps> = ({ supplier, onCopy, onEdit }) => {
  const { theme, getTextColor, getSecondaryTextColor } = useTheme();

  const categoryColors: Record<SupplierCategory, string> = {
    'DMC': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    'Hotelier': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'Transport': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    'Visa': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  };

  const CategoryIcon = {
      'DMC': Briefcase,
      'Hotelier': Building2,
      'Transport': Plane,
      'Visa': FileText
  }[supplier.category] || Briefcase;

  // Defensive coding: Ensure destinations is an array for display
  const displayDestinations = Array.isArray(supplier.destinations) 
    ? supplier.destinations 
    : (typeof supplier.destinations === 'string' ? (supplier.destinations as string).split(',') : []);

  return (
    <Card className="flex flex-col h-full hover:scale-[1.01] transition-transform duration-200" noPadding>
        {/* Header Section */}
        <div className="p-5 border-b border-gray-500/10 relative">
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                    <div className={cn("p-2 rounded-lg", theme === 'light' ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-white')}>
                        <CategoryIcon size={18} />
                    </div>
                    <div>
                        <h3 className={cn("font-bold text-lg leading-tight pr-6", getTextColor())}>{supplier.name}</h3>
                        <div className="flex items-center gap-1 mt-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Star 
                                    key={i} 
                                    size={10} 
                                    className={i < supplier.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300 opacity-30"} 
                                />
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <button 
                        onClick={() => onEdit(supplier)}
                        className={cn("p-1.5 rounded-full transition-colors", theme === 'light' ? "hover:bg-slate-100 text-slate-400" : "hover:bg-white/10 text-white/40")}
                        title="Edit Vendor"
                    >
                        <Pencil size={14} />
                    </button>
                    <span className={cn(
                        "px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                        categoryColors[supplier.category] || 'bg-gray-500/10'
                    )}>
                        {supplier.category}
                    </span>
                </div>
            </div>
            
            <div className="mt-3 flex flex-wrap gap-1.5">
                {displayDestinations.map((dest, i) => (
                    <span key={`${dest}-${i}`} className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1",
                        theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-white/5 border-white/10 text-slate-300'
                    )}>
                        <MapPin size={8} /> {dest.trim()}
                    </span>
                ))}
            </div>
        </div>

        {/* Body Section */}
        <div className="p-5 flex-1 space-y-4">
            <div className="flex items-center gap-3">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", theme === 'light' ? 'bg-slate-100 text-slate-500' : 'bg-white/10 text-white/50')}>
                    <User size={14} />
                </div>
                <div>
                    <p className={cn("text-xs font-bold uppercase opacity-50", getTextColor())}>Contact Person</p>
                    <p className={cn("text-sm font-medium", getTextColor())}>{supplier.contactPerson}</p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", theme === 'light' ? 'bg-slate-100 text-slate-500' : 'bg-white/10 text-white/50')}>
                    <Phone size={14} />
                </div>
                <div className="min-w-0">
                    <p className={cn("text-xs font-bold uppercase opacity-50", getTextColor())}>Phone</p>
                    <p className={cn("text-sm font-medium truncate font-mono", getTextColor())}>{supplier.phone}</p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", theme === 'light' ? 'bg-slate-100 text-slate-500' : 'bg-white/10 text-white/50')}>
                    <Mail size={14} />
                </div>
                <div className="min-w-0">
                    <p className={cn("text-xs font-bold uppercase opacity-50", getTextColor())}>Email</p>
                    <p className={cn("text-sm font-medium truncate", getTextColor())}>{supplier.email}</p>
                </div>
            </div>
        </div>

        {/* Action Footer */}
        <div className={cn("p-3 grid grid-cols-4 gap-2 border-t", theme === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/10')}>
            <a 
                href={`tel:${supplier.phone}`}
                className={cn(
                    "flex flex-col items-center justify-center gap-1 py-2 rounded-lg transition-colors group",
                    theme === 'light' ? 'hover:bg-green-50 text-slate-500 hover:text-green-600' : 'hover:bg-green-500/10 text-slate-400 hover:text-green-400'
                )}
                title="Call"
            >
                <Phone size={18} />
                <span className="text-[9px] font-bold uppercase">Call</span>
            </a>

            <a 
                href={`mailto:${supplier.email}`}
                className={cn(
                    "flex flex-col items-center justify-center gap-1 py-2 rounded-lg transition-colors group",
                    theme === 'light' ? 'hover:bg-blue-50 text-slate-500 hover:text-blue-600' : 'hover:bg-blue-500/10 text-slate-400 hover:text-blue-400'
                )}
                title="Email"
            >
                <Mail size={18} />
                <span className="text-[9px] font-bold uppercase">Mail</span>
            </a>

            <button
                onClick={() => onCopy(supplier.phone, 'Phone')}
                className={cn(
                    "flex flex-col items-center justify-center gap-1 py-2 rounded-lg transition-colors group",
                    theme === 'light' ? 'hover:bg-slate-200 text-slate-500 hover:text-slate-700' : 'hover:bg-white/10 text-slate-400 hover:text-white'
                )}
                title="Copy Phone"
            >
                <Copy size={18} />
                <span className="text-[9px] font-bold uppercase">Copy #</span>
            </button>

            <button
                onClick={() => onCopy(supplier.email, 'Email')}
                className={cn(
                    "flex flex-col items-center justify-center gap-1 py-2 rounded-lg transition-colors group",
                    theme === 'light' ? 'hover:bg-slate-200 text-slate-500 hover:text-slate-700' : 'hover:bg-white/10 text-slate-400 hover:text-white'
                )}
                title="Copy Email"
            >
                <Copy size={18} />
                <span className="text-[9px] font-bold uppercase">Copy @</span>
            </button>
        </div>
    </Card>
  );
};

// --- Main Page ---

export const Suppliers = () => {
    const { theme, getTextColor, getInputClass } = useTheme();
    const { suppliers, addSupplier, updateSupplier } = useLeads();
    const [searchQuery, setSearchQuery] = useState('');
    const [toast, setToast] = useState<{ show: boolean, msg: string } | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

    // Form State
    const [destTagInput, setDestTagInput] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        contactPerson: '',
        phone: '',
        email: '',
        category: 'DMC' as SupplierCategory,
        destinations: [] as string[]
    });

    const filteredSuppliers = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return suppliers;
        return suppliers.filter(s => {
            const dests = Array.isArray(s.destinations) 
                ? s.destinations 
                : (typeof s.destinations === 'string' ? (s.destinations as string).split(',') : []);
                
            return s.name.toLowerCase().includes(q) ||
            dests.some(d => d.toLowerCase().includes(q));
        });
    }, [searchQuery, suppliers]);

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setToast({ show: true, msg: `${label} Copied!` });
        setTimeout(() => setToast(null), 2000);
    };

    const handleAddDestination = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Trigger on Enter OR Comma
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault(); 
            const val = destTagInput.trim();
            if (val) {
                // Support pasting or typing comma-separated strings
                const newTags = val.split(',').map(d => d.trim()).filter(d => d.length > 0);
                
                // Add only unique tags
                const uniqueNewTags = newTags.filter(tag => !formData.destinations.includes(tag));
                
                if (uniqueNewTags.length > 0) {
                    setFormData(prev => ({ 
                        ...prev, 
                        destinations: [...prev.destinations, ...uniqueNewTags] 
                    }));
                }
                setDestTagInput('');
            }
        }
    };

    const removeDestination = (dest: string) => {
        setFormData(prev => ({ ...prev, destinations: prev.destinations.filter(d => d !== dest) }));
    };

    const handleOpenAdd = () => {
        setEditingSupplier(null);
        setFormData({
            name: '',
            contactPerson: '',
            phone: '',
            email: '',
            category: 'DMC',
            destinations: []
        });
        setDestTagInput('');
        setIsModalOpen(true);
    };

    const handleEdit = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        
        // Safety check if supplier.destinations is a string (legacy data)
        let destArray: string[] = [];
        if (Array.isArray(supplier.destinations)) {
            destArray = supplier.destinations;
        } else if (typeof supplier.destinations === 'string') {
            destArray = (supplier.destinations as string).split(',').map(d => d.trim()).filter(Boolean);
        }

        setFormData({
            name: supplier.name,
            contactPerson: supplier.contactPerson,
            phone: supplier.phone,
            email: supplier.email,
            category: supplier.category,
            destinations: destArray
        });
        setDestTagInput('');
        setIsModalOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault(); // 1. Stop Reload
        
        // 2. Validation
        if (!formData.name.trim()) {
            setToast({ show: true, msg: 'Company Name is required' });
            setTimeout(() => setToast(null), 3000);
            return;
        }

        // 3. Robust Array Conversion
        // Check for any pending text in the input that wasn't "entered"
        let finalDestinations = [...formData.destinations];
        if (destTagInput.trim()) {
            const pendingTags = destTagInput.split(',').map(d => d.trim()).filter(d => d.length > 0);
            pendingTags.forEach(tag => {
                if (!finalDestinations.includes(tag)) {
                    finalDestinations.push(tag);
                }
            });
        }

        if (editingSupplier) {
            // Update Existing Logic
            const updatedSupplier: Supplier = {
                ...editingSupplier,
                name: formData.name,
                contactPerson: formData.contactPerson || 'Sales Team',
                phone: formData.phone,
                email: formData.email,
                category: formData.category,
                destinations: finalDestinations, // Ensure array
            };
            
            updateSupplier(updatedSupplier);
            setToast({ show: true, msg: `✅ ${updatedSupplier.name} updated successfully!` });

        } else {
            // Create New Logic
            const newSupplier: Supplier = {
                id: generateId(),
                name: formData.name,
                contactPerson: formData.contactPerson || 'Sales Team',
                phone: formData.phone,
                email: formData.email,
                category: formData.category,
                destinations: finalDestinations, // Ensure array
                rating: 3
            };
            
            addSupplier(newSupplier);
            setToast({ show: true, msg: `✅ ${newSupplier.name} added successfully!` });
        }

        // Common Cleanup
        setTimeout(() => setToast(null), 3000);
        setIsModalOpen(false);
        
        // Reset Form
        setFormData({
            name: '',
            contactPerson: '',
            phone: '',
            email: '',
            category: 'DMC',
            destinations: []
        });
        setDestTagInput('');
        setEditingSupplier(null);
    };

    return (
        <div className="relative min-h-[calc(100vh-100px)]">
             {/* Toast Notification */}
            {toast && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 md:top-6 md:right-6 md:translate-x-0 md:left-auto z-50 animate-in slide-in-from-top-2 fade-in duration-300 w-full max-w-sm px-4">
                    <div className={cn(
                        "flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-md",
                        theme === 'light' ? 'bg-white/90 border-slate-200 text-slate-800' : 'bg-slate-800/90 border-white/10 text-white'
                    )}>
                        <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                        <span className="font-medium text-sm">{toast.msg}</span>
                    </div>
                </div>
            )}

            {/* Header & Search */}
            <div className="flex flex-col items-center justify-center py-8 space-y-6 relative">
                
                {/* Floating Add Button (Desktop: Top Right, Mobile: Bottom Fixed) */}
                <div className="absolute top-4 right-0 hidden md:block">
                     <Button onClick={handleOpenAdd} className="shadow-lg shadow-blue-500/20">
                         <Plus size={18} /> Add New Vendor
                     </Button>
                </div>

                <h1 className={cn("text-4xl font-bold font-serif text-center", getTextColor())}>Suppliers & Partners</h1>
                <p className={cn("opacity-60 max-w-md text-center", getTextColor())}>
                    Connect with your network of DMCs, hoteliers, and service providers.
                </p>
                
                <div className="relative w-full max-w-xl group">
                    <div className={cn(
                        "absolute inset-0 rounded-2xl blur-lg transition-opacity duration-300 opacity-20 group-hover:opacity-30",
                        theme === 'light' ? 'bg-purple-300' : 'bg-purple-500'
                    )}></div>
                    <div className={cn(
                        "relative flex items-center px-4 rounded-2xl transition-all border",
                        theme === 'light' ? 'bg-white border-slate-200 shadow-xl' : 'bg-white/10 border-white/20 backdrop-blur-xl shadow-2xl'
                    )}>
                        <Search size={20} className="opacity-50 shrink-0 mr-3" />
                        <input 
                            type="text" 
                            placeholder="Search by Destination (e.g., Dubai) or Name..." 
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

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {filteredSuppliers.length === 0 ? (
                    <div className="col-span-full py-20 text-center opacity-50">
                        <Briefcase size={48} className="mx-auto mb-4 opacity-50" />
                        <p className="text-lg">No partners found matching "{searchQuery}"</p>
                        <Button variant="secondary" onClick={handleOpenAdd} className="mt-4">
                            Add New Vendor
                        </Button>
                    </div>
                ) : (
                    filteredSuppliers.map(supplier => (
                        <SupplierCard 
                            key={supplier.id} 
                            supplier={supplier} 
                            onCopy={handleCopy} 
                            onEdit={handleEdit}
                        />
                    ))
                )}
            </div>

            {/* Mobile Floating Action Button */}
            <button
                onClick={handleOpenAdd}
                className="md:hidden fixed bottom-24 right-6 h-14 w-14 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center z-50 hover:scale-105 active:scale-95 transition-all"
                aria-label="Add Vendor"
            >
                <Plus size={28} />
            </button>

            {/* Add/Edit Supplier Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingSupplier ? "Edit Supplier" : "Add New Supplier"}>
                <form onSubmit={handleSubmit} className="space-y-5">
                    
                    <div className="space-y-1.5">
                        <label className={cn("text-xs font-bold uppercase tracking-wider opacity-60", getTextColor())}>Company Name <span className="text-red-500">*</span></label>
                        <input 
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            required 
                            className={cn("w-full rounded-lg p-3 outline-none transition-all border", getInputClass())} 
                            placeholder="e.g. Bali Dreams DMC" 
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className={cn("text-xs font-bold uppercase tracking-wider opacity-60", getTextColor())}>Contact Person</label>
                            <input 
                                value={formData.contactPerson}
                                onChange={(e) => setFormData({...formData, contactPerson: e.target.value})}
                                className={cn("w-full rounded-lg p-3 outline-none transition-all border", getInputClass())} 
                                placeholder="e.g. John Doe" 
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className={cn("text-xs font-bold uppercase tracking-wider opacity-60", getTextColor())}>Category</label>
                            <select 
                                value={formData.category}
                                onChange={(e) => setFormData({...formData, category: e.target.value as SupplierCategory})}
                                className={cn("w-full rounded-lg p-3 outline-none transition-all border", getInputClass(), "[&>option]:text-black")}
                            >
                                <option value="DMC">DMC</option>
                                <option value="Wholesaler">Wholesaler</option>
                                <option value="Hotelier">Hotel Chain / Hotelier</option>
                                <option value="Transport">Transporter</option>
                                <option value="Visa">Visa Consultant</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className={cn("text-xs font-bold uppercase tracking-wider opacity-60", getTextColor())}>Phone Number</label>
                            <input 
                                value={formData.phone}
                                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                className={cn("w-full rounded-lg p-3 outline-none transition-all border", getInputClass())} 
                                placeholder="+91..." 
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className={cn("text-xs font-bold uppercase tracking-wider opacity-60", getTextColor())}>Email</label>
                            <input 
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({...formData, email: e.target.value})}
                                className={cn("w-full rounded-lg p-3 outline-none transition-all border", getInputClass())} 
                                placeholder="bookings@..." 
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className={cn("text-xs font-bold uppercase tracking-wider opacity-60", getTextColor())}>Destinations Managed <span className="text-red-500">*</span></label>
                        <div className={cn("w-full rounded-lg p-3 border focus-within:ring-1 focus-within:ring-blue-500 transition-all flex flex-wrap gap-2", getInputClass())}>
                            {formData.destinations.map(dest => (
                                <span key={dest} className={cn(
                                    "text-xs px-2 py-1 rounded-md flex items-center gap-1", 
                                    theme === 'light' ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/30 text-white'
                                )}>
                                    {dest}
                                    <button type="button" onClick={() => removeDestination(dest)} className="hover:bg-black/10 rounded-full p-0.5">
                                        <X size={12} />
                                    </button>
                                </span>
                            ))}
                            <input 
                                value={destTagInput}
                                onChange={(e) => setDestTagInput(e.target.value)}
                                onKeyDown={handleAddDestination}
                                placeholder={formData.destinations.length === 0 ? "Type destination & hit Enter (e.g. Maldives)" : "Add another..."}
                                className="bg-transparent outline-none flex-1 min-w-[120px] text-sm"
                            />
                        </div>
                        <p className={cn("text-[10px] opacity-50", getTextColor())}>Type locations and press Enter or Comma.</p>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit">{editingSupplier ? "Update Vendor" : "Add Vendor"}</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
