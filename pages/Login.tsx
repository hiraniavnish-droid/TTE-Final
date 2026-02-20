
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Plane, Lock } from 'lucide-react';
import { cn } from '../utils/helpers';

export const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = login(passcode);
    if (success) {
      navigate('/');
    } else {
      setError(true);
      setPasscode('');
      // Reset shake animation class after it plays
      setTimeout(() => setError(false), 500);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 relative overflow-hidden pb-20 md:pb-0">
        {/* Background Elements */}
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative z-10 w-full max-w-sm px-6">
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center p-3 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-xl shadow-blue-500/20 mb-3">
                    <Plane className="text-white w-8 h-8" />
                </div>
                <h1 className="text-2xl font-bold font-serif text-slate-900 tracking-tight leading-tight">The Tourism Experts</h1>
                <p className="text-slate-500 mt-1 text-sm font-medium">Enter your access code to continue</p>
            </div>

            <form onSubmit={handleSubmit} className="relative space-y-4">
                <div className={cn(
                    "relative transition-transform duration-100",
                    error ? "animate-[shake_0.5s_ease-in-out]" : ""
                )}>
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                        <Lock className="w-5 h-5" />
                    </div>
                    <input 
                        type="password" 
                        value={passcode}
                        onChange={(e) => setPasscode(e.target.value)}
                        placeholder="Passcode"
                        className={cn(
                            "w-full bg-white border text-slate-900 text-lg font-bold placeholder:font-normal placeholder:text-slate-400 rounded-xl py-4 pl-12 pr-4 outline-none transition-all shadow-sm",
                            error 
                                ? "border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10" 
                                : "border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10"
                        )}
                        autoFocus
                    />
                </div>
                
                {error && (
                    <p className="text-center text-xs font-bold text-red-500 animate-in fade-in slide-in-from-top-1">
                        Invalid Passcode. Please try again.
                    </p>
                )}

                <button 
                    type="submit" 
                    className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 active:scale-95 transition-all duration-200"
                >
                    Unlock Access
                </button>
            </form>
            
            <div className="mt-8 text-center">
               <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold opacity-80">Authorized Personnel Only</p>
            </div>
        </div>

        <style>{`
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
                20%, 40%, 60%, 80% { transform: translateX(4px); }
            }
        `}</style>
    </div>
  );
};
