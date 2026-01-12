
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Wykorzystanie Supabase do wysłania linku resetującego
      // redirectTo musi pasować do adresu ustawionego w Supabase Dashboard
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/#/reset-password',
      });

      if (resetError) throw resetError;
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Wystąpił błąd podczas wysyłania linku.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center animate-in fade-in zoom-in duration-300">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Link wysłany!</h2>
          <p className="text-slate-500 mb-8">
            Jeśli adres <strong>{email}</strong> znajduje się w naszej bazie, otrzymasz wiadomość z instrukcją resetowania hasła.
          </p>
          <Link to="/login" className="inline-flex items-center text-blue-600 font-bold hover:underline">
            <ArrowLeft size={18} className="mr-2" /> Wróć do logowania
          </Link>
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
          <h1 className="text-2xl font-bold text-slate-900">Resetowanie hasła</h1>
          <p className="text-slate-500 mt-2">Wpisz swój email, aby otrzymać link do zmiany hasła.</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-600 text-sm">
            <AlertCircle size={18} className="shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
              ADRES EMAIL
            </label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                placeholder="twoj@email.pl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <Button type="submit" fullWidth disabled={loading} className="h-12 text-base font-bold shadow-lg shadow-blue-600/20">
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" /> Wysyłanie...
              </span>
            ) : (
              'Wyślij link resetujący'
            )}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-50 text-center">
          <Link to="/login" className="text-sm text-slate-500 hover:text-blue-600 flex items-center justify-center gap-2 transition-colors">
            <ArrowLeft size={16} /> Wróć do logowania
          </Link>
        </div>
      </div>
    </div>
  );
};
