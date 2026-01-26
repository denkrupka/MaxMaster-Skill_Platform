import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Users, Clock, Search,
  User, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp,
  Mail, Phone, Calendar, Building2, Monitor, CreditCard, X, Package,
  FileText, Receipt, ArrowRight
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { UserStatus, User as UserType, Role } from '../../types';
import { Button } from '../../components/Button';
import { ROLE_LABELS } from '../../constants';

export const DoradcaCompanyView: React.FC = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const { state, loginAsUser } = useAppContext();
  const { companies, users, companyModules, modules } = state;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // Modal states
  const [showCabinetModal, setShowCabinetModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<UserType | null>(null);
  const [showUserCabinet, setShowUserCabinet] = useState(false);

  // Get current company
  const company = companies.find(c => c.id === companyId);

  // Get company users
  const companyUsers = useMemo(() => {
    return (users || []).filter(u => u.company_id === companyId);
  }, [users, companyId]);

  // Get company modules/subscriptions
  const companySubscriptions = useMemo(() => {
    return (companyModules || [])
      .filter(cm => cm.company_id === companyId && cm.is_active)
      .map(cm => {
        const module = (modules || []).find(m => m.code === cm.module_code);
        return { ...cm, module };
      });
  }, [companyModules, modules, companyId]);

  // Filter users
  const filteredUsers = useMemo(() => {
    return companyUsers.filter(user => {
      const matchesSearch =
        user.first_name.toLowerCase().includes(search.toLowerCase()) ||
        user.last_name.toLowerCase().includes(search.toLowerCase()) ||
        user.email?.toLowerCase().includes(search.toLowerCase()) ||
        user.target_position?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [companyUsers, search, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const active = companyUsers.filter(u => u.status === UserStatus.ACTIVE).length;
    const trial = companyUsers.filter(u => u.status === UserStatus.TRIAL).length;
    const pending = companyUsers.filter(u => u.status === UserStatus.PENDING).length;
    return { total: companyUsers.length, active, trial, pending };
  }, [companyUsers]);

  const getStatusIcon = (status: UserStatus) => {
    switch (status) {
      case UserStatus.ACTIVE: return <CheckCircle className="w-4 h-4 text-green-500" />;
      case UserStatus.TRIAL: return <Clock className="w-4 h-4 text-amber-500" />;
      case UserStatus.PENDING: return <AlertTriangle className="w-4 h-4 text-blue-500" />;
      case UserStatus.INACTIVE: return <XCircle className="w-4 h-4 text-slate-400" />;
      default: return null;
    }
  };

  // Handle opening cabinet for selected employee
  const handleSelectEmployee = (employee: UserType) => {
    setSelectedEmployee(employee);
    setShowCabinetModal(false);
    setShowUserCabinet(true);
  };

  // Handle viewing as user - open in new window with user context
  const handleViewAsUser = () => {
    if (selectedEmployee) {
      // Store the selected user in sessionStorage for the new window to pick up
      sessionStorage.setItem('doradca_view_user', JSON.stringify(selectedEmployee));
      // Open the dashboard in a new window
      const newWindow = window.open(`/#/dashboard?viewAs=${selectedEmployee.id}`, '_blank', 'noopener');
      if (newWindow) {
        // Also trigger login as user to switch context
        loginAsUser(selectedEmployee);
      }
    }
  };

  if (!company) {
    return (
      <div className="p-6 text-center">
        <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">Firma nie została znaleziona</p>
        <Link to="/doradca/dashboard" className="text-blue-600 hover:underline mt-2 inline-block">
          Wróć do panelu
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/doradca/dashboard"
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">
            {company.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{company.name}</h1>
            <p className="text-slate-500">{company.industry || 'Brak branży'}</p>
          </div>
        </div>
      </div>

      {/* Action Tile-Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <button
          onClick={() => setShowCabinetModal(true)}
          className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl p-6 hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center group-hover:bg-white/30 transition-colors">
              <Monitor className="w-6 h-6" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-lg">Zarządzanie kontem użytkownika</h3>
              <p className="text-sm text-blue-100">Podgląd panelu pracownika</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => setShowSubscriptionModal(true)}
          className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl p-6 hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg hover:shadow-xl group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center group-hover:bg-white/30 transition-colors">
              <CreditCard className="w-6 h-6" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-lg">Subskrypcja</h3>
              <p className="text-sm text-emerald-100">Zarządzanie subskrypcją firmy</p>
            </div>
          </div>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-xs text-slate-500">Łącznie</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.active}</p>
              <p className="text-xs text-slate-500">Aktywnych</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.trial}</p>
              <p className="text-xs text-slate-500">Okres próbny</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
              <p className="text-xs text-slate-500">Kandydaci</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl mb-6">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Szukaj pracownika..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg w-full focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as UserStatus | 'all')}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Wszystkie statusy</option>
            <option value={UserStatus.ACTIVE}>Aktywni</option>
            <option value={UserStatus.TRIAL}>Okres próbny</option>
            <option value={UserStatus.PENDING}>Kandydaci</option>
            <option value={UserStatus.INACTIVE}>Nieaktywni</option>
          </select>
        </div>

        {/* Users List */}
        {filteredUsers.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredUsers.map(user => {
              const isExpanded = expandedUser === user.id;

              return (
                <div key={user.id} className="transition-colors">
                  <div
                    onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                    className="flex items-center justify-between p-4 hover:bg-slate-50 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900">
                            {user.first_name} {user.last_name}
                          </p>
                          {getStatusIcon(user.status)}
                        </div>
                        <p className="text-sm text-slate-500">
                          {user.target_position || 'Brak stanowiska'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-slate-50 border-t border-slate-100">
                      <div className="py-4">
                        {/* Contact Info */}
                        <div>
                          <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Kontakt</h4>
                          <div className="space-y-2">
                            {user.email && (
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Mail className="w-4 h-4" />
                                <span>{user.email}</span>
                              </div>
                            )}
                            {user.phone && (
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Phone className="w-4 h-4" />
                                <span>{user.phone}</span>
                              </div>
                            )}
                            {user.hired_date && (
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Calendar className="w-4 h-4" />
                                <span>Od: {new Date(user.hired_date).toLocaleDateString('pl-PL')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">
              {companyUsers.length === 0 ? 'Brak pracowników w tej firmie' : 'Brak pracowników spełniających kryteria'}
            </p>
          </div>
        )}
      </div>

      {/* Cabinet Management Modal - Employee Selection */}
      {showCabinetModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCabinetModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Monitor className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Zarządzanie kontem użytkownika</h2>
                  <p className="text-sm text-slate-500">Wybierz pracownika do podglądu</p>
                </div>
              </div>
              <button onClick={() => setShowCabinetModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {companyUsers.length > 0 ? (
                <div className="space-y-2">
                  {companyUsers.map(emp => (
                    <button
                      key={emp.id}
                      onClick={() => handleSelectEmployee(emp)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 border border-slate-100 text-left transition-colors"
                    >
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-slate-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{emp.first_name} {emp.last_name}</p>
                        <p className="text-sm text-slate-500">{emp.target_position || 'Brak stanowiska'}</p>
                      </div>
                      {getStatusIcon(emp.status)}
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-center text-slate-500 py-8">Brak pracowników w tej firmie</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Cabinet View Modal */}
      {showUserCabinet && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowUserCabinet(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-gradient-to-r from-blue-500 to-indigo-600">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                  <User className="w-7 h-7 text-white" />
                </div>
                <div className="text-white">
                  <h2 className="text-xl font-bold">{selectedEmployee.first_name} {selectedEmployee.last_name}</h2>
                  <p className="text-blue-100">{selectedEmployee.target_position || 'Brak stanowiska'} • {ROLE_LABELS[selectedEmployee.role] || selectedEmployee.role}</p>
                </div>
              </div>
              <button onClick={() => setShowUserCabinet(false)} className="text-white/80 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              {/* User Info Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Contact Info */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">Dane kontaktowe</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-700">{selectedEmployee.email || 'Brak email'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-700">{selectedEmployee.phone || 'Brak telefonu'}</span>
                    </div>
                  </div>
                </div>

                {/* Status Info */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">Status</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Status:</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        selectedEmployee.status === UserStatus.ACTIVE ? 'bg-green-100 text-green-700' :
                        selectedEmployee.status === UserStatus.TRIAL ? 'bg-amber-100 text-amber-700' :
                        selectedEmployee.status === UserStatus.PENDING ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {selectedEmployee.status === UserStatus.ACTIVE ? 'Aktywny' :
                         selectedEmployee.status === UserStatus.TRIAL ? 'Okres próbny' :
                         selectedEmployee.status === UserStatus.PENDING ? 'Kandydat' : 'Nieaktywny'}
                      </span>
                    </div>
                    {selectedEmployee.hired_date && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Data zatrudnienia:</span>
                        <span className="font-medium text-slate-900">
                          {new Date(selectedEmployee.hired_date).toLocaleDateString('pl-PL')}
                        </span>
                      </div>
                    )}
                    {selectedEmployee.contract_end_date && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Koniec umowy:</span>
                        <span className="font-medium text-slate-900">
                          {new Date(selectedEmployee.contract_end_date).toLocaleDateString('pl-PL')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Additional Details */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">Szczegóły konta</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Rola:</span>
                    <span className="font-medium text-slate-900">{ROLE_LABELS[selectedEmployee.role] || selectedEmployee.role}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">ID użytkownika:</span>
                    <span className="font-mono text-sm text-slate-500">{selectedEmployee.id.slice(0, 8)}...</span>
                  </div>
                  {selectedEmployee.created_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Konto utworzone:</span>
                      <span className="font-medium text-slate-900">
                        {new Date(selectedEmployee.created_at).toLocaleDateString('pl-PL')}
                      </span>
                    </div>
                  )}
                  {selectedEmployee.source && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Źródło:</span>
                      <span className="font-medium text-slate-900">{selectedEmployee.source}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action to view as user */}
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-blue-900">Zaloguj jako użytkownik</h3>
                    <p className="text-sm text-blue-600">Pełny dostęp do panelu pracownika</p>
                  </div>
                  <Button onClick={handleViewAsUser} className="bg-blue-600 hover:bg-blue-700">
                    <Monitor className="w-4 h-4 mr-2" />
                    Otwórz panel
                  </Button>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
              <Button variant="secondary" onClick={() => {
                setShowUserCabinet(false);
                setShowCabinetModal(true);
              }} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Wybierz innego
              </Button>
              <Button onClick={() => setShowUserCabinet(false)} className="flex-1">
                Zamknij
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Modal */}
      {showSubscriptionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowSubscriptionModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Subskrypcja</h2>
                  <p className="text-sm text-slate-500">Informacje o płatnościach i fakturach</p>
                </div>
              </div>
              <button onClick={() => setShowSubscriptionModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Subscription Status */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">Status subskrypcji</h3>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-slate-600">Status:</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      company.subscription_status === 'active' ? 'bg-green-100 text-green-700' :
                      company.subscription_status === 'trialing' ? 'bg-amber-100 text-amber-700' :
                      company.subscription_status === 'past_due' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {company.subscription_status === 'active' ? 'Aktywna' :
                       company.subscription_status === 'trialing' ? 'Okres próbny' :
                       company.subscription_status === 'past_due' ? 'Zaległa płatność' :
                       company.subscription_status === 'cancelled' ? 'Anulowana' : 'Brak subskrypcji'}
                    </span>
                  </div>
                  {company.trial_ends_at && (
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-slate-600">Koniec okresu próbnego:</span>
                      <span className="font-medium text-slate-900">
                        {new Date(company.trial_ends_at).toLocaleDateString('pl-PL')}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Liczba aktywnych produktów:</span>
                    <span className="font-bold text-slate-900">{companySubscriptions.length}</span>
                  </div>
                </div>
              </div>

              {/* Subscription Products */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">Produkty subskrypcji</h3>
                {companySubscriptions.length > 0 ? (
                  <div className="space-y-3">
                    {companySubscriptions.map(sub => (
                      <div key={sub.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Package className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-slate-900">{sub.module?.name_pl || sub.module_code}</h4>
                              <p className="text-sm text-slate-500">{sub.module?.description_pl || 'Moduł platformy'}</p>
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            sub.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {sub.is_active ? 'Aktywny' : 'Nieaktywny'}
                          </span>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-slate-500">Użytkownicy:</span>
                            <span className="ml-2 font-medium text-slate-900">{sub.current_users} / {sub.max_users}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Cena/użytkownik:</span>
                            <span className="ml-2 font-medium text-slate-900">{sub.price_per_user} PLN/{sub.billing_cycle === 'monthly' ? 'mies.' : 'rok'}</span>
                          </div>
                          {sub.activated_at && (
                            <div>
                              <span className="text-slate-500">Aktywowany:</span>
                              <span className="ml-2 font-medium text-slate-900">{new Date(sub.activated_at).toLocaleDateString('pl-PL')}</span>
                            </div>
                          )}
                          {sub.stripe_subscription_id && (
                            <div>
                              <span className="text-slate-500">Stripe ID:</span>
                              <span className="ml-2 font-mono text-xs text-slate-500">{sub.stripe_subscription_id.slice(0, 12)}...</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-xl p-8 border border-slate-100 text-center">
                    <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">Brak aktywnych produktów subskrypcji</p>
                  </div>
                )}
              </div>

              {/* Payment History */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">Historia płatności</h3>
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100 text-center">
                  <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">Historia płatności zostanie pobrana z Stripe API</p>
                  {company.stripe_customer_id && (
                    <p className="text-xs text-slate-400 mt-1">Customer ID: {company.stripe_customer_id}</p>
                  )}
                </div>
              </div>

              {/* Invoices */}
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">Faktury</h3>
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100 text-center">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">Lista faktur zostanie pobrana z Stripe API</p>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50">
              <Button onClick={() => setShowSubscriptionModal(false)} className="w-full">
                Zamknij
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
