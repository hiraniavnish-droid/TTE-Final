
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { User, Shield, Key, Trash2, Plus, Eye, EyeOff, UserPlus, LogOut, UserCog, Check } from 'lucide-react';
import { cn } from '../utils/helpers';
import { User as UserType } from '../types';
import { UserAvatar } from '../components/ui/UserAvatar';

interface AutoAssignSettings {
  auto_assign_enabled: boolean;
  auto_assign_to: string | null;
}

// Auto-assignment for inbound Rann Utsav website/WhatsApp leads (api/leads.ts)
// used to be hardcoded to one agent in code — this reads/writes the same
// single-row `app_settings` table that endpoint now checks on every request,
// so pausing it or handing it to someone else is a Team Settings change, not
// a code change.
const AutoAssignCard: React.FC<{ agents: UserType[] }> = ({ agents }) => {
  const { theme, getTextColor, getInputClass } = useTheme();
  const [settings, setSettings] = useState<AutoAssignSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.from('app_settings').select('auto_assign_enabled, auto_assign_to').eq('id', true).single()
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        setSettings(data as AutoAssignSettings);
      });
    return () => { cancelled = true; };
  }, []);

  const save = (next: AutoAssignSettings) => {
    setSettings(next); // optimistic — matches this page's other mutators (see updateUserPasscode)
    setSaved(false);
    supabase.from('app_settings').update(next).eq('id', true).then(({ error }) => {
      if (error) { console.error('Failed to update auto-assign settings:', error); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  if (!settings) return null;

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-3">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', theme === 'light' ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-white')}>
          <UserCog size={18} strokeWidth={2} />
        </div>
        <div>
          <h2 className={cn('font-bold', getTextColor())}>Lead Auto-Assignment</h2>
          <p className={cn('text-[12px] opacity-60', getTextColor())}>New leads from the Rann Utsav website and WhatsApp bot.</p>
        </div>
        {saved && (
          <span className="ml-auto flex items-center gap-1 text-[11px] font-bold text-emerald-500">
            <Check size={13} strokeWidth={3} /> Saved
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className={cn('flex rounded-lg border overflow-hidden', theme === 'light' ? 'border-slate-200' : 'border-white/10')}>
          <button
            onClick={() => save({ ...settings, auto_assign_enabled: true })}
            className={cn('px-4 py-2 text-[12px] font-bold transition',
              settings.auto_assign_enabled ? 'bg-slate-900 text-white' : (theme === 'light' ? 'bg-white text-slate-500' : 'bg-white/5 text-white/50'))}
          >
            Enabled
          </button>
          <button
            onClick={() => save({ ...settings, auto_assign_enabled: false })}
            className={cn('px-4 py-2 text-[12px] font-bold transition',
              !settings.auto_assign_enabled ? 'bg-slate-900 text-white' : (theme === 'light' ? 'bg-white text-slate-500' : 'bg-white/5 text-white/50'))}
          >
            Paused
          </button>
        </div>

        <select
          disabled={!settings.auto_assign_enabled}
          value={settings.auto_assign_to || ''}
          onChange={e => save({ ...settings, auto_assign_to: e.target.value || null })}
          className={cn('rounded-lg p-2 text-[13px] outline-none border transition-all disabled:opacity-40', getInputClass())}
        >
          <option value="">Nobody selected</option>
          {agents.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
        </select>
      </div>

      <p className={cn('text-[11px] opacity-50', getTextColor())}>
        {settings.auto_assign_enabled
          ? (settings.auto_assign_to ? `Every new lead is assigned to ${settings.auto_assign_to} automatically.` : 'Enabled, but no one is selected yet — new leads will stay unassigned.')
          : 'Paused — new leads come in unassigned until you turn this back on.'}
      </p>
    </Card>
  );
};

export const TeamSettings = () => {
  const { user, users, addUser, removeUser, updateUserPasscode, updateUserPhone, logoutAllDevices } = useAuth();
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
  const [editPhone, setEditPhone] = useState('');

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
      setEditPhone(u.phone || '');
      setIsEditModalOpen(true);
  };

  const handleUpdatePasscode = (e: React.FormEvent) => {
      e.preventDefault();
      if (selectedUser && editPasscode) {
          updateUserPasscode(selectedUser.id, editPasscode);
          if ((selectedUser.phone || '') !== editPhone.trim()) {
              updateUserPhone(selectedUser.id, editPhone.trim());
          }
          setIsEditModalOpen(false);
          setSelectedUser(null);
      }
  };

  const handleRemoveUser = (id: string) => {
      if (window.confirm('Are you sure you want to remove this user? They will no longer be able to log in.')) {
          removeUser(id);
      }
  };

  const handleLogoutEverywhere = (u: UserType) => {
      const msg = u.id === user.id
          ? 'Log yourself out of every browser/device where you\'re currently signed in? This will also log you out here.'
          : `Log ${u.name} out of every browser/device they're currently signed in on?`;
      if (window.confirm(msg)) {
          logoutAllDevices(u.id);
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className={cn("text-2xl font-bold tracking-tight", getTextColor())}>Team Management</h1>
                <p className={cn("text-sm opacity-60 mt-0.5", getTextColor())}>Manage access and permissions for your agency.</p>
            </div>
            <Button onClick={() => setIsAddModalOpen(true)} className="shadow-sm">
                <Plus size={18} strokeWidth={2.5} /> Add New Agent
            </Button>
        </div>

        <AutoAssignCard agents={users.filter(u => u.role === 'agent')} />

        <Card noPadding className="overflow-hidden shadow-[0_8px_30px_-8px_rgba(15,23,42,0.12)]">
            <div className="overflow-x-auto">
                <table className={cn("w-full text-left", getTextColor())}>
                    <thead>
                        <tr className={cn("text-xs font-bold uppercase tracking-wider opacity-60 border-b", theme === 'light' ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/5')}>
                            <th className="p-5">Name</th>
                            <th className="p-5">Role</th>
                            <th className="p-5">Passcode</th>
                            <th className="p-5">WhatsApp Alerts</th>
                            <th className="p-5 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className={cn("divide-y", theme === 'light' ? 'divide-slate-100' : 'divide-white/5')}>
                        {users.map((u) => (
                            <tr key={u.id} className={cn("group transition-colors", theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-white/5')}>
                                <td className="p-5 font-bold flex items-center gap-3">
                                    <UserAvatar name={u.name} size={32} />
                                    {u.name}
                                    {u.id === user.id && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 ml-2">You</span>}
                                </td>
                                <td className="p-5">
                                    <span className={cn(
                                        "px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border flex w-fit items-center gap-1.5",
                                        u.role === 'admin'
                                            ? (theme === 'light' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white/90 text-slate-900 border-white/90')
                                            : (theme === 'light' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-white/5 text-white/60 border-white/10')
                                    )}>
                                        {u.role === 'admin' ? <Shield size={12} strokeWidth={2.5} /> : <User size={12} strokeWidth={2.5} />}
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
                                <td className="p-5 text-sm">
                                    {u.phone
                                        ? <span className="font-mono">{u.phone}</span>
                                        : <span className="opacity-40 italic text-xs">not set — no alerts</span>}
                                </td>
                                <td className="p-5 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => openEditModal(u)}
                                            className={cn("p-2 rounded-lg transition-colors", theme === 'light' ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-white/10 text-white/70')}
                                            title="Change Passcode"
                                        >
                                            <Key size={16} strokeWidth={2.5} />
                                        </button>
                                        <button
                                            onClick={() => handleLogoutEverywhere(u)}
                                            className={cn("p-2 rounded-lg transition-colors", theme === 'light' ? 'hover:bg-amber-50 text-amber-600' : 'hover:bg-amber-500/15 text-amber-400')}
                                            title="Log out of all devices"
                                        >
                                            <LogOut size={16} strokeWidth={2.5} />
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
                    <div className={cn("w-16 h-16 rounded-full flex items-center justify-center mb-3", theme === 'light' ? 'bg-slate-100 text-slate-700 ring-1 ring-slate-200/70' : 'bg-white/10 text-white')}>
                        <UserPlus size={32} strokeWidth={2} />
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

                <div className="space-y-1.5">
                    <label className={cn("text-xs font-bold uppercase opacity-60", getTextColor())}>WhatsApp Number <span className="opacity-50 font-normal normal-case">(for team lead-update alerts — leave blank to opt out)</span></label>
                    <input
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="10-digit mobile number"
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
