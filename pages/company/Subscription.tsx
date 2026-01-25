
import React, { useState, useMemo } from 'react';
import { Package, CreditCard, FileText, Users, Plus, Minus, Check, AlertCircle, Download, Clock } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { UserStatus } from '../../types';
import { MODULE_LABELS, MODULE_DESCRIPTIONS, SUBSCRIPTION_STATUS_LABELS, SUBSCRIPTION_STATUS_COLORS } from '../../constants';

export const CompanySubscriptionPage: React.FC = () => {
  const { state } = useAppContext();
  const { currentCompany, users, companyModules, modules, moduleUserAccess } = state;

  const [activeTab, setActiveTab] = useState<'modules' | 'usage' | 'history'>('modules');

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

  // Mock payment history
  const paymentHistory = [
    { id: '1', date: '2024-01-01', amount: 790, status: 'paid', invoice: 'FV/2024/01/001' },
    { id: '2', date: '2023-12-01', amount: 790, status: 'paid', invoice: 'FV/2023/12/001' },
    { id: '3', date: '2023-11-01', amount: 632, status: 'paid', invoice: 'FV/2023/11/001' },
  ];

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
      <div className="flex gap-2 mb-6 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('modules')}
          className={`px-4 py-3 font-medium transition border-b-2 -mb-px ${
            activeTab === 'modules'
              ? 'text-blue-600 border-blue-600'
              : 'text-slate-500 border-transparent hover:text-slate-700'
          }`}
        >
          <Package className="w-4 h-4 inline mr-2" />
          Moduły
        </button>
        <button
          onClick={() => setActiveTab('usage')}
          className={`px-4 py-3 font-medium transition border-b-2 -mb-px ${
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
          className={`px-4 py-3 font-medium transition border-b-2 -mb-px ${
            activeTab === 'history'
              ? 'text-blue-600 border-blue-600'
              : 'text-slate-500 border-transparent hover:text-slate-700'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          Historia płatności
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
                            <button className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50" disabled>
                              <Minus className="w-4 h-4 text-slate-400" />
                            </button>
                            <span className="w-12 text-center font-medium">{companyMod.max_users}</span>
                            <button className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50" disabled>
                              <Plus className="w-4 h-4 text-slate-400" />
                            </button>
                          </div>
                        </div>
                      )}

                      {!isActive && (
                        <button
                          disabled
                          className="px-4 py-2 bg-slate-100 text-slate-500 rounded-lg cursor-not-allowed"
                        >
                          Aktywuj moduł
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-blue-800">Zmiana planu</p>
              <p className="text-sm text-blue-600 mt-1">
                Aby zmienić liczbę użytkowników lub aktywować nowe moduły, skontaktuj się z działem sprzedaży
                lub poczekaj na integrację Stripe.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Usage Tab */}
      {activeTab === 'usage' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Wykorzystanie modułów</h3>
            <p className="text-sm text-slate-500 mt-1">Przegląd użytkowników przypisanych do modułów</p>
          </div>

          {myModules.filter(m => m.is_active).length > 0 ? (
            <div className="divide-y divide-slate-100">
              {myModules.filter(m => m.is_active).map(cm => (
                <div key={cm.id} className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <Package className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-slate-900">{cm.module?.name_pl || MODULE_LABELS[cm.module_code]}</h4>
                        <p className="text-sm text-slate-500">{cm.activeUsers} z {cm.max_users} miejsc zajętych</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">{(cm.max_users * cm.price_per_user).toFixed(2)} PLN</p>
                      <p className="text-xs text-slate-500">/ miesiąc</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${Math.min((cm.activeUsers / cm.max_users) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    {cm.max_users - cm.activeUsers} wolnych miejsc
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Brak aktywnych modułów</p>
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
                        {new Date(payment.date).toLocaleDateString('pl-PL')}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600 font-mono">
                        {payment.invoice}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                        {payment.amount.toFixed(2)} PLN
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          payment.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {payment.status === 'paid' ? 'Opłacona' : 'Oczekująca'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm"
                          disabled
                        >
                          <Download className="w-4 h-4" />
                          Pobierz
                        </button>
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

      {/* Payment Method Section */}
      <div className="mt-6 bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Metoda płatności</h3>
        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
          <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-400 rounded flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-slate-900">Karta nie została dodana</p>
            <p className="text-sm text-slate-500">Dodaj kartę, aby aktywować automatyczne płatności</p>
          </div>
          <button
            disabled
            className="px-4 py-2 bg-slate-200 text-slate-500 rounded-lg cursor-not-allowed"
          >
            Dodaj kartę
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Integracja ze Stripe zostanie dodana w kolejnej wersji.
        </p>
      </div>
    </div>
  );
};
