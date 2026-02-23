import React, { useState } from 'react';
import { X, Loader2, Check, AlertCircle, Truck, Zap, LogIn, LogOut, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { WholesalerIntegration } from '../../types';

// Kategorie sprzętu
const CATEGORIES = [
  { id: 'budowlany', name: 'Sprzęt budowlany' },
];

// Wypożyczalnie per category
const RENTALS: Record<string, {
  id: string;
  name: string;
  logo?: string;
  color: string;
  description: string;
  authRequired: boolean;
}[]> = {
  budowlany: [
    {
      id: 'atut-rental',
      name: 'Atut Rental',
      logo: 'https://www.atutrental.com.pl/wp-content/themes/atutrental2022/assets/img/header/logo.png',
      color: '#2563eb',
      description: 'AtutRental.com.pl — wynajem sprzętu budowlanego, maszyn i narzędzi',
      authRequired: false,
    },
    {
      id: 'ramirent',
      name: 'Ramirent',
      logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS3ww1KGpOdFTdurvfOWcU7yUFsKxs8Gxrh8A&s',
      color: '#2563eb',
      description: 'Ramirent.pl — profesjonalny wynajem maszyn i urządzeń budowlanych',
      authRequired: true,
    },
  ],
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  integrations: WholesalerIntegration[];
  onIntegrationChange: () => void;
}

export const RentalIntegrationModal: React.FC<Props> = ({
  isOpen,
  onClose,
  companyId,
  integrations,
  onIntegrationChange,
}) => {
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0].id);
  const [authModal, setAuthModal] = useState<{ rentalId: string; rentalName: string } | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [connectingNoAuth, setConnectingNoAuth] = useState<string | null>(null);

  if (!isOpen) return null;

  const getIntegration = (rentalId: string) =>
    integrations.find(i => i.wholesaler_id === rentalId && i.is_active);

  const resetAuthState = () => {
    setUsername('');
    setPassword('');
    setAuthError('');
    setAuthSuccess('');
  };

  // Connect without auth (Atut Rental)
  const handleConnectNoAuth = async (rentalId: string, rentalName: string) => {
    setConnectingNoAuth(rentalId);
    try {
      const existing = integrations.find(i => i.wholesaler_id === rentalId);

      if (existing) {
        // Re-activate
        await supabase
          .from('wholesaler_integrations')
          .update({ is_active: true, credentials: { last_refresh: new Date().toISOString() } })
          .eq('id', existing.id);
      } else {
        // Create new
        await supabase
          .from('wholesaler_integrations')
          .insert({
            company_id: companyId,
            wholesaler_id: rentalId,
            wholesaler_name: rentalName,
            branza: 'sprzet',
            credentials: { last_refresh: new Date().toISOString() },
            is_active: true,
          });
      }

      onIntegrationChange();
    } catch (err) {
      console.error('Connect error:', err);
    } finally {
      setConnectingNoAuth(null);
    }
  };

  // Connect with auth (Ramirent)
  const handleConnect = (rentalId: string, rentalName: string) => {
    setAuthModal({ rentalId, rentalName });
    resetAuthState();
  };

  const handleDisconnect = async (rentalId: string) => {
    setDisconnecting(rentalId);
    try {
      const integration = integrations.find(i => i.wholesaler_id === rentalId);
      if (integration) {
        await supabase
          .from('wholesaler_integrations')
          .delete()
          .eq('id', integration.id);
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
      const existing = integrations.find(i => i.wholesaler_id === authModal.rentalId);

      const credentialsData = {
        username,
        password,
        last_refresh: new Date().toISOString(),
      };

      if (existing) {
        await supabase
          .from('wholesaler_integrations')
          .update({ credentials: credentialsData, is_active: true })
          .eq('id', existing.id);
      } else {
        const { error: insertErr } = await supabase
          .from('wholesaler_integrations')
          .insert({
            company_id: companyId,
            wholesaler_id: authModal.rentalId,
            wholesaler_name: authModal.rentalName,
            branza: 'sprzet',
            credentials: credentialsData,
            is_active: true,
          });

        if (insertErr) throw new Error(insertErr.message);
      }

      setAuthSuccess(`Połączono z ${authModal.rentalName} jako ${username}`);
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

  const rentals = RENTALS[selectedCategory] || [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-slate-500 bg-opacity-75" onClick={onClose} />
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle max-w-3xl w-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <Truck className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-slate-900">Integracje z wypożyczalniami sprzętu</h3>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-500">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex" style={{ minHeight: 400 }}>
            {/* Left: Categories */}
            <div className="w-56 border-r border-slate-200 bg-slate-50">
              <div className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Kategorie
              </div>
              {CATEGORIES.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between transition-colors ${
                    selectedCategory === c.id
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-500'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>{c.name}</span>
                  <ChevronRight className="w-4 h-4 opacity-40" />
                </button>
              ))}
            </div>

            {/* Right: Rental tiles */}
            <div className="flex-1 p-6">
              <h4 className="text-sm font-semibold text-slate-700 mb-4">
                Dostępne wypożyczalnie — {CATEGORIES.find(c => c.id === selectedCategory)?.name}
              </h4>

              {rentals.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Truck className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Brak dostępnych integracji dla tej kategorii</p>
                  <p className="text-xs mt-1">Wkrótce dodamy nowe wypożyczalnie</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {rentals.map(r => {
                    const integration = getIntegration(r.id);
                    const isConnected = !!integration;
                    const isDisconnecting = disconnecting === r.id;
                    const isConnectingNA = connectingNoAuth === r.id;

                    return (
                      <div
                        key={r.id}
                        className={`border rounded-lg p-4 transition-all ${
                          isConnected
                            ? 'border-green-200 bg-green-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            {r.logo ? (
                              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-white border border-slate-200 p-1.5 flex-shrink-0">
                                <img src={r.logo} alt={r.name} className="max-w-full max-h-full object-contain" />
                              </div>
                            ) : (
                              <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                                style={{ backgroundColor: r.color }}
                              >
                                {r.name.substring(0, 3).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-slate-900">{r.name}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{r.description}</div>
                              {!r.authRequired && !isConnected && (
                                <div className="text-[10px] text-green-600 mt-1">Nie wymaga logowania</div>
                              )}
                            </div>
                          </div>

                          {isConnected ? (
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-1 text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                                <Check className="w-3 h-3" />
                                Połączono
                              </span>
                              <button
                                onClick={() => handleDisconnect(r.id)}
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
                          ) : r.authRequired ? (
                            <button
                              onClick={() => handleConnect(r.id, r.name)}
                              className="flex items-center gap-1.5 text-sm font-medium text-white px-3 py-1.5 rounded-lg transition-colors"
                              style={{ backgroundColor: r.color }}
                            >
                              <Zap className="w-3.5 h-3.5" />
                              Połącz
                            </button>
                          ) : (
                            <button
                              onClick={() => handleConnectNoAuth(r.id, r.name)}
                              disabled={isConnectingNA}
                              className="flex items-center gap-1.5 text-sm font-medium text-white px-3 py-1.5 rounded-lg transition-colors"
                              style={{ backgroundColor: r.color }}
                            >
                              {isConnectingNA ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Zap className="w-3.5 h-3.5" />
                              )}
                              Integruj
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

      {/* Auth sub-modal (for Ramirent etc.) */}
      {authModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="fixed inset-0 bg-black bg-opacity-30" onClick={() => !authLoading && (setAuthModal(null), resetAuthState())} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <LogIn className="w-4 h-4 text-blue-600" />
                <h4 className="font-semibold text-slate-900">
                  Logowanie — {authModal.rentalName}
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
              <p className="text-xs text-slate-500">
                Podaj dane logowania do konta w {authModal.rentalName}. Dane zostaną bezpiecznie zapisane.
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
