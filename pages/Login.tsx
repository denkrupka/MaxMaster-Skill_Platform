
import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, AlertCircle, ExternalLink, ChevronRight } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Button } from '../components/Button';
import { Role, UserStatus } from '../types';

export const LoginPage = () => {
  const { login, state } = useAppContext();
  const navigate = useNavigate();

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state.currentUser) {
      if (state.currentUser.status === UserStatus.INACTIVE) {
        navigate('/terminated');
      } else if (state.currentUser.role === Role.ADMIN) {
        navigate('/admin/users');
      } else if (state.currentUser.role === Role.HR) {
        navigate('/hr/dashboard');
      } else if (state.currentUser.role === Role.CANDIDATE) {
        navigate('/candidate/dashboard');
      } else if (state.currentUser.role === Role.COORDINATOR) {
        navigate('/coordinator/dashboard');
      } else if (state.currentUser.status === UserStatus.TRIAL) {
        navigate('/trial/dashboard');
      } else {
        navigate('/dashboard');
      }
    }
  }, [state.currentUser, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    setError(null);
    try {
      // Sanitization: trim whitespace which is common cause of "Invalid credentials"
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      console.error('Login error:', err);
      // Handle specific Supabase error messages
      if (err.message === 'Invalid login credentials') {
        setError('Błędny adres e-mail lub hasło. Sprawdź czy nie masz spacji na końcu maila.');
      } else if (err.message === 'Email not confirmed') {
        setError('Adres e-mail nie został jeszcze potwierdzony. Sprawdź skrzynkę odbiorczą.');
      } else {
        setError('Wystąpił błąd podczas logowania. Spróbuj ponownie.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl mx-auto mb-4 shadow-lg shadow-blue-600/20">M</div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">MaxMaster Skills</h1>
            <p className="text-slate-500 mt-2 font-medium">Zaloguj się do platformy</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-600 text-sm animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={20} className="shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 mb-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">ADRES EMAIL</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                <input 
                  type="email" 
                  required
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-bold text-slate-700"
                  placeholder="twoj@email.pl"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">HASŁO</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                <input 
                  type="password" 
                  required
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-bold text-slate-700"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>

            <Button type="submit" fullWidth disabled={isLoading} className="h-14 text-base font-black uppercase tracking-widest shadow-xl shadow-blue-600/20 rounded-xl">
              {isLoading ? 'Logowanie...' : 'Zaloguj się'}
            </Button>
          </form>

          <div className="text-center mt-4">
            <Link to="/forgot-password" className="text-xs text-blue-600 hover:text-blue-700 hover:underline font-bold uppercase tracking-tighter">
              Zapomniałeś hasła?
            </Link>
          </div>
          
          <div className="pt-6 text-center border-t border-slate-100 mt-6">
              <Link to="/candidate/welcome" className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors">
                  <ExternalLink size={14} className="mr-2"/> Strona powitalna dla kandydatów
              </Link>
          </div>
        </div>
      </div>
      
      <p className="mt-8 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
        MaxMaster Sp. z o.o. &bull; SYSTEM SKILLS 2.0
      </p>
    </div>
  );
};
