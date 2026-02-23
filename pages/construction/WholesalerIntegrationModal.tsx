import React, { useState } from 'react';
import { X, Loader2, Check, AlertCircle, Store, Zap, LogIn, LogOut, ChevronRight, Smartphone, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { WholesalerIntegration } from '../../types';

// Branże (industry categories)
const BRANZE = [
  { id: 'elektryczne', name: 'Instalacje elektryczne' },
  { id: 'sanitarne', name: 'Instalacje sanitarne' },
  { id: 'klimatyzacyjne', name: 'Instalacje klimatyzacyjne' },
];

// Wholesalers per branża
const WHOLESALERS: Record<string, { id: string; name: string; logo?: string; color: string; description: string }[]> = {
  elektryczne: [
    { id: 'tim', name: 'TIM S.A.', logo: '/logos/tim.png', color: '#b5421a', description: 'Hurtownia elektryczna TIM.pl - największy dystrybutor materiałów elektrycznych w Polsce' },
    { id: 'oninen', name: 'Onninen', logo: '/logos/onninen.svg', color: '#003DA5', description: 'Hurtownia elektryczna i przemysłowa Onninen.pl - szeroki asortyment materiałów instalacyjnych' },
    { id: 'speckable', name: 'Speckable', logo: '/logos/speckable.png', color: '#1a73e8', description: 'Hurtownia elektryczna Speckable.pl - materiały i osprzęt elektryczny' },
  ],
  sanitarne: [],
  klimatyzacyjne: [],
};

// Map wholesaler ID to edge function name
function getProxyName(wholesalerId: string): string {
  switch (wholesalerId) {
    case 'tim': return 'tim-proxy';
    case 'oninen': return 'oninen-proxy';
    case 'speckable': return 'speckable-proxy';
    default: return 'tim-proxy';
  }
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  integrations: WholesalerIntegration[];
  onIntegrationChange: () => void;
}

export const WholesalerIntegrationModal: React.FC<Props> = ({
  isOpen,
  onClose,
  companyId,
  integrations,
  onIntegrationChange,
}) => {
  const [selectedBranza, setSelectedBranza] = useState(BRANZE[0].id);
  const [authModal, setAuthModal] = useState<{ wholesalerId: string; wholesalerName: string } | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  // 2FA state
  const [needs2fa, setNeeds2fa] = useState(false);
  const [tempId, setTempId] = useState('');
  const [code2fa, setCode2fa] = useState('');
  const [twoFaMessage, setTwoFaMessage] = useState('');
  const [resending2fa, setResending2fa] = useState(false);

  if (!isOpen) return null;

  const getIntegration = (wholesalerId: string) =>
    integrations.find(i => i.wholesaler_id === wholesalerId && i.is_active);

  const resetAuthState = () => {
    setUsername('');
    setPassword('');
    setAuthError('');
    setAuthSuccess('');
    setNeeds2fa(false);
    setTempId('');
    setCode2fa('');
    setTwoFaMessage('');
  };

  const handleConnect = async (wholesalerId: string, wholesalerName: string) => {
    setAuthModal({ wholesalerId, wholesalerName });
    resetAuthState();
  };

  const handleDisconnect = async (wholesalerId: string) => {
    setDisconnecting(wholesalerId);
    try {
      const integration = integrations.find(i => i.wholesaler_id === wholesalerId);
      if (integration) {
        const proxyName = getProxyName(wholesalerId);
        await supabase.functions.invoke(proxyName, {
          body: { action: 'logout', integrationId: integration.id },
        });
      }
      onIntegrationChange();
    } catch (err) {
      console.error('Disconnect error:', err);
    } finally {
      setDisconnecting(null);
    }
  };

  const handleAuth = async () => {
    if (!authModal || !username || !password) return;
    setAuthLoading(true);
    setAuthError('');
    setAuthSuccess('');

    try {
      const existing = integrations.find(i => i.wholesaler_id === authModal.wholesalerId);
      const proxyName = getProxyName(authModal.wholesalerId);

      const { data, error } = await supabase.functions.invoke(proxyName, {
        body: {
          action: 'login',
          username,
          password,
          companyId,
          wholesalerId: authModal.wholesalerId,
          wholesalerName: authModal.wholesalerName,
          branza: selectedBranza,
          existingIntegrationId: existing?.id,
        },
      });

      if (error) {
        setAuthError(error.message || 'Błąd połączenia z serwerem');
        setAuthLoading(false);
        return;
      }

      // Handle 2FA requirement
      if (data?.needs2fa) {
        setNeeds2fa(true);
        setTempId(data.tempId);
        setTwoFaMessage(data.message || 'Kod SMS został wysłany');
        setAuthLoading(false);
        return;
      }

      if (!data?.success) {
        setAuthError(data?.error || 'Błąd logowania. Sprawdź dane dostępowe.');
        setAuthLoading(false);
        return;
      }

      setAuthSuccess(`Połączono z ${authModal.wholesalerName} jako ${data.username || username}`);
      onIntegrationChange();

      setTimeout(() => {
        setAuthModal(null);
        resetAuthState();
      }, 1500);
    } catch (err: any) {
      setAuthError(err.message || 'Błąd połączenia');
    } finally {
      setAuthLoading(false);
    }
  };

  const handle2faSubmit = async () => {
    if (!authModal || !code2fa || !tempId) return;
    setAuthLoading(true);
    setAuthError('');

    try {
      const existing = integrations.find(i => i.wholesaler_id === authModal.wholesalerId);
      const proxyName = getProxyName(authModal.wholesalerId);

      const { data, error } = await supabase.functions.invoke(proxyName, {
        body: {
          action: 'login2fa',
          tempId,
          code2fa,
          companyId,
          wholesalerId: authModal.wholesalerId,
          wholesalerName: authModal.wholesalerName,
          branza: selectedBranza,
          existingIntegrationId: existing?.id,
        },
      });

      if (error) {
        setAuthError(error.message || 'Błąd weryfikacji kodu');
        setAuthLoading(false);
        return;
      }

      // Still needs 2FA (wrong code)
      if (data?.needs2fa) {
        setAuthError(data.message || 'Nieprawidłowy kod. Spróbuj ponownie.');
        setCode2fa('');
        setAuthLoading(false);
        return;
      }

      if (!data?.success) {
        setAuthError(data?.error || 'Błąd weryfikacji. Spróbuj ponownie.');
        setAuthLoading(false);
        return;
      }

      setAuthSuccess(`Połączono z ${authModal.wholesalerName} jako ${data.username || username}`);
      onIntegrationChange();

      setTimeout(() => {
        setAuthModal(null);
        resetAuthState();
      }, 1500);
    } catch (err: any) {
      setAuthError(err.message || 'Błąd weryfikacji');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResend2fa = async () => {
    if (!authModal || !tempId) return;
    setResending2fa(true);

    try {
      const proxyName = getProxyName(authModal.wholesalerId);
      const { data } = await supabase.functions.invoke(proxyName, {
        body: { action: 'resend2fa', tempId },
      });
      setTwoFaMessage(data?.message || 'Kod SMS wysłany ponownie');
    } catch (err: any) {
      setAuthError(err.message || 'Nie udało się wysłać kodu ponownie');
    } finally {
      setResending2fa(false);
    }
  };

  const wholesalers = WHOLESALERS[selectedBranza] || [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-slate-500 bg-opacity-75" onClick={onClose} />
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle max-w-3xl w-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <Store className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-slate-900">Integracje z hurtowniami</h3>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-500">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex" style={{ minHeight: 400 }}>
            {/* Left: Branże list */}
            <div className="w-56 border-r border-slate-200 bg-slate-50">
              <div className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Branże
              </div>
              {BRANZE.map(b => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBranza(b.id)}
                  className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between transition-colors ${
                    selectedBranza === b.id
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-500'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>{b.name}</span>
                  <ChevronRight className="w-4 h-4 opacity-40" />
                </button>
              ))}
            </div>

            {/* Right: Wholesaler tiles */}
            <div className="flex-1 p-6">
              <h4 className="text-sm font-semibold text-slate-700 mb-4">
                Dostępne hurtownie — {BRANZE.find(b => b.id === selectedBranza)?.name}
              </h4>

              {wholesalers.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Store className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Brak dostępnych integracji dla tej branży</p>
                  <p className="text-xs mt-1">Wkrótce dodamy nowe hurtownie</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {wholesalers.map(w => {
                    const integration = getIntegration(w.id);
                    const isConnected = !!integration;
                    const isDisconnecting = disconnecting === w.id;

                    return (
                      <div
                        key={w.id}
                        className={`border rounded-lg p-4 transition-all ${
                          isConnected
                            ? 'border-green-200 bg-green-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            {w.logo ? (
                              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-white border border-slate-200 p-1.5 flex-shrink-0">
                                <img src={w.logo} alt={w.name} className="max-w-full max-h-full object-contain" />
                              </div>
                            ) : (
                              <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                                style={{ backgroundColor: w.color }}
                              >
                                {w.name.substring(0, 3).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-slate-900">{w.name}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{w.description}</div>
                            </div>
                          </div>

                          {isConnected ? (
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-1 text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                                <Check className="w-3 h-3" />
                                Połączono
                              </span>
                              <button
                                onClick={() => handleDisconnect(w.id)}
                                disabled={isDisconnecting}
                                className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                              >
                                {isDisconnecting ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <LogOut className="w-3 h-3" />
                                )}
                                Rozłącz
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleConnect(w.id, w.name)}
                              className="flex items-center gap-1.5 text-sm font-medium text-white px-3 py-1.5 rounded-lg transition-colors"
                              style={{ backgroundColor: w.color }}
                            >
                              <Zap className="w-3.5 h-3.5" />
                              Połącz
                            </button>
                          )}
                        </div>

                        {isConnected && integration.credentials?.username && (
                          <div className="mt-2 text-xs text-slate-500 pl-13">
                            Zalogowano jako: <span className="font-medium text-slate-700">{integration.credentials.username}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Auth sub-modal */}
      {authModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="fixed inset-0 bg-black bg-opacity-30" onClick={() => !authLoading && (setAuthModal(null), resetAuthState())} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                {needs2fa ? (
                  <Smartphone className="w-4 h-4 text-blue-600" />
                ) : (
                  <LogIn className="w-4 h-4 text-blue-600" />
                )}
                <h4 className="font-semibold text-slate-900">
                  {needs2fa ? 'Weryfikacja SMS' : 'Logowanie'} — {authModal.wholesalerName}
                </h4>
              </div>
              <button
                onClick={() => { if (!authLoading) { setAuthModal(null); resetAuthState(); } }}
                className="text-slate-400 hover:text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {!needs2fa ? (
                /* Standard login form */
                <>
                  <p className="text-xs text-slate-500">
                    Podaj dane logowania do konta w {authModal.wholesalerName}. Dane zostaną bezpiecznie zapisane.
                  </p>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Login / Email</label>
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="twoj@email.pl"
                      disabled={authLoading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Hasło</label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="********"
                      disabled={authLoading}
                      onKeyDown={e => e.key === 'Enter' && handleAuth()}
                    />
                  </div>
                </>
              ) : (
                /* 2FA SMS code form */
                <>
                  <div className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 p-3 rounded-lg">
                    <Smartphone className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{twoFaMessage}</span>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Kod SMS</label>
                    <input
                      type="text"
                      value={code2fa}
                      onChange={e => setCode2fa(e.target.value.replace(/\D/g, '').slice(0, 8))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-center tracking-widest font-mono text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="------"
                      disabled={authLoading}
                      onKeyDown={e => e.key === 'Enter' && handle2faSubmit()}
                      autoFocus
                    />
                  </div>

                  <button
                    onClick={handleResend2fa}
                    disabled={resending2fa || authLoading}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${resending2fa ? 'animate-spin' : ''}`} />
                    Wyślij kod ponownie
                  </button>
                </>
              )}

              {authError && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              {authSuccess && (
                <div className="flex items-start gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
                  <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{authSuccess}</span>
                </div>
              )}

              {!needs2fa ? (
                <button
                  onClick={handleAuth}
                  disabled={authLoading || !username || !password}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {authLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Logowanie...
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      Zaloguj się
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handle2faSubmit}
                  disabled={authLoading || !code2fa}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {authLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Weryfikacja...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Potwierdź kod
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
