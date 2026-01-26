import React, { useState, useMemo } from 'react';
import {
  Package, CreditCard, FileText, Users, Plus, Minus, Check, AlertCircle,
  Download, Clock, ExternalLink, Loader2, Settings, Zap, Search, X,
  ToggleLeft, ToggleRight, UserPlus, Award, Receipt
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Role, UserStatus } from '../../types';
import { MODULE_LABELS, MODULE_DESCRIPTIONS, SUBSCRIPTION_STATUS_LABELS, SUBSCRIPTION_STATUS_COLORS } from '../../constants';
import {
  isStripeConfigured,
  getCardBrandName,
  formatCurrency
} from '../../lib/stripeService';
import { supabase } from '../../lib/supabase';

const MODULE_INFO: Record<string, { name: string; description: string; icon: React.ReactNode }> = {
  recruitment: {
    name: 'Rekrutacja',
    description: 'Zarządzanie kandydatami, procesem rekrutacji i dokumentami HR',
    icon: <UserPlus className="w-5 h-5" />
  },
  skills: {
    name: 'Umiejętności',
    description: 'Zarządzanie kompetencjami, szkoleniami i certyfikatami pracowników',
    icon: <Award className="w-5 h-5" />
  }
};

export const CompanySubscriptionPage: React.FC = () => {
  const { state, refreshData, grantModuleAccess, revokeModuleAccess } = useAppContext();
  const { currentCompany, users, companyModules, modules, moduleUserAccess, paymentHistory: allPaymentHistory } = state;

  const [activeTab, setActiveTab] = useState<'modules' | 'usage' | 'history' | 'invoices'>('modules');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Module access management state
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [accessSearch, setAccessSearch] = useState('');
  const [accessLoading, setAccessLoading] = useState<string | null>(null);

  // Invoices state
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  // Stripe configuration state
  const stripeEnabled = isStripeConfigured();

  // Get company users
  const companyUsers = useMemo(() => {
    if (!currentCompany) return [];
    return users.filter(u => u.company_id === currentCompany.id);
  }, [users, currentCompany]);

  // Get company modules with details
  const myModules = useMemo(() => {
    if (!currentCompany) return [];
    return companyModules
      .filter(cm => cm.company_id === currentCompany.id)
      .map(cm => {
        const mod = modules.find(m => m.code === cm.module_code);
        const usersInModule = moduleUserAccess.filter(
          mua => mua.company_id === currentCompany.id && mua.module_code === cm.module_code && mua.is_enabled
        ).length;
        return {
          ...cm,
          module: mod,
          activeUsers: usersInModule
        };
      });
  }, [companyModules, modules, moduleUserAccess, currentCompany]);

  // Calculate totals
  const totals = useMemo(() => {
    const monthly = myModules.reduce((sum, m) => {
      if (m.is_active) {
        return sum + (m.max_users * m.price_per_user);
      }
      return sum;
    }, 0);

    return {
      monthlyTotal: monthly,
      bonusBalance: currentCompany?.bonus_balance || 0,
      nextPayment: monthly - (currentCompany?.bonus_balance || 0)
    };
  }, [myModules, currentCompany]);

  // Get payment history for current company
  const paymentHistory = useMemo(() => {
    if (!currentCompany) return [];
    return allPaymentHistory.filter(ph => ph.company_id === currentCompany.id);
  }, [allPaymentHistory, currentCompany]);

  // Get active module codes for usage tab
  const activeModuleCodes = useMemo(() => {
    return myModules.filter(m => m.is_active).map(m => m.module_code);
  }, [myModules]);

  // Get company users (excluding global users and admins) for access management
  const accessibleUsers = useMemo(() => {
    if (!currentCompany) return [];
    return users.filter(u =>
      u.company_id === currentCompany.id &&
      !u.is_global_user &&
      u.role !== Role.COMPANY_ADMIN &&
      u.status !== UserStatus.INACTIVE
    );
  }, [users, currentCompany]);

  // Filter users by search
  const filteredAccessUsers = useMemo(() => {
    return accessibleUsers.filter(u =>
      u.first_name.toLowerCase().includes(accessSearch.toLowerCase()) ||
      u.last_name.toLowerCase().includes(accessSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(accessSearch.toLowerCase())
    );
  }, [accessibleUsers, accessSearch]);

  // Check if user has access to a module
  const hasModuleAccess = (userId: string, moduleCode: string): boolean => {
    return moduleUserAccess.some(
      mua => mua.user_id === userId && mua.module_code === moduleCode && mua.is_enabled
    );
  };

  // Get users with/without access to selected module
  const usersWithAccess = useMemo(() => {
    if (!selectedModule) return [];
    return filteredAccessUsers.filter(u => hasModuleAccess(u.id, selectedModule));
  }, [filteredAccessUsers, selectedModule, moduleUserAccess]);

  const usersWithoutAccess = useMemo(() => {
    if (!selectedModule) return [];
    return filteredAccessUsers.filter(u => !hasModuleAccess(u.id, selectedModule));
  }, [filteredAccessUsers, selectedModule, moduleUserAccess]);

  // Toggle user access
  const toggleAccess = async (userId: string, moduleCode: string, currentAccess: boolean) => {
    setAccessLoading(userId);
    setError(null);
    try {
      if (currentAccess) {
        await revokeModuleAccess(userId, moduleCode);
      } else {
        await grantModuleAccess(userId, moduleCode);
      }
    } catch (err) {
      console.error('Error toggling access:', err);
      setError(err instanceof Error ? err.message : 'Wystąpił błąd podczas zmiany dostępu');
    } finally {
      setAccessLoading(null);
    }
  };

  // Fetch invoices from Stripe
  const fetchInvoices = async () => {
    if (!currentCompany?.stripe_customer_id) return;

    setInvoicesLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          action: 'list-invoices',
          customerId: currentCompany.stripe_customer_id
        }
      });

      if (fnError) throw fnError;
      setInvoices(data?.invoices || []);
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setInvoicesLoading(false);
    }
  };

  // Fetch invoices when tab changes to invoices
  React.useEffect(() => {
    if (activeTab === 'invoices' && currentCompany?.stripe_customer_id) {
      fetchInvoices();
    }
  }, [activeTab, currentCompany?.stripe_customer_id]);

  // Handle Stripe checkout for module activation
  const handleActivateModule = async (moduleCode: string, maxUsers: number = 10) => {
    if (!currentCompany) return;

    setLoading(moduleCode);
    setError(null);

    try {
      // Call Edge Function to create Stripe Checkout session
      const { data, error: fnError } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          action: 'create-checkout-session',
          companyId: currentCompany.id,
          moduleCode,
          quantity: maxUsers,
          successUrl: `${window.location.origin}/#/company/subscription?success=true&module=${moduleCode}`,
          cancelUrl: `${window.location.origin}/#/company/subscription?canceled=true`
        }
      });

      if (fnError) throw fnError;

      if (data?.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err instanceof Error ? err.message : 'Wystąpił błąd podczas tworzenia sesji płatności');
    } finally {
      setLoading(null);
    }
  };

  // Handle opening Stripe Customer Portal
  const handleOpenPortal = async () => {
    if (!currentCompany?.stripe_customer_id) {
      setError('Brak konta Stripe. Najpierw aktywuj moduł.');
      return;
    }

    setLoading('portal');
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          action: 'create-portal-session',
          customerId: currentCompany.stripe_customer_id,
          returnUrl: `${window.location.origin}/#/company/subscription`
        }
      });

      if (fnError) throw fnError;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Portal error:', err);
      setError(err instanceof Error ? err.message : 'Nie udało się otworzyć panelu zarządzania');
    } finally {
      setLoading(null);
    }
  };

  // Handle changing user count for a module
  const handleChangeSeats = async (moduleCode: string, delta: number) => {
    const companyMod = myModules.find(cm => cm.module_code === moduleCode);
    if (!companyMod || !currentCompany) return;

    const newCount = Math.max(1, companyMod.max_users + delta);
    if (newCount === companyMod.max_users) return;

    setLoading(moduleCode);
    setError(null);

    try {
      // Update via Edge Function (which handles Stripe subscription update)
      const { data, error: fnError } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          action: 'update-subscription',
          companyId: currentCompany.id,
          moduleCode,
          quantity: newCount
        }
      });

      if (fnError) throw fnError;

      setSuccess(`Liczba miejsc zmieniona na ${newCount}`);
      await refreshData();

      // Clear success after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Update seats error:', err);
      setError(err instanceof Error ? err.message : 'Nie udało się zmienić liczby miejsc');
    } finally {
      setLoading(null);
    }
  };

  // Check URL params for success/cancel
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    if (urlParams.get('success') === 'true') {
      setSuccess('Płatność zakończona pomyślnie! Moduł został aktywowany.');
      refreshData();
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname + '#/company/subscription');
    }
    if (urlParams.get('canceled') === 'true') {
      setError('Płatność została anulowana.');
      window.history.replaceState({}, '', window.location.pathname + '#/company/subscription');
    }
  }, []);

  if (!currentCompany) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
          <p className="text-yellow-800">Brak przypisanej firmy</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Subskrypcja</h1>
        <p className="text-slate-500 mt-1">Zarządzaj modułami i płatnościami</p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
          <Check className="w-5 h-5 text-green-600" />
          <p className="text-green-800">{success}</p>
          <button onClick={() => setSuccess(null)} className="ml-auto text-green-600 hover:text-green-800">
            &times;
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
            &times;
          </button>
        </div>
      )}

      {/* Status Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <CreditCard className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Status subskrypcji</p>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border mt-1 ${
                SUBSCRIPTION_STATUS_COLORS[currentCompany.subscription_status] || 'bg-slate-100 text-slate-800'
              }`}>
                {SUBSCRIPTION_STATUS_LABELS[currentCompany.subscription_status] || currentCompany.subscription_status}
              </span>
            </div>
          </div>

          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-sm text-slate-500">Miesięcznie</p>
              <p className="text-2xl font-bold text-slate-900">{totals.monthlyTotal.toFixed(2)} PLN</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-500">Balans bonusowy</p>
              <p className="text-2xl font-bold text-green-600">{totals.bonusBalance.toFixed(2)} PLN</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('modules')}
          className={`px-4 py-3 font-medium transition border-b-2 -mb-px whitespace-nowrap ${
            activeTab === 'modules'
              ? 'text-blue-600 border-blue-600'
              : 'text-slate-500 border-transparent hover:text-slate-700'
          }`}
        >
          <Package className="w-4 h-4 inline mr-2" />
          Moduły
        </button>
        <button
          onClick={() => { setActiveTab('usage'); setSelectedModule(null); }}
          className={`px-4 py-3 font-medium transition border-b-2 -mb-px whitespace-nowrap ${
            activeTab === 'usage'
              ? 'text-blue-600 border-blue-600'
              : 'text-slate-500 border-transparent hover:text-slate-700'
          }`}
        >
          <Users className="w-4 h-4 inline mr-2" />
          Wykorzystanie
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-3 font-medium transition border-b-2 -mb-px whitespace-nowrap ${
            activeTab === 'history'
              ? 'text-blue-600 border-blue-600'
              : 'text-slate-500 border-transparent hover:text-slate-700'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          Historia płatności
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-4 py-3 font-medium transition border-b-2 -mb-px whitespace-nowrap ${
            activeTab === 'invoices'
              ? 'text-blue-600 border-blue-600'
              : 'text-slate-500 border-transparent hover:text-slate-700'
          }`}
        >
          <Receipt className="w-4 h-4 inline mr-2" />
          Faktury
        </button>
      </div>

      {/* Modules Tab */}
      {activeTab === 'modules' && (
        <div className="space-y-4">
          {/* Available Modules */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Dostępne moduły</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {modules.filter(m => m.is_active).map(mod => {
                const companyMod = myModules.find(cm => cm.module_code === mod.code);
                const isActive = companyMod?.is_active;
                const isLoading = loading === mod.code;

                return (
                  <div key={mod.code} className="p-5">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          isActive ? 'bg-green-100' : 'bg-slate-100'
                        }`}>
                          <Package className={`w-6 h-6 ${isActive ? 'text-green-600' : 'text-slate-400'}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-slate-900">{mod.name_pl}</h4>
                            {isActive && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                Aktywny
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 mt-1">{mod.description_pl || MODULE_DESCRIPTIONS[mod.code]}</p>
                          <p className="text-sm font-medium text-blue-600 mt-2">{mod.base_price_per_user} PLN / użytkownik / miesiąc</p>
                        </div>
                      </div>

                      {isActive && companyMod && (
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <p className="text-sm text-slate-500">Użytkowników</p>
                            <p className="text-lg font-bold text-slate-900">
                              {companyMod.activeUsers} / {companyMod.max_users}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                              disabled={isLoading || companyMod.max_users <= 1}
                              onClick={() => handleChangeSeats(mod.code, -1)}
                            >
                              <Minus className="w-4 h-4 text-slate-600" />
                            </button>
                            <span className="w-12 text-center font-medium">
                              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : companyMod.max_users}
                            </span>
                            <button
                              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                              disabled={isLoading}
                              onClick={() => handleChangeSeats(mod.code, 1)}
                            >
                              <Plus className="w-4 h-4 text-slate-600" />
                            </button>
                          </div>
                        </div>
                      )}

                      {!isActive && (
                        <button
                          onClick={() => handleActivateModule(mod.code)}
                          disabled={isLoading || !stripeEnabled}
                          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition ${
                            stripeEnabled
                              ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                              : 'bg-slate-100 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Zap className="w-4 h-4" />
                          )}
                          Aktywuj moduł
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* Usage Tab */}
      {activeTab === 'usage' && (
        <div className="space-y-6">
          {/* Active Modules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myModules.filter(m => m.is_active).map(cm => {
              const moduleInfo = MODULE_INFO[cm.module_code];
              const isSelected = selectedModule === cm.module_code;

              return (
                <div
                  key={cm.id}
                  onClick={() => setSelectedModule(isSelected ? null : cm.module_code)}
                  className={`bg-white border rounded-xl p-4 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-100'
                      : 'border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-100 text-blue-600">
                      {moduleInfo?.icon || <Package className="w-5 h-5" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{cm.module?.name_pl || MODULE_LABELS[cm.module_code]}</h3>
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-600 rounded-full">Aktywny</span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">{moduleInfo?.description || ''}</p>
                      <p className="text-sm text-blue-600 mt-2">
                        <Users className="w-4 h-4 inline mr-1" />
                        {cm.activeUsers} / {cm.max_users} użytkowników
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {myModules.filter(m => m.is_active).length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Brak aktywnych modułów</p>
            </div>
          )}

          {/* User Access Management */}
          {selectedModule && (
            <div className="bg-white border border-slate-200 rounded-xl">
              <div className="p-4 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                      {MODULE_INFO[selectedModule]?.icon || <Package className="w-4 h-4" />}
                    </div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Dostęp do: {MODULE_INFO[selectedModule]?.name || MODULE_LABELS[selectedModule]}
                    </h2>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Szukaj użytkownika..."
                      value={accessSearch}
                      onChange={(e) => setAccessSearch(e.target.value)}
                      className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg w-full sm:w-64 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Users with Access */}
              <div className="p-4 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  Z dostępem ({usersWithAccess.length})
                </h3>
                {usersWithAccess.length > 0 ? (
                  <div className="space-y-2">
                    {usersWithAccess.map(user => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 bg-green-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <span className="text-green-700 font-medium text-sm">
                              {user.first_name.charAt(0)}{user.last_name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{user.first_name} {user.last_name}</p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleAccess(user.id, selectedModule, true)}
                          disabled={accessLoading === user.id}
                          className="flex items-center gap-2 px-3 py-1.5 text-red-600 hover:bg-red-100 rounded-lg transition disabled:opacity-50"
                        >
                          {accessLoading === user.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <ToggleRight className="w-5 h-5" />
                          )}
                          <span className="text-sm hidden sm:inline">Usuń dostęp</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 py-2">Brak użytkowników z dostępem</p>
                )}
              </div>

              {/* Users without Access */}
              <div className="p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <X className="w-4 h-4 text-slate-400" />
                  Bez dostępu ({usersWithoutAccess.length})
                </h3>
                {usersWithoutAccess.length > 0 ? (
                  <div className="space-y-2">
                    {usersWithoutAccess.map(user => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                            <span className="text-slate-600 font-medium text-sm">
                              {user.first_name.charAt(0)}{user.last_name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{user.first_name} {user.last_name}</p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleAccess(user.id, selectedModule, false)}
                          disabled={accessLoading === user.id}
                          className="flex items-center gap-2 px-3 py-1.5 text-green-600 hover:bg-green-100 rounded-lg transition disabled:opacity-50"
                        >
                          {accessLoading === user.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <ToggleLeft className="w-5 h-5" />
                          )}
                          <span className="text-sm hidden sm:inline">Nadaj dostęp</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 py-2">Wszyscy użytkownicy mają dostęp</p>
                )}
              </div>
            </div>
          )}

          {/* Info Banner when no module selected */}
          {!selectedModule && myModules.filter(m => m.is_active).length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-blue-900 font-medium">Wybierz moduł</p>
                <p className="text-blue-700 text-sm">
                  Kliknij na moduł powyżej, aby zarządzać dostępem użytkowników.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Historia płatności</h3>
          </div>

          {paymentHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Data</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Faktura</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Kwota</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paymentHistory.map(payment => (
                    <tr key={payment.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4 text-sm text-slate-900">
                        {payment.paid_at
                          ? new Date(payment.paid_at).toLocaleDateString('pl-PL')
                          : new Date(payment.created_at).toLocaleDateString('pl-PL')}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600 font-mono">
                        {payment.invoice_number || '-'}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                        {Number(payment.amount).toFixed(2)} {payment.currency || 'PLN'}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          payment.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : payment.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : payment.status === 'refunded'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {payment.status === 'paid' ? 'Opłacona'
                            : payment.status === 'failed' ? 'Niepowodzenie'
                            : payment.status === 'refunded' ? 'Zwrócona'
                            : 'Oczekująca'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {payment.invoice_pdf_url ? (
                          <a
                            href={payment.invoice_pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm"
                          >
                            <Download className="w-4 h-4" />
                            Pobierz
                          </a>
                        ) : (
                          <span className="text-slate-400 text-sm">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Brak historii płatności</p>
            </div>
          )}
        </div>
      )}

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Faktury ze Stripe</h3>
            <button
              onClick={fetchInvoices}
              disabled={invoicesLoading}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              {invoicesLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4" />
              )}
              Odśwież
            </button>
          </div>

          {!currentCompany.stripe_customer_id ? (
            <div className="text-center py-12">
              <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Brak konta Stripe</p>
              <p className="text-sm text-slate-400 mt-1">Aktywuj moduł, aby zobaczyć faktury</p>
            </div>
          ) : invoicesLoading ? (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-blue-500 mx-auto mb-3 animate-spin" />
              <p className="text-slate-500">Pobieranie faktur...</p>
            </div>
          ) : invoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Data</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Numer</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Kwota</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Pobierz</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((invoice: any) => (
                    <tr key={invoice.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4 text-sm text-slate-900">
                        {invoice.created ? new Date(invoice.created * 1000).toLocaleDateString('pl-PL') : '-'}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600 font-mono">
                        {invoice.number || '-'}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                        {(invoice.amount_due / 100).toFixed(2)} {invoice.currency?.toUpperCase() || 'PLN'}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          invoice.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : invoice.status === 'open'
                            ? 'bg-yellow-100 text-yellow-800'
                            : invoice.status === 'void'
                            ? 'bg-slate-100 text-slate-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {invoice.status === 'paid' ? 'Opłacona'
                            : invoice.status === 'open' ? 'Otwarta'
                            : invoice.status === 'void' ? 'Anulowana'
                            : invoice.status === 'draft' ? 'Szkic'
                            : invoice.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {invoice.invoice_pdf ? (
                          <a
                            href={invoice.invoice_pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm"
                          >
                            <Download className="w-4 h-4" />
                            PDF
                          </a>
                        ) : (
                          <span className="text-slate-400 text-sm">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Brak faktur</p>
            </div>
          )}
        </div>
      )}

      {/* Payment Method Section */}
      <div className="mt-6 bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Zarządzanie płatnościami</h3>
          {currentCompany.stripe_customer_id && (
            <button
              onClick={handleOpenPortal}
              disabled={loading === 'portal'}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              {loading === 'portal' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Settings className="w-4 h-4" />
              )}
              Panel Stripe
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
          <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-400 rounded flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            {currentCompany.stripe_customer_id ? (
              <>
                <p className="font-medium text-slate-900">Konto Stripe aktywne</p>
                <p className="text-sm text-slate-500">Zarządzaj metodami płatności i subskrypcjami w panelu Stripe</p>
              </>
            ) : (
              <>
                <p className="font-medium text-slate-900">Karta nie została dodana</p>
                <p className="text-sm text-slate-500">Aktywuj moduł, aby utworzyć konto płatności</p>
              </>
            )}
          </div>
          {!currentCompany.stripe_customer_id && stripeEnabled && (
            <button
              onClick={() => {
                const firstInactiveModule = modules.find(m => m.is_active && !myModules.find(cm => cm.module_code === m.code && cm.is_active));
                if (firstInactiveModule) {
                  handleActivateModule(firstInactiveModule.code);
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Rozpocznij
            </button>
          )}
        </div>

        {stripeEnabled && (
          <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
            <Check className="w-3 h-3 text-green-500" />
            Bezpieczne płatności obsługiwane przez Stripe
          </p>
        )}
      </div>
    </div>
  );
};
