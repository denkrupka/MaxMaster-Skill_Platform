
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';

export const ResetPasswordPage = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  // Sprawdzenie czy użytkownik ma aktywną sesję resetowania (obsługiwane automatycznie przez Supabase po kliknięciu w link)
  useEffect(() => {
    const checkSession = async () => {
      console.log('[ResetPassword] Checking session');
      console.log('[ResetPassword] URL:', window.location.href);
      console.log('[ResetPassword] Hash:', window.location.hash);

      const { data: { session } } = await supabase.auth.getSession();
      console.log('[ResetPassword] Session:', session ? 'Found' : 'Not found');

      if (!session) {
        console.log('[ResetPassword] No session found - link may have expired');
        setError('Link resetowania hasła wygasł lub jest nieprawidłowy. Spróbuj ponownie.');
      } else {
        console.log('[ResetPassword] Session valid, user can reset password');
      }
    };
    checkSession();
  }, []);

  const validations = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
    match: password === confirmPassword && password.length > 0
  };

  const isFormValid = Object.values(validations).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[ResetPassword] Form submitted');
    console.log('[ResetPassword] Form valid:', isFormValid);

    if (!isFormValid) {
      console.log('[ResetPassword] Form validation failed');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('[ResetPassword] Attempting to update password');
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        console.error('[ResetPassword] Update error:', updateError);
        throw updateError;
      }

      console.log('[ResetPassword] Password updated successfully');
      setSuccess(true);
      // Przekierowanie do logowania po 2 sekundach
      setTimeout(() => {
        console.log('[ResetPassword] Redirecting to login');
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      console.error('[ResetPassword] Error:', err);
      setError(err.message || 'Wystąpił błąd podczas zmiany hasła.');
    } finally {
      setLoading(false);
    }
  };

  const ValidationItem = ({ label, met }: { label: string; met: boolean }) => (
    <div className={`flex items-center gap-2 text-xs font-bold transition-colors ${met ? 'text-green-600' : 'text-slate-400'}`}>
      <CheckCircle size={14} className={met ? 'text-green-500' : 'text-slate-200'} fill={met ? 'currentColor' : 'none'} />
      {label}
    </div>
  );

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center animate-in fade-in zoom-in duration-300">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Hasło zresetowane! 🎉</h2>
          <p className="text-slate-500">Twoje hasło zostało pomyślnie zaktualizowane. Zaraz zostaniesz przekierowany do strony logowania.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full border border-slate-100">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">
            M
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Ustaw nowe hasło</h1>
          <p className="text-slate-500 mt-2">Wprowadź nowe, bezpieczne hasło do swojego konta.</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-600 text-sm">
            <AlertCircle size={18} className="shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">NOWE HASŁO</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="w-full pl-10 pr-12 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold text-slate-800"
                placeholder="Min. 8 znaków"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">POTWIERDŹ HASŁO</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold text-slate-800"
                placeholder="Powtórz hasło"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-100">
            <ValidationItem label="Minimum 8 znaków" met={validations.length} />
            <ValidationItem label="Jedna wielka litera" met={validations.uppercase} />
            <ValidationItem label="Jedna mała litera" met={validations.lowercase} />
            <ValidationItem label="Jedna cyfra" met={validations.digit} />
            <ValidationItem label="Hasła są identyczne" met={validations.match} />
          </div>

          <Button 
            type="submit" 
            fullWidth 
            disabled={loading || !isFormValid} 
            className="h-12 text-base font-bold shadow-lg shadow-blue-600/20 mt-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" /> Zapisywanie...
              </span>
            ) : (
              'Zmień hasło'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};
