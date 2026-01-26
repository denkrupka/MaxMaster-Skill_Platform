
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Users, Package, CreditCard, Settings, ArrowRight, AlertCircle } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { UserStatus } from '../../types';
import { MODULE_LABELS, SUBSCRIPTION_STATUS_LABELS, SUBSCRIPTION_STATUS_COLORS } from '../../constants';

export const CompanyDashboard: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser, currentCompany, users, companyModules, modules } = state;

  // Get company users
  const companyUsers = useMemo(() => {
    if (!currentCompany) return [];
    return users.filter(u => u.company_id === currentCompany.id);
  }, [users, currentCompany]);

  // Stats
  const stats = useMemo(() => {
    const activeUsers = companyUsers.filter(u => u.status === UserStatus.ACTIVE).length;
    const trialUsers = companyUsers.filter(u => u.status === UserStatus.TRIAL).length;
    const activeModules = companyModules.filter(cm => cm.company_id === currentCompany?.id && cm.is_active).length;

    return {
      totalUsers: companyUsers.length,
      activeUsers,
      trialUsers,
      activeModules
    };
  }, [companyUsers, companyModules, currentCompany]);

  // Company modules
  const myModules = useMemo(() => {
    if (!currentCompany) return [];
    return companyModules
      .filter(cm => cm.company_id === currentCompany.id)
      .map(cm => ({
        ...cm,
        module: modules.find(m => m.code === cm.module_code)
      }));
  }, [companyModules, modules, currentCompany]);

  if (!currentCompany) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-yellow-800 mb-2">Brak przypisanej firmy</h2>
          <p className="text-yellow-600">Skontaktuj się z administratorem platformy.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Panel Administratora</h1>
        <p className="text-slate-500 mt-1">{currentCompany.name}</p>
      </div>

      {/* Company Status Alert */}
      {currentCompany.subscription_status === 'past_due' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-800">Zaległa płatność</p>
            <p className="text-sm text-red-600">Prosimy o uregulowanie płatności, aby uniknąć zawieszenia konta.</p>
          </div>
          <Link to="/company/subscription" className="ml-auto px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
            Opłać teraz
          </Link>
        </div>
      )}


      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm text-slate-500">Użytkownicy</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{stats.totalUsers}</p>
          <p className="text-xs text-slate-500 mt-1">{stats.activeUsers} aktywnych</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm text-slate-500">Moduły</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{stats.activeModules}</p>
          <p className="text-xs text-slate-500 mt-1">aktywnych</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm text-slate-500">Balans bonusów</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{currentCompany.bonus_balance?.toFixed(0) || 0}</p>
          <p className="text-xs text-slate-500 mt-1">PLN</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Link to="/company/users" className="bg-white rounded-xl p-5 border border-slate-200 hover:border-blue-300 hover:shadow-md transition group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Użytkownicy</h3>
                <p className="text-sm text-slate-500">Zarządzaj zespołem</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition" />
          </div>
        </Link>

        <Link to="/company/subscription" className="bg-white rounded-xl p-5 border border-slate-200 hover:border-green-300 hover:shadow-md transition group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-200 transition">
                <Package className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Subskrypcja</h3>
                <p className="text-sm text-slate-500">Moduły i płatności</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-green-600 transition" />
          </div>
        </Link>

        <Link to="/company/settings" className="bg-white rounded-xl p-5 border border-slate-200 hover:border-purple-300 hover:shadow-md transition group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-200 transition">
                <Settings className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Ustawienia</h3>
                <p className="text-sm text-slate-500">Dane firmy</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-purple-600 transition" />
          </div>
        </Link>
      </div>

      {/* Active Modules */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Aktywne moduły</h2>
          <Link to="/company/subscription" className="text-sm text-blue-600 hover:text-blue-700">
            Zarządzaj modułami
          </Link>
        </div>

        {myModules.length > 0 ? (
          <div className="space-y-3">
            {myModules.map(cm => (
              <div key={cm.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    cm.is_active ? 'bg-green-100' : 'bg-slate-200'
                  }`}>
                    <Package className={`w-5 h-5 ${cm.is_active ? 'text-green-600' : 'text-slate-400'}`} />
                  </div>
                  <p className="font-medium text-slate-900">{cm.module?.name_pl || MODULE_LABELS[cm.module_code] || cm.module_code}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900">{cm.current_users} / {cm.max_users}</p>
                  <p className="text-xs text-slate-500">użytkowników</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Brak aktywnych modułów</p>
            <Link to="/company/subscription" className="mt-3 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700">
              Aktywuj moduły <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
