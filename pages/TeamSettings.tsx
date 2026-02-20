
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { User, Shield, Key, Trash2, Plus, Eye, EyeOff, UserPlus } from 'lucide-react';
import { cn } from '../utils/helpers';
import { User as UserType } from '../types';

export const TeamSettings = () => {
  const { user, users, addUser, removeUser, updateUserPasscode } = useAuth();
  const { theme, getTextColor, getInputClass } = useTheme();

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // State for actions
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  
  // Form States
  const [newName, setNewName] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [editPasscode, setEditPasscode] = useState('');

  // Protect the route logic (Optional strictly here since Layout handles it, but good practice)
  if (user?.role !== 'admin') {
      return <div className="p-8 text-center opacity-50">Access Denied</div>;
  }

  const togglePasswordVisibility = (id: string) => {
      setVisiblePasswords(prev => ({
          ...prev,
          [id]: !prev[id]
      }));
  };

  const handleAddUser = (e: React.FormEvent) => {
      e.preventDefault();
      if (newName && newPasscode) {
          addUser(newName, newPasscode);
          setNewName('');
          setNewPasscode('');
          setIsAddModalOpen(false);
      }
  };

  const openEditModal = (u: UserType) => {
      setSelectedUser(u);
      setEditPasscode(u.passcode);
      setIsEditModalOpen(true);
  };

  const handleUpdatePasscode = (e: React.FormEvent) => {
      e.preventDefault();
      if (selectedUser && editPasscode) {
          updateUserPasscode(selectedUser.id, editPasscode);
          setIsEditModalOpen(false);
          setSelectedUser(null);
      }
  };

  const handleRemoveUser = (id: string) => {
      if (window.confirm('Are you sure you want to remove this user? They will no longer be able to log in.')) {
          removeUser(id);
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className={cn("text-3xl font-bold font-serif", getTextColor())}>Team Management</h1>
                <p className={cn("text-sm opacity-60 mt-1", getTextColor())}>Manage access and permissions for your agency.</p>
            </div>
            <Button onClick={() => setIsAddModalOpen(true)} className="shadow-lg shadow-blue-500/20">
                <Plus size={18} /> Add New Agent
            </Button>
        </div>

        <Card noPadding className="overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
                <table className={cn("w-full text-left", getTextColor())}>
                    <thead>
                        <tr className={cn("text-xs font-bold uppercase tracking-wider opacity-60 border-b", theme === 'light' ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/5')}>
                            <th className="p-5">Name</th>
                            <th className="p-5">Role</th>
                            <th className="p-5">Passcode</th>
                            <th className="p-5 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className={cn("divide-y", theme === 'light' ? 'divide-slate-100' : 'divide-white/5')}>
                        {users.map((u) => (
                            <tr key={u.id} className={cn("group transition-colors", theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-white/5')}>
                                <td className="p-5 font-bold flex items-center gap-3">
                                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs", theme === 'light' ? 'bg-blue-100 text-blue-700' : 'bg-white/10 text-white')}>
                                        {u.name.charAt(0)}
                                    </div>
                                    {u.name}
                                    {u.id === user.id && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 ml-2">You</span>}
                                </td>
                                <td className="p-5">
                                    <span className={cn(
                                        "px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border flex w-fit items-center gap-1.5",
                                        u.role === 'admin' 
                                            ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' 
                                            : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                    )}>
                                        {u.role === 'admin' ? <Shield size={12} /> : <User size={12} />}
                                        {u.role}
                                    </span>
                                </td>
                                <td className="p-5 font-mono text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className={visiblePasswords[u.id] ? "" : "blur-sm select-none"}>
                                            {u.passcode}
                                        </span>
                                        <button 
                                            onClick={() => togglePasswordVisibility(u.id)}
                                            className="opacity-30 hover:opacity-100 transition-opacity"
                                        >
                                            {visiblePasswords[u.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                </td>
                                <td className="p-5 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button 
                                            onClick={() => openEditModal(u)}
                                            className={cn("p-2 rounded-lg transition-colors", theme === 'light' ? 'hover:bg-blue-50 text-blue-600' : 'hover:bg-white/10 text-blue-400')}
                                            title="Change Passcode"
                                        >
                                            <Key size={16} />
                                        </button>
                                        {u.role !== 'admin' && (
                                            <button 
                                                onClick={() => handleRemoveUser(u.id)}
                                                className={cn("p-2 rounded-lg transition-colors", theme === 'light' ? 'hover:bg-red-50 text-red-600' : 'hover:bg-white/10 text-red-400')}
                                                title="Remove User"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>

        {/* Add User Modal */}
        <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add New Agent">
            <form onSubmit={handleAddUser} className="space-y-5">
                <div className="flex flex-col items-center justify-center py-4 text-center">
                    <div className={cn("w-16 h-16 rounded-full flex items-center justify-center mb-3", theme === 'light' ? 'bg-blue-50 text-blue-600' : 'bg-white/10 text-white')}>
                        <UserPlus size={32} />
                    </div>
                    <p className={cn("text-sm opacity-60", getTextColor())}>Create a new profile for a team member.</p>
                </div>

                <div className="space-y-1.5">
                    <label className={cn("text-xs font-bold uppercase opacity-60", getTextColor())}>Name</label>
                    <input 
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        required
                        placeholder="e.g. Amit"
                        className={cn("w-full rounded-lg p-3 outline-none border transition-all", getInputClass())}
                    />
                </div>
                
                <div className="space-y-1.5">
                    <label className={cn("text-xs font-bold uppercase opacity-60", getTextColor())}>Access Passcode</label>
                    <input 
                        value={newPasscode}
                        onChange={(e) => setNewPasscode(e.target.value)}
                        required
                        placeholder="e.g. amit2024"
                        className={cn("w-full rounded-lg p-3 outline-none border transition-all", getInputClass())}
                    />
                </div>

                <div className="flex justify-end pt-2">
                    <Button type="submit" className="w-full">Create Account</Button>
                </div>
            </form>
        </Modal>

        {/* Edit Passcode Modal */}
        <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Update Passcode">
            <form onSubmit={handleUpdatePasscode} className="space-y-5">
                <p className={cn("text-sm opacity-70", getTextColor())}>
                    Enter a new passcode for <span className="font-bold">{selectedUser?.name}</span>. They will need this to log in next time.
                </p>

                <div className="space-y-1.5">
                    <label className={cn("text-xs font-bold uppercase opacity-60", getTextColor())}>New Passcode</label>
                    <input 
                        value={editPasscode}
                        onChange={(e) => setEditPasscode(e.target.value)}
                        required
                        className={cn("w-full rounded-lg p-3 outline-none border transition-all font-mono", getInputClass())}
                    />
                </div>

                <div className="flex justify-end pt-2">
                    <Button type="submit" className="w-full">Update Credentials</Button>
                </div>
            </form>
        </Modal>

    </div>
  );
};
