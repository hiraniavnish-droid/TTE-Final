import React, { useState } from 'react';
import { Compass, ArrowRight, LockKeyhole } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';

export const Login = () => {
  const { login } = useAuth();
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading || !passcode.trim()) return;
    setLoading(true); setError('');
    if (!await login(passcode)) {
      setLoading(false);
      setError('We couldn’t sign you in. Check your access code and connection, then try again.');
    }
  };
  return <div className="crm-login">
    <section className="crm-login-story" aria-label="The Tourism Experts workspace">
      <div className="flex items-center gap-3"><Compass size={30}/><span className="text-sm font-semibold">The Tourism Experts</span></div>
      <div><p className="text-xs uppercase tracking-widest mb-4">YOUR TEAM. EVERY JOURNEY.</p><h2>Less admin.<br/>More extraordinary trips.</h2><p>Keep enquiries, follow-ups and quotations together, from the first hello to the next booking.</p></div>
      <footer>The Tourism Experts · Team workspace</footer>
    </section>
    <section className="crm-login-form"><div>
      <span className="crm-brand-mark"><Compass size={24}/></span>
      <h1>Welcome back.</h1><p>Sign in to your travel workspace.</p>
      <form onSubmit={submit} aria-busy={loading}>
        <label htmlFor="access-code">Your access code</label>
        <input id="access-code" type="password" autoComplete="current-password" value={passcode} onChange={event => { setPasscode(event.target.value); setError(''); }} required aria-invalid={!!error} aria-describedby={error ? 'login-error' : undefined} placeholder="Enter your access code"/>
        {error && <p id="login-error" role="alert" className="mt-3 text-sm !text-red-600">{error}</p>}
        <Button type="submit" disabled={loading || !passcode.trim()} size="lg">{loading ? 'Signing in…' : 'Sign in'}<ArrowRight size={18}/></Button>
      </form>
      <p className="crm-login-support flex items-start gap-2"><LockKeyhole size={16} className="shrink-0 mt-0.5"/>For your team only. Ask your administrator if you need an access code.</p>
    </div></section>
  </div>;
};
