
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export const SetupPasswordPage = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [userName, setUserName] = useState('');
  const [validToken, setValidToken] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkToken = async () => {
      // W HashRouter adres może wyglądać tak: domain.com/#/setup-password#access_token=...
      // Musimy rozbić hash na części
      const fullHash = window.location.hash;
      const hashParts = fullHash.split('#');

      // Szukamy części zawierającej parametry auth
      const authParamsString = hashParts.find(p => p.includes('access_token='));
      const hashParams = new URLSearchParams(authParamsString);

      let accessToken = hashParams.get('access_token');
      let refreshToken = hashParams.get('refresh_token');

      // Rezerwowo sprawdź query params
      if (!accessToken) {
        const queryParams = new URLSearchParams(window.location.search);
        accessToken = queryParams.get('access_token');
        refreshToken = queryParams.get('refresh_token');
      }

      if (!accessToken) {
        // Jeśli nie znaleźliśmy tokena, sprawdźmy czy sesja już nie została ustawiona automatycznie
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setValidToken(true);
          setUserName(`${session.user.user_metadata?.first_name || ''} ${session.user.user_metadata?.last_name || ''}`);
          return;
        }
      }

      if (!accessToken) {
        setError('Nieprawidłowy lub wygasły link aktywacyjny. Skontaktuj się z działem HR.');
        return;
      }

      try {
        // IMPORTANT: Set the session first so Supabase client knows about the user
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || ''
        });

        if (sessionError || !sessionData.session) {
          setError('Nie udało się zweryfikować Twojej tożsamości. Link mógł wygasnąć.');
          return;
        }

        setValidToken(true);
        setUserName(`${sessionData.session.user.user_metadata?.first_name || ''} ${sessionData.session.user.user_metadata?.last_name || ''}`);
      } catch (err) {
        setError('Wystąpił nieoczekiwany błąd podczas weryfikacji konta.');
      }
    };

    checkToken();
  }, []);

  const validatePassword = (pwd: string) => {
    const errors = [];
    if (pwd.length < 8) errors.push('minimum 8 znaków');
    if (!/[A-Z]/.test(pwd)) errors.push('jedną wielką literę');
    if (!/[a-z]/.test(pwd)) errors.push('jedną małą literę');
    if (!/[0-9]/.test(pwd)) errors.push('jedną cyfrę');
    
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      setError(`Hasło musi zawierać: ${passwordErrors.join(', ')}`);
      return;
    }

    if (password !== confirmPassword) {
      setError('Hasła nie są identyczne');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;

      setSuccess(true);

      // Check user's role to determine redirect
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      let redirectPath = '/login';
      if (userId) {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', userId)
          .maybeSingle();

        if (userData?.role === 'candidate') {
          redirectPath = '/candidate/dashboard';
        }
      }

      setTimeout(() => {
        navigate(redirectPath);
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Błąd podczas ustawiania hasła');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center animate-in fade-in zoom-in duration-500 border border-slate-100">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-3">
            Hasło ustawione! 🎉
          </h2>
          <p className="text-slate-600 mb-6">
            Twoje konto zostało aktywowane. Możesz teraz korzystać z platformy MaxMaster Skills.
          </p>
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <p className="text-sm text-blue-800 font-bold">
              Przekierowanie za 3 sekundy...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!validToken && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-slate-100">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Weryfikacja linku aktywacyjnego...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full border border-slate-100">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Lock size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-1">
            MaxMaster Skills
          </h1>
          <h2 className="text-lg font-bold text-slate-800 mb-1">
            Witaj{userName && `, ${userName}`}!
          </h2>
          <p className="text-sm text-slate-500">
            Utwórz hasło, aby aktywować swoje konto w systemie.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-start gap-3">
            <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
            <span className="text-xs font-bold">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Nowe hasło</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-300" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition bg-slate-50 focus:bg-white font-bold text-slate-800"
                placeholder="Minimum 8 znaków"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {password && (
              <div className="mt-3 space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className={`text-[10px] font-black uppercase flex items-center gap-2 ${password.length >= 8 ? 'text-green-600' : 'text-slate-400'}`}>
                  {password.length >= 8 ? '✓' : '○'} Minimum 8 znaków
                </div>
                <div className={`text-[10px] font-black uppercase flex items-center gap-2 ${/[A-Z]/.test(password) ? 'text-green-600' : 'text-slate-400'}`}>
                  {/[A-Z]/.test(password) ? '✓' : '○'} Wielka litera
                </div>
                <div className={`text-[10px] font-black uppercase flex items-center gap-2 ${/[a-z]/.test(password) ? 'text-green-600' : 'text-slate-400'}`}>
                  {/[a-z]/.test(password) ? '✓' : '○'} Mała litera
                </div>
                <div className={`text-[10px] font-black uppercase flex items-center gap-2 ${/[0-9]/.test(password) ? 'text-green-600' : 'text-slate-400'}`}>
                  {/[0-9]/.test(password) ? '✓' : '○'} Jedna cyfra
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Potwierdź hasło</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-300" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition bg-slate-50 focus:bg-white font-bold text-slate-800"
                placeholder="Powtórz hasło"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmPassword && (
              <div className={`mt-2 text-[10px] font-black uppercase ${password === confirmPassword ? 'text-green-600' : 'text-red-600'}`}>
                {password === confirmPassword ? '✓ Hasła są identyczne' : '○ Hasła różnią się'}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !validToken}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-600/20 transform active:scale-95"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={20} className="animate-spin" />
                Ustawianie...
              </span>
            ) : (
              'Aktywuj konto'
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100">
          <p className="text-center text-xs text-slate-400 font-bold uppercase tracking-wider">
            Potrzebujesz pomocy?{' '}
            <a href="mailto:hr@maxmaster.pl" className="text-blue-600 hover:underline">
              Kontakt z HR
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
