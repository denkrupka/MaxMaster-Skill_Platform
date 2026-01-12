
import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, AlertCircle, ExternalLink } from 'lucide-react';
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
      if (state.currentUser.role === Role.ADMIN) {
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
      await login(email, password);
    } catch (err: any) {
      console.error('Login error:', err);
      // Obsługa specyficznych komunikatów błędów z Supabase
      if (err.message === 'Invalid login credentials') {
        setError('Błędny adres e-mail lub hasło.');
      } else if (err.message === 'Email not confirmed') {
        setError('Adres e-mail nie został jeszcze potwierdzony.');
      } else {
        setError('Wystąpił błąd podczas logowania. Spróbuj ponownie.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">M</div>
          <h1 className="text-2xl font-bold text-slate-900">MaxMaster Skills</h1>
          <p className="text-slate-500 mt-2">Zaloguj się do platformy zarządzania</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-600 text-sm animate-in fade-in zoom-in">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 mb-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">ADRES EMAIL</label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="email" 
                required
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="twoj@email.pl"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">HASŁO</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="password" 
                required
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          <Button type="submit" fullWidth disabled={isLoading} className="h-12 text-base font-bold shadow-lg shadow-blue-600/20">
            {isLoading ? 'Logowanie...' : 'Zaloguj się'}
          </Button>
        </form>

        <div className="text-center mt-4">
          <Link to="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium">
            Zapomniałeś hasła?
          </Link>
        </div>
        
        <div className="pt-6 text-center border-t border-slate-50 mt-4">
            <Link to="/candidate/welcome" className="inline-flex items-center text-xs text-blue-500 hover:text-blue-700 hover:underline">
                <ExternalLink size={12} className="mr-1"/> Przejdź do strony powitalnej dla kandydatów
            </Link>
        </div>
      </div>
    </div>
  );
};
