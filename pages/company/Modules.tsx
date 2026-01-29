import React, { useState, useMemo } from 'react';
import {
  Layers, Users, UserPlus, Award, Search, Check, X,
  ToggleLeft, ToggleRight, Info, Shield, Loader2
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Role, UserStatus } from '../../types';
import { ROLE_LABELS } from '../../constants';

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

export const CompanyModulesPage: React.FC = () => {
  const { state, grantModuleAccess, revokeModuleAccess } = useAppContext();
  const { currentCompany, users, companyModules, moduleUserAccess } = state;

  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null); // tracks which user is being toggled
  const [error, setError] = useState<string | null>(null);

  // Get company's active modules
  const activeModules = useMemo(() => {
    if (!currentCompany) return [];
    return companyModules
      .filter(cm => cm.company_id === currentCompany.id && cm.is_active)
      .map(cm => cm.module_code);
  }, [companyModules, currentCompany]);

  // Get company users (excluding global users, including admin)
  const companyUsers = useMemo(() => {
    if (!currentCompany) return [];
    return users.filter(u =>
      u.company_id === currentCompany.id &&
      !u.is_global_user &&
      u.status !== UserStatus.INACTIVE
    );
  }, [users, currentCompany]);

  // Filter users by search
  const filteredUsers = useMemo(() => {
    return companyUsers.filter(u =>
      u.first_name.toLowerCase().includes(search.toLowerCase()) ||
      u.last_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
    );
  }, [companyUsers, search]);

  // Check if user has access to a module
  const hasModuleAccess = (userId: string, moduleCode: string): boolean => {
    return moduleUserAccess.some(
      mua => mua.user_id === userId && mua.module_code === moduleCode && mua.is_enabled
    );
  };

  // Get users with access to selected module
  const usersWithAccess = useMemo(() => {
    if (!selectedModule) return [];
    return filteredUsers.filter(u => hasModuleAccess(u.id, selectedModule));
  }, [filteredUsers, selectedModule, moduleUserAccess]);

  // Get users without access to selected module
  const usersWithoutAccess = useMemo(() => {
    if (!selectedModule) return [];
    return filteredUsers.filter(u => !hasModuleAccess(u.id, selectedModule));
  }, [filteredUsers, selectedModule, moduleUserAccess]);

  // Toggle user access
  const toggleAccess = async (userId: string, moduleCode: string, currentAccess: boolean) => {
    setLoading(userId);
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
      setLoading(null);
    }
  };

  if (!currentCompany) {
    return (
      <div className="p-6 text-center">
        <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">Brak aktywnej firmy</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Moduły i dostępy</h1>
        <p className="text-slate-500 mt-1">
          Zarządzaj dostępem użytkowników do modułów systemu
        </p>
      </div>

      {/* Active Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {Object.entries(MODULE_INFO).map(([moduleCode, info]) => {
          const isActive = activeModules.includes(moduleCode);
          const usersCount = companyUsers.filter(u => hasModuleAccess(u.id, moduleCode)).length;
          const isSelected = selectedModule === moduleCode;

          return (
            <div
              key={moduleCode}
              onClick={() => isActive && setSelectedModule(isSelected ? null : moduleCode)}
              className={`bg-white border rounded-xl p-4 transition-all ${
                isActive
                  ? isSelected
                    ? 'border-blue-500 ring-2 ring-blue-100 cursor-pointer'
                    : 'border-slate-200 hover:border-blue-300 cursor-pointer'
                  : 'border-slate-200 opacity-50'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  isActive ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  {info.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{info.name}</h3>
                    {isActive ? (
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-600 rounded-full">Aktywny</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">Nieaktywny</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{info.description}</p>
                  {isActive && (
                    <p className="text-sm text-blue-600 mt-2">
                      <Users className="w-4 h-4 inline mr-1" />
                      {usersCount} użytkowników z dostępem
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Banner */}
      {!selectedModule && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-900 font-medium">Wybierz moduł</p>
            <p className="text-blue-700 text-sm">
              Kliknij na aktywny moduł powyżej, aby zarządzać dostępem użytkowników.
            </p>
          </div>
        </div>
      )}

      {/* User Access Management */}
      {selectedModule && (
        <div className="bg-white border border-slate-200 rounded-xl">
          <div className="p-4 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                  {MODULE_INFO[selectedModule].icon}
                </div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Dostęp do: {MODULE_INFO[selectedModule].name}
                </h2>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Szukaj użytkownika..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
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
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900">{user.first_name} {user.last_name}</p>
                          {user.role === Role.COMPANY_ADMIN && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-semibold">Admin</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleAccess(user.id, selectedModule, true)}
                      disabled={loading === user.id}
                      className="flex items-center gap-2 px-3 py-1.5 text-red-600 hover:bg-red-100 rounded-lg transition disabled:opacity-50"
                    >
                      {loading === user.id ? (
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
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900">{user.first_name} {user.last_name}</p>
                          {user.role === Role.COMPANY_ADMIN && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-semibold">Admin</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleAccess(user.id, selectedModule, false)}
                      disabled={loading === user.id}
                      className="flex items-center gap-2 px-3 py-1.5 text-green-600 hover:bg-green-100 rounded-lg transition disabled:opacity-50"
                    >
                      {loading === user.id ? (
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

          {/* Error message */}
          {error && (
            <div className="p-4 border-t border-slate-100">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            </div>
          )}
        </div>
      )}

      {/* No Active Modules Warning */}
      {activeModules.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-900 font-medium">Brak aktywnych modułów</p>
            <p className="text-amber-700 text-sm">
              Twoja firma nie ma jeszcze aktywnych modułów. Skontaktuj się z działem sprzedaży, aby aktywować moduły.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
