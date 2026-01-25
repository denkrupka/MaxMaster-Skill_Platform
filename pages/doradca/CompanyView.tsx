import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Users, Clock, Search,
  User, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp,
  Mail, Phone, Calendar, Building2, Monitor, CreditCard, X
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { UserStatus, User as UserType, Role } from '../../types';
import { Button } from '../../components/Button';

export const DoradcaCompanyView: React.FC = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const { state, setSimulatedRole } = useAppContext();
  const { companies, users } = state;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // Modal states
  const [showCabinetModal, setShowCabinetModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<UserType | null>(null);

  // Get current company
  const company = companies.find(c => c.id === companyId);

  // Get company users
  const companyUsers = useMemo(() => {
    return (users || []).filter(u => u.company_id === companyId);
  }, [users, companyId]);

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
  const handleOpenCabinet = (employee: UserType) => {
    setSelectedEmployee(employee);
    // Simulate as employee to view their cabinet
    // This will redirect to employee dashboard in simulation mode
    setSimulatedRole(Role.EMPLOYEE);
    // Close modal and navigate to employee view
    window.location.hash = `/dashboard`;
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
              <h3 className="font-bold text-lg">Zarządzanie kabinetem</h3>
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
              <h3 className="font-bold text-lg">Podpisка</h3>
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

      {/* Cabinet Management Modal */}
      {showCabinetModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCabinetModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Monitor className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Zarządzanie kabinetem</h2>
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
                      onClick={() => handleOpenCabinet(emp)}
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
                  <h2 className="text-lg font-bold text-slate-900">Subskrypcja - {company.name}</h2>
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
                       company.subscription_status === 'cancelled' ? 'Anulowana' : 'Nieznany'}
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
                    <span className="text-slate-600">Stripe Customer ID:</span>
                    <span className="font-mono text-sm text-slate-500">
                      {company.stripe_customer_id || 'Brak'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment History Placeholder */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">Historia płatności</h3>
                <div className="bg-slate-50 rounded-xl p-8 border border-slate-100 text-center">
                  <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Historia płatności zostanie pobrana z Stripe API</p>
                  <p className="text-sm text-slate-400 mt-1">Integracja w trakcie implementacji</p>
                </div>
              </div>

              {/* Invoices Placeholder */}
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase mb-3">Faktury</h3>
                <div className="bg-slate-50 rounded-xl p-8 border border-slate-100 text-center">
                  <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Lista faktur zostanie pobrana z Stripe API</p>
                  <p className="text-sm text-slate-400 mt-1">Integracja w trakcie implementacji</p>
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
